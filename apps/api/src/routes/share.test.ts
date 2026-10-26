import {
  addDays,
  todayInVietnam,
  type CandidateOverview,
  type HrJobsResponse,
  type JobListResponse,
} from '@careers/shared';
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
    expect(html).toContain('<title>Kỹ sư &lt;Backend&gt; · Công ty Test</title>');
    expect(html).toContain('<meta property="og:title" content="Kỹ sư &lt;Backend&gt; · Công ty Test">');
    expect(html).toContain('<link rel="canonical" href="https://tuyendung.test/viec-lam/ky-su">');
    expect(html).toContain('20 – 30 triệu');
    expect(html).not.toContain('noindex');
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? '';
    expect(JSON.parse(ld)).toMatchObject({ '@type': 'JobPosting', title: 'Kỹ sư <Backend>' });
    expect(ld).not.toContain('<');
  });

  it('should give link previews a large picture, the locale and a large Twitter card', async () => {
    // Arrange
    await insertJob(t, { slug: 'ky-su' });

    // Act
    const html = await (await t.request('/viec-lam/ky-su')).text();

    // Assert
    expect(html).toContain('<meta property="og:image" content="https://tuyendung.test/images/og-share.jpg">');
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toMatch(/<meta property="og:image:alt" content="[^"]+">/);
    expect(html).toContain('<meta property="og:locale" content="vi_VN">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('should show crawlers the same sections and headings as the job page people see', async () => {
    await insertJob(t, {
      slug: 'kinh-doanh',
      title: 'Kinh doanh B2B',
      department: 'Kinh doanh',
      responsibilities: 'Tìm khách hàng',
      requirements: 'Giao tiếp tốt',
      preferred: 'Đã dùng CRM',
      benefits: ['Hoa hồng'],
      roadmap: ['Nhận máy', 'Học quy trình', 'Tự làm', 'Làm độc lập', 'Ký hợp đồng'],
      experience: 'Từ 1 năm',
      workingHours: 'Thứ 2 – Thứ 7, 8:00 – 17:30',
    });
    await insertJob(t, { slug: 'thuc-tap', title: 'Thực tập Kinh doanh', department: 'Kinh doanh' });

    const html = await (await t.request('/viec-lam/kinh-doanh')).text();

    const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    expect(headings).toEqual([
      'Mô tả công việc',
      'Yêu cầu',
      'Ưu tiên (không bắt buộc)',
      'Quyền lợi',
      'Lộ trình 2 tháng thử việc',
      'Nơi bạn sẽ làm việc',
      'Việc làm tương tự',
    ]);
    expect(html).toContain('<li>Đã dùng CRM</li>');
    expect(html).toContain('<li>Hoa hồng</li>');
    expect(html).toContain('<h3>Ngày đầu tiên</h3>');
    expect(html).toContain('Từ 1 năm');
    expect(html).toContain('<a href="https://tuyendung.test/viec-lam/thuc-tap">Thực tập Kinh doanh</a>');
    expect(html).toContain('<a href="https://tuyendung.test/">Việc làm</a> › Kinh doanh B2B');
  });

  it('should add a breadcrumb and place the Đà Nẵng job in Đà Nẵng for Google', async () => {
    await insertJob(t, { slug: 'cskh', title: 'Chăm sóc khách hàng', address: 'Hải Châu, Đà Nẵng' });

    const html = await (await t.request('/viec-lam/cskh')).text();

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
      (m) => JSON.parse(m[1]) as Record<string, unknown>,
    );
    expect(blocks.map((b) => b['@type'])).toEqual(['JobPosting', 'BreadcrumbList']);
    expect(blocks[0]).toMatchObject({
      jobLocation: { address: { addressLocality: 'Hải Châu', addressRegion: 'Đà Nẵng', addressCountry: 'VN' } },
      hiringOrganization: { sameAs: 'https://topflow.vn', logo: 'https://tuyendung.test/images/logo-512.png' },
    });
    expect(JSON.stringify(blocks[0])).not.toContain('Hồ Chí Minh');
  });

  it('keeps a closed job page but drops it from Google (BR-05, BR-16)', async () => {
    await insertJob(t, { slug: 'du', state: 'closed', closedOn: '2026-10-19' });
    await insertJob(t, { slug: 'dang-mo' });
    const html = await (await t.request('/share/jobs/du')).text();
    expect(html).toContain('Vị trí này đã ngừng nhận hồ sơ');
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
    expect(html).not.toContain('JobPosting');
    expect(html).toContain('<h2>Vị trí tương tự đang tuyển</h2>');
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

describe('about and privacy pages for crawlers', () => {
  it.each([
    ['/gioi-thieu', 'Về chúng tôi · Công ty Test', 'Làm việc tại Công ty Test'],
    ['/chinh-sach-du-lieu', 'Chính sách dữ liệu ứng viên · Công ty Test', 'Chính sách dữ liệu ứng viên'],
  ])('should give %s its own title, description, address and preview', async (path, title, heading) => {
    // Act
    const res = await t.request(path);
    const html = await res.text();

    // Assert
    expect(res.status).toBe(200);
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toMatch(/<meta name="description" content="[^"]{40,}">/);
    expect(html).toContain(`<link rel="canonical" href="https://tuyendung.test${path}">`);
    expect(html).toContain(`<meta property="og:url" content="https://tuyendung.test${path}">`);
    expect(html).toContain('<meta property="og:image" content="https://tuyendung.test/images/og-share.jpg">');
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html).toContain('<a href="https://tuyendung.test/">');
  });
});

describe('GET /sitemap.xml', () => {
  const locOf = (xml: string, path: string) => {
    const block = xml.split('<url>').find((u) => u.includes(`<loc>https://tuyendung.test${path}</loc>`)) ?? '';
    return { block, lastmod: /<lastmod>(.*?)<\/lastmod>/.exec(block)?.[1] ?? null };
  };

  it('should list the public static pages with absolute URLs', async () => {
    const xml = await (await t.request('/sitemap.xml')).text();

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://tuyendung.test/</loc>');
    expect(xml).toContain('<loc>https://tuyendung.test/gioi-thieu</loc>');
    expect(xml).toContain('<loc>https://tuyendung.test/chinh-sach-du-lieu</loc>');
    expect(xml).not.toMatch(/<loc>(?!https:\/\/tuyendung\.test\/)/);
  });

  it('should list only jobs taking applications, each with its last update (BR-16)', async () => {
    const today = todayInVietnam(t.clock.now);
    await insertJob(t, { slug: 'mo', updatedAt: new Date('2026-10-18T08:30:00.000Z') });
    await insertJob(t, { slug: 'dong', state: 'closed', closedOn: '2026-10-19' });
    await insertJob(t, { slug: 'nhap', state: 'draft' });
    await insertJob(t, { slug: 'het-han', publishedOn: addDays(today, -40), deadline: addDays(today, -2) });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(locOf(xml, '/viec-lam/mo').lastmod).toBe('2026-10-18T08:30:00Z');
    expect(xml).not.toContain('/viec-lam/dong');
    expect(xml).not.toContain('/viec-lam/nhap');
    expect(xml).not.toContain('/viec-lam/het-han');
  });

  it('should give the home page the lastmod of the newest job update', async () => {
    await insertJob(t, { slug: 'cu', updatedAt: new Date('2026-10-10T01:00:00.000Z') });
    await insertJob(t, { slug: 'moi', updatedAt: new Date('2026-10-19T09:15:00.000Z') });
    await insertJob(t, { slug: 'nhap', state: 'draft', updatedAt: new Date('2026-10-20T02:00:00.000Z') });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(locOf(xml, '/').lastmod).toBe('2026-10-19T09:15:00Z');
  });

  it('should move the home lastmod when a job is closed, since it leaves the home list', async () => {
    await insertJob(t, { slug: 'mo', updatedAt: new Date('2026-10-10T01:00:00.000Z') });
    await insertJob(t, { slug: 'dong', state: 'closed', updatedAt: new Date('2026-10-19T09:15:00.000Z') });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(locOf(xml, '/').lastmod).toBe('2026-10-19T09:15:00Z');
  });

  it('should leave the home page without lastmod when no job was ever posted', async () => {
    const xml = await (await t.request('/sitemap.xml')).text();

    expect(locOf(xml, '/').block).not.toBe('');
    expect(locOf(xml, '/').lastmod).toBeNull();
  });

  it('should escape special characters in job slugs so the XML stays valid', async () => {
    await insertJob(t, { slug: 'a&b<c>"d\'' });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(xml).toContain('<loc>https://tuyendung.test/viec-lam/a&amp;b%3Cc%3E%22d&apos;</loc>');
    expect(xml).not.toContain('a&b');
  });

  it('should answer as XML that a CDN may cache for five minutes', async () => {
    const res = await t.request('/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600');
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
