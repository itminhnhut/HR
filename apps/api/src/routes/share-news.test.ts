import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, TEST_INDEXNOW_KEY, type TestContext } from '../test/harness.js';
import { coverImage, insertCategory, insertPost, tagPost } from '../test/news-fixtures.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});

const SITE = 'https://tuyendung.test';
const page = async (path: string) => {
  const res = await t.request(path);
  return { res, html: await res.text() };
};
const jsonLdOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    (m) => JSON.parse(m[1]) as Record<string, unknown>,
  );

describe('GET /tin-tuc/:slug for crawlers', () => {
  it('should serve the whole article with SEO and sharing tags', async () => {
    const category = await insertCategory(t, 'Đời sống');
    const cover = coverImage({ alt: 'Cả đội đi dã ngoại', width: 1600, height: 900 });
    const post = await insertPost(t, category.id, {
      slug: 'da-ngoai',
      title: 'Chuyến dã ngoại',
      summary: 'Một ngày ở Ba Vì.',
      cover,
      publishedAt: new Date('2026-10-18T02:00:00Z'),
      updatedAt: new Date('2026-10-19T05:30:00Z'),
    });
    await insertPost(t, category.id, { slug: 'bai-lien-quan', title: 'Bài liên quan' });

    const { res, html } = await page('/tin-tuc/da-ngoai');

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect(html).toContain('<title>Chuyến dã ngoại · Công ty Test</title>');
    expect(html).toContain('<meta name="description" content="Một ngày ở Ba Vì.">');
    expect(html).toContain(`<link rel="canonical" href="${SITE}/tin-tuc/da-ngoai">`);
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="article:published_time" content="2026-10-18T09:00:00+07:00">');
    expect(html).toContain('<meta property="article:modified_time" content="2026-10-19T12:30:00+07:00">');
    expect(html).toContain('<meta property="article:section" content="Đời sống">');
    expect(html).toContain(`<meta property="og:image" content="${cover.url}">`);
    expect(html).toContain('<meta property="og:image:width" content="1600">');
    expect(html).toContain('<meta property="og:image:height" content="900">');
    expect(html).toContain('<meta property="og:image:alt" content="Cả đội đi dã ngoại">');
    expect(html).toContain(post.contentHtml);
    expect(html).toContain('<a href="#gioi-thieu">Giới thiệu</a>');
    expect(html).toContain(`<a href="${SITE}/tin-tuc/bai-lien-quan">Bài liên quan</a>`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc">`);
    expect(jsonLdOf(html).map((d) => d['@type'])).toEqual(['BlogPosting', 'BreadcrumbList']);
    expect(jsonLdOf(html)[0]).toMatchObject({ headline: 'Chuyến dã ngoại', image: [cover.url] });
  });

  it('should not repeat the company name in the title of a post that already names it', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'mot-ngay', title: 'Một ngày tại Công ty Test' });

    const { html } = await page('/tin-tuc/mot-ngay');

    expect(html).toContain('<title>Một ngày tại Công ty Test</title>');
    expect(html).toContain('<meta property="og:title" content="Một ngày tại Công ty Test">');
  });

  it('should escape what HR typed, also inside the JSON-LD', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'xss', title: '</script><script>alert(1)</script>', summary: '"><b>' });

    const { html } = await page('/tin-tuc/xss');

    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('content="&quot;&gt;&lt;b&gt;"');
    expect(html).toContain('\\u003c/script>');
  });

  it('should describe the post by its first words when HR left the summary empty', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'khong-tom-tat', summary: '', plainText: 'Mở đầu bài viết thật hay.' });

    const { html } = await page('/tin-tuc/khong-tom-tat');

    expect(html).toContain('<meta name="description" content="Mở đầu bài viết thật hay.">');
  });

  it('should answer 404 for drafts and unknown posts, and keep them out of search', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });

    const draft = await page('/tin-tuc/nhap');
    const unknown = await page('/tin-tuc/khong-co');

    expect(draft.res.status).toBe(404);
    expect(unknown.res.status).toBe(404);
    expect(draft.html).toContain('<meta name="robots" content="noindex">');
    expect(draft.html).not.toContain('Bài');
  });
});

