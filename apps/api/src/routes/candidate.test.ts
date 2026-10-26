import type { ApplyResponse, CandidateMe, CandidateOverview } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, candidates, subscribers, type Job } from '../db/schema.js';
import { googleToken, pdfFile } from '../test/fakes.js';
import { cookiesFrom, insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const EMAIL = 'minhanh@gmail.com';

const google = (email = EMAIL) => t.send('POST', '/api/candidate/google', { idToken: googleToken(email) });

async function signIn(email = EMAIL): Promise<string> {
  const res = await google(email);
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
  return cookiesFrom(res);
}

const overview = async (cookie: string) =>
  json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }));

async function applyRow(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  const [row] = await t.db
    .insert(applications)
    .values({
      jobId: job.id,
      fullName: 'Trần Minh Anh',
      phone: '0912345678',
      email: EMAIL,
      consentAt: t.clock.now,
      policyVersion: 'v',
      ...overrides,
    })
    .returning();
  return row;
}

describe('Google sign-in', () => {
  it('creates the account on first sign-in, without asking for a phone', async () => {
    const res = await google('MinhAnh@Gmail.com');
    expect(res.status).toBe(200);
    expect(await json<CandidateMe>(res)).toEqual({
      email: EMAIL,
      phone: null,
      name: 'Người Test',
      cvFileName: null,
      alertDepartments: [],
    });
    expect(res.headers.getSetCookie()[0]).toMatch(/^candidate_session=.*HttpOnly/i);
  });

  it('signs back into the same account later', async () => {
    await google();
    await google('MINHANH@gmail.com');
    expect(await t.db.select().from(candidates)).toHaveLength(1);
  });

  it('pre-fills a new account from the latest application sent with that email', async () => {
    const job = await insertJob(t);
    await applyRow(job, { fullName: 'Cũ', phone: '0900000000', createdAt: new Date('2026-10-01T00:00:00Z') });
    await applyRow(job, { fullName: 'Trần Minh Anh', email: 'MinhAnh@gmail.com' });

    const me = await json<CandidateMe>(await google());

    expect(me).toMatchObject({ name: 'Trần Minh Anh', phone: '0912345678' });
  });

  it('refuses an invalid Google token', async () => {
    expect((await t.send('POST', '/api/candidate/google', { idToken: 'x' })).status).toBe(401);
    expect((await t.send('POST', '/api/candidate/google', {})).status).toBe(400);
  });

  it('no longer offers phone sign-in', async () => {
    expect((await t.send('POST', '/api/candidate/otp', { phone: '0912345678', channel: 'zalo' })).status).toBe(404);
    expect((await t.send('POST', '/api/candidate/otp/verify', { phone: '0912345678', code: '1' })).status).toBe(404);
  });
});

describe('GET /api/candidate/me', () => {
  it('should answer 200 { signedIn: false } to a visitor who is not signed in, so public pages log no error', async () => {
    // Act
    const res = await t.request('/api/candidate/me');

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedIn: false });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('shows only applications sent with the Google email, with the stage the candidate may see', async () => {
    const open = await insertJob(t, {
      title: 'Đang tuyển',
      salaryMin: 15_000_000,
      salaryMax: 20_000_000,
      address: 'Huế',
    });
    const closed = await insertJob(t, { title: 'Đã đóng', state: 'closed', closedOn: '2026-10-19' });
    await applyRow(open, { status: 'seen', email: 'MINHANH@gmail.com', createdAt: new Date('2026-10-19T00:00:00Z') });
    await applyRow(closed, { status: 'new', createdAt: new Date('2026-10-18T00:00:00Z') });
    await applyRow(open, { email: 'nguoikhac@gmail.com' });
    await applyRow(open, { email: null });
    const cookie = await signIn();

    const body = await overview(cookie);

    expect(body.applications.map((a) => [a.jobTitle, a.stage])).toEqual([
      ['Đang tuyển', 'seen'],
      ['Đã đóng', 'closed'],
    ]);
    expect(body.applications[0]).toMatchObject({ jobSlug: open.slug, salary: '15 – 20 triệu', place: 'Huế' });
  });

  it('never shows "rejected" wording: a rejected application reads as closed', async () => {
    await applyRow(await insertJob(t), { status: 'rejected' });
    expect((await overview(await signIn())).applications[0].stage).toBe('closed');
  });

  it('should treat a session whose account no longer exists as signed out', async () => {
    const cookie = await signIn();
    await t.db.delete(candidates);
    expect(await (await t.request('/api/candidate/me', { headers: { cookie } })).json()).toEqual({ signedIn: false });
  });
});

