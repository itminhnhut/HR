import type { HrNewsListResponse, HrNewsPostDto, NewsListResponse, NewsPostDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { coverImage, insertCategory, insertPost, newsInput, tagPost } from '../test/news-fixtures.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const SITE = 'https://tuyendung.test';
const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const publishedPost = async (categoryId: string, overrides = {}) => {
  const post = await json<HrNewsPostDto>(await hr('POST', '/news', newsInput(categoryId, overrides)));
  return json<HrNewsPostDto>(await hr('POST', `/news/${post.id}/publish`));
};

describe('hiding a news post (HR)', () => {
  it.each(['unpublish', 'hide'])('should move a published post to hidden with POST /:id/%s', async (action) => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);

    const res = await hr('POST', `/news/${post.id}/${action}`);

    expect(res.status).toBe(200);
    expect(await json<HrNewsPostDto>(res)).toMatchObject({ status: 'hidden', slugLocked: true });
  });

  it('should refuse to hide a post that was never published', async () => {
    const draft = await json<HrNewsPostDto>(await hr('POST', '/news', {}));

    const res = await hr('POST', `/news/${draft.id}/hide`);

    expect(res.status).toBe(422);
  });

  it('should save a hidden post like a draft, without the publish rules, keeping its address', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);
    await hr('POST', `/news/${post.id}/hide`);

    const res = await hr('PUT', `/news/${post.id}`, { cover: null, title: 'Tên mới', slug: 'duong-moi' });

    expect(res.status).toBe(200);
    expect(await json<HrNewsPostDto>(res)).toMatchObject({ status: 'hidden', cover: null, slug: post.slug });
  });

  it('should show a hidden post again with the same rules, first publish date and address', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);
    await hr('POST', `/news/${post.id}/hide`);
    await hr('PUT', `/news/${post.id}`, { cover: null });
    t.clock.now = new Date('2026-10-25T03:00:00.000Z');

    const blocked = await hr('POST', `/news/${post.id}/publish`);
    await hr('PUT', `/news/${post.id}`, { cover: coverImage() });
    const shown = await json<HrNewsPostDto>(await hr('POST', `/news/${post.id}/publish`));

    expect(blocked.status).toBe(422);
    expect(shown).toMatchObject({ status: 'published', publishedAt: post.publishedAt, slug: post.slug });
  });

  it('should list rows with all three statuses and count hidden posts in categories', async () => {
    const category = await insertCategory(t, 'Đời sống');
    await insertPost(t, category.id, { title: 'Nháp', status: 'draft', publishedAt: null });
    await insertPost(t, category.id, { title: 'Đã đăng' });
    await insertPost(t, category.id, { title: 'Đã ẩn', status: 'hidden' });

    const list = await json<HrNewsListResponse>(await hr('GET', '/news'));

    expect(list.posts.map((p) => p.status).sort()).toEqual(['draft', 'hidden', 'published']);
    expect(list.categories[0].postCount).toBe(3);
  });

  it('should ping IndexNow when a post is hidden', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);
    t.outbound.clear();

    await hr('POST', `/news/${post.id}/hide`);

    expect(t.outbound.indexNowUrls()).toContain(`${SITE}/tin-tuc/${post.slug}`);
  });
});

describe('hidden posts on the public side', () => {
  it('should keep hidden posts out of lists, counts, related posts, hashtags and the sitemap', async () => {
    const category = await insertCategory(t, 'Đời sống');
    const shown = await insertPost(t, category.id, { slug: 'dang-hien' });
    const hidden = await insertPost(t, category.id, { slug: 'da-an', status: 'hidden' });
    await tagPost(t, shown.id, ['Chung']);
    await tagPost(t, hidden.id, ['Chung', 'Chi an']);

    const list = await json<NewsListResponse>(await t.request('/api/news'));
    const detail = await json<NewsPostDto>(await t.request('/api/news/dang-hien'));
    const xml = await (await t.request('/sitemap.xml')).text();

    expect(list.posts.map((p) => p.slug)).toEqual(['dang-hien']);
    expect(list.categories).toEqual([expect.objectContaining({ slug: 'doi-song', postCount: 1 })]);
    expect(detail.related).toEqual([]);
    expect((await t.request('/api/news?tag=chi-an')).status).toBe(404);
    expect((await json<NewsListResponse>(await t.request('/api/news?tag=chung'))).posts).toHaveLength(1);
    expect(xml).not.toContain('/tin-tuc/da-an');
  });

  it('should answer 404 with noindex for a hidden post, in the API and for crawlers', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { slug: 'da-an', status: 'hidden' });

    const api = await t.request('/api/news/da-an');
    const crawler = await t.request('/tin-tuc/da-an');

    expect(api.status).toBe(404);
    expect(crawler.status).toBe(404);
    expect(await crawler.text()).toContain('<meta name="robots" content="noindex">');
  });
});
