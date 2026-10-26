import { describe, expect, it } from 'vitest';
import { blogPostingData, newsBreadcrumbData, vietnamIso } from './seo.js';
import type { NewsCardDto } from './types.js';

const post: NewsCardDto = {
  slug: 'mot-ngay-o-top-flow',
  title: 'Một ngày ở TOP FLOW',
  summary: 'Đi cùng đội kinh doanh.',
  cover: { url: 'https://x.public.blob.vercel-storage.com/a.webp', alt: 'Đội', width: 1200, height: 630 },
  category: { name: 'Đời sống công ty', slug: 'doi-song-cong-ty' },
  tags: [
    { name: 'Kinh doanh', slug: 'kinh-doanh' },
    { name: 'Gò Vấp', slug: 'go-vap' },
  ],
  publishedAt: '2026-10-26T02:30:00.000Z',
  updatedAt: '2026-10-27T03:00:00.000Z',
  readingMinutes: 3,
};
const site = { url: 'https://www.lee-hr.com', companyName: 'TOP FLOW' };

describe('blogPostingData', () => {
  it('should describe the post for Google with Vietnam-time dates and the company as author', () => {
    expect(blogPostingData(post, site)).toMatchObject({
      '@type': 'BlogPosting',
      headline: 'Một ngày ở TOP FLOW',
      image: ['https://x.public.blob.vercel-storage.com/a.webp'],
      datePublished: '2026-10-26T09:30:00+07:00',
      dateModified: '2026-10-27T10:00:00+07:00',
      articleSection: 'Đời sống công ty',
      keywords: 'Kinh doanh, Gò Vấp',
      author: { '@type': 'Organization', name: 'TOP FLOW' },
      mainEntityOfPage: { '@id': 'https://www.lee-hr.com/tin-tuc/mot-ngay-o-top-flow' },
    });
  });
});

describe('blogPostingData image address', () => {
  it('should give Google an absolute address for a cover stored under the site', () => {
    // Arrange
    const local = { ...post, cover: { url: '/api/news-images/a.jpg', alt: 'Đội', width: 1200, height: 630 } };

    // Act
    const data = blogPostingData(local, site);

    // Assert
    expect(data.image).toEqual(['https://www.lee-hr.com/api/news-images/a.jpg']);
  });
});

describe('newsBreadcrumbData', () => {
  it('should lead from the home page through the category to the post', () => {
    const data = newsBreadcrumbData(post, site) as { itemListElement: { name: string; item: string }[] };

    expect(data.itemListElement.map((i) => i.item)).toEqual([
      'https://www.lee-hr.com/',
      'https://www.lee-hr.com/tin-tuc',
      'https://www.lee-hr.com/tin-tuc/chuyen-muc/doi-song-cong-ty',
      'https://www.lee-hr.com/tin-tuc/mot-ngay-o-top-flow',
    ]);
  });
});

describe('vietnamIso', () => {
  it('should cross midnight correctly', () => {
    expect(vietnamIso('2026-10-26T20:00:00.000Z')).toBe('2026-10-27T03:00:00+07:00');
  });
});
