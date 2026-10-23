import type { CandidateMe, CandidateOverview } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, candidates, otpCodes, savedJobs, subscribers, type Job } from '../db/schema.js';
import { consoleOtpSender } from '../lib/otp.js';
import { googleToken, pdfFile } from '../test/fakes.js';
import { cookiesFrom, insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const PHONE = '0912345678';
const MINUTE = 60_000;
const later = (ms: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + ms);
};

const requestCode = (phone = PHONE, channel = 'zalo') => t.send('POST', '/api/candidate/otp', { phone, channel });
const verify = (code: string, phone = PHONE, cookie = '') =>
  t.send('POST', '/api/candidate/otp/verify', { phone, code }, cookie ? { cookie } : {});

async function signIn(phone = PHONE): Promise<string> {
  await requestCode(phone);
  const res = await verify(t.otp.lastCode(phone), phone);
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
  return cookiesFrom(res);
}

async function applyAs(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: 'Trần Minh Anh',
      phone: PHONE,
      consentAt: t.clock.now,
      policyVersion: 'v',
      ...overrides,
    })
    .returning();
  return row;
}

describe('phone sign-in (OTP)', () => {
  it('sends a 6-digit code through the chosen channel', async () => {
    const res = await requestCode('0912 345 678', 'sms');
    expect(await res.json()).toEqual({ ok: true });
    expect(t.otp.sent).toEqual([{ phone: PHONE, code: expect.stringMatching(/^\d{6}$/), channel: 'sms' }]);
  });

  it('rejects an invalid phone number', async () => {
    const res = await requestCode('123');
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { phone: expect.any(String) } });
    expect(t.otp.sent).toEqual([]);
  });

  it('never stores the code itself', async () => {
    await requestCode();
    const [row] = await t.db.select().from(otpCodes);
    expect(row.codeHash).not.toContain(t.otp.lastCode(PHONE));
  });

  it('signs in with the right code and creates the account from the latest application', async () => {
    const job = await insertJob(t);
    await applyAs(job, { fullName: 'Cũ', createdAt: new Date('2026-10-01T00:00:00Z') });
    await applyAs(job, { fullName: 'Trần Minh Anh', email: 'anh@gmail.com', keepForOtherJobs: true });

    await requestCode();
    const res = await verify(t.otp.lastCode(PHONE));

    expect(res.status).toBe(200);
    expect(await json<CandidateMe>(res)).toEqual({
      phone: PHONE,
      name: 'Trần Minh Anh',
      email: 'anh@gmail.com',
      cvFileName: null,
      keepForOtherJobs: true,
      alertDepartments: [],
    });
    expect(res.headers.getSetCookie()[0]).toMatch(/^candidate_session=.*HttpOnly/i);
  });

  it('rejects a wrong code without signing in', async () => {
    await requestCode();
    const res = await verify('000000' === t.otp.lastCode(PHONE) ? '111111' : '000000');
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { code: 'Mã chưa đúng hoặc đã hết hạn.' } });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('locks the code after 5 wrong tries, even if the 6th is right', async () => {
    await requestCode();
    const code = t.otp.lastCode(PHONE);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await verify(wrong)).status).toBe(422);
    expect((await verify(code)).status).toBe(422);
  });

  it('counts parallel guesses against the same limit', async () => {
    await requestCode();
    const code = t.otp.lastCode(PHONE);
    const wrong = code === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 8 }, () => verify(wrong)));
    const [row] = await t.db.select().from(otpCodes);
    expect(row.attempts).toBe(5);
  });

  it('expires the code after 5 minutes', async () => {
    await requestCode();
    later(5 * MINUTE + 1000);
    expect((await verify(t.otp.lastCode(PHONE))).status).toBe(422);
  });

  it('accepts each code only once', async () => {
    await requestCode();
    const code = t.otp.lastCode(PHONE);
    expect((await verify(code)).status).toBe(200);
    expect((await verify(code)).status).toBe(422);
  });

  it('waits 60 seconds before sending another code, then replaces the old one', async () => {
    await requestCode();
    const first = t.otp.lastCode(PHONE);
    later(30_000);
    const tooSoon = await requestCode();
    expect(tooSoon.status).toBe(429);
    expect(await tooSoon.json()).toMatchObject({ error: 'Chờ 30 giây rồi gửi lại mã.' });

    later(31_000);
    expect((await requestCode()).status).toBe(200);
    const second = t.otp.lastCode(PHONE);
    if (second !== first) expect((await verify(first)).status).toBe(422);
    expect((await verify(second)).status).toBe(200);
  });

  it('answers 503 when no OTP provider is configured', async () => {
    t.deps.otpSender = null;
    expect((await requestCode()).status).toBe(503);
  });

  it('echoes the code only with the local dev sender', async () => {
    t.deps.otpSender = consoleOtpSender;
    const body = await json<{ devCode?: string }>(await requestCode());
    expect(body.devCode).toMatch(/^\d{6}$/);
    expect((await verify(body.devCode ?? '')).status).toBe(200);
  });

  it('answers 502 and forgets the code when delivery fails', async () => {
    t.deps.otpSender = {
      revealsCode: false,
      send: async () => {
        throw new Error('provider down');
      },
    };
    expect((await requestCode()).status).toBe(502);
    expect(await t.db.select().from(otpCodes)).toEqual([]);
  });
});

