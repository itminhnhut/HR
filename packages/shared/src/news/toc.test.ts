import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';
import { numberHeadings, renderArticle } from './render.js';

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
});
const el = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
});
const h = (tag: string, value: string) => el('heading', [text(value)], { tag });
function render(...children: unknown[]) {
  const parsed = parseArticleContent({ root: el('root', children) }, { isAllowedImage: () => true });
  if (!parsed.ok) throw new Error(parsed.error);
  return renderArticle(parsed.value);
}

describe('numberHeadings', () => {
  it('should number sections 1, 1.1, 1.1.1 by heading level', () => {
    const { headings } = render(
      h('h2', 'Giới thiệu'),
      h('h3', 'Lịch sử'),
      h('h4', 'Năm đầu'),
      h('h3', 'Sứ mệnh'),
      h('h4', 'Giá trị'),
      h('h2', 'Tuyển dụng'),
    );

    expect(numberHeadings(headings).map((x) => `${x.number} ${x.text}`)).toEqual([
      '1 Giới thiệu',
      '1.1 Lịch sử',
      '1.1.1 Năm đầu',
      '1.2 Sứ mệnh',
      '1.2.1 Giá trị',
      '2 Tuyển dụng',
    ]);
  });

  it('should treat a sub-heading with no parent above it as a top-level section, never "0.1"', () => {
    const { headings } = render(h('h3', 'Mở đầu'), h('h2', 'Phần chính'), h('h4', 'Chi tiết'));

    expect(numberHeadings(headings).map((x) => x.number)).toEqual(['1', '2', '2.1']);
  });
});

describe('table of contents block with sub-sections', () => {
  it('should nest sub-sections inside their section, numbered', () => {
    const { html } = render({ type: 'toc', version: 1 }, h('h2', 'A'), h('h3', 'B'), h('h4', 'C'), h('h2', 'D'));

    expect(html.slice(0, html.indexOf('</nav>') + 6)).toBe(
      '<nav class="toc" aria-label="Mục lục"><p class="toc-title">Mục lục</p><ol>' +
        '<li><a href="#a"><span class="toc-num">1</span>A</a><ol>' +
        '<li><a href="#b"><span class="toc-num">1.1</span>B</a><ol>' +
        '<li><a href="#c"><span class="toc-num">1.1.1</span>C</a></li>' +
        '</ol></li></ol></li>' +
        '<li><a href="#d"><span class="toc-num">2</span>D</a></li>' +
        '</ol></nav>',
    );
  });

  it('should accept h4 and still refuse h1, h5 and h6', () => {
    const ok = (tag: string) =>
      parseArticleContent({ root: el('root', [h(tag, 'x')]) }, { isAllowedImage: () => true }).ok;

    expect(ok('h4')).toBe(true);
    expect(ok('h1')).toBe(false);
    expect(ok('h5')).toBe(false);
  });
});

describe('headings HR numbered by hand', () => {
  it('should not number them twice in the table of contents', () => {
    const { headings } = render(h('h2', '1. Tìm hiểu sản phẩm'), h('h3', '1.1 Van'), h('h2', '2) Chuẩn bị'));

    expect(numberHeadings(headings).map((x) => `${x.number} ${x.label}`)).toEqual([
      '1 Tìm hiểu sản phẩm',
      '1.1 Van',
      '2 Chuẩn bị',
    ]);
  });

  it('should keep a number that is part of the title, or a year, as it is', () => {
    const { headings } = render(h('h2', '2026'), h('h2', '5 điều cần nhớ'));

    expect(numberHeadings(headings).map((x) => x.label)).toEqual(['2026', '5 điều cần nhớ']);
  });
});
