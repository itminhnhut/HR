import { describe, expect, it } from 'vitest';
import { absoluteUrl, NEWS_IMAGE_VARIANT_WIDTHS, newsImageSchema, srcsetAttr, variantWidths } from './index.js';

describe('variantWidths', () => {
  it('should make every smaller size for a wide photo', () => {
    expect(variantWidths(2000)).toEqual([...NEWS_IMAGE_VARIANT_WIDTHS]);
  });

  it('should never upscale: only sizes narrower than the uploaded image', () => {
    expect(variantWidths(1200)).toEqual([480, 960]);
    expect(variantWidths(960)).toEqual([480]);
    expect(variantWidths(480)).toEqual([]);
  });
});

describe('srcsetAttr', () => {
  it('should list each size with its width descriptor, narrowest first', () => {
    const attr = srcsetAttr([
      { url: 'https://x.test/b.webp', width: 960 },
      { url: 'https://x.test/a.webp', width: 480 },
    ]);

    expect(attr).toBe('https://x.test/a.webp 480w, https://x.test/b.webp 960w');
  });

  it('should give nothing for an image without sizes', () => {
    expect(srcsetAttr(undefined)).toBe('');
    expect(srcsetAttr([])).toBe('');
  });
});

describe('newsImageSchema', () => {
  const cover = { url: 'https://x.test/a.jpg', alt: 'Ảnh', width: 1600, height: 900 };

  it('should keep accepting an older cover without sizes', () => {
    expect(newsImageSchema.parse(cover)).toEqual(cover);
  });

  it('should keep the sizes of a cover', () => {
    const srcset = [{ url: 'https://x.test/a-480.webp', width: 480 }];

    expect(newsImageSchema.parse({ ...cover, srcset }).srcset).toEqual(srcset);
  });

  it('should refuse sizes that are not web addresses or have no real width', () => {
    expect(newsImageSchema.safeParse({ ...cover, srcset: [{ url: 'javascript:alert(1)', width: 480 }] }).success).toBe(
      false,
    );
    expect(newsImageSchema.safeParse({ ...cover, srcset: [{ url: 'https://x.test/a.webp', width: 0 }] }).success).toBe(
      false,
    );
  });
});

describe('newsImageSchema with site-relative addresses (local development store)', () => {
  const cover = { url: '/api/news-images/a.jpg', alt: 'Ảnh', width: 1600, height: 900 };

  it('should accept a cover and copies stored under the site', () => {
    // Arrange
    const srcset = [{ url: '/api/news-images/a-480.webp', width: 480 }];

    // Act
    const parsed = newsImageSchema.safeParse({ ...cover, srcset });

    // Assert
    expect(parsed.success).toBe(true);
  });

  it.each([
    ['another host without a scheme', '//evil.test/a.jpg'],
    ['a backslash trick', '/\\evil.test/a.jpg'],
    ['a relative path without the leading slash', 'api/news-images/a.jpg'],
    ['a script address', 'javascript:alert(1)'],
  ])('should refuse %s', (_label, url) => {
    expect(newsImageSchema.safeParse({ ...cover, url }).success).toBe(false);
  });
});

describe('absoluteUrl', () => {
  it('should put the site address in front of a site path', () => {
    expect(absoluteUrl('https://site.test', '/api/news-images/a.jpg')).toBe('https://site.test/api/news-images/a.jpg');
    expect(absoluteUrl('https://site.test/', '/a.jpg')).toBe('https://site.test/a.jpg');
  });

  it('should leave a full address as it is', () => {
    expect(absoluteUrl('https://site.test', 'https://blob.test/news/a.jpg')).toBe('https://blob.test/news/a.jpg');
  });
});
