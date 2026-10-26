import type { NewsCardDto, RenderedArticle } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { canPublish, publishChecks } from './publishChecks';

const card = (patch: Partial<NewsCardDto> = {}): NewsCardDto => ({
  slug: 'mot-ngay-o-xuong',
  title: 'Một ngày ở xưởng',
  summary: 'Đi cùng đội lắp đặt từ sáng tới chiều.',
  cover: { url: '/api/news-images/a.jpg', alt: 'Đội lắp đặt ở công trình', width: 1600, height: 900 },
  category: { name: 'Đời sống TOP FLOW', slug: 'doi-song-top-flow' },
  tags: [],
  publishedAt: '2026-10-26T03:00:00.000Z',
  updatedAt: '2026-10-26T03:00:00.000Z',
  readingMinutes: 3,
  ...patch,
});

const article = (patch: Partial<RenderedArticle> = {}): RenderedArticle => ({
  html: '<h2 id="sang">Buổi sáng</h2><p>Bắt đầu lúc 7 giờ.</p>',
  headings: [{ id: 'sang', text: 'Buổi sáng', level: 2 }],
  plainText: 'Buổi sáng. Bắt đầu lúc 7 giờ.',
  hasToc: false,
  ...patch,
});

const failing = (checks: ReturnType<typeof publishChecks>) => checks.filter((c) => !c.ok).map((c) => c.key);

describe('publish checklist', () => {
  it('should pass every check for a complete post', () => {
    // Act
    const checks = publishChecks(card(), article());

    // Assert
    expect(failing(checks)).toEqual([]);
    expect(canPublish(checks)).toBe(true);
  });

  it('should block publishing without a category, a cover or any text', () => {
    // Act
    const checks = publishChecks(
      card({ category: { name: '', slug: '' }, cover: null }),
      article({ html: '', plainText: '', headings: [] }),
    );

    // Assert
    expect(failing(checks)).toEqual(expect.arrayContaining(['category', 'cover', 'content']));
    expect(canPublish(checks)).toBe(false);
  });

  it('should only warn when the cover is narrower than 1200px', () => {
    // Act
    const checks = publishChecks(
      card({ cover: { url: '/a.jpg', alt: 'Đội lắp đặt', width: 960, height: 540 } }),
      article(),
    );

    // Assert
    expect(failing(checks)).toEqual(['coverSize']);
    expect(canPublish(checks)).toBe(true);
  });

  it('should warn about a cover description without Vietnamese marks or that just says "ảnh bìa"', () => {
    const noMarks = card({
      cover: { url: '/a.jpg', alt: 'anh bia cham soc nguoi cao tuoi', width: 1600, height: 900 },
    });
    const generic = card({ cover: { url: '/a.jpg', alt: 'Ảnh bìa bài viết', width: 1600, height: 900 } });

    expect(failing(publishChecks(noMarks, article()))).toEqual(['coverAlt']);
    expect(failing(publishChecks(generic, article()))).toEqual(['coverAlt']);
  });

  it('should warn when the description only repeats the title', () => {
    const checks = publishChecks(card({ summary: 'một ngày ở xưởng' }), article());
    expect(failing(checks)).toEqual(['summary']);
    expect(canPublish(checks)).toBe(true);
  });

  it('should warn when the article has no H2 section heading', () => {
    const checks = publishChecks(card(), article({ headings: [{ id: 'a', text: 'Nhỏ', level: 3 }] }));
    expect(failing(checks)).toEqual(['headings']);
  });

  it('should count a picture alone as content', () => {
    const checks = publishChecks(
      card(),
      article({ html: '<figure><img src="/a.jpg" alt="x"></figure>', plainText: '' }),
    );
    expect(failing(checks)).not.toContain('content');
  });

  it('should block publishing while a picture in the article has no description', () => {
    const checks = publishChecks(card(), article(), 1);

    expect(failing(checks)).toEqual(['imageAlt']);
    expect(canPublish(checks)).toBe(false);
  });
});
