import { describe, expect, it } from 'vitest';
import { parseArticleContent } from './content.js';
import { renderArticle } from './render.js';

const IMAGES = 'https://abc.public.blob.vercel-storage.com/';
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

function render(...children: unknown[]) {
  const parsed = parseArticleContent(
    { root: block('root', children) },
    { isAllowedImage: (u) => u.startsWith(IMAGES) },
  );
  if (!parsed.ok) throw new Error(parsed.error);
  return renderArticle(parsed.value);
}

describe('renderArticle', () => {
  it('should escape text, so typed HTML shows as text and never runs', () => {
    const { html } = render(block('paragraph', [text('<script>alert("x")</script> & co')]));

    expect(html).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</p>');
  });

  it('should write bold, italic and underline as semantic tags', () => {
    const { html } = render(block('paragraph', [text('a', 1), text('b', 2), text('c', 8), text('d', 3)]));

    expect(html).toBe('<p><strong>a</strong><em>b</em><u>c</u><strong><em>d</em></strong></p>');
  });

  it('should give headings ids without accents and list them for the table of contents', () => {
    const { html, headings } = render(
      block('heading', [text('Quyền lợi')], { tag: 'h2' }),
      block('heading', [text('Lộ trình')], { tag: 'h3' }),
      block('heading', [text('Quyền lợi')], { tag: 'h2' }),
    );

    expect(html).toContain('<h2 id="quyen-loi">Quyền lợi</h2>');
    expect(html).toContain('<h3 id="lo-trinh">Lộ trình</h3>');
    expect(html).toContain('<h2 id="quyen-loi-2">Quyền lợi</h2>');
    expect(headings).toEqual([
      { id: 'quyen-loi', text: 'Quyền lợi', level: 2 },
      { id: 'lo-trinh', text: 'Lộ trình', level: 3 },
      { id: 'quyen-loi-2', text: 'Quyền lợi', level: 2 },
    ]);
  });

  it('should write lists, nested lists, quotes and line breaks', () => {
    const { html } = render(
      block(
        'list',
        [
          block('listitem', [text('Một')], { value: 1 }),
          block(
            'listitem',
            [
              block('list', [block('listitem', [text('Con')], { value: 1 })], {
                listType: 'bullet',
                start: 1,
                tag: 'ul',
              }),
            ],
            { value: 2 },
          ),
        ],
        { listType: 'number', start: 1, tag: 'ol' },
      ),
      block('quote', [text('Dòng 1'), { type: 'linebreak', version: 1 }, text('Dòng 2')]),
    );

    expect(html).toBe('<ol><li>Một</li><li><ul><li>Con</li></ul></li></ol><blockquote>Dòng 1<br>Dòng 2</blockquote>');
  });

  it('should write safe links and images with size and alt text', () => {
    const { html } = render(
      block('paragraph', [block('link', [text('Xem việc')], { url: 'https://www.lee-hr.com/?a=1&b="2"' })]),
      { type: 'article-image', src: `${IMAGES}a.webp`, altText: 'Đội "TOP"', width: 1200, height: 800, version: 1 },
    );

    expect(html).toBe(
      '<p><a href="https://www.lee-hr.com/?a=1&amp;b=%222%22" rel="noopener">Xem việc</a></p>' +
        `<figure><img src="${IMAGES}a.webp" alt="Đội &quot;TOP&quot;" width="1200" height="800" loading="lazy" decoding="async"></figure>`,
    );
  });

  it('should offer the smaller sizes of an image so phones download less', () => {
    const srcset = [
      { url: `${IMAGES}a-480.webp`, width: 480 },
      { url: `${IMAGES}a.webp`, width: 1200 },
    ];

    const { html } = render({
      type: 'article-image',
      src: `${IMAGES}a.webp`,
      altText: 'Ảnh',
      width: 1200,
      height: 800,
      srcset,
    });

    expect(html).toContain(`srcset="${IMAGES}a-480.webp 480w, ${IMAGES}a.webp 1200w"`);
    expect(html).toContain('sizes="(min-width: 768px) 720px, 100vw"');
  });

  it('should hint the size a narrow image is shown at: its own width, not the whole column', () => {
    const srcset = [{ url: `${IMAGES}a-480.webp`, width: 480 }];

    const { html } = render({
      type: 'article-image',
      src: `${IMAGES}a.webp`,
      altText: 'Ảnh',
      width: 600,
      height: 400,
      srcset,
    });

    expect(html).toContain('sizes="(min-width: 768px) 600px, 100vw"');
  });

  it('should leave out empty paragraphs and give the plain text for descriptions', () => {
    const { html, plainText } = render(
      block('paragraph', []),
      block('heading', [text('Tiêu đề')], { tag: 'h2' }),
      block('paragraph', [text('Đoạn   một.')]),
    );

    expect(html).toBe('<h2 id="tieu-de">Tiêu đề</h2><p>Đoạn   một.</p>');
    expect(plainText).toBe('Tiêu đề Đoạn một.');
  });
});
