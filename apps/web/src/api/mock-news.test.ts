import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsPostInput } from '@careers/shared';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { DEMO_HR } from './mock-seed';
import { ApiError } from './types';

const run = <T>(p: Promise<T>) => {
  void vi.runAllTimersAsync();
  return p;
};

async function rejection(p: Promise<unknown>): Promise<ApiError> {
  try {
    await run(p);
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a rejection');
}

const paragraph = (text: string) => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text, format: 0, style: '' }] }],
  },
});

const cover = () => ({
  url: `${location.origin}/images/company/team-expo.jpg`,
  alt: 'Đội ngũ TOP FLOW',
  width: 1200,
  height: 988,
});

const empty: NewsPostInput = { title: '', categoryId: null, summary: '', cover: null, content: null };

async function categoryId(): Promise<string> {
  const { categories } = await run(mockApi.hrNews());
  return categories[0].id;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  resetMockDb(new Date());
  await run(mockApi.hrSignIn(DEMO_HR.email, demoHrPassword()));
});

describe('news (HR)', () => {
  it('should refuse news calls without an HR session', async () => {
    // Arrange
    await run(mockApi.hrLogout());

    // Act
    const err = await rejection(mockApi.hrNews());

    // Assert
    expect(err.status).toBe(401);
  });

  it('should create an empty draft and give it an address from the title once there is one', async () => {
    const created = await run(mockApi.hrCreateNews(empty));

    const saved = await run(mockApi.hrSaveNews(created.id, { ...empty, title: 'Đời sống ở TOP FLOW', slug: '' }));

    expect(created.status).toBe('draft');
    expect(saved.slug).toBe('doi-song-o-top-flow');
  });

  it('should refuse to publish until title, category, cover and a paragraph are there', async () => {
    const post = await run(mockApi.hrCreateNews(empty));

    const err = await rejection(mockApi.hrPublishNews(post.id));

    expect(err.status).toBe(422);
    expect(Object.keys(err.fieldErrors).sort()).toEqual(['categoryId', 'content', 'cover', 'title']);
  });

  it('should publish a complete post and show it on the public list', async () => {
    const input = {
      title: 'Bài mới',
      categoryId: await categoryId(),
      summary: '',
      cover: cover(),
      content: paragraph('Xin chào'),
    };
    const post = await run(mockApi.hrCreateNews(input));

    const published = await run(mockApi.hrPublishNews(post.id));
    const list = await run(mockApi.listNews({}));

    expect(published.status).toBe('published');
    expect(list.posts.map((p) => p.slug)).toContain('bai-moi');
  });

  it('should keep the address once published, even after taking the post down', async () => {
    const input = {
      title: 'Bài mới',
      categoryId: await categoryId(),
      summary: '',
      cover: cover(),
      content: paragraph('Xin chào'),
    };
    const post = await run(mockApi.hrCreateNews(input));
    await run(mockApi.hrPublishNews(post.id));
    await run(mockApi.hrUnpublishNews(post.id));

    const saved = await run(mockApi.hrSaveNews(post.id, { ...input, title: 'Tên khác', slug: 'dia-chi-khac' }));

    expect(saved.slugLocked).toBe(true);
    expect(saved.slug).toBe('bai-moi');
  });

  it('should hide a published post and show it again with its first publish date', async () => {
    const input = {
      ...empty,
      title: 'Bài mới',
      categoryId: await categoryId(),
      cover: cover(),
      content: paragraph('Xin chào'),
    };
    const post = await run(mockApi.hrCreateNews(input));
    const first = await run(mockApi.hrPublishNews(post.id));

    const hidden = await run(mockApi.hrUnpublishNews(post.id));
    const shown = await run(mockApi.hrPublishNews(post.id));

    expect(hidden.status).toBe('hidden');
    expect(hidden.slugLocked).toBe(true);
    expect(shown.status).toBe('published');
    expect(shown.publishedAt).toBe(first.publishedAt);
  });

  it('should refuse to hide a draft', async () => {
    const post = await run(mockApi.hrCreateNews(empty));

    const err = await rejection(mockApi.hrUnpublishNews(post.id));

    expect(err.status).toBe(422);
  });

  it('should accept a post whose only content is a video', async () => {
    const video = { root: { type: 'root', children: [{ type: 'youtube', videoID: 'dQw4w9WgXcQ', format: '' }] } };
    const input = { ...empty, title: 'Video', categoryId: await categoryId(), cover: cover(), content: video };
    const post = await run(mockApi.hrCreateNews(input));

    const published = await run(mockApi.hrPublishNews(post.id));

    expect(published.status).toBe('published');
  });

  it('should save hashtags cleaned and refuse more than 10', async () => {
    const post = await run(mockApi.hrCreateNews({ ...empty, tags: ['#Kỹ  sư', 'kỹ sư', 'Đời sống'] }));
    const tooMany = Array.from({ length: 11 }, (_, i) => `tag ${i}`);

    const err = await rejection(mockApi.hrSaveNews(post.id, { ...empty, tags: tooMany }));
    const cleared = await run(mockApi.hrSaveNews(post.id, { ...empty, tags: [] }));

    expect(post.tags).toEqual(['Kỹ sư', 'Đời sống']);
    expect(err.fieldErrors.tags).toBeTruthy();
    expect(cleared.tags).toEqual([]);
  });

  it('should suggest hashtags in use, most used first, without minding accents', async () => {
    const all = await run(mockApi.hrNewsTags(''));
    const found = await run(mockApi.hrNewsTags('doi song'));

    expect(all.tags[0]?.postCount).toBeGreaterThanOrEqual(all.tags[all.tags.length - 1]?.postCount ?? 0);
    expect(found.tags).toEqual([{ name: 'Đời sống', slug: 'doi-song', postCount: 2 }]);
  });

  it('should answer 404 on the public page once a post is taken down', async () => {
    const input = {
      title: 'Bài mới',
      categoryId: await categoryId(),
      summary: '',
      cover: cover(),
      content: paragraph('Xin chào'),
    };
    const post = await run(mockApi.hrCreateNews(input));
    await run(mockApi.hrPublishNews(post.id));

    await run(mockApi.hrUnpublishNews(post.id));
    const err = await rejection(mockApi.getNews('bai-moi'));

    expect(err.status).toBe(404);
  });

  it('should keep fields a save leaves out (partial saves)', async () => {
    const post = await run(mockApi.hrCreateNews({ ...empty, title: 'Giữ tiêu đề', summary: 'Tóm tắt' }));

    const saved = await run(mockApi.hrSaveNews(post.id, { summary: 'Tóm tắt mới' } as NewsPostInput));

    expect(saved.title).toBe('Giữ tiêu đề');
    expect(saved.summary).toBe('Tóm tắt mới');
  });

  it('should refuse cover sizes from another site', async () => {
    const post = await run(mockApi.hrCreateNews(empty));
    const srcset = [{ url: 'https://evil.test/a-480.webp', width: 480 }];

    const err = await rejection(mockApi.hrSaveNews(post.id, { ...empty, cover: { ...cover(), srcset } }));

    expect(err.status).toBe(422);
    expect(err.fieldErrors).toHaveProperty('cover');
  });

  it('should refuse content with a script link or an image from another site', async () => {
    const post = await run(mockApi.hrCreateNews(empty));
    const badLink = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'x', format: 0 }] },
            ],
          },
        ],
      },
    };
    const hotlink = {
      root: {
        type: 'root',
        children: [{ type: 'article-image', src: 'https://evil.example/a.png', altText: 'a', width: 1, height: 1 }],
      },
    };

    const linkErr = await rejection(mockApi.hrSaveNews(post.id, { ...empty, content: badLink }));
    const imageErr = await rejection(mockApi.hrSaveNews(post.id, { ...empty, content: hotlink }));

    expect(linkErr.fieldErrors.content).toBeTruthy();
    expect(imageErr.fieldErrors.content).toBeTruthy();
  });
});

