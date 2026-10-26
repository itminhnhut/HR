import type { NewsListResponse, NewsPostDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { json } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost, tagPost } from '../test/news-fixtures.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 3));
const list = async (query = '') => json<NewsListResponse>(await t.request(`/api/news${query}`));

describe('public news hashtags', () => {
  it('should list the most used hashtags of published posts for the news page, drafts and hidden posts aside', async () => {
    // Arrange
    const category = await insertCategory(t);
    const a = await insertPost(t, category.id, { slug: 'a' });
    const b = await insertPost(t, category.id, { slug: 'b' });
    const draft = await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });
    const hidden = await insertPost(t, category.id, { slug: 'an', status: 'hidden' });
    await tagPost(t, a.id, ['Phỏng vấn', 'Đời sống']);
    await tagPost(t, b.id, ['Phỏng vấn']);
    await tagPost(t, draft.id, ['Bí mật']);
    await tagPost(t, hidden.id, ['Đã ẩn']);

    // Act
    const list = await json<NewsListResponse>(await t.request('/api/news'));

    // Assert
    expect(list.popularTags).toEqual([
      { name: 'Phỏng vấn', slug: 'phong-van', postCount: 2 },
      { name: 'Đời sống', slug: 'doi-song', postCount: 1 },
    ]);
  });

  it('should put each post’s hashtags on its card, in HR’s order', async () => {
    const category = await insertCategory(t);
    const post = await insertPost(t, category.id);
    await tagPost(t, post.id, ['Đời sống', 'Tuyển dụng']);

    const body = await list();

    expect(body.posts[0].tags).toEqual([
      { name: 'Đời sống', slug: 'doi-song' },
      { name: 'Tuyển dụng', slug: 'tuyen-dung' },
    ]);
    expect(body.tag).toBeNull();
  });

  it('should filter by hashtag and say which one', async () => {
    const category = await insertCategory(t);
    const tagged = await insertPost(t, category.id, { slug: 'co-the' });
    await insertPost(t, category.id, { slug: 'khong-the' });
    const draft = await insertPost(t, category.id, { slug: 'nhap', status: 'draft', publishedAt: null });
    await tagPost(t, tagged.id, ['Tuyển dụng']);
    await tagPost(t, draft.id, ['Tuyển dụng']);

    const body = await list('?tag=tuyen-dung');

    expect(body.posts.map((p) => p.slug)).toEqual(['co-the']);
    expect(body.tag).toEqual({ name: 'Tuyển dụng', slug: 'tuyen-dung' });
  });

  it('should answer 404 for a hashtag no published post uses', async () => {
    const category = await insertCategory(t);
    const draft = await insertPost(t, category.id, { status: 'draft', publishedAt: null });
    await tagPost(t, draft.id, ['Chỉ nháp']);

    expect((await t.request('/api/news?tag=chi-nhap')).status).toBe(404);
    expect((await t.request('/api/news?tag=khong-co')).status).toBe(404);
  });

  it('should rank related posts by shared hashtags, then category, then date', async () => {
    const home = await insertCategory(t);
    const other = await insertCategory(t);
    const post = await insertPost(t, home.id, { slug: 'chinh', publishedAt: day(1) });
    const twoShared = await insertPost(t, other.id, { slug: 'hai-the', publishedAt: day(2) });
    const oneShared = await insertPost(t, other.id, { slug: 'mot-the', publishedAt: day(3) });
    await insertPost(t, home.id, { slug: 'cung-muc-cu', publishedAt: day(4) });
    await insertPost(t, home.id, { slug: 'cung-muc-moi', publishedAt: day(5) });
    await insertPost(t, other.id, { slug: 'muc-khac-moi-nhat', publishedAt: day(9) });
    const draft = await insertPost(t, home.id, { slug: 'nhap', status: 'draft', publishedAt: null });
    await tagPost(t, post.id, ['A1', 'B2']);
    await tagPost(t, twoShared.id, ['A1', 'B2']);
    await tagPost(t, oneShared.id, ['B2']);
    await tagPost(t, draft.id, ['A1', 'B2']);

    const body = await json<NewsPostDto>(await t.request('/api/news/chinh'));

    expect(body.related.map((r) => r.slug)).toEqual(['hai-the', 'mot-the', 'cung-muc-moi']);
    expect(body.tags.map((tag) => tag.slug)).toEqual(['a1', 'b2']);
  });

  it('should fill related posts from other categories when there are few', async () => {
    const home = await insertCategory(t);
    const other = await insertCategory(t);
    await insertPost(t, home.id, { slug: 'chinh' });
    await insertPost(t, other.id, { slug: 'muc-khac' });

    const body = await json<NewsPostDto>(await t.request('/api/news/chinh'));

    expect(body.related.map((r) => r.slug)).toEqual(['muc-khac']);
  });
});
