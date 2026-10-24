import type { ApplyResponse } from '@careers/shared';
import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, subscribers } from '../db/schema.js';
import { pdfFile } from '../test/fakes.js';
import { insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

type Fields = Record<string, string | boolean | number | null | undefined>;

/** Same encoding as httpApi.apply in apps/web/src/api/http.ts. */
function applyForm(fields: Fields, cv: File | null = null) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== null && v !== undefined) form.append(k, String(v));
  if (cv) form.append('cv', cv);
  return t.request('/api/applications', { method: 'POST', body: form, headers: { 'x-requested-with': 'careers-web' } });
}

const fields = (jobId: string, overrides: Fields = {}): Fields => ({
  jobId,
  fullName: 'Nguyễn Văn An',
  phone: '0912 000 111',
  email: '',
  message: '',
  cvLink: 'https://drive.google.com/cv',
  consent: true,
  formOpenedAt: t.clock.now.getTime(),
  ...overrides,
});

describe('POST /api/applications', () => {
  it('stores an application with consent evidence (BR-12)', async () => {
    const job = await insertJob(t);

    const res = await applyForm(fields(job.id));

    expect(res.status).toBe(200);
    expect(await json<ApplyResponse>(res)).toEqual({
      ok: true,
      firstName: 'An',
      phone: '0912000111',
      updatedExisting: false,
      previousDate: null,
    });
    const [row] = await t.db.select().from(applications);
    expect(row).toMatchObject({
      jobId: job.id,
      phone: '0912000111',
      status: 'new',
      email: null,
      cvLink: 'https://drive.google.com/cv',
      policyVersion: '2026-10',
    });
    expect(row.consentAt).toEqual(t.clock.now);
  });

  it('requires the consent tick (BR-11)', async () => {
    const job = await insertJob(t);
    const res = await applyForm(fields(job.id, { consent: false }));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.consent).toBeTruthy();
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('requires a CV file or link', async () => {
    const job = await insertJob(t);
    const res = await applyForm(fields(job.id, { cvLink: '' }));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe(
      'Đính kèm file CV hoặc dán link CV.',
    );
  });

  it('stores an uploaded PDF in the private store', async () => {
    const job = await insertJob(t);

    const res = await applyForm(fields(job.id, { cvLink: '' }), pdfFile('Nguyen An.pdf'));

    expect(res.status).toBe(200);
    const [row] = await t.db.select().from(applications);
    expect(row.cvFileName).toBe('Nguyen An.pdf');
    expect(row.cvPathname).toMatch(new RegExp(`^cv/${job.id}/`));
    expect(t.cvStore.files.has(row.cvPathname ?? '')).toBe(true);
  });

  it('rejects CVs over 4 MB', async () => {
    const job = await insertJob(t);
    const res = await applyForm(fields(job.id), pdfFile('big.pdf', 4 * 1024 * 1024));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toMatch(/4 MB/);
    expect(t.cvStore.files.size).toBe(0);
  });

  it('rejects files that are not really PDF, whatever their name', async () => {
    const job = await insertJob(t);
    const fake = new File(['<html>'], 'cv.pdf', { type: 'application/pdf' });
    const res = await applyForm(fields(job.id), fake);
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toBe('CV cần là file PDF.');
  });

  it('rejects a PDF that was cut off before its %%EOF marker', async () => {
    const job = await insertJob(t);
    const truncated = new File([new TextEncoder().encode('%PDF-1.7\n'), new Uint8Array(2000)], 'cv.pdf', {
      type: 'application/pdf',
    });

    const res = await applyForm(fields(job.id, { cvLink: '' }), truncated);

    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.cv).toMatch(
      /^File PDF bị lỗi hoặc chưa tải hết/,
    );
    expect(await t.db.select().from(applications)).toEqual([]);
    expect(t.cvStore.files.size).toBe(0);
  });

  it('rejects an invalid phone number', async () => {
    const job = await insertJob(t);
    const res = await applyForm(fields(job.id, { phone: '12345' }));
    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors.phone).toBeTruthy();
  });

  it('updates instead of duplicating within 30 days (BR-07)', async () => {
    const job = await insertJob(t);
    await applyForm(fields(job.id, { message: 'Lần 1' }));
    const firstAt = t.clock.now;
    t.clock.now = new Date(firstAt.getTime() + 29 * 24 * 60 * 60 * 1000);

    const res = await applyForm(fields(job.id, { phone: '+84 912 000 111', message: 'Lần 2' }));

    const body = await json<ApplyResponse>(res);
    expect(body).toMatchObject({ updatedExisting: true, previousDate: firstAt.toISOString() });
    const rows = await t.db.select().from(applications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ message: 'Lần 2', status: 'new' });
    expect(rows[0].createdAt).toEqual(t.clock.now);
  });

  it('keeps the status and note HR set when the candidate re-applies, moving it to the top (BR-07)', async () => {
    const job = await insertJob(t);
    await applyForm(fields(job.id, { message: 'Bản đầu' }));
    await t.db.update(applications).set({ status: 'interview', note: 'Hẹn thứ 5' });
    t.clock.now = new Date(t.clock.now.getTime() + 2 * 24 * 60 * 60 * 1000);

    await applyForm(fields(job.id, { message: 'Bản mới' }));

    const [row] = await t.db.select().from(applications);
    expect(row).toMatchObject({ status: 'interview', note: 'Hẹn thứ 5', message: 'Bản mới' });
    expect(row.createdAt).toEqual(t.clock.now);
  });

  it('counts the 30 days in Vietnam calendar days', async () => {
    const job = await insertJob(t, { deadline: '2026-12-15' });
    t.clock.now = new Date('2026-10-20T16:30:00.000Z'); // 23:30 on 20/10 in Vietnam
    await applyForm(fields(job.id));
    t.clock.now = new Date('2026-11-19T17:30:00.000Z'); // 00:30 on 20/11, 31 calendar days later
    expect((await json<ApplyResponse>(await applyForm(fields(job.id)))).updatedExisting).toBe(false);
    expect(await t.db.select().from(applications)).toHaveLength(2);
  });

  it('keeps applications for different jobs separate', async () => {
    const a = await insertJob(t);
    const b = await insertJob(t);
    await applyForm(fields(a.id));
    expect((await json<ApplyResponse>(await applyForm(fields(b.id)))).updatedExisting).toBe(false);
  });

  // PGlite runs transactions one at a time, so this guards the logic only. The advisory lock itself was
  // checked against a real Postgres 14: 15 parallel submits gave 1 row with the lock, 6-14 rows without.
  it('never creates two applications from a double submit', async () => {
    const job = await insertJob(t);
    const results = await Promise.all([applyForm(fields(job.id)), applyForm(fields(job.id))]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await t.db.select().from(applications)).toHaveLength(1);
  });

  it('replaces the stored CV file when the candidate re-applies with a new one', async () => {
    const job = await insertJob(t);
    await applyForm(fields(job.id), pdfFile('v1.pdf'));
    await applyForm(fields(job.id), pdfFile('v2.pdf'));
    const [row] = await t.db.select().from(applications);
    expect(row.cvFileName).toBe('v2.pdf');
    expect([...t.cvStore.files.keys()]).toEqual([row.cvPathname]);
  });

  it('refuses closed jobs with code job_closed', async () => {
    const closed = await insertJob(t, { state: 'closed', closedOn: '2026-10-19' });
    const expired = await insertJob(t, { deadline: '2026-10-19' });
    const draft = await insertJob(t, { state: 'draft' });
    for (const job of [closed, expired, draft]) {
      const res = await applyForm(fields(job.id));
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'job_closed' });
    }
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('accepts applications until 23:59 Vietnam time on the deadline day', async () => {
    const job = await insertJob(t, { deadline: '2026-10-20' });
    t.clock.now = new Date('2026-10-20T16:59:00.000Z'); // 23:59 Vietnam
    expect((await applyForm(fields(job.id))).status).toBe(200);
  });

  it('refuses an application sent after the deadline, even from a form opened before it', async () => {
    const job = await insertJob(t, { deadline: '2026-10-20' });
    const openedAt = new Date('2026-10-20T16:50:00.000Z').getTime(); // 23:50 Vietnam
    t.clock.now = new Date('2026-10-20T17:01:00.000Z'); // 00:01 next day

    const res = await applyForm(fields(job.id, { formOpenedAt: openedAt }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'job_closed' });
    expect(await t.db.select().from(applications)).toEqual([]);
  });

  it('answers 404 for an unknown or malformed job id', async () => {
    expect((await applyForm(fields('00000000-0000-0000-0000-000000000000'))).status).toBe(404);
    expect((await applyForm(fields('not-a-uuid'))).status).toBe(404);
  });

  it('pretends to accept honeypot submissions without storing them', async () => {
    const job = await insertJob(t);
    const res = await applyForm(fields(job.id, { website: 'http://spam' }), pdfFile());
    expect(res.status).toBe(200);
    expect(await t.db.select().from(applications)).toEqual([]);
    expect(t.cvStore.files.size).toBe(0);
  });

  it('removes the uploaded file when saving the application fails', async () => {
    const job = await insertJob(t);
    await t.db.execute(sql`ALTER TABLE applications RENAME TO applications_tmp`);
    try {
      expect((await applyForm(fields(job.id), pdfFile())).status).toBe(500);
      expect(t.cvStore.files.size).toBe(0);
    } finally {
      await t.db.execute(sql`ALTER TABLE applications_tmp RENAME TO applications`);
    }
  });

  it('needs the CSRF header', async () => {
    const job = await insertJob(t);
    const form = new FormData();
    form.append('jobId', job.id);
    expect((await t.request('/api/applications', { method: 'POST', body: form })).status).toBe(403);
  });
});

