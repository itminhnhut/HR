import { describe, expect, it } from 'vitest';
import { renderSitemap } from './sitemap.js';

const SITE = 'https://tuyendung.test';

describe('renderSitemap', () => {
  it('should leave out the image namespace when no entry has images', () => {
    const xml = renderSitemap(SITE, [{ path: '/' }, { path: '/gioi-thieu', images: [] }]);

    expect(xml).not.toContain('xmlns:image');
    expect(xml).not.toContain('<image:image>');
  });

  it('should declare the image namespace and list images with absolute, escaped URLs', () => {
    const xml = renderSitemap(SITE, [
      { path: '/tin-tuc/bai-1', images: [{ url: '/anh/a&b.jpg', title: 'Ảnh <đẹp>' }] },
      { path: '/tin-tuc/bai-2', images: [{ url: 'https://cdn.test/x.png' }] },
    ]);

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    );
    expect(xml).toContain(
      '<image:image><image:loc>https://tuyendung.test/anh/a&amp;b.jpg</image:loc><image:title>Ảnh &lt;đẹp&gt;</image:title></image:image>',
    );
    expect(xml).toContain('<image:image><image:loc>https://cdn.test/x.png</image:loc></image:image>');
  });

  it('should write lastmod as a W3C date-time in UTC', () => {
    const xml = renderSitemap(SITE, [{ path: '/', lastmod: new Date('2026-10-20T03:04:05.678Z') }]);

    expect(xml).toContain('<url><loc>https://tuyendung.test/</loc><lastmod>2026-10-20T03:04:05Z</lastmod></url>');
  });

  it('should percent-encode non-ASCII paths', () => {
    const xml = renderSitemap(SITE, [{ path: '/viec-lam/kỹ-sư' }]);

    expect(xml).toContain('<loc>https://tuyendung.test/viec-lam/k%E1%BB%B9-s%C6%B0</loc>');
  });
});