describe('Google sign-in for candidates (BR-22)', () => {
  const google = (email: string, cookie = '') =>
    t.send('POST', '/api/candidate/google', { idToken: googleToken(email) }, cookie ? { cookie } : {});

  it('asks for the phone once, then links the Google email to that account', async () => {
    const first = await google('anh@gmail.com');
    expect(await first.json()).toEqual({ email: 'anh@gmail.com', needsPhone: true });
    const pending = cookiesFrom(first);
    expect(pending).toMatch(/^candidate_google=/);
    expect((await t.request('/api/candidate/me', { headers: { cookie: pending } })).status).toBe(401);

    await requestCode();
    const verified = await verify(t.otp.lastCode(PHONE), PHONE, pending);
    expect((await json<CandidateMe>(verified)).email).toBe('anh@gmail.com');

    const again = await google('anh@gmail.com');
    expect(await again.json()).toEqual({ email: 'anh@gmail.com', needsPhone: false });
    const me = await t.request('/api/candidate/me', { headers: { cookie: cookiesFrom(again) } });
    expect((await json<CandidateOverview>(me)).me.phone).toBe(PHONE);
  });

  it('moves the email to the phone that proved it', async () => {
    const pending = cookiesFrom(await google('anh@gmail.com'));
    // Meanwhile another account ended up holding the same email.
    await t.db.insert(candidates).values({ phone: '0987654321', email: 'anh@gmail.com' });

    await requestCode();
    await verify(t.otp.lastCode(PHONE), PHONE, pending);

    const rows = await t.db.select().from(candidates).orderBy(candidates.phone);
    expect(rows.map((r) => [r.phone, r.email])).toEqual([
      [PHONE, 'anh@gmail.com'],
      ['0987654321', null],
    ]);
  });

  it('refuses an invalid Google token', async () => {
    expect((await t.send('POST', '/api/candidate/google', { idToken: 'x' })).status).toBe(401);
  });
});