describe('applying while signed in', () => {
  it('always files the application under the Google email, whatever the form says', async () => {
    const job = await insertJob(t);
    const cookie = await signIn();
    const form = new FormData();
    const fields = {
      jobId: job.id,
      fullName: 'Trần Minh Anh',
      phone: '0912345678',
      email: 'khac@yahoo.com',
      cvLink: 'https://drive.google.com/x',
      consent: 'true',
      formOpenedAt: String(t.clock.now.getTime()),
    };
    for (const [k, v] of Object.entries(fields)) form.append(k, v);

    const res = await t.request('/api/applications', {
      method: 'POST',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });

    expect((await json<ApplyResponse>(res)).ok).toBe(true);
    expect((await t.db.select().from(applications))[0].email).toBe(EMAIL);
    expect((await overview(cookie)).applications).toHaveLength(1);
  });
});

describe('applying with the saved CV (one CV per account)', () => {
  const form = (jobId: string, extra: Record<string, string> = {}) => {
    const f = new FormData();
    const fields = {
      jobId,
      fullName: 'Trần Minh Anh',
      phone: '0912345678',
      consent: 'true',
      formOpenedAt: String(t.clock.now.getTime()),
      ...extra,
    };
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    return f;
  };
  const send = (body: FormData, cookie = '') =>
    t.request('/api/applications', { method: 'POST', body, headers: { cookie, 'x-requested-with': 'careers-web' } });
  const uploadCv = async (cookie: string, file: File) => {
    const f = new FormData();
    f.append('cv', file);
    await t.request('/api/candidate/me', {
      method: 'PATCH',
      body: f,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });
  };

  it('copies the account CV into the application, so later changes do not touch it', async () => {
    const job = await insertJob(t);
    const cookie = await signIn();
    await uploadCv(cookie, pdfFile('CV-MinhAnh.pdf', 2000));
    const [account] = await t.db.select().from(candidates);

    expect((await send(form(job.id, { useSavedCv: 'true' }), cookie)).status).toBe(200);

    const [app] = await t.db.select().from(applications);
    expect(app.cvFileName).toBe('CV-MinhAnh.pdf');
    expect(app.cvPathname).not.toBe(account.cvPathname);
    const copy = new Uint8Array(t.cvStore.files.get(app.cvPathname ?? '') ?? new ArrayBuffer(0));
    const original = new Uint8Array(t.cvStore.files.get(account.cvPathname ?? '') ?? new ArrayBuffer(0));
    expect(copy).toEqual(original);

    await uploadCv(cookie, pdfFile('CV-moi.pdf'));
    expect(t.cvStore.files.has(app.cvPathname ?? '')).toBe(true);
  });

  it('asks for a CV when the account has none saved', async () => {
    const job = await insertJob(t);
    const res = await send(form(job.id, { useSavedCv: 'true' }), await signIn());
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { cv: expect.stringMatching(/chưa có CV/) } });
  });

  it('never reuses a CV for someone who is not signed in', async () => {
    const job = await insertJob(t);
    const cookie = await signIn();
    await uploadCv(cookie, pdfFile());
    expect((await send(form(job.id, { useSavedCv: 'true' }))).status).toBe(422);
    expect(await t.db.select().from(applications)).toEqual([]);
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

  it('updates the name and an optional, normalized phone', async () => {
    const cookie = await signIn();
    const me = await json<CandidateMe>(await patch(cookie, { name: '  Minh Anh ', phone: '+84 912 345 678' }));
    expect(me).toMatchObject({ name: 'Minh Anh', phone: '0912345678', email: EMAIL });
    expect((await json<CandidateMe>(await patch(cookie, { phone: '' }))).phone).toBeNull();
  });

  it('rejects an invalid phone', async () => {
    const cookie = await signIn();
    const res = await patch(cookie, { phone: '123' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { phone: expect.any(String) } });
  });

  it('needs a phone before turning job alerts on (BR-10)', async () => {
    const cookie = await signIn();
    const res = await patch(cookie, { alertDepartments: '["Kỹ thuật"]' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      fieldErrors: { alertDepartments: expect.stringMatching(/số điện thoại/) },
    });
    expect(await t.db.select().from(subscribers)).toEqual([]);

    const me = await json<CandidateMe>(await patch(cookie, { phone: '0912345678', alertDepartments: '["Kỹ thuật"]' }));
    expect(me.alertDepartments).toEqual(['Kỹ thuật']);
  });

  it('replaces its own alerts, keeping the first consent time', async () => {
    const cookie = await signIn();
    await patch(cookie, { phone: '0912345678', alertDepartments: '["Kỹ thuật"]' });
    const firstConsent = (await t.db.select().from(subscribers))[0].consentAt;
    t.clock.now = new Date(t.clock.now.getTime() + 60_000);

    const me = await json<CandidateMe>(await patch(cookie, { alertDepartments: '["Kỹ thuật","Nhân sự"]' }));

    expect(me.alertDepartments.sort()).toEqual(['Kỹ thuật', 'Nhân sự']);
    const rows = await t.db.select().from(subscribers);
    expect(rows.find((r) => r.department === 'Kỹ thuật')?.consentAt).toEqual(firstConsent);
    expect(rows.find((r) => r.department === 'Nhân sự')?.consentAt).toEqual(t.clock.now);
    expect((await json<CandidateMe>(await patch(cookie, { alertDepartments: '[]' }))).alertDepartments).toEqual([]);
  });

  it('cannot see or remove public sign-ups of a phone it merely typed in (unverified)', async () => {
    await t.db
      .insert(subscribers)
      .values({ phone: '0912345678', department: 'Marketing', consentAt: t.clock.now, policyVersion: 'v' });
    const cookie = await signIn();

    const me = await json<CandidateMe>(await patch(cookie, { phone: '0912345678' }));
    expect(me.alertDepartments).toEqual([]);
    await patch(cookie, { alertDepartments: '["Kỹ thuật"]' });
    await patch(cookie, { alertDepartments: '[]' });
    await patch(cookie, { phone: '0987654321' });
    await t.send('DELETE', '/api/candidate/me', undefined, { cookie });

    const left = await t.db.select().from(subscribers);
    expect(left.map((r) => [r.phone, r.department, r.candidateId])).toEqual([['0912345678', 'Marketing', null]]);
  });

  it('moves alerts to a new phone, and refuses to drop the phone while alerts are on', async () => {
    const cookie = await signIn();
    await patch(cookie, { phone: '0912345678', alertDepartments: '["Kỹ thuật"]' });

    const moved = await json<CandidateMe>(await patch(cookie, { phone: '0987654321' }));
    expect(moved.alertDepartments).toEqual(['Kỹ thuật']);
    expect((await t.db.select().from(subscribers)).map((s) => s.phone)).toEqual(['0987654321']);
    expect((await t.db.select().from(subscribers))[0].candidateId).not.toBeNull();

    expect((await patch(cookie, { phone: '' })).status).toBe(422);
    expect((await patch(cookie, { phone: '', alertDepartments: '[]' })).status).toBe(200);
    expect(await t.db.select().from(subscribers)).toEqual([]);
  });

  it('rejects empty departments and unreadable lists', async () => {
    const cookie = await signIn();
    await patch(cookie, { phone: '0912345678' });
    expect((await patch(cookie, { alertDepartments: '[" "]' })).status).toBe(422);
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

describe('saved jobs (removed)', () => {
  it('no longer offers saving jobs', async () => {
    const cookie = await signIn();
    const job = await insertJob(t);
    expect((await t.request('/api/candidate/saved', { headers: { cookie } })).status).toBe(404);
    expect((await t.send('PUT', `/api/candidate/saved/${job.slug}`, { saved: true }, { cookie })).status).toBe(404);
  });
});

describe('DELETE /api/candidate/me (BR-14)', () => {
  it('removes the account, its applications and CV files, its own alerts right away', async () => {
    const job = await insertJob(t);
    await applyRow(job, { cvPathname: await t.cvStore.put(job.id, pdfFile()) });
    const other = await applyRow(job, { email: 'khac@gmail.com', phone: '0999999999' });
    await t.db.insert(subscribers).values([
      { phone: '0912345678', department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' },
      { phone: '0999999999', department: 'Kỹ thuật', consentAt: t.clock.now, policyVersion: 'v' },
    ]);
    const cookie = await signIn();
    const form = new FormData();
    form.append('phone', '0912345678');
    form.append('alertDepartments', '["Marketing"]');
    await t.request('/api/candidate/me', {
      method: 'PATCH',
      body: form,
      headers: { cookie, 'x-requested-with': 'careers-web' },
    });

    const res = await t.send('DELETE', '/api/candidate/me', undefined, { cookie });

    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.getSetCookie().join()).toMatch(/candidate_session=;.*Max-Age=0/);
    expect((await t.db.select().from(applications)).map((a) => a.id)).toEqual([other.id]);
    // Its own alert goes; public sign-ups stay (the account never proved it owns that phone).
    const left = await t.db.select().from(subscribers).orderBy(subscribers.phone);
    expect(left.map((s) => [s.phone, s.department])).toEqual([
      ['0912345678', 'Kỹ thuật'],
      ['0999999999', 'Kỹ thuật'],
    ]);
    expect(await t.db.select().from(candidates)).toEqual([]);
    expect(t.cvStore.files.size).toBe(0);
    expect(await (await t.request('/api/candidate/me', { headers: { cookie } })).json()).toEqual({ signedIn: false });
  });

  it('deletes nothing when the file store fails, so a retry can finish the job', async () => {
    const job = await insertJob(t);
    await applyRow(job, { cvPathname: await t.cvStore.put(job.id, pdfFile()) });
    const cookie = await signIn();
    t.deps.cvStore = {
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
  it('clears the candidate cookie', async () => {
    const res = await t.send('POST', '/api/candidate/logout');
    expect(res.headers.getSetCookie().join()).toMatch(/candidate_session=;/);
  });
});
