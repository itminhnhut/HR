import type { HrJobDto, HrJobsResponse, JobPageResponse } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, jobs } from '../db/schema.js';
import { googleToken } from '../test/fakes.js';
import { cookiesFrom, insertJob, jobInput, json, loginHr } from '../test/fixtures.js';
import { createTestContext, HR_EMAIL, type TestContext } from '../test/harness.js';

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
const saveNew = async (overrides = {}) => json<HrJobDto>(await hr('POST', '/jobs', jobInput(overrides)));
const dbJob = async (id: string) => (await t.db.select().from(jobs).where(eq(jobs.id, id)))[0];

describe('HR sign-in', () => {
  it('signs in an allowed Google account and remembers it', async () => {
    const res = await t.send('POST', '/api/hr/auth/google', { idToken: googleToken('HR@congty.vn') });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: HR_EMAIL, name: 'Người Test' });
    const setCookie = res.headers.getSetCookie()[0];
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await t.request('/api/hr/me', { headers: { cookie: cookiesFrom(res) } });
    expect(await me.json()).toEqual({ email: HR_EMAIL, name: 'Người Test' });
  });

  it('refuses Google accounts outside HR_EMAILS with 403', async () => {
    const res = await t.send('POST', '/api/hr/auth/google', { idToken: googleToken('la@gmail.com') });
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('refuses an invalid Google token with 401', async () => {
    expect((await t.send('POST', '/api/hr/auth/google', { idToken: 'garbage' })).status).toBe(401);
    expect((await t.send('POST', '/api/hr/auth/google', {})).status).toBe(400);
  });

  it('answers /hr/me with 401 when signed out', async () => {
    expect((await t.request('/api/hr/me')).status).toBe(401);
  });

  it('blocks every HR job endpoint without a session', async () => {
    const job = await insertJob(t);
    const calls = [
      t.request('/api/hr/jobs'),
      t.request(`/api/hr/jobs/${job.id}`),
      t.send('POST', '/api/hr/jobs', jobInput()),
      t.send('PUT', `/api/hr/jobs/${job.id}`, jobInput()),
      t.send('DELETE', `/api/hr/jobs/${job.id}`),
      t.send('POST', `/api/hr/jobs/${job.id}/pause`),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
    expect((await dbJob(job.id)).state).toBe('published');
  });

  it('revokes access as soon as the email leaves the allow-list', async () => {
    t.deps.config.hrEmails = [];
    try {
      expect((await hr('GET', '/jobs')).status).toBe(401);
    } finally {
      t.deps.config.hrEmails = [HR_EMAIL];
    }
  });

  it('rejects a forged or expired session cookie', async () => {
    const forged = await new SignJWT({ kind: 'hr' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(HR_EMAIL)
      .sign(new TextEncoder().encode('another-secret-another-secret-12345'));
    expect((await t.request('/api/hr/jobs', { headers: { cookie: `hr_session=${forged}` } })).status).toBe(401);

    t.clock.now = new Date(t.clock.now.getTime() + 8 * 24 * 60 * 60 * 1000);
    expect((await hr('GET', '/jobs')).status).toBe(401);
  });

  it('does not accept a candidate cookie as an HR session', async () => {
    const res = await t.request('/api/hr/me', {
      headers: { cookie: cookie.replace('hr_session', 'candidate_session') },
    });
    expect(res.status).toBe(401);
  });

  it('logs out by clearing the cookie', async () => {
    const res = await hr('POST', '/logout');
    expect(res.headers.getSetCookie()[0]).toMatch(/hr_session=;.*Max-Age=0/);
  });
});

describe('HR job list', () => {
  it('orders by urgency and counts applications per job', async () => {
    const open = await insertJob(t, { title: 'Đang tuyển' });
    await insertJob(t, { title: 'Sắp hết', deadline: '2026-10-22' });
    await insertJob(t, { title: 'Nháp', state: 'draft', publishedOn: null });
    await insertJob(t, { title: 'Đủ người', state: 'filled' });
    const base = { fullName: 'A', consentAt: t.clock.now, policyVersion: 'v', jobId: open.id };
    await t.db.insert(applications).values([
      { ...base, phone: '0912000001' },
      { ...base, phone: '0912000002', status: 'seen' },
    ]);

    const body = await json<HrJobsResponse>(await hr('GET', '/jobs'));

    expect(body.jobs.map((j) => j.title)).toEqual(['Sắp hết', 'Đang tuyển', 'Nháp', 'Đủ người']);
    expect(body.jobs[1]).toMatchObject({ totalApplications: 2, newApplications: 1, extendTo: null });
    expect(body.newApplications).toBe(1);
  });

  it('offers an extension only for expiring and expired jobs, capped at 60 days (BR-18)', async () => {
    await insertJob(t, { title: 'Sắp hết', deadline: '2026-10-22', publishedOn: '2026-10-01' });
    await insertJob(t, { title: 'Hết 60 ngày', deadline: '2026-10-19', publishedOn: '2026-08-20' });

    const { jobs: rows } = await json<HrJobsResponse>(await hr('GET', '/jobs'));

    expect(rows.find((j) => j.title === 'Sắp hết')?.extendTo).toBe('2026-11-05');
    expect(rows.find((j) => j.title === 'Hết 60 ngày')?.extendTo).toBeNull();
  });
});

describe('saving jobs', () => {
  it('publishes a new job with a slug from the title and today as publish date', async () => {
    const job = await saveNew({ title: 'Kỹ sư Đám mây (Senior)' });
    expect(job).toMatchObject({ slug: 'ky-su-dam-may-senior', state: 'published', status: 'open' });
    expect((await dbJob(job.id)).publishedOn).toBe('2026-10-20');
    expect((await t.request('/api/jobs/ky-su-dam-may-senior')).status).toBe(200);
  });

  it('gives a second job with the same title its own slug', async () => {
    await saveNew();
    expect((await saveNew()).slug).toBe('ky-su-phan-mem-2');
    expect((await saveNew()).slug).toBe('ky-su-phan-mem-3');
  });

  it('will not publish a job with a deadline over 60 days (BR-01)', async () => {
    const res = await hr('POST', '/jobs', jobInput({ deadline: '2026-12-20' }));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.deadline).toBe(
      'Hạn nộp tối đa 60 ngày từ hôm nay.',
    );
    expect((await hr('POST', '/jobs', jobInput({ deadline: '2026-12-19' }))).status).toBe(200);
  });

  it('requires a deadline that is a real date not in the past to publish', async () => {
    for (const deadline of ['', '2026-10-19', '2026-02-30', '20/11/2026']) {
      const res = await hr('POST', '/jobs', jobInput({ deadline }));
      expect(res.status, deadline).toBe(422);
    }
  });

  it('saves a half-written draft with a default deadline', async () => {
    const job = await saveNew({ intent: 'draft', deadline: '', responsibilities: '' });
    expect(job).toMatchObject({ state: 'draft', status: 'draft', deadline: '2026-11-19' });
    expect((await t.request(`/api/jobs/${job.slug}`)).status).toBe(404);
  });

  it('refuses a malformed deadline even on a draft', async () => {
    expect((await hr('POST', '/jobs', jobInput({ intent: 'draft', deadline: '2026-13-01' }))).status).toBe(422);
  });

  it('requires the duties to publish', async () => {
    const res = await hr('POST', '/jobs', jobInput({ responsibilities: '' }));
    expect(res.status).toBe(422);
  });

  it('keeps the public link when the title of a published job changes (BR-04)', async () => {
    const job = await saveNew();
    const updated = await json<HrJobDto>(await hr('PUT', `/jobs/${job.id}`, jobInput({ title: 'Tên mới hoàn toàn' })));
    expect(updated.slug).toBe(job.slug);
    expect(updated.title).toBe('Tên mới hoàn toàn');
  });

  it('lets a draft slug follow its title until first publish', async () => {
    const draft = await saveNew({ intent: 'draft' });
    const renamed = await json<HrJobDto>(
      await hr('PUT', `/jobs/${draft.id}`, jobInput({ intent: 'draft', title: 'Chuyên viên tuyển dụng' })),
    );
    expect(renamed.slug).toBe('chuyen-vien-tuyen-dung');
  });

  it('keeps a draft slug that does not need to change', async () => {
    const draft = await saveNew({ intent: 'draft' });
    const again = await json<HrJobDto>(await hr('PUT', `/jobs/${draft.id}`, jobInput({ intent: 'draft' })));
    expect(again.slug).toBe(draft.slug);
  });

  it('cannot push the deadline past 60 days from publishing by editing (BR-18)', async () => {
    const job = await saveNew({ deadline: '2026-11-19' });
    t.clock.now = new Date('2026-11-10T03:00:00.000Z');
    cookie = await loginHr(t);

    const tooFar = await hr('PUT', `/jobs/${job.id}`, jobInput({ deadline: '2026-12-25', intent: 'draft' }));
    expect(tooFar.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(tooFar)).fieldErrors.deadline).toMatch(
      /20\/10\/2026.*60 ngày/,
    );
    expect((await hr('PUT', `/jobs/${job.id}`, jobInput({ deadline: '2026-12-19', intent: 'draft' }))).status).toBe(
      200,
    );
  });

  it('keeps the publish date when a live job is saved again', async () => {
    const job = await saveNew();
    t.clock.now = new Date('2026-10-25T03:00:00.000Z');
    await hr('PUT', `/jobs/${job.id}`, jobInput({ title: 'Đổi tên' }));
    expect((await dbJob(job.id)).publishedOn).toBe('2026-10-20');
  });

  it('does not let a draft-intent save turn a live job back into a draft', async () => {
    const job = await saveNew();
    const saved = await json<HrJobDto>(await hr('PUT', `/jobs/${job.id}`, jobInput({ intent: 'draft' })));
    expect(saved.state).toBe('published');
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('GET', '/jobs/00000000-0000-0000-0000-000000000000')).status).toBe(404);
    expect((await hr('GET', '/jobs/abc')).status).toBe(404);
    expect((await hr('PUT', '/jobs/abc', jobInput())).status).toBe(404);
  });

  it('returns field errors from the shared schema', async () => {
    const res = await hr('POST', '/jobs', jobInput({ title: 'A', salaryMin: 30, salaryMax: 10 }));
    const body = await json<{ fieldErrors: Record<string, string> }>(res);
    expect(res.status).toBe(422);
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['salaryMax', 'title']);
  });
});