describe('GET /api/candidate/me', () => {
  it('answers 401 when signed out', async () => {
    expect((await t.request('/api/candidate/me')).status).toBe(401);
  });

  it('shows own applications with the stage the candidate may see', async () => {
    const open = await insertJob(t, { title: 'Đang tuyển', salaryMin: 15, salaryMax: 20, remote: true, city: 'Huế' });
    const filled = await insertJob(t, { title: 'Đủ người', state: 'filled' });
    const paused = await insertJob(t, { title: 'Tạm dừng', state: 'paused' });
    await applyAs(open, { status: 'seen', createdAt: new Date('2026-10-19T00:00:00Z') });
    await applyAs(filled, { status: 'new', createdAt: new Date('2026-10-18T00:00:00Z') });
    await applyAs(paused, { status: 'new', createdAt: new Date('2026-10-17T00:00:00Z') });
    await applyAs(open, { phone: '0999999999' });
    const cookie = await signIn();

    const body = await json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }));

    expect(body.applications.map((a) => [a.jobTitle, a.stage])).toEqual([
      ['Đang tuyển', 'seen'],
      ['Đủ người', 'closed'],
      ['Tạm dừng', 'sent'],
    ]);
    expect(body.applications[0]).toMatchObject({ jobSlug: open.slug, salary: '15 – 20 triệu', place: 'Huế, từ xa' });
  });

  it('never shows "rejected" wording: a rejected application reads as closed', async () => {
    await applyAs(await insertJob(t), { status: 'rejected' });
    const cookie = await signIn();
    const body = await json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }));
    expect(body.applications[0].stage).toBe('closed');
  });

  it('lists only saved jobs that are still open', async () => {
    const cookie = await signIn();
    const open = await insertJob(t);
    const closed = await insertJob(t, { state: 'filled' });
    await t.db.insert(savedJobs).values([
      { phone: PHONE, jobId: open.id },
      { phone: PHONE, jobId: closed.id },
    ]);
    const body = await json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }));
    expect(body.saved.map((j) => j.slug)).toEqual([open.slug]);
  });
});

describe('PATCH /api/candidate/me', () => {
  const patch = (cookie: string, fields: Record<string, string>, cv?: File) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    if (cv) form.append('cv', cv);
    return t.request('/api/candidate/me', {
      method: 'PATCH',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });
  };

  it('needs a session', async () => {
    expect((await patch('', { name: 'X' })).status).toBe(401);
  });

  it('updates the name', async () => {
    const cookie = await signIn();
    expect((await json<CandidateMe>(await patch(cookie, { name: '  Minh Anh ' }))).name).toBe('Minh Anh');
  });

  it('withdraws "keep my CV" from every application at once (BR-14)', async () => {
    const job = await insertJob(t);
    await applyAs(job, { keepForOtherJobs: true });
    await applyAs(await insertJob(t), { keepForOtherJobs: true });
    const cookie = await signIn();

    const me = await json<CandidateMe>(await patch(cookie, { keepForOtherJobs: 'false' }));

    expect(me.keepForOtherJobs).toBe(false);
    const rows = await t.db.select().from(applications).where(eq(applications.phone, PHONE));
    expect(rows.map((r) => r.keepForOtherJobs)).toEqual([false, false]);
  });

  it('replaces job alerts, including sign-ups from closed-job pages (BR-10)', async () => {
    await t.db
      .insert(subscribers)
      .values({ phone: PHONE, department: 'Marketing', consentAt: t.clock.now, policyVersion: 'v' });
    const cookie = await signIn();
    expect(
      (await json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }))).me
        .alertDepartments,
    ).toEqual(['Marketing']);

    const me = await json<CandidateMe>(
      await patch(cookie, { alertDepartments: JSON.stringify(['Kỹ thuật', 'Nhân sự']) }),
    );
    expect(me.alertDepartments.sort()).toEqual(['Kỹ thuật', 'Nhân sự']);

    const none = await json<CandidateMe>(await patch(cookie, { alertDepartments: '[]' }));
    expect(none.alertDepartments).toEqual([]);
    expect(await t.db.select().from(subscribers)).toEqual([]);
  });

  it('rejects unknown departments and unreadable lists', async () => {
    const cookie = await signIn();
    expect((await patch(cookie, { alertDepartments: '["Bếp"]' })).status).toBe(422);
    expect((await patch(cookie, { alertDepartments: '[oops' })).status).toBe(422);
  });

  it('stores a new CV and deletes the previous file', async () => {
    const cookie = await signIn();
    await patch(cookie, {}, pdfFile('v1.pdf'));
    const me = await json<CandidateMe>(await patch(cookie, {}, pdfFile('v2.pdf')));
    expect(me.cvFileName).toBe('v2.pdf');
    const [row] = await t.db.select().from(candidates);
    expect([...t.cvStore.files.keys()]).toEqual([row.cvPathname]);
  });

  it('rejects a CV that is not a PDF', async () => {
    const cookie = await signIn();
    expect((await patch(cookie, {}, new File(['hello'], 'cv.pdf'))).status).toBe(422);
    expect(t.cvStore.files.size).toBe(0);
  });
});

