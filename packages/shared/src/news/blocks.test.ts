import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';
import { renderArticle } from './render.js';

const text = (value: string, format = 0) => ({
  type: 'text',
  text: value,
  format,
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
const p = (value: string, extra: Record<string, unknown> = {}) => el('paragraph', [text(value)], extra);
const h2 = (value: string) => el('heading', [text(value)], { tag: 'h2' });
const parse = (...children: unknown[]) =>
  parseArticleContent({ root: el('root', children) }, { isAllowedImage: () => true });
function render(...children: unknown[]) {
  const parsed = parse(...children);
  if (!parsed.ok) throw new Error(parsed.error);
  return renderArticle(parsed.value);
}

describe('table of contents block', () => {
  it('should list every heading where HR placed it, including headings that come after it', () => {
    const { html, hasToc } = render(p('Mở đầu'), { type: 'toc', version: 1 }, h2('Quyền lợi'), h2('Lộ trình'));

    expect(hasToc).toBe(true);
    expect(html).toBe(
      '<p>Mở đầu</p>' +
        '<nav class="toc" aria-label="Mục lục"><p class="toc-title">Mục lục</p><ol>' +
        '<li><a href="#quyen-loi"><span class="toc-num">1</span>Quyền lợi</a></li>' +
        '<li><a href="#lo-trinh"><span class="toc-num">2</span>Lộ trình</a></li>' +
        '</ol></nav>' +
        '<h2 id="quyen-loi">Quyền lợi</h2><h2 id="lo-trinh">Lộ trình</h2>',
    );
  });

  it('should report no block when HR did not insert one', () => {
    expect(render(h2('A')).hasToc).toBe(false);
  });
});

describe('FAQ block (collapsible)', () => {
  it('should write a question that opens to show its answer', () => {
    const faq = el(
      'collapsible-container',
      [el('collapsible-title', [text('Có cần kinh nghiệm không?')]), el('collapsible-content', [p('Không bắt buộc.')])],
      { open: true },
    );

    expect(render(faq).html).toBe(
      '<details class="faq"><summary>Có cần kinh nghiệm không?</summary><div class="faq-body"><p>Không bắt buộc.</p></div></details>',
    );
  });

  it('should refuse a FAQ whose parts are out of order', () => {
    const wrong = el('collapsible-container', [el('collapsible-content', [p('x')])], { open: false });

    expect(parse(wrong).ok).toBe(false);
  });
});

describe('column layout', () => {
  it('should write the columns with a class for the chosen widths', () => {
    const layout = el('layout-container', [el('layout-item', [p('Trái')]), el('layout-item', [p('Phải')])], {
      templateColumns: '1fr 3fr',
    });

    expect(render(layout).html).toBe(
      '<div class="layout cols-1-3"><div class="layout-item"><p>Trái</p></div><div class="layout-item"><p>Phải</p></div></div>',
    );
  });

  it('should refuse column widths that are not one of the offered layouts', () => {
    const layout = el('layout-container', [el('layout-item', [p('x')])], { templateColumns: 'repeat(9, 1px)' });

    expect(parse(layout).ok).toBe(false);
  });
});

describe('checklist and indentation', () => {
  it('should write a checklist with ticked items', () => {
    const list = el(
      'list',
      [
        el('listitem', [text('CCCD')], { value: 1, checked: true }),
        el('listitem', [text('CV')], { value: 2, checked: false }),
      ],
      { listType: 'check', start: 1, tag: 'ul' },
    );

    expect(render(list).html).toBe(
      '<ul class="checklist"><li class="checked" aria-checked="true">CCCD</li><li aria-checked="false">CV</li></ul>',
    );
  });

  it('should indent paragraphs with a class, up to 4 levels', () => {
    expect(render(p('Thụt', { indent: 2 })).html).toBe('<p class="indent-2">Thụt</p>');
    expect(parse(p('Quá sâu', { indent: 9 })).ok).toBe(false);
  });
});

describe('text formats', () => {
  it('should write subscript, superscript and letter case', () => {
    const { html } = render(
      el('paragraph', [text('m'), text('2', 64), text(' H'), text('2', 32), text('O '), text('top flow', 512)]),
    );

    expect(html).toBe('<p>m<sup>2</sup> H<sub>2</sub>O <span class="tt-upper">top flow</span></p>');
  });
});

describe('code block', () => {
  it('should keep the code as escaped text, line breaks included', () => {
    const code = el(
      'code',
      [
        text('<b>1</b>'),
        { type: 'linebreak', version: 1 },
        {
          type: 'code-highlight',
          text: 'npm i',
          highlightType: null,
          format: 0,
          style: '',
          mode: 'normal',
          detail: 0,
          version: 1,
        },
      ],
      {
        language: 'html',
      },
    );

    expect(render(code).html).toBe('<pre class="code-block"><code>&lt;b&gt;1&lt;/b&gt;\nnpm i</code></pre>');
  });
});
