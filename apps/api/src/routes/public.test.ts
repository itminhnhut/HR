import { addDays, type JobListResponse, type JobPageResponse } from '@careers/shared';
import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { insertJob, json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

const TODAY = '2026-10-20';

describe('GET /api/jobs', () => {
  it('lists only open and expiring jobs, newest first', async () => {
    await insertJob(t, { slug: 'cu', publishedOn: '2026-10-01' });
    await insertJob(t, { slug: 'moi', publishedOn: '2026-10-19' });
    await insertJob(t, { slug: 'sap-het', deadline: addDays(TODAY, 2) });
    await insertJob(t, { slug: 'nhap', state: 'draft', publishedOn: null });
    await insertJob(t, { slug: 'tam-dung', state: 'paused' });
    await insertJob(t, { slug: 'du-nguoi', state: 'filled' });
    await insertJob(t, { slug: 'het-han', deadline: '2026-10-19', publishedOn: '2026-09-01' });

    const body = await json<JobListResponse>(await t.request('/api/jobs'));

    expect(body.jobs.map((j) => j.slug)).toEqual(['sap-het', 'moi', 'cu']);
    expect(body.jobs.find((j) => j.slug === 'sap-het')?.status).toBe('expiring');
    expect(body.jobs.find((j) => j.slug === 'moi')?.status).toBe('open');
  });

  it('keeps a job listed until 23:59 Vietnam time on its deadline (BR-02)', async () => {
    await insertJob(t, { slug: 'hom-nay', deadline: TODAY });
    t.clock.now = new Date('2026-10-20T16:59:00.000Z'); // 23:59 in Vietnam
    expect((await json<JobListResponse>(await t.request('/api/jobs'))).jobs).toHaveLength(1);
    t.clock.now = new Date('2026-10-20T17:00:00.000Z'); // 00:00 next day
    expect((await json<JobListResponse>(await t.request('/api/jobs'))).jobs).toHaveLength(0);
  });

  it('returns the distinct cities of listed jobs', async () => {
    await insertJob(t, { city: 'Hà Nội' });
    await insertJob(t, { city: 'Đà Nẵng' });
    await insertJob(t, { city: 'Hà Nội' });
    await insertJob(t, { city: 'Cần Thơ', state: 'draft' });

    const body = await json<JobListResponse>(await t.request('/api/jobs'));

    expect(body.cities.sort()).toEqual(['Hà Nội', 'Đà Nẵng'].sort());
  });

  it('builds the card perk line from the first income benefit', async () => {
    await insertJob(t, { benefitIncome: '- Thưởng quý\n- Lương 13', benefitEnvironment: 'Văn phòng đẹp' });
    await insertJob(t, { benefitIncome: '', benefitEnvironment: 'Làm việc linh hoạt' });

    const { jobs } = await json<JobListResponse>(await t.request('/api/jobs'));

    expect(jobs.map((j) => j.perks).sort()).toEqual(['Làm việc linh hoạt', 'Thưởng quý']);
  });
});

describe('GET /api/jobs/:slug', () => {
  it('returns the full job with multi-line fields split into items', async () => {
    await insertJob(t, {
      slug: 'ky-su',
      responsibilities: '- Viết API\n\n• Review code',
      skills: ['TypeScript', 'SQL'],
      plan30: 'Làm quen',
    });

    const res = await t.request('/api/jobs/ky-su');
    const { job } = await json<JobPageResponse>(res);

    expect(res.status).toBe(200);
    expect(job).toMatchObject({
      slug: 'ky-su',
      status: 'open',
      responsibilities: ['Viết API', 'Review code'],
      skills: ['TypeScript', 'SQL'],
      plan: { day30: 'Làm quen', day60: null, day90: null },
      benefits: { income: ['Lương tháng 13'], insurance: [] },
      publishedAt: `${TODAY}T02:00:00.000Z`,
    });
  });

  it('still shows an expired job instead of 404 (BR-05)', async () => {
    await insertJob(t, { slug: 'het-han', deadline: '2026-10-10', publishedOn: '2026-09-01' });
    const res = await t.request('/api/jobs/het-han');
    expect(res.status).toBe(200);
    expect((await json<JobPageResponse>(res)).job.status).toBe('expired');
  });

  it('still shows filled and paused jobs (BR-05, BR-06)', async () => {
    await insertJob(t, { slug: 'du', state: 'filled' });
    await insertJob(t, { slug: 'dung', state: 'paused' });
    expect((await json<JobPageResponse>(await t.request('/api/jobs/du'))).job.status).toBe('filled');
    expect((await json<JobPageResponse>(await t.request('/api/jobs/dung'))).job.status).toBe('paused');
  });

  it('hides drafts and unknown slugs with 404', async () => {
    await insertJob(t, { slug: 'nhap', state: 'draft', publishedOn: null });
    expect((await t.request('/api/jobs/nhap')).status).toBe(404);
    const res = await t.request('/api/jobs/khong-co');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'Không tìm thấy tin tuyển dụng.' });
  });

  it('suggests up to 3 open jobs, same department first, then same city (BR-05)', async () => {
    await insertJob(t, { slug: 'goc', department: 'Kỹ thuật', city: 'Hà Nội', state: 'filled' });
    await insertJob(t, { slug: 'kt-1', department: 'Kỹ thuật', city: 'Huế' });
    await insertJob(t, { slug: 'kt-2', department: 'Kỹ thuật', city: 'Huế' });
    await insertJob(t, { slug: 'mkt-hn', department: 'Marketing', city: 'Hà Nội' });
    await insertJob(t, { slug: 'mkt-hn-2', department: 'Marketing', city: 'Hà Nội' });
    await insertJob(t, { slug: 'mkt-hue', department: 'Marketing', city: 'Huế' });
    await insertJob(t, { slug: 'kt-dong', department: 'Kỹ thuật', state: 'paused' });

    const { similar } = await json<JobPageResponse>(await t.request('/api/jobs/goc'));
    const slugs = similar.map((j) => j.slug);

    expect(slugs).toHaveLength(3);
    expect(slugs.slice(0, 2).sort()).toEqual(['kt-1', 'kt-2']);
    expect(['mkt-hn', 'mkt-hn-2']).toContain(slugs[2]);
  });

  it('never suggests the job itself', async () => {
    await insertJob(t, { slug: 'mot', department: 'Kỹ thuật' });
    const { similar } = await json<JobPageResponse>(await t.request('/api/jobs/mot'));
    expect(similar).toEqual([]);
  });
});

describe('unexpected errors', () => {
  it('answer 500 with a generic message and no internals', async () => {
    await t.db.execute(sql`ALTER TABLE jobs RENAME TO jobs_tmp`);
    try {
      const res = await t.request('/api/jobs');
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(JSON.parse(body)).toEqual({ error: 'Có lỗi xảy ra, thử lại sau.' });
      expect(body).not.toMatch(/jobs|relation|select/i);
    } finally {
      await t.db.execute(sql`ALTER TABLE jobs_tmp RENAME TO jobs`);
    }
  });
});