describe('"Đăng lại" (BR-04)', () => {
  it('creates a new job with a new link while old applications stay on the old job', async () => {
    const old = await insertJob(t, { title: 'Kỹ sư phần mềm', slug: 'ky-su-phan-mem', state: 'filled' });
    await t.db
      .insert(applications)
      .values({ jobId: old.id, fullName: 'A', phone: '0912000001', consentAt: t.clock.now, policyVersion: 'v' });

    const fresh = await saveNew({ title: 'Kỹ sư phần mềm' });

    expect(fresh.id).not.toBe(old.id);
    expect(fresh.slug).toBe('ky-su-phan-mem-2');
    const apps = await t.db.select().from(applications);
    expect(apps.map((a) => a.jobId)).toEqual([old.id]);
    expect((await json<JobPageResponse>(await t.request('/api/jobs/ky-su-phan-mem'))).job.status).toBe('filled');
  });
});

describe('job actions', () => {
  const act = (id: string, action: string) => hr('POST', `/jobs/${id}/${action}`);

  it('extends an expiring job by 14 days, keeping the link (BR-04)', async () => {
    const job = await insertJob(t, { deadline: '2026-10-22', publishedOn: '2026-10-01' });
    expect(await (await act(job.id, 'extend')).json()).toEqual({ ok: true });
    expect(await dbJob(job.id)).toMatchObject({ deadline: '2026-11-05', slug: job.slug, state: 'published' });
  });

  it('reopens an expired job by extending from today', async () => {
    const job = await insertJob(t, { deadline: '2026-10-15', publishedOn: '2026-10-01' });
    await act(job.id, 'extend');
    expect((await dbJob(job.id)).deadline).toBe('2026-11-03');
  });

  it('caps an extension at 60 days from publishing and then refuses (BR-18)', async () => {
    const job = await insertJob(t, { deadline: '2026-10-22', publishedOn: '2026-08-25' });
    await act(job.id, 'extend');
    expect((await dbJob(job.id)).deadline).toBe('2026-10-24');
    t.clock.now = new Date('2026-10-22T03:00:00.000Z'); // expiring again
    const again = await act(job.id, 'extend');
    expect(again.status).toBe(422);
    expect(await again.json()).toMatchObject({ error: expect.stringMatching(/Đăng lại/) });
  });

  it('does not extend a job that is comfortably open, a draft or a filled one', async () => {
    for (const overrides of [{}, { state: 'draft' as const, publishedOn: null }, { state: 'filled' as const }]) {
      const job = await insertJob(t, overrides);
      expect((await act(job.id, 'extend')).status).toBe(422);
    }
  });

  it('pauses an open job and resumes it', async () => {
    const job = await insertJob(t);
    await act(job.id, 'pause');
    expect((await dbJob(job.id)).state).toBe('paused');
    expect((await t.request('/api/jobs')).ok).toBe(true);
    await act(job.id, 'resume');
    expect((await dbJob(job.id)).state).toBe('published');
  });

  it('cannot pause a job that is not taking applications', async () => {
    const job = await insertJob(t, { state: 'filled' });
    expect((await act(job.id, 'pause')).status).toBe(422);
  });

  it('cannot resume a paused job whose deadline has passed (BR-19)', async () => {
    const job = await insertJob(t, { state: 'paused', deadline: '2026-10-19', publishedOn: '2026-10-01' });
    expect((await act(job.id, 'resume')).status).toBe(422);
    expect((await dbJob(job.id)).state).toBe('paused');
  });

  it('closes a job as filled right away, before its deadline (BR-06)', async () => {
    const job = await insertJob(t);
    await act(job.id, 'fill');
    const page = await json<JobPageResponse>(await t.request(`/api/jobs/${job.slug}`));
    expect(page.job.status).toBe('filled');
  });

  it('cannot mark a draft as filled', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null });
    expect((await act(job.id, 'fill')).status).toBe(422);
  });

  it('publishes a valid draft and sets its publish date once', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null, deadline: '2026-11-01' });
    await act(job.id, 'publish');
    expect(await dbJob(job.id)).toMatchObject({ state: 'published', publishedOn: '2026-10-20' });
  });

  it('refuses to publish a draft whose deadline is over 60 days away', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null, deadline: '2027-01-30' });
    expect((await act(job.id, 'publish')).status).toBe(422);
  });

  it('answers 404 for unknown actions', async () => {
    const job = await insertJob(t);
    expect((await act(job.id, 'delete')).status).toBe(404);
  });
});

describe('deleting jobs', () => {
  it('deletes a draft', async () => {
    const job = await insertJob(t, { state: 'draft', publishedOn: null });
    expect((await hr('DELETE', `/jobs/${job.id}`)).status).toBe(200);
    expect(await dbJob(job.id)).toBeUndefined();
  });

  it('refuses to delete anything that was published', async () => {
    for (const state of ['published', 'paused', 'filled'] as const) {
      const job = await insertJob(t, { state });
      expect((await hr('DELETE', `/jobs/${job.id}`)).status).toBe(422);
      expect(await dbJob(job.id)).toBeDefined();
    }
  });
});
