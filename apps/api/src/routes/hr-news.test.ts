import { NEWS_CONTENT_MAX_BYTES, type HrNewsListResponse, type HrNewsPostDto } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newsPosts } from '../db/schema.js';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { articleState, coverImage, insertCategory, insertPost, newsInput, ownImageUrl } from '../test/news-fixtures.js';

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
const publishedPost = async (categoryId: string, overrides = {}) => {
  const post = await createPost(newsInput(categoryId, overrides));
  return json<HrNewsPostDto>(await hr('POST', `/news/${post.id}/publish`));
};
const errorsOf = async (res: Response) => (await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors;

describe('HR news: access', () => {
  it('should refuse the list without an HR session', async () => {
    const res = await t.request('/api/hr/news');

    expect(res.status).toBe(401);
  });

  it('should refuse a save without the CSRF header even with a session', async () => {
    const res = await t.request('/api/hr/news', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(403);
  });
});

describe('HR news: drafts', () => {
  it('should create an empty draft that HR can fill in later', async () => {
    const res = await hr('POST', '/news', {});
    const post = await json<HrNewsPostDto>(res);

    expect(res.status).toBe(200);
    expect(post).toMatchObject({
      title: '',
      slug: 'bai-viet',
      slugLocked: false,
      status: 'draft',
      categoryId: null,
      summary: '',
      cover: null,
      content: null,
      publishedAt: null,
      updatedAt: t.clock.now.toISOString(),
      updatedBy: 'Phòng Nhân sự',
    });
  });

  it('should make the address from the title and number it when it is taken', async () => {
    const first = await createPost({ title: 'Đời sống ở TOP FLOW' });
    const second = await createPost({ title: 'Đời sống ở TOP FLOW!' });

    expect(first.slug).toBe('doi-song-o-top-flow');
    expect(second.slug).toBe('doi-song-o-top-flow-2');
  });

  it('should autosave the editor content and render it for the public page', async () => {
    const category = await insertCategory(t);
    const post = await createPost();

    const res = await hr('PUT', `/news/${post.id}`, newsInput(category.id, { content: articleState('Xin chào <b>') }));

    expect(res.status).toBe(200);
    const [row] = await t.db.select().from(newsPosts).where(eq(newsPosts.id, post.id));
    expect(row.contentHtml).toBe('<h2 id="gioi-thieu">Giới thiệu</h2><p>Xin chào &lt;b&gt;</p>');
    expect(row.plainText).toBe('Giới thiệu Xin chào <b>');
    expect(row.headings).toEqual([{ id: 'gioi-thieu', text: 'Giới thiệu', level: 2 }]);
  });

  it('should keep the fields a save leaves out', async () => {
    const category = await insertCategory(t);
    const post = await createPost(newsInput(category.id));

    const saved = await json<HrNewsPostDto>(await hr('PUT', `/news/${post.id}`, { title: 'Tiêu đề mới' }));

    expect(saved.title).toBe('Tiêu đề mới');
    expect(saved.categoryId).toBe(category.id);
    expect(saved.cover).toEqual(post.cover);
  });

  it('should let HR choose the address while the post is a draft', async () => {
    const post = await createPost({ title: 'Bài A' });

    const saved = await json<HrNewsPostDto>(await hr('PUT', `/news/${post.id}`, { slug: 'Đường Dẫn Riêng' }));

    expect(saved.slug).toBe('duong-dan-rieng');
  });

  it('should let a draft address follow its title while the editor sends the current one back', async () => {
    const post = await createPost({ title: 'Bài A' });

    const saved = await json<HrNewsPostDto>(await hr('PUT', `/news/${post.id}`, { title: 'Bài B', slug: post.slug }));

    expect(saved.slug).toBe('bai-b');
  });

  it('should keep an address HR typed when the title changes later', async () => {
    const post = await createPost({ title: 'Bài A' });
    await hr('PUT', `/news/${post.id}`, { slug: 'duong-rieng' });

    const saved = await json<HrNewsPostDto>(
      await hr('PUT', `/news/${post.id}`, { title: 'Bài B', slug: 'duong-rieng' }),
    );
    const reset = await json<HrNewsPostDto>(await hr('PUT', `/news/${post.id}`, { slug: '' }));

    expect(saved.slug).toBe('duong-rieng');
    expect(reset.slug).toBe('bai-b');
  });

  it.each([
    ['an unknown node', { root: { type: 'root', children: [{ type: 'script', children: [] }] } }],
    [
      'a javascript: link',
      {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'link', url: 'java\tscript:alert(1)', children: [{ type: 'text', text: 'x', format: 0 }] },
              ],
            },
          ],
        },
      },
    ],
    [
      'an image from another site',
      {
        root: {
          type: 'root',
          children: [{ type: 'article-image', src: 'https://evil.test/a.jpg', altText: 'x', width: 1, height: 1 }],
        },
      },
    ],
    ['HTML instead of editor JSON', '<p>Xin chào</p>'],
  ])('should refuse content with %s', async (_label, content) => {
    const post = await createPost();

    const res = await hr('PUT', `/news/${post.id}`, { content });

    expect(res.status).toBe(422);
    expect(Object.keys(await errorsOf(res))).toEqual(['content']);
  });

  it('should refuse content larger than the limit', async () => {
    const post = await createPost();
    const content = articleState('a'.repeat(9_000), ...Array.from({ length: 25 }, () => 'b'.repeat(9_000)));

    const res = await hr('PUT', `/news/${post.id}`, { content });

    expect(JSON.stringify(content).length).toBeGreaterThan(NEWS_CONTENT_MAX_BYTES);
    expect(res.status).toBe(422);
    expect(await errorsOf(res)).toHaveProperty('content');
  });

  it('should refuse a cover that was not uploaded through the editor', async () => {
    const post = await createPost();

    const res = await hr('PUT', `/news/${post.id}`, { cover: coverImage({ url: 'https://evil.test/pixel.gif' }) });

    expect(res.status).toBe(422);
    expect(await errorsOf(res)).toHaveProperty('cover');
  });

  it('should keep the smaller sizes of a cover uploaded through the editor', async () => {
    const post = await createPost();
    const cover = coverImage({ srcset: [{ url: ownImageUrl('webp'), width: 480 }] });

    const res = await hr('PUT', `/news/${post.id}`, { cover });

    expect(res.status).toBe(200);
    expect((await json<HrNewsPostDto>(res)).cover).toEqual(cover);
  });

  it('should refuse cover sizes that were not uploaded through the editor', async () => {
    const post = await createPost();
    const cover = coverImage({ srcset: [{ url: 'https://evil.test/a-480.webp', width: 480 }] });

    const res = await hr('PUT', `/news/${post.id}`, { cover });

    expect(res.status).toBe(422);
    expect(await errorsOf(res)).toHaveProperty('cover');
  });

  it('should refuse a category that does not exist', async () => {
    const post = await createPost();

    const res = await hr('PUT', `/news/${post.id}`, { categoryId: '00000000-0000-4000-8000-000000000000' });

    expect(res.status).toBe(422);
    expect(await errorsOf(res)).toHaveProperty('categoryId');
  });

  it('should answer 404 for a post that does not exist', async () => {
    expect((await hr('GET', '/news/00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await hr('GET', '/news/not-a-uuid')).status).toBe(404);
  });
});

describe('HR news: list', () => {
  it('should list posts newest change first with categories counting every post', async () => {
    const category = await insertCategory(t, 'Đời sống');
    await insertCategory(t, 'Cẩm nang');
    await insertPost(t, category.id, { title: 'Cũ', updatedAt: new Date('2026-10-01T00:00:00Z') });
    await insertPost(t, category.id, { title: 'Nháp', status: 'draft', publishedAt: null });

    const list = await json<HrNewsListResponse>(await hr('GET', '/news'));

    expect(list.posts.map((p) => [p.title, p.status, p.categoryName])).toEqual([
      ['Nháp', 'draft', 'Đời sống'],
      ['Cũ', 'published', 'Đời sống'],
    ]);
    expect(list.categories.map((c) => [c.name, c.postCount])).toEqual(
      expect.arrayContaining([
        ['Đời sống', 2],
        ['Cẩm nang', 0],
      ]),
    );
  });
});

describe('HR news: publishing', () => {
  it('should say everything that is missing before a post can go live', async () => {
    const post = await createPost();

    const res = await hr('POST', `/news/${post.id}/publish`);

    expect(res.status).toBe(422);
    expect(Object.keys(await errorsOf(res)).sort()).toEqual(['categoryId', 'content', 'cover', 'title']);
  });

  it('should not count empty paragraphs as content', async () => {
    const category = await insertCategory(t);
    const empty = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } };
    const post = await createPost(newsInput(category.id, { content: empty }));

    const res = await hr('POST', `/news/${post.id}/publish`);

    expect(await errorsOf(res)).toEqual({ content: expect.any(String) });
  });

  it('should publish a complete post and record when', async () => {
    const category = await insertCategory(t);

    const post = await publishedPost(category.id);

    expect(post).toMatchObject({ status: 'published', slugLocked: true, publishedAt: t.clock.now.toISOString() });
  });

  it('should keep the address once published, whatever the title or slug sent', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);

    const saved = await json<HrNewsPostDto>(
      await hr('PUT', `/news/${post.id}`, { ...newsInput(category.id), title: 'Tên khác hẳn', slug: 'duong-moi' }),
    );

    expect(saved.title).toBe('Tên khác hẳn');
    expect(saved.slug).toBe(post.slug);
  });

  it('should refuse an edit that would break a published post, and keep the old version', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);

    const res = await hr('PUT', `/news/${post.id}`, { cover: null, title: '' });

    expect(res.status).toBe(422);
    expect(Object.keys(await errorsOf(res)).sort()).toEqual(['cover', 'title']);
    const again = await json<HrNewsPostDto>(await hr('GET', `/news/${post.id}`));
    expect(again.cover).toEqual(post.cover);
  });

  it('should hide a post but keep its address and first publish date', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);
    t.clock.now = new Date('2026-10-22T03:00:00.000Z');

    const down = await json<HrNewsPostDto>(await hr('POST', `/news/${post.id}/unpublish`));
    const republished = await json<HrNewsPostDto>(await hr('POST', `/news/${post.id}/publish`));

    expect(down).toMatchObject({ status: 'hidden', slugLocked: true, slug: post.slug });
    expect(republished.publishedAt).toBe(post.publishedAt);
  });

  it('should delete a post', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);

    const res = await hr('DELETE', `/news/${post.id}`);

    expect(res.status).toBe(200);
    expect((await hr('GET', `/news/${post.id}`)).status).toBe(404);
  });
});

