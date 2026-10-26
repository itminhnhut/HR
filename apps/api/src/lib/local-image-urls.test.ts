import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newsPosts } from '../db/schema.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, insertPost } from '../test/news-fixtures.js';
import { relativizeLocalImageUrls, rewriteLocalImageUrls } from './local-image-urls.js';

const NAME = '0b6f3c1e-2a4d-4f5b-9c8d-7e6f5a4b3c2d.jpg';

describe('relativizeLocalImageUrls', () => {
  it.each([
    [`http://localhost:3344/api/news-images/${NAME}`],
    [`http://localhost:8787/api/news-images/${NAME}`],
    [`http://127.0.0.1:3344/api/news-images/${NAME}`],
    [`http://localhost/api/news-images/${NAME}`],
  ])('should turn %s into a site path', (url) => {
    expect(relativizeLocalImageUrls(url)).toBe(`/api/news-images/${NAME}`);
  });

  it('should rewrite every address inside saved content and HTML', () => {
    // Arrange
    const content = {
      root: {
        children: [
          {
            type: 'article-image',
            src: `http://localhost:3344/api/news-images/${NAME}`,
            srcset: [{ url: `http://127.0.0.1:3344/api/news-images/a-480.webp`, width: 480 }],
          },
        ],
      },
    };
    const html = `<img src="http://localhost:3344/api/news-images/a.jpg" srcset="http://localhost:3344/api/news-images/b.webp 480w">`;

    // Act
    const rewritten = relativizeLocalImageUrls({ content, html });

    // Assert
    expect(rewritten.content.root.children[0]).toMatchObject({
      src: `/api/news-images/${NAME}`,
      srcset: [{ url: '/api/news-images/a-480.webp', width: 480 }],
    });
    expect(rewritten.html).toBe('<img src="/api/news-images/a.jpg" srcset="/api/news-images/b.webp 480w">');
  });

  it('should leave other addresses alone', () => {
    const value = {
      blob: `https://x.public.blob.vercel-storage.com/news/${NAME}`,
      other: `https://evil.test/api/news-images/${NAME}`,
      already: `/api/news-images/${NAME}`,
      count: 3,
      none: null,
    };

    expect(relativizeLocalImageUrls(value)).toEqual(value);
  });
});

describe('rewriteLocalImageUrls', () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestContext();
  });
  beforeEach(() => t.reset());

  it('should move stored local addresses to site paths once, keeping the edit time', async () => {
    // Arrange
    const category = await insertCategory(t);
    const old = `http://localhost:3344/api/news-images/${NAME}`;
    const post = await insertPost(t, category.id, {
      cover: { url: old, alt: 'Ảnh', width: 1200, height: 630, srcset: [{ url: old, width: 1200 }] },
      contentHtml: `<p><img src="${old}"></p>`,
    });

    // Act
    const first = await rewriteLocalImageUrls(t.db);
    const second = await rewriteLocalImageUrls(t.db);

    // Assert
    const row = await t.db.query.newsPosts.findFirst({ where: eq(newsPosts.id, post.id) });
    expect(first).toBe(1);
    expect(second).toBe(0);
    expect(row?.cover).toMatchObject({
      url: `/api/news-images/${NAME}`,
      srcset: [{ url: `/api/news-images/${NAME}`, width: 1200 }],
    });
    expect(row?.contentHtml).toBe(`<p><img src="/api/news-images/${NAME}"></p>`);
    expect(row?.updatedAt.getTime()).toBe(post.updatedAt.getTime());
  });
});
