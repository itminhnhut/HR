import type {
  ApplicationDetailDto,
  ApplicationsResponse,
  CandidateOverview,
  DashboardDto,
  DuplicateApplicationDto,
  ReviewBatchDto,
  ReviewPageDto,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, cvScores, subscribers, type Job } from '../db/schema.js';
import { googleToken, pdfFile } from '../test/fakes.js';
import { cookiesFrom, insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let hrCookie: string;
let job: Job;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  hrCookie = await loginHr(t);
  job = await insertJob(t, { title: 'Nhân viên Kinh doanh B2B' });
});

const multipart = (fields: Record<string, string>, file?: File) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append('cv', file);
  return form;
};
const sendForm = (method: string, path: string, body: FormData, cookie: string) =>
  t.request(path, { method, body, headers: { cookie, 'x-requested-with': 'careers-web' } });
const hr = (method: string, path: string, body?: unknown) =>
  t.send(method, `/api/hr${path}`, body, { cookie: hrCookie });

const fields = (over: Record<string, string> = {}) => ({
  jobId: job.id,
  fullName: 'Trần Minh Khoa',
  phone: '0912 345 678',
  email: 'khoa@mail.vn',
  source: 'zalo',
  consent: 'true',
  ...over,
});
const addApplication = (over: Record<string, string> = {}, file?: File) =>
  sendForm('POST', '/api/hr/applications', multipart(fields(over), file), hrCookie);
const detail = async (id: string) => json<ApplicationDetailDto>(await hr('GET', `/applications/${id}`));

describe('HR adds an application received outside the site', () => {
  it('should store it as already seen, with its source, the HR who added it and the consent they confirmed', async () => {
    // Act
    const res = await addApplication({ note: 'Gửi qua Zalo tối qua' }, pdfFile('CV Khoa.pdf'));

    // Assert
    expect(res.status).toBe(201);
    const app = await detail((await json<{ id: string }>(res)).id);
    expect(app).toMatchObject({
      status: 'seen',
      source: 'zalo',
      phone: '0912345678',
      cvFileName: 'CV Khoa.pdf',
      hasCv: true,
      note: 'Gửi qua Zalo tối qua',
    });
    expect(app.addedBy).toBeTruthy();
    expect(app.consentBy).toBe(app.addedBy);
    expect(await t.db.select().from(subscribers)).toEqual([]);
  });

  it('should refuse it without the consent tick or a referrer for a referral', async () => {
    const noConsent = await addApplication({ consent: 'false' });
    expect(noConsent.status).toBe(422);
    const noReferrer = await addApplication({ source: 'referral' });
    expect((await json<{ fieldErrors: Record<string, string> }>(noReferrer)).fieldErrors.referrer).toBeTruthy();
  });

  it('should refuse a draft job', async () => {
    const draft = await insertJob(t, { state: 'draft' });
    expect((await addApplication({ jobId: draft.id })).status).toBe(422);
  });

  it('should point to the existing application of the same phone for the same job', async () => {
    // Arrange
    const first = await json<{ id: string }>(await addApplication());

    // Act
    const res = await addApplication({ fullName: 'Khoa Trần', phone: '0912345678' });

    // Assert
    expect(res.status).toBe(409);
    const body = await json<{ code: string; existing: DuplicateApplicationDto }>(res);
    expect(body.code).toBe('duplicate');
    expect(body.existing).toMatchObject({ id: first.id, fullName: 'Trần Minh Khoa' });
  });

  it('should allow the same phone for another job', async () => {
    await addApplication();
    const other = await insertJob(t, { title: 'Kế toán' });
    expect((await addApplication({ jobId: other.id })).status).toBe(201);
  });

  it('should filter the list by source and count sources on the dashboard', async () => {
    // Arrange
    await addApplication();
    await addApplication({ phone: '0912345679', source: 'email' });

    // Act
    const zalo = await json<ApplicationsResponse>(await hr('GET', '/applications?source=zalo'));
    const dash = await json<DashboardDto>(await hr('GET', '/dashboard'));

    // Assert
    expect(zalo.applications.map((a) => a.source)).toEqual(['zalo']);
    expect(dash.bySource).toEqual(
      expect.arrayContaining([
        { source: 'zalo', count: 1 },
        { source: 'email', count: 1 },
      ]),
    );
  });
});

