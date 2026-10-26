import { foldVietnamese, type NewsCardDto, type RenderedArticle } from '@careers/shared';

/**
 * What the confirm sheet checks before a post goes live. Blocking items are the ones the server refuses to
 * publish without; warnings are worth fixing (Google, Zalo and Facebook previews) but HR may publish anyway.
 */
export interface PublishCheck {
  key: 'title' | 'category' | 'cover' | 'content' | 'imageAlt' | 'coverSize' | 'coverAlt' | 'summary' | 'headings';
  label: string;
  ok: boolean;
  blocking: boolean;
  /** The form field to jump to (data-field). */
  field: string;
}

/** Google and Facebook show a large preview from this width. */
export const COVER_MIN_WIDTH = 1200;

const VIETNAMESE_MARKS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/** A real description of the picture: written with Vietnamese marks, not "ảnh bìa…" / "anh bia…". */
function isGoodAlt(alt: string): boolean {
  return VIETNAMESE_MARKS.test(alt) && !/^anh\s*bia\b/.test(foldVietnamese(alt.trim()));
}

const hasBody = (article: RenderedArticle | null): boolean =>
  !!article && (article.plainText.trim() !== '' || /<(img|iframe)\b/.test(article.html));

/**
 * `card` is the post as the list and previews will show it (summary = what Google shows); `imagesWithoutAlt`
 * counts the article's pictures still waiting for a description (saved with a placeholder).
 */
export function publishChecks(
  card: NewsCardDto,
  article: RenderedArticle | null,
  imagesWithoutAlt = 0,
): PublishCheck[] {
  const cover = card.cover;
  const same = (a: string, b: string) => foldVietnamese(a.trim()) === foldVietnamese(b.trim());
  return [
    { key: 'title', label: 'Có tiêu đề', ok: card.title.trim() !== '', blocking: true, field: 'title' },
    {
      key: 'category',
      label: 'Đã chọn chuyên mục',
      ok: card.category.slug !== '',
      blocking: true,
      field: 'categoryId',
    },
    { key: 'cover', label: 'Có ảnh bìa', ok: !!cover, blocking: true, field: 'cover' },
    { key: 'content', label: 'Bài có nội dung', ok: hasBody(article), blocking: true, field: 'content' },
    {
      key: 'imageAlt',
      label:
        imagesWithoutAlt > 0
          ? `Mô tả cho ${imagesWithoutAlt} ảnh trong bài (đang báo "Cần mô tả ảnh")`
          : 'Ảnh trong bài đều có mô tả',
      ok: imagesWithoutAlt === 0,
      blocking: true,
      field: 'content',
    },
    {
      key: 'coverSize',
      label: `Ảnh bìa rộng từ ${COVER_MIN_WIDTH}px (ảnh lớn trên Google, Zalo, Facebook)`,
      ok: !!cover && cover.width >= COVER_MIN_WIDTH,
      blocking: false,
      field: 'cover',
    },
    {
      key: 'coverAlt',
      label: 'Mô tả ảnh bìa viết có dấu, nói ảnh có gì (không phải "ảnh bìa…")',
      ok: !!cover && isGoodAlt(cover.alt),
      blocking: false,
      field: 'cover',
    },
    {
      key: 'summary',
      label: 'Mô tả ngắn khác tiêu đề',
      ok: !card.summary.trim() || !same(card.summary, card.title),
      blocking: false,
      field: 'summary',
    },
    {
      key: 'headings',
      label: 'Có ít nhất một tiêu đề mục (H2)',
      ok: !!article?.headings.some((h) => h.level === 2),
      blocking: false,
      field: 'content',
    },
  ];
}

export const canPublish = (checks: PublishCheck[]): boolean => checks.every((c) => c.ok || !c.blocking);
