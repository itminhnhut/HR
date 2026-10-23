import type { ApplicationDetailDto, ApplicationsResponse, SubscriberDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, subscribers, type Job } from '../db/schema.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

let n = 0;
async function insertApplication(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  n += 1;
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: `Ứng viên ${n}`,
      phone: `09120000${String(n).padStart(2, '0')}`,
      consentAt: t.clock.now,
      policyVersion: '2026-10',
      createdAt: new Date(t.clock.now.getTime() - n * 60_000),
      ...overrides,
    })
    .returning();
  return row;
}

describe('GET /api/hr/applications', () => {
  it('lists newest first with counts per status and the jobs that have applications', async () => {
    const a = await insertJob(t, { title: 'A' });
    const b = await insertJob(t, { title: 'B' });
    await insertJob(t, { title: 'Không ai nộp' });
    const first = await insertApplication(a, { createdAt: new Date('2026-10-18T00:00:00Z') });
    const second = await insertApplication(b, { createdAt: new Date('2026-10-19T00:00:00Z'), status: 'interview' });

    const body = await json<ApplicationsResponse>(await hr('GET', '/applications'));

    expect(body.applications.map((x) => x.id)).toEqual([second.id, first.id]);
    expect(body.applications[0]).toEqual({
      id: second.id,
      jobId: b.id,
      jobTitle: 'B',
      fullName: second.fullName,
      phone: second.phone,
      status: 'interview',
      createdAt: '2026-10-19T00:00:00.000Z',
    });
    expect(body.counts).toEqual({ all: 2, new: 1, seen: 0, interview: 1, passed: 0, rejected: 0 });
    expect(body.jobs).toEqual([
      { id: a.id, title: 'A' },
      { id: b.id, title: 'B' },
    ]);
  });

  it('filters by job', async () => {
    const a = await insertJob(t);
    const b = await insertJob(t);
    await insertApplication(a);
    await insertApplication(b);
    const body = await json<ApplicationsResponse>(await hr('GET', `/applications?jobId=${a.id}`));
    expect(body.applications.map((x) => x.jobId)).toEqual([a.id]);
    expect(body.counts.all).toBe(1);
    expect(body.jobs).toHaveLength(2);
  });

  it('returns an empty list for a malformed job filter', async () => {
    const res = await hr('GET', '/applications?jobId=abc');
    expect(res.status).toBe(200);
    expect((await json<ApplicationsResponse>(res)).applications).toEqual([]);
  });

  it('needs an HR session', async () => {
    expect((await t.request('/api/hr/applications')).status).toBe(401);
    expect((await t.request('/api/hr/subscribers')).status).toBe(401);
  });
});

