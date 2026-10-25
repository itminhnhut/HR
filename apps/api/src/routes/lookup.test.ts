import type { LookupResponse } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applications, type Job } from '../db/schema.js';
import { insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const PHONE = '0912345678';
const DAY = 24 * 60 * 60 * 1000;
let ip = 0;
/** A fresh IP per call unless given, so per-IP limits only matter where a test means them to. */
const lookup = (phone: string, from = `10.0.0.${++ip}`) =>
  t.send('POST', '/api/applications/lookup', { phone }, { 'x-forwarded-for': `198.51.100.250, ${from}` });

async function applied(job: Job, overrides: Partial<typeof applications.$inferInsert> = {}) {
  await t.db.insert(applications).values({
    jobId: job.id,
    fullName: 'Nguyễn Bí Mật',
    phone: PHONE,
    email: 'bimat@gmail.com',
    note: 'Ghi chú nội bộ HR',
    consentAt: t.clock.now,
    policyVersion: 'v',
    ...overrides,
  });
}

describe('POST /api/applications/lookup', () => {
  it('lists only job, date and candidate-facing stage, never personal data or HR notes', async () => {
    const job = await insertJob(t, { title: 'Kỹ sư', slug: 'ky-su' });
    await applied(job, { status: 'interview', createdAt: new Date('2026-10-18T17:30:00Z') });

    const res = await lookup('0912 345 678');
    const raw = await res.text();
    const body = JSON.parse(raw) as LookupResponse;

    expect(res.status).toBe(200);
    expect(body).toEqual({
      applications: [{ jobTitle: 'Kỹ sư', jobSlug: 'ky-su', appliedOn: '2026-10-19', stage: 'interview' }],
    });
    for (const secret of ['Bí Mật', 'bimat', 'Ghi chú', PHONE]) expect(raw).not.toContain(secret);
  });

  it('shows a rejected application as closed, never as rejected', async () => {
    await applied(await insertJob(t), { status: 'rejected' });
    expect((await json<LookupResponse>(await lookup(PHONE))).applications[0].stage).toBe('closed');
  });

  it('only covers the last 90 days, newest first', async () => {
    const job = await insertJob(t, { title: 'Mới' });
    const old = await insertJob(t, { title: 'Cũ' });
    await applied(job, { createdAt: new Date(t.clock.now.getTime() - 89 * DAY) });
    await applied(old, { createdAt: new Date(t.clock.now.getTime() - 91 * DAY) });
    await applied(await insertJob(t, { title: 'Gần nhất' }), { createdAt: t.clock.now });

    const { applications: list } = await json<LookupResponse>(await lookup(PHONE));
    expect(list.map((a) => a.jobTitle)).toEqual(['Gần nhất', 'Mới']);
  });

  it('returns nothing for a number without applications', async () => {
    await applied(await insertJob(t));
    expect((await json<LookupResponse>(await lookup('0987654321'))).applications).toEqual([]);
  });

  it('rejects an invalid number', async () => {
    const res = await lookup('123');
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { phone: expect.any(String) } });
  });

  it('allows 5 lookups per IP every 15 minutes', async () => {
    for (let i = 0; i < 5; i++) expect((await lookup(`09120000${10 + i}`, '1.2.3.4')).status).toBe(200);
    expect((await lookup('0912000020', '1.2.3.4')).status).toBe(429);
    expect((await lookup('0912000020', '5.6.7.8')).status).toBe(200);
    t.clock.now = new Date(t.clock.now.getTime() + 15 * 60 * 1000 + 1000);
    expect((await lookup('0912000020', '1.2.3.4')).status).toBe(200);
  });

  it('allows 10 lookups per number per day, from any IP', async () => {
    for (let i = 0; i < 10; i++) expect((await lookup(PHONE)).status).toBe(200);
    const res = await lookup(PHONE);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/thử lại/i) });
    t.clock.now = new Date(t.clock.now.getTime() + DAY + 1000);
    expect((await lookup(PHONE)).status).toBe(200);
  });

  it('counts parallel lookups against the same limit', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => lookup(`09120000${30 + i}`, '9.9.9.9')));
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
  });

  it('needs the CSRF header and keeps the number out of the URL', async () => {
    const res = await t.request('/api/applications/lookup', { method: 'POST', body: JSON.stringify({ phone: PHONE }) });
    expect(res.status).toBe(403);
    expect((await t.request(`/api/applications/lookup?phone=${PHONE}`)).status).toBe(404);
  });

  // Kept out of search engines by X-Robots-Tag: noindex, see vercel-config.test.ts.
});