describe('saved jobs', () => {
  it('returns an empty list to signed-out visitors', async () => {
    expect(await (await t.request('/api/candidate/saved')).json()).toEqual([]);
  });

  it('needs a session to save', async () => {
    const job = await insertJob(t);
    expect((await t.send('PUT', `/api/candidate/saved/${job.slug}`, { saved: true })).status).toBe(401);
  });

  it('saves and unsaves by slug', async () => {
    const cookie = await signIn();
    const a = await insertJob(t);
    const b = await insertJob(t);
    await t.send('PUT', `/api/candidate/saved/${a.slug}`, { saved: true }, { cookie });
    later(1000);
    const both = await t.send('PUT', `/api/candidate/saved/${b.slug}`, { saved: true }, { cookie });
    expect((await json<string[]>(both)).sort()).toEqual([a.slug, b.slug].sort());
    const one = await t.send('PUT', `/api/candidate/saved/${a.slug}`, { saved: false }, { cookie });
    expect(await one.json()).toEqual([b.slug]);
    expect(await (await t.request('/api/candidate/saved', { headers: { cookie } })).json()).toEqual([b.slug]);
  });

  it('answers 404 for unknown slugs and drafts', async () => {
    const cookie = await signIn();
    const draft = await insertJob(t, { state: 'draft' });
    expect((await t.send('PUT', '/api/candidate/saved/khong-co', { saved: true }, { cookie })).status).toBe(404);
    expect((await t.send('PUT', `/api/candidate/saved/${draft.slug}`, { saved: true }, { cookie })).status).toBe(404);
  });
});

describe('DELETE /api/candidate/me (BR-14)', () => {
  it('removes applications, CV files, alerts, saved jobs and the account right away', async () => {
    const job = await insertJob(t);
    const cvPath = await t.cvStore.put(job.id, pdfFile());
    await applyAs(job, { cvPathname: cvPath });
    const other = await applyAs(job, { phone: '0999999999' });
    await t.db.insert(subscribers).values([
      { phone: PHONE, department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' },
      { phone: '0999999999', department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' },
    ]);
    const cookie = await signIn();
    await t.send('PUT', `/api/candidate/saved/${job.slug}`, { saved: true }, { cookie });

    const res = await t.send('DELETE', '/api/candidate/me', undefined, { cookie });

    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.getSetCookie().join()).toMatch(/candidate_session=;.*Max-Age=0/);
    expect((await t.db.select().from(applications)).map((a) => a.id)).toEqual([other.id]);
    expect((await t.db.select().from(subscribers)).map((s) => s.phone)).toEqual(['0999999999']);
    expect(await t.db.select().from(candidates)).toEqual([]);
    expect(await t.db.select().from(savedJobs)).toEqual([]);
    expect(t.cvStore.files.size).toBe(0);
    expect((await t.request('/api/candidate/me', { headers: { cookie } })).status).toBe(401);
  });

  it('deletes nothing when the file store fails, so a retry can finish the job', async () => {
    const job = await insertJob(t);
    await applyAs(job, { cvPathname: await t.cvStore.put(job.id, pdfFile()) });
    const cookie = await signIn();
    t.deps.cvStore = {
      ...t.cvStore,
      put: t.cvStore.put.bind(t.cvStore),
      get: t.cvStore.get.bind(t.cvStore),
      delete: async () => {
        throw new Error('blob down');
      },
    };
    try {
      expect((await t.send('DELETE', '/api/candidate/me', undefined, { cookie })).status).toBe(500);
      expect(await t.db.select().from(applications)).toHaveLength(1);
    } finally {
      t.deps.cvStore = t.cvStore;
    }
    expect((await t.send('DELETE', '/api/candidate/me', undefined, { cookie })).status).toBe(200);
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('needs a session', async () => {
    expect((await t.send('DELETE', '/api/candidate/me')).status).toBe(401);
  });
});

describe('logout', () => {
  it('clears both candidate cookies', async () => {
    const res = await t.send('POST', '/api/candidate/logout');
    const cleared = res.headers.getSetCookie().join();
    expect(cleared).toMatch(/candidate_session=;/);
    expect(cleared).toMatch(/candidate_google=;/);
  });
});
