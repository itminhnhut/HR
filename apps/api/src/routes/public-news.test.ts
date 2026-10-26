import type { NewsListResponse, NewsPostDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost } from '../test/news-fixtures.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 3));
const list = async (query = '') => json<NewsListResponse>(await t.request(`/api/news${query}`));

describe('public post rendering', () => {
  it('should show a post with the current page renderer, even if it was saved before the renderer changed', async () => {
    // Arrange: HTML stored by an older version of the site.
    const category = await insertCategory(t);
    const post = await insertPost(t, category.id, { contentHtml: '<p>HTML cũ</p>', headings: [] });

    // Act
    const page = await json<NewsPostDto>(await t.request(`/api/news/${post.slug}`));

    // Assert
    expect(page.html).not.toContain('HTML cũ');
    expect(page.html).toContain(`Đoạn văn của bài`);
  });
});

describe('GET /api/news', () => {
  it('should list only published posts, newest first, as cards', async () => {
    const category = await insertCategory(t, 'Đời sống');
    await insertPost(t, category.id, { slug: 'cu', publishedAt: day(1) });
    await insertPost(t, category.id, { slug: 'moi', publishedAt: day(5), summary: '', plainText: 'Chữ '.repeat(450) });
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });

    const body = await list();

    expect(body.posts.map((p) => p.slug)).toEqual(['moi', 'cu']);
    expect(body.posts[0]).toMatchObject({
      category: { name: 'Đời sống', slug: 'doi-song' },
      publishedAt: day(5).toISOString(),
      readingMinutes: 2,
      summary: expect.stringMatching(/^Chữ Chữ .*…$/),
      cover: expect.objectContaining({ alt: 'Văn phòng công ty' }),
    });
    expect(body).toMatchObject({ page: 1, pageCount: 1, category: null });
    expect(body.posts[0]).not.toHaveProperty('html');
  });

  it('should show twelve posts a page', async () => {
    const category = await insertCategory(t);
    for (let i = 1; i <= 13; i++) await insertPost(t, category.id, { slug: `bai-so-${i}`, publishedAt: day(i) });

    const first = await list();
    const second = await list('?page=2');

    expect(first.posts).toHaveLength(12);
    expect(first.pageCount).toBe(2);
    expect(second.posts.map((p) => p.slug)).toEqual(['bai-so-1']);
  });

  it('should read a broken page number as the first page', async () => {
    const body = await list('?page=abc');

    expect(body.page).toBe(1);
  });

  it('should filter by category and count only published posts per category', async () => {
    const life = await insertCategory(t, 'Đời sống');
    const guide = await insertCategory(t, 'Cẩm nang');
    await insertCategory(t, 'Trống');
    await insertPost(t, life.id, { slug: 'a' });
    await insertPost(t, guide.id, { slug: 'b' });
    await insertPost(t, guide.id, { slug: 'c', status: 'draft', publishedAt: null });

    const body = await list('?category=cam-nang');

    expect(body.posts.map((p) => p.slug)).toEqual(['b']);
    expect(body.category).toMatchObject({ slug: 'cam-nang', postCount: 1 });
    expect(body.categories.map((c) => [c.slug, c.postCount])).toEqual(
      expect.arrayContaining([
        ['doi-song', 1],
        ['cam-nang', 1],
      ]),
    );
    expect(body.categories.map((c) => c.slug)).not.toContain('trong');
  });

  it('should answer 404 for a category that does not exist', async () => {
    const res = await t.request('/api/news?category=khong-co');

    expect(res.status).toBe(404);
  });

  it('should let the CDN keep the list for a minute', async () => {
    const res = await t.request('/api/news');

    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
  });
});

describe('GET /api/news/:slug', () => {
  it('should give the rendered article and up to three newer posts of its category', async () => {
    const category = await insertCategory(t);
    const other = await insertCategory(t);
    const post = await insertPost(t, category.id, { slug: 'chinh', publishedAt: day(2) });
    for (let i = 3; i <= 6; i++) await insertPost(t, category.id, { slug: `cung-muc-${i}`, publishedAt: day(i) });
    await insertPost(t, other.id, { slug: 'muc-khac', publishedAt: day(9) });
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });

    const res = await t.request('/api/news/chinh');
    const body = await json<NewsPostDto>(res);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect(body).toMatchObject({ slug: 'chinh', title: post.title, html: post.contentHtml, headings: post.headings });
    expect(body.related.map((r) => r.slug)).toEqual(['cung-muc-6', 'cung-muc-5', 'cung-muc-4']);
  });

  it('should never show a draft', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });

    expect((await t.request('/api/news/nhap')).status).toBe(404);
    expect((await t.request('/api/news/khong-co')).status).toBe(404);
  });

  it('should answer 404 once HR takes the post down', async () => {
    const cookie = await loginHr(t);
    const category = await insertCategory(t);
    const post = await insertPost(t, category.id, { slug: 'go-xuong' });

    await t.send('POST', `/api/hr/news/${post.id}/unpublish`, undefined, { cookie });

    expect((await t.request('/api/news/go-xuong')).status).toBe(404);
    expect((await list()).posts).toEqual([]);
  });
});
