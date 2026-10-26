import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';

const IMAGES = 'https://abc.public.blob.vercel-storage.com/';
const allowImage = (url: string) => url.startsWith(IMAGES);

const text = (value: string, format = 0) => ({
  type: 'text',
  text: value,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
});
const block = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
});
const doc = (...children: unknown[]) => ({ root: block('root', children) });
const parse = (state: unknown) => parseArticleContent(state, { isAllowedImage: allowImage });

describe('parseArticleContent', () => {
  it('should accept what the editor produces: headings, lists, quotes, links and images', () => {
    // Arrange
    const state = doc(
      block('heading', [text('Môi trường làm việc')], { tag: 'h2' }),
      block('paragraph', [
        text('Chúng tôi '),
        text('rất', 1),
        block('link', [text('tuyển')], { url: 'https://www.lee-hr.com/' }),
      ]),
      block('list', [block('listitem', [text('Một')], { value: 1 })], { listType: 'bullet', start: 1, tag: 'ul' }),
      block('quote', [text('Trích dẫn')]),
      { type: 'article-image', src: `${IMAGES}a.webp`, altText: 'Đội ngũ', width: 1200, height: 800, version: 1 },
    );

    // Act
    const result = parse(state);

    // Assert
    expect(result.ok).toBe(true);
  });

  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['java\tscript:alert(1)'],
    [' javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
  ])('should refuse a link to %j', (url) => {
    const result = parse(doc(block('paragraph', [block('link', [text('bấm')], { url })])));

    expect(result.ok).toBe(false);
  });

  it('should refuse free CSS, which could carry tracking images', () => {
    const styled = { ...text('đỏ'), style: 'color:red;background:url(https://evil.example/x)' };

    expect(parse(doc(block('paragraph', [styled]))).ok).toBe(false);
  });

  it('should refuse node types the site does not render, such as raw HTML or equations', () => {
    expect(parse(doc({ type: 'html', html: '<script>alert(1)</script>', version: 1 })).ok).toBe(false);
    expect(parse(doc({ type: 'equation', equation: 'x^2', inline: false, version: 1 })).ok).toBe(false);
  });

  it('should refuse h1 (the page title is the only h1) and h5', () => {
    expect(parse(doc(block('heading', [text('A')], { tag: 'h1' }))).ok).toBe(false);
    expect(parse(doc(block('heading', [text('A')], { tag: 'h5' }))).ok).toBe(false);
  });

  it('should refuse the highlight format (colours come from the palette)', () => {
    expect(parse(doc(block('paragraph', [text('vàng', 128)]))).ok).toBe(false);
  });

  it('should refuse images that are not in our own storage or have no alt text', () => {
    const image = { type: 'article-image', src: `${IMAGES}a.webp`, altText: 'Ảnh', width: 10, height: 10, version: 1 };

    expect(parse(doc({ ...image, src: 'https://lh3.googleusercontent.com/x' })).ok).toBe(false);
    expect(parse(doc({ ...image, altText: ' ' })).ok).toBe(false);
  });

  it('should keep the smaller sizes of an image when they are in our own storage', () => {
    const srcset = [{ url: `${IMAGES}a-480.webp`, width: 480 }];
    const image = { type: 'article-image', src: `${IMAGES}a.webp`, altText: 'Ảnh', width: 960, height: 540, srcset };

    const result = parse(doc(image));

    expect(result.ok && result.value.root.children[0]).toMatchObject({ srcset });
  });

  it('should refuse image sizes that are not in our own storage', () => {
    const srcset = [{ url: 'https://evil.test/a-480.webp', width: 480 }];
    const image = { type: 'article-image', src: `${IMAGES}a.webp`, altText: 'Ảnh', width: 960, height: 540, srcset };

    expect(parse(doc(image)).ok).toBe(false);
  });

  it('should refuse a block where only text belongs, so the page structure stays valid', () => {
    expect(parse(doc(text('chữ trần ở gốc'))).ok).toBe(false);
    expect(parse(doc(block('paragraph', [block('heading', [text('A')], { tag: 'h2' })]))).ok).toBe(false);
  });

  it('should refuse content nested deeper than any real article', () => {
    let node: unknown = block('listitem', [text('sâu')], { value: 1 });
    for (let i = 0; i < 30; i++) {
      node = block('listitem', [block('list', [node], { listType: 'bullet', start: 1, tag: 'ul' })], { value: 1 });
    }

    expect(parse(doc(block('list', [node], { listType: 'bullet', start: 1, tag: 'ul' }))).ok).toBe(false);
  });

  it('should refuse something that is not an editor state at all', () => {
    expect(parse('<p>html</p>').ok).toBe(false);
    expect(parse({ root: { type: 'paragraph', children: [] } }).ok).toBe(false);
  });
});