describe('HR adds or replaces a CV', () => {
  it('should keep only the newest file, log the change and drop the old score', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication({}, pdfFile('cu.pdf')));
    const oldPath = (await t.db.query.applications.findFirst({ where: eq(applications.id, id) }))?.cvPathname;
    await t.db.insert(cvScores).values({
      applicationId: id,
      percent: 50,
      items: [],
      version: 1,
      requirementsKey: '',
      scoredAt: t.clock.now,
    });

    // Act
    const res = await sendForm('PUT', `/api/hr/applications/${id}/cv`, multipart({}, pdfFile('moi.pdf')), hrCookie);

    // Assert
    expect(res.status).toBe(200);
    const app = await json<ApplicationDetailDto>(res);
    expect(app.cvFileName).toBe('moi.pdf');
    expect(app.cvHistory).toEqual([expect.objectContaining({ previous: 'cu.pdf' })]);
    expect(app.cvScore).toBeNull();
    expect(oldPath && t.cvStore.files.has(oldPath)).toBe(false);
  });

  it('should take a link instead of a file and refuse an empty change', async () => {
    const { id } = await json<{ id: string }>(await addApplication());
    const empty = await sendForm('PUT', `/api/hr/applications/${id}/cv`, multipart({}), hrCookie);
    expect(empty.status).toBe(422);
    const link = await sendForm(
      'PUT',
      `/api/hr/applications/${id}/cv`,
      multipart({ cvLink: 'https://drive.test/cv' }),
      hrCookie,
    );
    expect((await json<ApplicationDetailDto>(link)).cvLink).toBe('https://drive.test/cv');
  });

  it('should let HR fix the contact of an application they added, never one the candidate sent', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication());
    const [own] = await t.db
      .insert(applications)
      .values({ jobId: job.id, fullName: 'Tự nộp', phone: '0987654321', consentAt: t.clock.now, policyVersion: 'v' })
      .returning();

    // Act
    const fixed = await hr('PATCH', `/applications/${id}/contact`, { phone: '0912000111', source: 'email' });
    const refused = await hr('PATCH', `/applications/${own.id}/contact`, { phone: '0912000222', source: 'email' });

    // Assert
    expect(await json<ApplicationDetailDto>(fixed)).toMatchObject({ phone: '0912000111', source: 'email' });
    expect(refused.status).toBe(409);
  });
});

describe('the candidate updates the CV of an application already sent', () => {
  const EMAIL = 'khoa@mail.vn';
  async function signIn(email = EMAIL) {
    const res = await t.send('POST', '/api/candidate/google', { idToken: googleToken(email) });
    return cookiesFrom(res);
  }
  const update = (id: string, cookie: string, file = pdfFile('CV moi.pdf')) =>
    sendForm('PUT', `/api/candidate/applications/${id}/cv`, multipart({}, file), cookie);

  it('should replace it while HR has not decided, and flag it for HR until an HR opens it', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication());
    const cookie = await signIn();

    // Act
    const res = await update(id, cookie);

    // Assert
    expect(res.status).toBe(200);
    const mine = await json<CandidateOverview>(res);
    expect(mine.applications[0]).toMatchObject({ hasCv: true, cvBlock: null });
    expect(mine.applications[0]?.cvChangedAt).not.toBeNull();
    const list = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    expect(list.applications[0]?.cvUpdatedByCandidate).toBe(true);
    await detail(id);
    const after = await json<ApplicationsResponse>(await hr('GET', '/applications'));
    expect(after.applications[0]?.cvUpdatedByCandidate).toBe(false);
  });

  it("should refuse someone else's application like a missing one", async () => {
    const { id } = await json<{ id: string }>(await addApplication());
    expect((await update(id, await signIn('nguoi-khac@mail.vn'))).status).toBe(404);
  });

  it('should stop after the third change and once HR has decided', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication());
    const cookie = await signIn();
    for (let i = 0; i < 3; i += 1) expect((await update(id, cookie)).status).toBe(200);

    // Act / Assert
    expect((await update(id, cookie)).status).toBe(409);
    const other = await insertJob(t, { title: 'Kế toán' });
    const { id: second } = await json<{ id: string }>(await addApplication({ jobId: other.id }));
    await hr('PATCH', `/applications/${second}`, { status: 'rejected' });
    expect((await update(second, cookie)).status).toBe(409);
  });

  it('should tell the reviewer the CV changed after the batch was sent, and HR that it changed after the decision', async () => {
    // Arrange
    const { id } = await json<{ id: string }>(await addApplication());
    const batch = await json<ReviewBatchDto>(
      await hr('POST', '/reviews', {
        title: 'Duyệt',
        senderName: 'HR',
        reviewerName: 'anh Minh',
        respondBy: '2026-10-22T10:00:00.000Z',
        items: [{ applicationId: id }],
      }),
    );
    await t.send('PUT', `/api/review/${batch.token}/items/${batch.items[0]?.id}`, { decision: 'approve' });
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);

    // Act
    await update(id, await signIn());

    // Assert
    const page = await json<ReviewPageDto>(await t.send('GET', `/api/review/${batch.token}`));
    expect(page.items[0]?.cvUpdated).toBe(true);
    expect((await detail(id)).reviewInfo?.cvChangedAfterDecision).toBe(true);
  });
});