describe('news categories', () => {
  it('should refuse to delete a category that still has posts (409)', async () => {
    const id = await categoryId();

    const err = await rejection(mockApi.hrDeleteNewsCategory(id));

    expect(err.status).toBe(409);
    expect(err.message).toMatch(/còn \d+ bài/);
  });

  it('should add, rename and delete an empty category, keeping its address on rename', async () => {
    const created = await run(mockApi.hrCreateNewsCategory('Sự kiện'));

    const renamed = await run(mockApi.hrRenameNewsCategory(created.id, 'Sự kiện công ty'));
    await run(mockApi.hrDeleteNewsCategory(created.id));
    const { categories } = await run(mockApi.hrNews());

    expect(renamed.slug).toBe('su-kien');
    expect(categories.some((c) => c.id === created.id)).toBe(false);
  });

  it('should list only categories with published posts on the public page', async () => {
    await run(mockApi.hrCreateNewsCategory('Trống'));

    const { categories } = await run(mockApi.listNews({}));

    expect(categories.map((c) => c.name)).not.toContain('Trống');
    expect(categories.every((c) => c.postCount > 0)).toBe(true);
  });
});

describe('news (public)', () => {
  it('should show a published post with rendered html, headings and hashtags', async () => {
    const post = await run(mockApi.getNews('mot-ngay-lam-viec-cua-ky-su-kinh-doanh-tai-top-flow'));

    expect(post.html).toContain('<h2 id="buoi-sang-hop-nhanh-va-len-lich-gap-khach">');
    expect(post.headings.length).toBeGreaterThan(1);
    expect(post.summary.length).toBeGreaterThan(0);
    expect(post.tags).toContainEqual({ name: 'Kinh doanh', slug: 'kinh-doanh' });
  });

  it('should rank related posts by shared hashtags, across categories', async () => {
    // Arrange: a new post in the other category sharing two hashtags with the "Một ngày…" post.
    const input = {
      ...empty,
      title: 'Hỏi đáp kỹ sư',
      categoryId: await categoryId(),
      cover: cover(),
      content: paragraph('Xin chào'),
      tags: ['Kỹ sư', 'kinh doanh'],
    };
    const post = await run(mockApi.hrCreateNews(input));
    await run(mockApi.hrPublishNews(post.id));

    // Act
    const { related } = await run(mockApi.getNews('mot-ngay-lam-viec-cua-ky-su-kinh-doanh-tai-top-flow'));

    // Assert
    expect(related[0]?.slug).toBe('hoi-dap-ky-su');
    expect(related.length).toBeLessThanOrEqual(3);
  });

  it('should list posts by hashtag and answer 404 for a hashtag no published post uses', async () => {
    const list = await run(mockApi.listNews({ tag: 'kinh-doanh' }));
    const err = await rejection(mockApi.listNews({ tag: 'thien-nguyen' }));

    expect(list.tag).toEqual({ name: 'Kinh doanh', slug: 'kinh-doanh' });
    expect(list.posts).toHaveLength(2);
    // "Thiện nguyện" is only on a draft.
    expect(err.status).toBe(404);
  });

  it('should hide drafts from the public', async () => {
    const err = await rejection(mockApi.getNews('chuyen-di-thien-nguyen-vinh-hy-2026'));

    expect(err.status).toBe(404);
  });
});
