import type { HrNewsPostDto, NewsPostDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { insertCategory, newsInput, ownImageUrl } from '../test/news-fixtures.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

const text = (value: string, extra: Record<string, unknown> = {}) => ({
  type: 'text',
  text: value,
  format: 0,
  ...extra,
});
const cell = (value: string, headerState: number, extra: Record<string, unknown> = {}) => ({
  type: 'tablecell',
  headerState,
  ...extra,
  children: [{ type: 'paragraph', children: [text(value)] }],
});
const state = (...children: unknown[]) => ({ root: { type: 'root', version: 1, children } });

describe('rich article content end to end', () => {
  it('should save and publish every editor block and show it on the public page', async () => {
    const category = await insertCategory(t);
    const image = ownImageUrl('webp');
    const content = state(
      { type: 'heading', tag: 'h2', format: 'center', children: [text('Quyền lợi')] },
      {
        type: 'paragraph',
        format: 'justify',
        children: [
          text('Giá cũ', { format: 4 }),
          text(' đỏ', { style: 'color: #b91c1c;' }),
          text(' nổi bật', { style: 'background-color: #fef08a;' }),
        ],
      },
      {
        type: 'article-image',
        src: image,
        altText: 'Văn phòng',
        width: 1600,
        height: 900,
        caption: 'Tầng 5',
        layout: 'wide',
      },
      { type: 'horizontalrule' },
      { type: 'youtube', videoID: 'dQw4w9WgXcQ' },
      { type: 'cta', text: 'Ứng tuyển ngay', url: '/viec-lam/ke-toan' },
      {
        type: 'table',
        children: [
          { type: 'tablerow', children: [cell('Vị trí', 1), cell('Lương', 1)] },
          { type: 'tablerow', children: [cell('Kế toán', 0, { backgroundColor: '#bbf7d0' }), cell('15 triệu', 0)] },
        ],
      },
    );
    const post = await json<HrNewsPostDto>(await hr('POST', '/news', newsInput(category.id, { content })));

    const published = await hr('POST', `/news/${post.id}/publish`);
    const page = await json<NewsPostDto>(await t.request(`/api/news/${post.slug}`));

    expect(published.status).toBe(200);
    expect(page.html).toContain('<h2 id="quyen-loi" class="text-center">Quyền lợi</h2>');
    expect(page.html).toContain(
      '<p class="text-justify"><s>Giá cũ</s><span class="tc-red"> đỏ</span><span class="hl-yellow"> nổi bật</span></p>',
    );
    expect(page.html).toContain(`<figure class="img-wide"><img src="${image}"`);
    expect(page.html).toContain('<figcaption>Tầng 5</figcaption>');
    expect(page.html).toContain('<hr>');
    expect(page.html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(page.html).toContain('<a class="cta-button" href="/viec-lam/ke-toan" rel="noopener">Ứng tuyển ngay</a>');
    expect(page.html).toContain('<th scope="col"><p>Vị trí</p></th>');
    expect(page.html).toContain('<td class="hl-green"><p>Kế toán</p></td>');
    const crawlerPage = await (await t.request(`/tin-tuc/${post.slug}`)).text();
    expect(crawlerPage).toContain(page.html);
  });

  it.each([
    ['a colour outside the palette', state({ type: 'paragraph', children: [text('x', { style: 'color: #123456;' })] })],
    ['free CSS in a text style', state({ type: 'paragraph', children: [text('x', { style: 'font-size: 40px;' })] })],
    ['a button to javascript:', state({ type: 'cta', text: 'Bấm', url: 'javascript:alert(1)' })],
    [
      'a table cell colour outside the palette',
      state({ type: 'table', children: [{ type: 'tablerow', children: [cell('x', 0, { backgroundColor: 'red' })] }] }),
    ],
    ['a YouTube id that is not one', state({ type: 'youtube', videoID: '"><script>' })],
  ])('should refuse %s with 422', async (_label, content) => {
    const post = await json<HrNewsPostDto>(await hr('POST', '/news', {}));

    const res = await hr('PUT', `/news/${post.id}`, { content });

    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors).toHaveProperty('content');
  });
});
