import { describe, expect, it } from 'vitest';
import { missingFields, NO_BACK_TO_DRAFT, statusOptions, transitionFor, wasPublished } from './statusRules';

describe('status picker rules', () => {
  it('should offer only Nháp and Đã đăng for a post never published', () => {
    const options = statusOptions(false);

    expect(options.map((o) => [o.label, o.hint])).toEqual([
      ['Nháp', 'Chỉ HR thấy'],
      ['Đã đăng', 'Hiện trên trang và Google'],
    ]);
  });

  it('should keep a post published before out of Nháp and say why', () => {
    const [draft, ...rest] = statusOptions(true);

    expect(draft).toMatchObject({ status: 'draft', disabled: true, note: NO_BACK_TO_DRAFT });
    expect(rest.map((o) => [o.status, o.hint])).toEqual([
      ['published', 'Hiện trên trang và Google'],
      ['hidden', 'Gỡ khỏi trang, giữ đường dẫn'],
    ]);
  });

  it('should count a hidden post or one with a publish date as published before', () => {
    expect(wasPublished({ status: 'draft', publishedAt: null })).toBe(false);
    expect(wasPublished({ status: 'hidden', publishedAt: null })).toBe(true);
    expect(wasPublished({ status: 'draft', publishedAt: '2026-10-01T00:00:00Z' })).toBe(true);
    expect(wasPublished(null)).toBe(false);
  });

  it('should publish when Đã đăng is picked, hide for Đã ẩn, and do nothing otherwise', () => {
    expect(transitionFor('draft', 'published')).toBe('publish');
    expect(transitionFor('hidden', 'published')).toBe('publish');
    expect(transitionFor('published', 'hidden')).toBe('hide');
    expect(transitionFor('published', 'published')).toBeNull();
    expect(transitionFor('hidden', 'draft')).toBeNull();
  });

  it('should list the missing fields in page order', () => {
    expect(missingFields({ cover: 'x', categoryId: 'y' }).map((f) => f.label)).toEqual(['Chuyên mục', 'Ảnh bìa']);
  });
});
