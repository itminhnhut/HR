import { describe, expect, it } from 'vitest';
import { absoluteImageHtml } from './absolute-images.js';

const SITE = 'https://site.test';

describe('absoluteImageHtml', () => {
  it('should make site-path image addresses full, srcset entries included', () => {
    // Arrange
    const html =
      '<img src="/api/news-images/a.jpg" srcset="/api/news-images/a-480.webp 480w, /api/news-images/a.jpg 1200w">';

    // Act
    const out = absoluteImageHtml(SITE, html);

    // Assert
    expect(out).toBe(
      '<img src="https://site.test/api/news-images/a.jpg" ' +
        'srcset="https://site.test/api/news-images/a-480.webp 480w, https://site.test/api/news-images/a.jpg 1200w">',
    );
  });

  it('should leave full addresses and links alone', () => {
    const html =
      '<a href="/viec-lam/ke-toan">Việc</a><img src="https://blob.test/a.jpg"><iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>';

    expect(absoluteImageHtml(SITE, html)).toBe(html);
  });
});
