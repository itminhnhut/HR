import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';
import { HIGHLIGHT_COLORS, TEXT_COLORS } from './palette.js';
import { renderArticle } from './render.js';

const IMAGES = 'https://abc.public.blob.vercel-storage.com/';
const text = (value: string, extra: Record<string, unknown> = {}) => ({
  type: 'text',
  text: value,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
  ...extra,
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
const parse = (...children: unknown[]) =>
  parseArticleContent({ root: block('root', children) }, { isAllowedImage: (u) => u.startsWith(IMAGES) });
function render(...children: unknown[]) {
  const parsed = parse(...children);
  if (!parsed.ok) throw new Error(parsed.error);
  return renderArticle(parsed.value).html;
}
const cell = (value: string, headerState = 0, extra: Record<string, unknown> = {}) =>
  block('tablecell', [block('paragraph', [text(value)])], {
    headerState,
    colSpan: 1,
    rowSpan: 1,
    backgroundColor: null,
    ...extra,
  });

describe('text tools', () => {
  it('should write strikethrough as <s>', () => {
    expect(render(block('paragraph', [text('cũ', { format: 4 })]))).toBe('<p><s>cũ</s></p>');
  });

  it('should write colours from the palette as classes, never as inline styles', () => {
    const red = TEXT_COLORS[0];
    const yellow = HIGHLIGHT_COLORS[0];

    const html = render(
      block('paragraph', [text('nổi bật', { style: `color: ${red.hex}; background-color: ${yellow.hex};` })]),
    );

    expect(html).toBe(`<p><span class="tc-${red.key} hl-${yellow.key}">nổi bật</span></p>`);
  });

  it('should refuse colours outside the palette and any other CSS', () => {
    expect(parse(block('paragraph', [text('x', { style: 'color: #123456;' })])).ok).toBe(false);
    expect(parse(block('paragraph', [text('x', { style: 'font-size: 40px;' })])).ok).toBe(false);
    expect(parse(block('paragraph', [text('x', { style: 'background: url(https://evil.example/p.gif)' })])).ok).toBe(
      false,
    );
  });

  it('should align paragraphs and headings with classes', () => {
    expect(render(block('paragraph', [text('giữa')], { format: 'center' }))).toBe('<p class="text-center">giữa</p>');
    expect(render(block('heading', [text('Phải')], { tag: 'h2', format: 'right' }))).toBe(
      '<h2 id="phai" class="text-right">Phải</h2>',
    );
  });

  it('should refuse an unknown alignment', () => {
    expect(parse(block('paragraph', [text('x')], { format: 'diagonal' })).ok).toBe(false);
  });
});

describe('block tools', () => {
  it('should write a divider', () => {
    expect(render({ type: 'horizontalrule', version: 1 })).toBe('<hr>');
  });

  it('should write an image caption and the wide layout', () => {
    const html = render({
      type: 'article-image',
      src: `${IMAGES}a.webp`,
      altText: 'Đội ngũ',
      width: 1200,
      height: 800,
      caption: 'Đội <kinh doanh>',
      layout: 'wide',
      version: 1,
    });

    expect(html).toBe(
      `<figure class="img-wide"><img src="${IMAGES}a.webp" alt="Đội ngũ" width="1200" height="800" loading="lazy" decoding="async"><figcaption>Đội &lt;kinh doanh&gt;</figcaption></figure>`,
    );
  });

  it('should embed YouTube through the privacy-enhanced player, from the video id only', () => {
    const html = render({ type: 'youtube', videoID: 'dQw4w9WgXcQ', format: '', version: 1 });

    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('loading="lazy"');
    expect(parse({ type: 'youtube', videoID: 'x" onload="alert(1)', format: '', version: 1 }).ok).toBe(false);
  });

  it('should write a call-to-action button and refuse unsafe targets', () => {
    expect(render({ type: 'cta', text: 'Ứng tuyển ngay', url: '/viec-lam/ke-toan', version: 1 })).toBe(
      '<p class="cta"><a class="cta-button" href="/viec-lam/ke-toan" rel="noopener">Ứng tuyển ngay</a></p>',
    );
    expect(parse({ type: 'cta', text: 'Bấm', url: 'javascript:alert(1)', version: 1 }).ok).toBe(false);
  });

  it('should write tables with header cells, spans and palette cell colours', () => {
    const yellow = HIGHLIGHT_COLORS[0];

    const html = render(
      block('table', [
        block('tablerow', [cell('Vị trí', 1), cell('Lương', 1)]),
        block('tablerow', [cell('Kế toán', 0, { colSpan: 2, backgroundColor: yellow.hex })]),
      ]),
    );

    expect(html).toBe(
      '<div class="table-wrap"><table><tbody>' +
        '<tr><th scope="col"><p>Vị trí</p></th><th scope="col"><p>Lương</p></th></tr>' +
        `<tr><td colspan="2" class="hl-${yellow.key}"><p>Kế toán</p></td></tr>` +
        '</tbody></table></div>',
    );
  });

  it('should refuse a table cell colour outside the palette and tables inside tables', () => {
    expect(parse(block('table', [block('tablerow', [cell('x', 0, { backgroundColor: '#000' })])])).ok).toBe(false);
    const inner = block('table', [block('tablerow', [cell('x')])]);
    expect(parse(block('table', [block('tablerow', [block('tablecell', [inner], { headerState: 0 })])])).ok).toBe(
      false,
    );
  });
});
