import { describe, expect, it } from 'vitest';
import { cutDescription, toSlug } from './text.js';
import { cleanTags } from './types.js';

describe('toSlug', () => {
  it('should turn a Vietnamese title into a short address without accents', () => {
    expect(toSlug('Đời sống ở TOP FLOW: “Một ngày” của kỹ sư!')).toBe('doi-song-o-top-flow-mot-ngay-cua-ky-su');
  });

  it('should fall back when nothing usable is left', () => {
    expect(toSlug('!!!', 'bai-viet')).toBe('bai-viet');
  });

  it('should stay under 80 characters without a trailing dash', () => {
    const slug = toSlug('a '.repeat(60));

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('cutDescription', () => {
  it('should cut at a word boundary and add an ellipsis', () => {
    const cut = cutDescription('Một hai ba bốn năm sáu bảy tám chín mười', 20);

    expect(cut).toBe('Một hai ba bốn năm…');
    expect(cut.length).toBeLessThanOrEqual(20);
  });

  it('should keep short text as it is', () => {
    expect(cutDescription('  Ngắn gọn  ', 155)).toBe('Ngắn gọn');
  });
});

describe('cleanTags', () => {
  it('should drop "#", extra spaces, empty tags and repeats that differ only by accents or case', () => {
    expect(cleanTags(['#Tuyển  dụng', 'tuyen dung', ' ', '##Gò Vấp', 'GÒ VẤP'])).toEqual(['Tuyển dụng', 'Gò Vấp']);
  });
});