describe('HR news: IndexNow', () => {
  const site = 'https://tuyendung.test';

  it('should announce the post, the news page and its category when a post is published', async () => {
    const category = await insertCategory(t, 'Đời sống');

    const post = await publishedPost(category.id);

    expect(t.outbound.indexNowUrls()).toEqual([
      `${site}/tin-tuc/${post.slug}`,
      `${site}/tin-tuc`,
      `${site}/tin-tuc/chuyen-muc/doi-song`,
    ]);
  });

  it('should announce edits, take-downs and deletes of a published post', async () => {
    const category = await insertCategory(t);
    const post = await publishedPost(category.id);
    t.outbound.clear();

    await hr('PUT', `/news/${post.id}`, { title: 'Sửa tiêu đề' });
    await hr('POST', `/news/${post.id}/unpublish`);
    await hr('POST', `/news/${post.id}/publish`);
    await hr('DELETE', `/news/${post.id}`);

    expect(t.outbound.calls).toHaveLength(4);
    expect(t.outbound.calls.every((c) => (c.body as { urlList: string[] }).urlList[0].endsWith(post.slug))).toBe(true);
  });

  it('should stay quiet about drafts', async () => {
    const category = await insertCategory(t);
    const post = await createPost(newsInput(category.id));

    await hr('PUT', `/news/${post.id}`, { title: 'Nháp sửa' });
    await hr('DELETE', `/news/${post.id}`);

    expect(t.outbound.calls).toHaveLength(0);
  });

  it('should still publish when IndexNow is down', async () => {
    const category = await insertCategory(t);
    t.outbound.respond = async () => {
      throw new Error('network down');
    };
    const post = await createPost(newsInput(category.id));

    const res = await hr('POST', `/news/${post.id}/publish`);

    expect(res.status).toBe(200);
    expect(t.outbound.calls).toHaveLength(1);
  });

  it('should not call IndexNow when no key is configured', async () => {
    t.deps.config.indexNowKey = null;
    const category = await insertCategory(t);

    await publishedPost(category.id);

    expect(t.outbound.calls).toHaveLength(0);
  });
});