describe('POST /api/subscribers', () => {
  const subscribe = (body: unknown) => t.send('POST', '/api/subscribers', body);

  it('needs its own consent (BR-10)', async () => {
    const res = await subscribe({ phone: '0912000111', department: 'Kỹ thuật', consent: false });
    expect(res.status).toBe(422);
    expect(await t.db.select().from(subscribers)).toEqual([]);
  });

  it('stores phone, department, source job and consent evidence', async () => {
    const job = await insertJob(t);
    const res = await subscribe({ phone: '0912 000 111', department: 'Kỹ thuật', fromJobId: job.id, consent: true });
    expect(await res.json()).toEqual({ ok: true });
    const [row] = await t.db.select().from(subscribers);
    expect(row).toMatchObject({
      phone: '0912000111',
      department: 'Kỹ thuật',
      fromJobId: job.id,
      policyVersion: '2026-10',
    });
    expect(row.consentAt).toEqual(t.clock.now);
  });

  it('ignores a repeat sign-up for the same department', async () => {
    const body = { phone: '0912000111', department: 'Kỹ thuật', consent: true };
    await subscribe(body);
    expect((await subscribe(body)).status).toBe(200);
    expect(await t.db.select().from(subscribers)).toHaveLength(1);
  });

  it('drops an unknown source job instead of failing', async () => {
    await subscribe({ phone: '0912000111', department: 'Kỹ thuật', fromJobId: 'abc', consent: true });
    expect((await t.db.select().from(subscribers))[0].fromJobId).toBeNull();
  });

  it('rejects an empty department', async () => {
    const res = await subscribe({ phone: '0912000111', department: ' ', consent: true });
    expect(res.status).toBe(422);
  });

  it('answers 400 for a body that is not JSON', async () => {
    const res = await t.request('/api/subscribers', {
      method: 'POST',
      headers: { 'x-requested-with': 'careers-web', 'content-type': 'application/json' },
      body: '{oops',
    });
    expect(res.status).toBe(400);
  });
});