describe('GET /tin-tuc and category pages for crawlers', () => {
  it('should list published posts with links to each post and category', async () => {
    const category = await insertCategory(t, 'Cẩm nang');
    await insertPost(t, category.id, { slug: 'mot', title: 'Bài một' });
    await insertPost(t, category.id, { slug: 'nhap', title: 'Bản nháp', status: 'draft', publishedAt: null });

    const { res, html } = await page('/tin-tuc');

    expect(res.status).toBe(200);
    expect(html).toContain('<title>Tin tức · Công ty Test</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE}/tin-tuc">`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc/mot">Bài một</a>`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc/chuyen-muc/cam-nang">Cẩm nang</a>`);
    expect(html).not.toContain('Bản nháp');
  });

  it('should give later pages their own canonical and link back, with the ?trang= address the site uses', async () => {
    // Arrange
    const category = await insertCategory(t);
    for (let i = 1; i <= 13; i++) await insertPost(t, category.id);

    // Act
    const { html } = await page('/tin-tuc?trang=2');

    // Assert
    expect(html).toContain(`<link rel="canonical" href="${SITE}/tin-tuc?trang=2">`);
    expect(html).toContain(`<link rel="prev" href="${SITE}/tin-tuc">`);
    expect(html).not.toContain('rel="next"');
    expect(html).toContain('<title>Tin tức – trang 2 · Công ty Test</title>');
    expect((await page('/tin-tuc?trang=3')).res.status).toBe(404);
  });

  it('should link page 1 to page 2 with ?trang=', async () => {
    const category = await insertCategory(t);
    for (let i = 1; i <= 13; i++) await insertPost(t, category.id);

    const { html } = await page('/tin-tuc');

    expect(html).toContain(`<link rel="next" href="${SITE}/tin-tuc?trang=2">`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc?trang=2">Trang sau</a>`);
    expect(html).not.toContain('?page=');
  });

  it('should move the old ?page= address to ?trang= for good (301)', async () => {
    const category = await insertCategory(t, 'Đời sống');
    for (let i = 1; i <= 13; i++) await insertPost(t, category.id);

    const res = await t.request('/tin-tuc/chuyen-muc/doi-song?page=2');

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`${SITE}/tin-tuc/chuyen-muc/doi-song?trang=2`);
  });

  it('should move ?page=1 to the plain address', async () => {
    const res = await t.request('/tin-tuc?page=1');

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(`${SITE}/tin-tuc`);
  });

  it('should list one category on its own page', async () => {
    const life = await insertCategory(t, 'Đời sống');
    const guide = await insertCategory(t, 'Cẩm nang');
    await insertPost(t, life.id, { slug: 'a', title: 'Bài đời sống' });
    await insertPost(t, guide.id, { slug: 'b', title: 'Bài cẩm nang' });

    const { res, html } = await page('/tin-tuc/chuyen-muc/doi-song');

    expect(res.status).toBe(200);
    expect(html).toContain('<title>Đời sống · Công ty Test</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE}/tin-tuc/chuyen-muc/doi-song">`);
    expect(html).toContain('Bài đời sống');
    expect(html).not.toContain('Bài cẩm nang');
    expect(jsonLdOf(html).map((d) => d['@type'])).toEqual(['BreadcrumbList']);
  });

  it('should answer 404 for a category that does not exist', async () => {
    const { res, html } = await page('/tin-tuc/chuyen-muc/khong-co');

    expect(res.status).toBe(404);
    expect(html).toContain('noindex');
  });
});

describe('IndexNow key file', () => {
  it('should serve the configured key at /<key>.txt', async () => {
    const res = await t.request(`/${TEST_INDEXNOW_KEY}.txt`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(TEST_INDEXNOW_KEY);
  });

  it('should not answer for any other text file or when no key is set', async () => {
    expect((await t.request('/khong-phai-key-1234.txt')).status).toBe(404);
    t.deps.config.indexNowKey = null;
    expect((await t.request(`/${TEST_INDEXNOW_KEY}.txt`)).status).toBe(404);
    expect((await t.request('/robots.txt')).status).toBe(200);
  });
});

describe('GET /sitemap.xml news entries', () => {
  const entryOf = (xml: string, path: string) =>
    xml.split('<url>').find((u) => u.includes(`<loc>${SITE}${path}</loc>`)) ?? '';

  it('should list each published post with its last update and cover image', async () => {
    const category = await insertCategory(t, 'Đời sống');
    const post = await insertPost(t, category.id, {
      slug: 'da-ngoai',
      title: 'Dã ngoại',
      updatedAt: new Date('2026-10-19T05:30:00Z'),
    });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(entryOf(xml, '/tin-tuc/da-ngoai')).toContain('<lastmod>2026-10-19T05:30:00Z</lastmod>');
    expect(entryOf(xml, '/tin-tuc/da-ngoai')).toContain(`<image:loc>${post.cover?.url}</image:loc>`);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  });

  it('should give the news page and each category page the date of their newest change', async () => {
    const life = await insertCategory(t, 'Đời sống');
    const guide = await insertCategory(t, 'Cẩm nang');
    await insertCategory(t, 'Trống');
    await insertPost(t, life.id, { updatedAt: new Date('2026-10-10T00:00:00Z') });
    await insertPost(t, guide.id, { updatedAt: new Date('2026-10-15T00:00:00Z') });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(entryOf(xml, '/tin-tuc')).toContain('<lastmod>2026-10-15T00:00:00Z</lastmod>');
    expect(entryOf(xml, '/tin-tuc/chuyen-muc/doi-song')).toContain('<lastmod>2026-10-10T00:00:00Z</lastmod>');
    expect(entryOf(xml, '/tin-tuc/chuyen-muc/cam-nang')).toContain('<lastmod>2026-10-15T00:00:00Z</lastmod>');
    expect(xml).not.toContain('/tin-tuc/chuyen-muc/trong');
  });

  it('should never list drafts or posts taken down', async () => {
    const category = await insertCategory(t, 'Riêng');
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });
    await insertPost(t, category.id, { slug: 'da-go', status: 'hidden' });

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(xml).not.toContain('/tin-tuc/nhap');
    expect(xml).not.toContain('/tin-tuc/da-go');
    expect(xml).not.toContain('/tin-tuc/chuyen-muc/rieng');
    expect(entryOf(xml, '/tin-tuc')).not.toBe('');
  });
});

describe('hashtag pages for crawlers', () => {
  it('should list the posts of a hashtag, kept out of search while it has a single post', async () => {
    const category = await insertCategory(t);
    const post = await insertPost(t, category.id, { slug: 'mot', title: 'Bài một' });
    await tagPost(t, post.id, ['Tuyển dụng']);

    const { res, html } = await page('/tin-tuc/the/tuyen-dung');

    expect(res.status).toBe(200);
    expect(html).toContain('<title>#Tuyển dụng · Công ty Test</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE}/tin-tuc/the/tuyen-dung">`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc/mot">Bài một</a>`);
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  it('should let search engines index a hashtag page from two published posts', async () => {
    const category = await insertCategory(t);
    for (const slug of ['mot', 'hai']) await tagPost(t, (await insertPost(t, category.id, { slug })).id, ['Đời sống']);

    const { html } = await page('/tin-tuc/the/doi-song');

    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large">');
  });

  it('should answer 404 for a hashtag without published posts', async () => {
    const category = await insertCategory(t);
    const draft = await insertPost(t, category.id, { status: 'draft', publishedAt: null });
    await tagPost(t, draft.id, ['Nháp']);

    expect((await page('/tin-tuc/the/nhap')).res.status).toBe(404);
  });

  it('should link the article to its hashtag pages and list them as keywords', async () => {
    const category = await insertCategory(t);
    const post = await insertPost(t, category.id, { slug: 'co-the' });
    await tagPost(t, post.id, ['Tuyển dụng', 'Đời sống']);

    const { html } = await page('/tin-tuc/co-the');

    expect(html).toContain(`<a href="${SITE}/tin-tuc/the/tuyen-dung">#Tuyển dụng</a>`);
    expect(html).toContain(`<a href="${SITE}/tin-tuc/the/doi-song">#Đời sống</a>`);
    expect(jsonLdOf(html)[0]).toMatchObject({ keywords: 'Tuyển dụng, Đời sống' });
  });
});

describe('GET /sitemap.xml hashtag entries', () => {
  const entryOf = (xml: string, path: string) =>
    xml.split('<url>').find((u) => u.includes(`<loc>${SITE}${path}</loc>`)) ?? '';

  it('should list hashtags with two or more published posts, dated by the newest', async () => {
    const category = await insertCategory(t);
    const a = await insertPost(t, category.id, { updatedAt: new Date('2026-10-10T00:00:00Z') });
    const b = await insertPost(t, category.id, { updatedAt: new Date('2026-10-12T00:00:00Z') });
    const draft = await insertPost(t, category.id, {
      status: 'draft',
      publishedAt: null,
      updatedAt: new Date('2026-10-19T00:00:00Z'),
    });
    await tagPost(t, a.id, ['Phổ biến', 'Một bài']);
    await tagPost(t, b.id, ['Phổ biến']);
    await tagPost(t, draft.id, ['Phổ biến', 'Một bài']);

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(entryOf(xml, '/tin-tuc/the/pho-bien')).toContain('<lastmod>2026-10-12T00:00:00Z</lastmod>');
    expect(xml).not.toContain('/tin-tuc/the/mot-bai');
  });
});