describe('GET /api/hr/applications/:id', () => {
  it('returns the full application and marks a new one as seen', async () => {
    const job = await insertJob(t, { title: 'Kỹ sư' });
    const app = await insertApplication(job, {
      email: 'an@gmail.com',
      cvLink: 'https://drive.google.com/x',
      keepForOtherJobs: true,
    });

    const body = await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`));

    expect(body).toMatchObject({
      status: 'seen',
      jobTitle: 'Kỹ sư',
      email: 'an@gmail.com',
      cvLink: 'https://drive.google.com/x',
      keepForOtherJobs: true,
      thankedAt: null,
    });
    const [row] = await t.db.select().from(applications);
    expect(row.status).toBe('seen');
  });

  it('leaves other statuses alone when opened', async () => {
    const app = await insertApplication(await insertJob(t), { status: 'interview' });
    expect((await json<ApplicationDetailDto>(await hr('GET', `/applications/${app.id}`))).status).toBe('interview');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('GET', '/applications/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await hr('GET', '/applications/x')).status).toBe(404);
  });
});

describe('PATCH /api/hr/applications/:id', () => {
  it('changes status and note, and records the thank-you time', async () => {
    const app = await insertApplication(await insertJob(t));

    const body = await json<ApplicationDetailDto>(
      await hr('PATCH', `/applications/${app.id}`, {
        status: 'rejected',
        note: '  Thiếu kinh nghiệm  ',
        thanked: true,
      }),
    );

    expect(body).toMatchObject({ status: 'rejected', note: 'Thiếu kinh nghiệm', thankedAt: t.clock.now.toISOString() });
  });

  it('clears the note with an empty string or null', async () => {
    const app = await insertApplication(await insertJob(t), { note: 'cũ' });
    expect(
      (await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, { note: '' }))).note,
    ).toBeNull();
  });

  it('rejects unknown statuses', async () => {
    const app = await insertApplication(await insertJob(t));
    expect((await hr('PATCH', `/applications/${app.id}`, { status: 'hired' })).status).toBe(422);
  });

  it('leaves the application unchanged for an empty patch', async () => {
    const app = await insertApplication(await insertJob(t), { status: 'seen' });
    const body = await json<ApplicationDetailDto>(await hr('PATCH', `/applications/${app.id}`, {}));
    expect(body.status).toBe('seen');
  });
});

describe('GET /api/hr/applications/:id/cv', () => {
  it('streams the stored PDF inline, never cached', async () => {
    const job = await insertJob(t);
    const pathname = await t.cvStore.put(job.id, new File(['%PDF-1.7 nội dung'], 'cv.pdf'));
    const app = await insertApplication(job, { fullName: 'Nguyễn An', cvPathname: pathname, cvFileName: 'cv.pdf' });

    const res = await t.request(`/api/hr/applications/${app.id}/cv`, { headers: { cookie } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent('CV-Nguyễn An.pdf')}`,
    );
    expect(await res.text()).toBe('%PDF-1.7 nội dung');
  });

  it('answers 404 when the application has only a link', async () => {
    const app = await insertApplication(await insertJob(t), { cvLink: 'https://x.vn' });
    expect((await hr('GET', `/applications/${app.id}/cv`)).status).toBe(404);
  });

  it('answers 404 when the file is gone from the store', async () => {
    const app = await insertApplication(await insertJob(t), { cvPathname: 'cv/x/missing.pdf' });
    expect((await hr('GET', `/applications/${app.id}/cv`)).status).toBe(404);
  });

  it('is not readable without an HR session', async () => {
    const job = await insertJob(t);
    const pathname = await t.cvStore.put(job.id, new File(['%PDF-'], 'cv.pdf'));
    const app = await insertApplication(job, { cvPathname: pathname });
    expect((await t.request(`/api/hr/applications/${app.id}/cv`)).status).toBe(401);
  });
});

describe('subscribers', () => {
  it('lists sign-ups newest first with the job they came from', async () => {
    const job = await insertJob(t, { title: 'Kế toán' });
    const base = { consentAt: t.clock.now, policyVersion: 'v' };
    await t.db.insert(subscribers).values([
      { ...base, phone: '0912000001', department: 'Kỹ thuật', createdAt: new Date('2026-10-01T00:00:00Z') },
      {
        ...base,
        phone: '0912000002',
        department: 'Kỹ thuật',
        fromJobId: job.id,
        createdAt: new Date('2026-10-02T00:00:00Z'),
      },
    ]);

    const body = await json<SubscriberDto[]>(await hr('GET', '/subscribers'));

    expect(body.map((s) => [s.phone, s.fromJobTitle])).toEqual([
      ['0912000002', 'Kế toán'],
      ['0912000001', null],
    ]);
    expect(body[0].createdAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('deletes one sign-up', async () => {
    const [row] = await t.db
      .insert(subscribers)
      .values({ phone: '0912000001', department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' })
      .returning();
    expect(await (await hr('DELETE', `/subscribers/${row.id}`)).json()).toEqual({ ok: true });
    expect(await t.db.select().from(subscribers)).toEqual([]);
    expect((await hr('DELETE', `/subscribers/${row.id}`)).status).toBe(200);
  });
});
