import type { HrNewsPostDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newsTags } from '../db/schema.js';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost, newsInput, tagPost } from '../test/news-fixtures.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });
const createPost = async (body: unknown = {}) => json<HrNewsPostDto>(await hr('POST', '/news', body));
const save = async (id: string, body: unknown) => json<HrNewsPostDto>(await hr('PUT', `/news/${id}`, body));

interface TagCount {
  name: string;
  slug: string;
  postCount: number;
}

describe('HR news hashtags', () => {
  it('should save hashtags in the order typed, without "#" and without repeats', async () => {
    const post = await createPost({ tags: ['#Tuyển dụng', 'Đời sống', 'tuyen DUNG'] });

    expect(post.tags).toEqual(['Tuyển dụng', 'Đời sống']);
    expect((await json<HrNewsPostDto>(await hr('GET', `/news/${post.id}`))).tags).toEqual(['Tuyển dụng', 'Đời sống']);
  });

  it('should replace the set on save, keep it when the field is left out, and clear it with []', async () => {
    const post = await createPost({ tags: ['A1', 'B2'] });

    const replaced = await save(post.id, { tags: ['C3', 'A1'] });
    const kept = await save(post.id, { title: 'Không đụng hashtag' });
    const cleared = await save(post.id, { tags: [] });

    expect(replaced.tags).toEqual(['C3', 'A1']);
    expect(kept.tags).toEqual(['C3', 'A1']);
    expect(cleared.tags).toEqual([]);
  });

  it('should reuse a tag with the same slug and keep its first spelling', async () => {
    await createPost({ tags: ['Tuyển dụng'] });

    const second = await createPost({ tags: ['TUYỂN DỤNG'] });

    expect(second.tags).toEqual(['Tuyển dụng']);
    expect(await t.db.select().from(newsTags)).toHaveLength(1);
  });

  it('should refuse more than ten hashtags', async () => {
    const res = await hr('POST', '/news', { tags: Array.from({ length: 11 }, (_, i) => `the-${i}`) });

    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors).toHaveProperty('tags');
  });

  it('should keep the tags when a post is deleted', async () => {
    const post = await createPost({ tags: ['Giữ lại'] });

    await hr('DELETE', `/news/${post.id}`);

    expect((await t.db.select().from(newsTags)).map((tag) => tag.name)).toEqual(['Giữ lại']);
  });

  it('should announce the tag pages of a published post', async () => {
    const category = await insertCategory(t);
    const post = await createPost(newsInput(category.id, { tags: ['Tuyển dụng'] }));

    await hr('POST', `/news/${post.id}/publish`);

    expect(t.outbound.indexNowUrls()).toContain('https://tuyendung.test/tin-tuc/the/tuyen-dung');
  });
});

describe('GET /api/hr/news/tags', () => {
  it('should suggest matching tags, most used first, with how many posts use each', async () => {
    const category = await insertCategory(t);
    const a = await insertPost(t, category.id);
    const b = await insertPost(t, category.id, { status: 'draft', publishedAt: null });
    await tagPost(t, a.id, ['Tuyển dụng', 'Tuyển sinh', 'Đời sống']);
    await tagPost(t, b.id, ['Tuyển sinh']);

    const res = await hr('GET', `/news/tags?q=${encodeURIComponent('tuyển')}`);

    expect(res.status).toBe(200);
    expect(await json<TagCount[]>(res)).toEqual([
      { name: 'Tuyển sinh', slug: 'tuyen-sinh', postCount: 2 },
      { name: 'Tuyển dụng', slug: 'tuyen-dung', postCount: 1 },
    ]);
  });

  it('should list at most twenty tags, unused ones included, when nothing is typed', async () => {
    await t.db.insert(newsTags).values(Array.from({ length: 25 }, (_, i) => ({ name: `Tag ${i}`, slug: `tag-${i}` })));

    const tags = await json<TagCount[]>(await hr('GET', '/news/tags'));

    expect(tags).toHaveLength(20);
    expect(tags[0].postCount).toBe(0);
  });

  it('should keep tag suggestions behind the HR sign-in', async () => {
    expect((await t.request('/api/hr/news/tags')).status).toBe(401);
  });
});
