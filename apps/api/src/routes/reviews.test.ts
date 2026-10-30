import type {
  ApplicationDetailDto,
  ApplicationsResponse,
  ReviewBatchDto,
  ReviewBatchRowDto,
  ReviewPageDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
  job = await insertJob(t, { title: 'Nhân viên Kinh doanh B2B' });
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const boss = (method: string, path: string, body?: unknown) => t.send(method, `/api/review${path}`, body);

let n = 0;
async function insertApplication(overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên ${n}`,
      phone: `09130000${String(n).padStart(2, '0')}`,
      email: `uv${n}@mail.test`,
      consentAt: t.clock.now,
      policyVersion: '2026-10',
      ...overrides,
    })
    .returning();
  return row;
}

/** Two days after DEFAULT_NOW. */
const RESPOND_BY = '2026-10-22T10:00:00.000Z';

async function sendBatch(ids: string[], extra: Record<string, unknown> = {}) {
  const res = await hr('POST', '/reviews', {
    title: 'Duyệt ứng viên · Kinh doanh B2B',
    senderName: 'Ngọc Anh (Phòng Nhân sự)',
    reviewerName: 'anh Minh',
    message: 'Anh xem giúp em nhé.',
    respondBy: RESPOND_BY,
    items: ids.map((applicationId, i) => ({
      applicationId,
      hrPick: i === 0 ? 'yes' : 'maybe',
      hrComment: `Nhận xét ${i}`,
    })),
    ...extra,
  });
  return { res, body: res.status === 201 ? await json<ReviewBatchDto>(res) : null };
}

describe('HR sends applications to the reviewer', () => {
  it('should create a batch with a private link, HR wording and a log line', async () => {
    // Arrange
    const a = await insertApplication();
    const b = await insertApplication();

    // Act
    const { res, body } = await sendBatch([a.id, b.id]);

    // Assert
    expect(res.status).toBe(201);
    expect(body?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body).toMatchObject({
      title: 'Duyệt ứng viên · Kinh doanh B2B',
      senderName: 'Ngọc Anh (Phòng Nhân sự)',
      state: 'open',
      total: 2,
    });
    expect(body?.expiresAt).toBe('2026-10-27T10:00:00.000Z');
    expect(body?.items.map((i) => [i.fullName, i.hrPick, i.hrComment])).toEqual([
      [a.fullName, 'yes', 'Nhận xét 0'],
      [b.fullName, 'maybe', 'Nhận xét 1'],
    ]);
    expect(body?.events.map((e) => e.kind)).toEqual(['sent']);
  });

  it('should refuse a reply-by time in the past', async () => {
    const a = await insertApplication();
    const { res } = await sendBatch([a.id], { respondBy: '2026-10-19T10:00:00.000Z' });
    expect(res.status).toBe(422);
  });

  it('should refuse an application that already waits for a reviewer in another batch', async () => {
    // Arrange
    const a = await insertApplication();
    await sendBatch([a.id]);

    // Act
    const { res } = await sendBatch([a.id]);

    // Assert
    expect(res.status).toBe(409);
    expect((await json<{ error: string }>(res)).error).toContain(a.fullName);
  });

  it('should refuse applications already invited or already told they did not fit', async () => {
    const invited = await insertApplication({ status: 'interview' });
    const declined = await insertApplication({ status: 'rejected' });
    const { res } = await sendBatch([invited.id, declined.id]);
    expect(res.status).toBe(422);
    expect((await json<{ error: string }>(res)).error).toContain(invited.fullName);
  });

  it('should need an HR session', async () => {
    const res = await t.send('GET', '/api/hr/reviews');
    expect(res.status).toBe(401);
  });
});

describe('the reviewer link', () => {
  async function setup() {
    const a = await insertApplication({ message: 'Em rất muốn làm ở đây.', cvLink: 'https://drive.test/cv' });
    const b = await insertApplication();
    const { body } = await sendBatch([a.id, b.id]);
    if (!body) throw new Error('batch not created');
    return { a, b, batch: body, token: body.token };
  }

  it('should show the batch without phone numbers or emails, and tell HR it was opened', async () => {
    // Arrange
    const { a, batch, token } = await setup();

    // Act
    const res = await boss('GET', `/${token}`);
    const page = await json<ReviewPageDto>(res);

    // Assert
    expect(res.headers.get('x-robots-tag')).toContain('noindex');
    expect(page).toMatchObject({ reviewerName: 'anh Minh', state: 'open', message: 'Anh xem giúp em nhé.' });
    expect(page.items[0]).toMatchObject({
      fullName: a.fullName,
      message: 'Em rất muốn làm ở đây.',
      cv: 'link',
      hrPick: 'yes',
    });
    const text = JSON.stringify(page);
    expect(text).not.toContain(a.phone);
    expect(text).not.toContain('@mail.test');
    const after = await json<ReviewBatchDto>(await hr('GET', `/reviews/${batch.id}`));
    expect(after.openedAt).not.toBeNull();
    expect(after.events.map((e) => e.kind)).toContain('opened');
  });

  it('should answer 404 for an unknown link', async () => {
    expect((await boss('GET', '/khong-phai-link')).status).toBe(404);
    expect((await boss('GET', `/${'a'.repeat(43)}`)).status).toBe(404);
  });

  it('should save each decision at once, show it to HR and allow changing it', async () => {
    // Arrange
    const { batch, token } = await setup();
    const [first, second] = batch.items;

    // Act
    await boss('PUT', `/${token}/items/${first?.id}`, { decision: 'approve' });
    await boss('PUT', `/${token}/items/${second?.id}`, { decision: 'reject', comment: 'Chưa có kinh nghiệm B2B' });
    const changed = await json<ReviewPageDto>(
      await boss('PUT', `/${token}/items/${second?.id}`, { decision: 'ask', comment: 'Hỏi thêm về CRM?' }),
    );

    // Assert
    expect(changed.items.map((i) => i.decision)).toEqual(['approve', 'ask']);
    const after = await json<ReviewBatchDto>(await hr('GET', `/reviews/${batch.id}`));
    expect(after).toMatchObject({ approved: 1, asked: 1, rejected: 0 });
    expect(after.items[1]?.reviewerComment).toBe('Hỏi thêm về CRM?');
    expect(after.events.filter((e) => e.kind === 'decided')).toHaveLength(3);
  });

  it('should need a reason to decline or ask', async () => {
    const { batch, token } = await setup();
    const res = await boss('PUT', `/${token}/items/${batch.items[0]?.id}`, { decision: 'reject' });
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.comment).toBeTruthy();
  });

  it('should not change a decision once HR has set the interview', async () => {
    // Arrange
    const { a, batch, token } = await setup();
    await boss('PUT', `/${token}/items/${batch.items[0]?.id}`, { decision: 'approve' });
    await hr('PATCH', `/applications/${a.id}`, { status: 'interview' });

    // Act
    const res = await boss('PUT', `/${token}/items/${batch.items[0]?.id}`, { decision: 'reject', comment: 'Đổi ý' });

    // Assert
    expect(res.status).toBe(409);
  });

  it('should only let the reviewer finish once every application has a decision', async () => {
    const { batch, token } = await setup();
    await boss('PUT', `/${token}/items/${batch.items[0]?.id}`, { decision: 'approve' });
    expect((await boss('POST', `/${token}/done`)).status).toBe(409);
    await boss('PUT', `/${token}/items/${batch.items[1]?.id}`, { decision: 'approve' });
    const page = await json<ReviewPageDto>(await boss('POST', `/${token}/done`));
    expect(page.doneAt).not.toBeNull();
  });

  it('should stop changes after the link expires or HR revokes it, and open again when HR extends it', async () => {
    // Arrange
    const { batch, token } = await setup();
    const itemPath = `/${token}/items/${batch.items[0]?.id}`;
    t.clock.now = new Date('2026-10-28T00:00:00.000Z');
    // A new day of work: HR signs in again (sessions do not last a week).
    cookie = await loginHr(t);

    // Act / Assert: expired
    expect((await boss('PUT', itemPath, { decision: 'approve' })).status).toBe(409);
    expect((await json<ReviewPageDto>(await boss('GET', `/${token}`))).state).toBe('expired');

    // Extended
    await hr('POST', `/reviews/${batch.id}/extend`, { respondBy: '2026-10-29T10:00:00.000Z' });
    expect((await boss('PUT', itemPath, { decision: 'approve' })).status).toBe(200);

    // Revoked
    await hr('POST', `/reviews/${batch.id}/revoke`);
    expect((await json<ReviewPageDto>(await boss('GET', `/${token}`))).state).toBe('revoked');
    expect((await boss('PUT', itemPath, { decision: null })).status).toBe(409);
  });

  it('should stream only CV files of applications in the batch', async () => {
    // Arrange
    const pathname = 'cv/test/file.pdf';
    t.cvStore.files.set(pathname, new TextEncoder().encode('%PDF-1.4').buffer);
    const withCv = await insertApplication({ cvPathname: pathname });
    const { body } = await sendBatch([withCv.id]);

    // Act
    const res = await boss('GET', `/${body?.token}/items/${body?.items[0]?.id}/cv`);
    const other = await setup();
    const foreign = await boss('GET', `/${body?.token}/items/${other.batch.items[0]?.id}/cv`);

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(foreign.status).toBe(404);
  });
});

describe('HR follows up a batch', () => {
  it("should answer the reviewer's question, add and remove applications", async () => {
    // Arrange
    const a = await insertApplication();
    const b = await insertApplication();
    const c = await insertApplication();
    const { body: batch } = await sendBatch([a.id, b.id]);
    if (!batch) throw new Error('batch not created');
    await boss('PUT', `/${batch.token}/items/${batch.items[0]?.id}`, { decision: 'ask', comment: 'Lương mong muốn?' });

    // Act
    await hr('POST', `/reviews/${batch.id}/items/${batch.items[0]?.id}/reply`, { reply: '15 triệu' });
    await hr('POST', `/reviews/${batch.id}/items`, { items: [{ applicationId: c.id }] });
    const removed = await hr('DELETE', `/reviews/${batch.id}/items/${batch.items[1]?.id}`);
    const refusedRemove = await hr('DELETE', `/reviews/${batch.id}/items/${batch.items[0]?.id}`);

    // Assert
    const page = await json<ReviewPageDto>(await boss('GET', `/${batch.token}`));
    expect(page.items.map((i) => i.fullName)).toEqual([a.fullName, c.fullName]);
    expect(page.items[0]?.hrReply).toBe('15 triệu');
    expect(removed.status).toBe(200);
    expect(refusedRemove.status).toBe(409);
    const list = await json<ReviewBatchRowDto[]>(await hr('GET', '/reviews'));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ total: 2, asked: 1 });
  });
});

describe("interview needs the reviewer's approval", () => {
  it('should block "Hẹn phỏng vấn" while the reviewer has not approved', async () => {
    // Arrange
    const a = await insertApplication();
    await sendBatch([a.id]);

    // Act
    const res = await hr('PATCH', `/applications/${a.id}`, { status: 'interview' });

    // Assert
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe('needs_review');
  });

  it('should allow it once approved, and show the review on the application', async () => {
    // Arrange
    const a = await insertApplication();
    const { body } = await sendBatch([a.id]);
    await boss('PUT', `/${body?.token}/items/${body?.items[0]?.id}`, { decision: 'approve' });

    // Act
    const res = await hr('PATCH', `/applications/${a.id}`, { status: 'interview' });

    // Assert
    expect(res.status).toBe(200);
    const detail = await json<ApplicationDetailDto>(res);
    expect(detail.reviewInfo).toMatchObject({ decision: 'approve', reviewerName: 'anh Minh' });
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    expect(list.applications[0]?.review).toBe('approve');
  });

  it('should allow it with a reason before approval, and log the reason for the reviewer', async () => {
    // Arrange
    const a = await insertApplication();
    const { body } = await sendBatch([a.id]);

    // Act
    const res = await hr('PATCH', `/applications/${a.id}`, {
      status: 'interview',
      reviewBypassReason: 'Ứng viên chỉ rảnh hôm nay',
    });

    // Assert
    expect(res.status).toBe(200);
    const batch = await json<ReviewBatchDto>(await hr('GET', `/reviews/${body?.id}`));
    expect(batch.events[0]).toMatchObject({ kind: 'bypassed', detail: 'Ứng viên chỉ rảnh hôm nay' });
  });

  it('should not block applications that were never sent, or whose batch HR revoked', async () => {
    const free = await insertApplication();
    expect((await hr('PATCH', `/applications/${free.id}`, { status: 'interview' })).status).toBe(200);
    const sent = await insertApplication();
    const { body } = await sendBatch([sent.id]);
    await hr('POST', `/reviews/${body?.id}/revoke`);
    expect((await hr('PATCH', `/applications/${sent.id}`, { status: 'interview' })).status).toBe(200);
  });
});
