import { DEFAULT_JOB_TEMPLATE } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from './db/schema.js';
import { createTestContext, DEFAULT_NOW, type TestContext } from './test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

describe('app shell', () => {
  it('answers the health check', async () => {
    const res = await t.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('rejects writes without the CSRF header', async () => {
    const res = await t.request('/api/health', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });

  it('rejects writes whose CSRF header has the wrong value', async () => {
    const res = await t.request('/api/health', { method: 'DELETE', headers: { 'x-requested-with': 'XMLHttpRequest' } });
    expect(res.status).toBe(403);
  });

  it('lets writes with the CSRF header through to routing', async () => {
    const res = await t.send('POST', '/api/health');
    expect(res.status).toBe(404);
  });

  it('allows reads without the CSRF header', async () => {
    expect((await t.request('/api/health', { method: 'HEAD' })).status).toBe(200);
  });

  it('sends security headers', async () => {
    const res = await t.request('/api/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('returns JSON 404 for unknown API paths', async () => {
    const res = await t.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });
});

describe('test harness', () => {
  it('empties every table on reset', async () => {
    const [job] = await t.db
      .insert(schema.jobs)
      .values({
        slug: 'a',
        title: 'A',
        department: 'Kỹ thuật',
        employmentType: 'full_time',
        deadline: '2026-11-01',
      })
      .returning();
    const now = new Date();
    await t.db.insert(schema.candidates).values({ email: 'an@gmail.com' });
    await t.db.insert(schema.applications).values({
      jobId: job.id,
      fullName: 'Nguyễn An',
      phone: '0912345678',
      consentAt: now,
      policyVersion: 'v',
    });
    await t.db
      .insert(schema.subscribers)
      .values({ phone: '0912345678', department: 'Kỹ thuật', consentAt: now, policyVersion: 'v' });
    await t.db.insert(schema.jobTemplates).values({ id: 1, data: DEFAULT_JOB_TEMPLATE });
    await t.db.insert(schema.hrUsers).values({ email: 'hr@x.vn', passwordHash: 'h' });
    t.clock.now = new Date('2030-01-01T00:00:00Z');

    await t.reset();

    for (const table of [
      schema.jobs,
      schema.applications,
      schema.subscribers,
      schema.candidates,
      schema.hrUsers,
      schema.jobTemplates,
    ]) {
      expect(await t.db.select().from(table)).toEqual([]);
    }
    expect(t.deps.now()).toEqual(DEFAULT_NOW);
  });

  it('applies column defaults from the migration', async () => {
    const [job] = await t.db
      .insert(schema.jobs)
      .values({
        slug: 'b',
        title: 'B',
        department: 'Kỹ thuật',
        employmentType: 'full_time',
        deadline: '2026-11-01',
      })
      .returning();
    expect(job).toMatchObject({ state: 'draft', benefits: [], roadmap: [], responsibilities: '', publishedOn: null });
    expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('refuses to delete a job that still has applications', async () => {
    const [job] = await t.db
      .insert(schema.jobs)
      .values({
        slug: 'c',
        title: 'C',
        department: 'Kỹ thuật',
        employmentType: 'full_time',
        deadline: '2026-11-01',
      })
      .returning();
    await t.db.insert(schema.applications).values({
      jobId: job.id,
      fullName: 'Nguyễn An',
      phone: '0912345678',
      consentAt: new Date(),
      policyVersion: 'v',
    });
    await expect(t.db.delete(schema.jobs)).rejects.toThrow();
    expect(await t.db.select().from(schema.applications)).toHaveLength(1);
  });

  it('enforces one sign-up per phone and department', async () => {
    const row = { phone: '0912345678', department: 'Kỹ thuật', consentAt: new Date(), policyVersion: 'v' };
    await t.db.insert(schema.subscribers).values(row);
    await expect(t.db.insert(schema.subscribers).values(row)).rejects.toThrow();
  });
});
