import { LAYOUT_COLUMNS } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { shrinkSize } from '../shrinkImage';
import { ctaUrl, jobSlugFromUrl, youtubeId } from './embeds';
import {
  alignFor,
  allowedFormat,
  cellBackground,
  cleanTextStyle,
  fontFamilyFor,
  fontSizeFor,
  headingTagFor,
  imageFileProblem,
  indentFor,
  isSafeLink,
  LAYOUT_CHOICES,
  layoutTemplateFor,
  listTypeFor,
  nearestFontSize,
  normalizeLinkInput,
  OFFERED_HIGHLIGHTS,
  OFFERED_TEXT_COLORS,
} from './rules';

describe('editor rules', () => {
  it('should drop highlight but keep the other text formats, inline code included', () => {
    // bold 1 | italic 2 | strikethrough 4 | underline 8 | code 16 | subscript 32 | superscript 64 | highlight 128
    expect(allowedFormat(1 | 2 | 4 | 8 | 16 | 32 | 128)).toBe(1 | 2 | 4 | 8 | 16 | 32);
    expect(allowedFormat(16)).toBe(16);
    expect(allowedFormat(128)).toBe(0);
    // superscript 64, lowercase 256, uppercase 512, capitalize 1024
    expect(allowedFormat(64 | 256 | 512 | 1024)).toBe(64 | 256 | 512 | 1024);
  });

  it('should keep palette colours, preset sizes and the serif font from a pasted text style', () => {
    expect(cleanTextStyle('font-family: Arial; color: #B91C1C; font-size: 20pt;')).toBe(
      'color: #b91c1c;font-size: 24px;',
    );
    expect(cleanTextStyle('font-size: 12pt; font-family: "Playfair Display", serif')).toBe(
      'font-family: Playfair Display, serif;',
    );
    expect(cleanTextStyle('font-size: 19px')).toBe('font-size: 18px;');
    expect(cleanTextStyle('font-size: 16px; font-family: Be Vietnam Pro, sans-serif')).toBe('');
    expect(cleanTextStyle('font-size: large')).toBe('');
    expect(cleanTextStyle('background-color: #fef08a; color: #ff0000;')).toBe('background-color: #fef08a;');
    expect(cleanTextStyle('color: #b91c1c;background-color: #fef08a;')).toBe(
      'color: #b91c1c;background-color: #fef08a;',
    );
    expect(cleanTextStyle('color: rgb(185, 28, 28)')).toBe('');
  });

  it('should snap a size to the nearest preset and store the normal size as nothing', () => {
    expect(nearestFontSize(13)).toBe(14);
    expect(nearestFontSize(22)).toBe(20);
    expect(nearestFontSize(40)).toBe(24);
    expect(fontSizeFor('1.5em')).toBe(24);
    expect(fontSizeFor('12pt')).toBeNull();
    expect(fontSizeFor('11pt')).toBe(14);
    expect(fontFamilyFor('Calibri, sans-serif')).toBeNull();
  });

  it('should offer the whole palette: six text colours and four highlights', () => {
    expect(OFFERED_TEXT_COLORS.map((c) => c.key)).toEqual(['red', 'orange', 'green', 'blue', 'navy', 'gray']);
    expect(OFFERED_HIGHLIGHTS.map((c) => c.key)).toEqual(['yellow', 'green', 'blue', 'pink']);
  });

  it('should keep a table cell colour only when it is in the highlight palette', () => {
    expect(cellBackground('#FEF08A')).toBe('#fef08a');
    expect(cellBackground('#123456')).toBeNull();
    expect(cellBackground(null)).toBeNull();
  });

  it('should keep the alignments the site renders', () => {
    expect(['left', 'center', 'right', 'justify'].map(alignFor)).toEqual(['left', 'center', 'right', 'justify']);
    expect(alignFor('end')).toBe('right');
    expect(alignFor('start')).toBe('');
    expect(alignFor('weird')).toBe('');
  });

  it('should turn pasted h1 into H2 and h5–h6 into H4, keeping H2, H3 and H4', () => {
    expect(headingTagFor('h1')).toBe('h2');
    expect(['h2', 'h3', 'h4'].map(headingTagFor)).toEqual(['h2', 'h3', 'h4']);
    expect(['h5', 'h6'].map(headingTagFor)).toEqual(['h4', 'h4']);
  });

  it('should keep bulleted, numbered and checklists', () => {
    expect(listTypeFor('check')).toBe('check');
    expect(listTypeFor('number')).toBe('number');
    expect(listTypeFor('bullet')).toBe('bullet');
    expect(listTypeFor('weird')).toBe('bullet');
  });

  it('should keep indentation between 0 and 4 steps', () => {
    expect([0, 2, 4].map(indentFor)).toEqual([0, 2, 4]);
    expect(indentFor(7)).toBe(4);
    expect(indentFor(-1)).toBe(0);
  });

  it('should keep a column layout the site offers and fall back to equal columns', () => {
    expect(layoutTemplateFor('1fr 3fr', 2)).toBe('1fr 3fr');
    expect(layoutTemplateFor('1fr 3fr', 3)).toBe('1fr 1fr 1fr');
    expect(layoutTemplateFor('repeat(2, 1fr)', 2)).toBe('1fr 1fr');
    expect(layoutTemplateFor('1fr', 1)).toBeNull();
    expect(layoutTemplateFor('1fr 1fr 1fr 1fr 1fr', 5)).toBeNull();
  });

  it('should offer the six layouts the site renders, each with a Vietnamese label', () => {
    expect(LAYOUT_CHOICES.map((c) => c.template).sort()).toEqual(Object.keys(LAYOUT_COLUMNS).sort());
    expect(LAYOUT_CHOICES[1]).toEqual({ template: '1fr 3fr', label: '2 cột 25% – 75%' });
  });

  it('should refuse script and data links, including ones hidden with a tab', () => {
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink('java\tscript:alert(1)')).toBe(false);
    expect(isSafeLink('data:text/html,hi')).toBe(false);
    expect(isSafeLink('https://topflow.vn')).toBe(true);
    expect(isSafeLink('/viec-lam/ke-toan')).toBe(true);
  });

  it('should complete what HR types in the link box into a safe address', () => {
    expect(normalizeLinkInput('topflow.vn/lien-he')).toBe('https://topflow.vn/lien-he');
    expect(normalizeLinkInput('/viec-lam/ke-toan')).toBe('/viec-lam/ke-toan');
    expect(normalizeLinkInput('mailto:hr@topflow.vn')).toBe('mailto:hr@topflow.vn');
    expect(normalizeLinkInput('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkInput('   ')).toBeNull();
  });

  it('should refuse files that are not JPEG, PNG or WebP, or are still too big', () => {
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'a.jpg', { type: 'image/jpeg' });
    const ok = new File(['x'], 'a.webp', { type: 'image/webp' });

    expect(imageFileProblem(gif)).toMatch(/JPEG, PNG hoặc WebP/);
    expect(imageFileProblem(big)).toMatch(/4 MB/);
    expect(imageFileProblem(ok)).toBeNull();
  });
});

