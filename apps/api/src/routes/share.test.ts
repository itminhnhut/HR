import type { CandidateOverview, HrJobsResponse, JobListResponse } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedDemoData } from '../db/seed.js';
import { applications, candidates, subscribers } from '../db/schema.js';
import { googleToken } from '../test/fakes.js';
import { insertJob, json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(() => t.reset());

describe('GET /share/jobs/:slug', () => {
  it('renders link-preview tags and JobPosting data for an open job', async () => {
    await insertJob(t, { slug: 'ky-su', title: 'Kỹ sư <Backend>', salaryMin: 20_000_000, salaryMax: 30_000_000 });

    const res = await t.request('/share/jobs/ky-su');
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<meta property="og:title" content="Kỹ sư &lt;Backend&gt; – Công ty Test">');
    expect(html).toContain('<link rel="canonical" href="https://tuyendung.test/viec-lam/ky-su">');
    expect(html).toContain('20 – 30 triệu');
    expect(html).not.toContain('noindex');
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? '';
    expect(JSON.parse(ld)).toMatchObject({ '@type': 'JobPosting', title: 'Kỹ sư <Backend>' });
    expect(ld).not.toContain('<');
  });

  it('keeps a closed job page but drops it from Google (BR-05, BR-16)', async () => {
    await insertJob(t, { slug: 'du', state: 'closed', closedOn: '2026-10-19' });
    const html = await (await t.request('/share/jobs/du')).text();
    expect(html).toContain('Vị trí này đã ngừng nhận hồ sơ');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toContain('application/ld+json');
  });

  it('escapes HTML from job content', async () => {
    await insertJob(t, { slug: 'xss', responsibilities: '<script>alert(1)</script>' });
    const html = await (await t.request('/share/jobs/xss')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('also answers on the public job path, where vercel.json sends crawlers', async () => {
    await insertJob(t, { slug: 'ky-su' });
    const html = await (await t.request('/viec-lam/ky-su')).text();
    expect(html).toContain('<meta property="og:url" content="https://tuyendung.test/viec-lam/ky-su">');
  });

  it('answers 404 for drafts and unknown slugs', async () => {
    await insertJob(t, { slug: 'nhap', state: 'draft' });
    expect((await t.request('/share/jobs/nhap')).status).toBe(404);
    expect((await t.request('/share/jobs/khong-co')).status).toBe(404);
  });
});

describe('GET /sitemap.xml', () => {
  it('lists the home pages and only jobs taking applications (BR-16)', async () => {
    await insertJob(t, { slug: 'mo' });
    await insertJob(t, { slug: 'dong', state: 'closed', closedOn: '2026-10-19' });
    await insertJob(t, { slug: 'nhap', state: 'draft' });

    const res = await t.request('/sitemap.xml');
    const xml = await res.text();

    expect(res.headers.get('content-type')).toMatch(/application\/xml/);
    expect(xml).toContain('<loc>https://tuyendung.test/</loc>');
    expect(xml).toContain('<loc>https://tuyendung.test/viec-lam/mo</loc>');
    expect(xml).not.toContain('/viec-lam/dong');
    expect(xml).not.toContain('/viec-lam/nhap');
  });
});

describe('GET /robots.txt', () => {
  it('keeps the API out and points to the sitemap', async () => {
    const text = await (await t.request('/robots.txt')).text();
    expect(text).toContain('Disallow: /api');
    expect(text).toContain('Sitemap: https://tuyendung.test/sitemap.xml');
  });

  it('should let crawlers read private pages, so they see the noindex that keeps them out of results', async () => {
    // A blocked page that is linked (the HR link in the menu) can still be listed by its address alone.
    const text = await (await t.request('/robots.txt')).text();

    expect(text).not.toMatch(/Disallow: \/(hr|ho-so-cua-toi|dang-nhap|tra-cuu-ho-so)\b/);
  });
});

describe('demo seed', () => {
  it('fills an empty database with the same demo data as the FE mock', async () => {
    const result = await seedDemoData(t.db, t.clock.now);

    expect(result.jobs).toBeGreaterThan(5);
    const board = await json<JobListResponse>(await t.request('/api/jobs'));
    expect(board.jobs.length).toBeGreaterThan(0);
    expect(await t.db.select().from(applications)).toHaveLength(result.applications);
    expect((await t.db.select().from(subscribers)).length).toBeGreaterThan(0);
    expect((await t.db.select().from(candidates))[0]).toMatchObject({
      email: 'minhanh@email.com',
      phone: '0912345128',
    });

    const cookie = await loginHr(t);
    const hr = await json<HrJobsResponse>(await t.request('/api/hr/jobs', { headers: { cookie } }));
    expect(hr.newApplications).toBeGreaterThan(0);
  });

  it('lets the demo candidate see their applications after signing in', async () => {
    await seedDemoData(t.db, t.clock.now);
    const res = await t.send('POST', '/api/candidate/google', { idToken: googleToken('minhanh@email.com') });
    const cookie = res.headers.getSetCookie()[0].split(';')[0];
    const me = await json<CandidateOverview>(await t.request('/api/candidate/me', { headers: { cookie } }));
    expect(me.me.name).toBe('Trần Minh Anh');
    expect(me.applications.length).toBe(3);
  });

  it('refuses to run on a database that already has jobs', async () => {
    await insertJob(t);
    await expect(seedDemoData(t.db, t.clock.now)).rejects.toThrow(/empty database/);
  });
});
