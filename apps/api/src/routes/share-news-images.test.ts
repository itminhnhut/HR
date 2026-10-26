import type { ArticleState } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../test/harness.js';
import { articleState, insertCategory, insertPost } from '../test/news-fixtures.js';

/** Posts saved with the local development image store: images are site paths. */
const LOCAL = '/api/news-images/0b6f3c1e-2a4d-4f5b-9c8d-7e6f5a4b3c2d.jpg';
const SITE = 'https://tuyendung.test';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});

/** Saved editor state with one article image after the heading and paragraph. */
const withImage = (image: Record<string, unknown>): ArticleState => {
  const state = articleState('Một ngày ở văn phòng.');
  return { ...state, root: { ...state.root, children: [...state.root.children, image] } } as ArticleState;
};

const localPost = async () => {
  const category = await insertCategory(t, 'Đời sống');
  await insertPost(t, category.id, {
    slug: 'anh-noi-bo',
    cover: { url: LOCAL, alt: 'Cả đội', width: 1600, height: 900 },
    content: withImage({
      type: 'article-image',
      version: 1,
      src: LOCAL,
      altText: 'Văn phòng',
      width: 1600,
      height: 900,
      srcset: [
        { url: '/api/news-images/a-480.webp', width: 480 },
        { url: LOCAL, width: 1600 },
      ],
    }),
  });
};

describe('bot pages for posts with site-path images', () => {
  it('should give share previews and Google full image addresses on the article', async () => {
    // Arrange
    await localPost();

    // Act
    const html = await (await t.request('/tin-tuc/anh-noi-bo')).text();

    // Assert
    expect(html).toContain(`<meta property="og:image" content="${SITE}${LOCAL}">`);
    expect(html).toContain(`<img src="${SITE}${LOCAL}"`);
    expect(html).toContain(`srcset="${SITE}/api/news-images/a-480.webp 480w, ${SITE}${LOCAL} 1600w"`);
    expect(html).not.toMatch(/(src|content)="\/api\/news-images/);
    expect(html).toContain(`"image":["${SITE}${LOCAL}"]`);
  });

  it('should give full image addresses on the news list', async () => {
    await localPost();

    const html = await (await t.request('/tin-tuc')).text();

    expect(html).toContain(`<img src="${SITE}${LOCAL}"`);
    expect(html).toContain(`<meta property="og:image" content="${SITE}${LOCAL}">`);
  });

  it('should list the cover in the sitemap with its full address', async () => {
    await localPost();

    const xml = await (await t.request('/sitemap.xml')).text();

    expect(xml).toContain(`<image:loc>${SITE}${LOCAL}</image:loc>`);
  });
});