describe('YouTube and call-to-action targets', () => {
  it('should read the video id from every kind of YouTube address', () => {
    const id = 'dQw4w9WgXcQ';
    const urls = [
      `https://www.youtube.com/watch?v=${id}&t=42s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
    ];

    expect(urls.map(youtubeId)).toEqual(urls.map(() => id));
  });

  it('should refuse anything that is not a YouTube video', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(youtubeId('https://evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(youtubeId('javascript:alert(1)')).toBeNull();
  });

  it('should point a button at an open job or a safe link only', () => {
    expect(ctaUrl({ jobSlug: 'ke-toan' })).toBe('/viec-lam/ke-toan');
    expect(ctaUrl({ jobSlug: '' })).toBeNull();
    expect(ctaUrl({ link: 'topflow.vn' })).toBe('https://topflow.vn/');
    expect(ctaUrl({ link: 'javascript:alert(1)' })).toBeNull();
    expect(jobSlugFromUrl('/viec-lam/ke-toan')).toBe('ke-toan');
    expect(jobSlugFromUrl('https://topflow.vn')).toBeNull();
  });
});

describe('shrinkSize', () => {
  it('should fit the longest side into 2000 px and never enlarge', () => {
    expect(shrinkSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(shrinkSize(1500, 6000)).toEqual({ width: 500, height: 2000 });
    expect(shrinkSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
