import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';
import { FONT_FAMILIES, FONT_SIZES } from './palette.js';
import { renderArticle } from './render.js';

const text = (value: string, format = 0, style = '') => ({
  type: 'text',
  text: value,
  format,
  style,
  mode: 'normal',
  detail: 0,
  version: 1,
});
const doc = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children, format: '', indent: 0, version: 1 }], version: 1 },
});
const parse = (...children: unknown[]) => parseArticleContent(doc(...children), { isAllowedImage: () => true });
function html(...children: unknown[]) {
  const parsed = parse(...children);
  if (!parsed.ok) throw new Error(parsed.error);
  return renderArticle(parsed.value).html;
}

describe('font size and family presets', () => {
  it('should write a preset size and the serif family as classes', () => {
    const size = FONT_SIZES.find((s) => s.px === 20);
    const serif = FONT_FAMILIES.find((f) => f.key === 'serif');

    const out = html(text('to', 0, `font-size: 20px; font-family: ${serif?.css};`));

    expect(size?.key).toBe('20');
    expect(out).toBe('<p><span class="fs-20 ff-serif">to</span></p>');
  });

  it('should refuse a size or font that is not offered', () => {
    expect(parse(text('x', 0, 'font-size: 72px;')).ok).toBe(false);
    expect(parse(text('x', 0, 'font-family: Comic Sans MS;')).ok).toBe(false);
  });

  it('should treat the default size and family as no style', () => {
    expect(html(text('x', 0, 'font-size: 16px;'))).toBe('<p>x</p>');
  });
});

describe('inline code', () => {
  it('should write inline code as <code>', () => {
    expect(html(text('npm i', 16))).toBe('<p><code>npm i</code></p>');
  });
});
