import {
  cutDescription,
  NEWS_SUMMARY_MAX,
  parseArticleContent,
  readingMinutes,
  renderArticle,
  toSlug,
  type HrNewsPostDto,
  type NewsImage,
  type NewsPostInput,
  type RenderedArticle,
} from '@careers/shared';

/** What the editor page holds while HR types. */
export interface Draft {
  title: string;
  slug: string;
  /** HR typed the address (or the saved one is not the title's). Otherwise '' is sent: follow the title. */
  slugTouched: boolean;
  categoryId: string | null;
  summary: string;
  cover: NewsImage | null;
  /** Hashtag names. */
  tags: string[];
  /** editorState.toJSON() from the editor, or the saved content. */
  content: unknown;
}

export function draftFrom(post: HrNewsPostDto | null): Draft {
  return {
    title: post?.title ?? '',
    slug: post?.slug ?? '',
    slugTouched: !!post && !slugFollowsTitle(post.title, post.slug),
    categoryId: post?.categoryId ?? null,
    summary: post?.summary ?? '',
    cover: post?.cover ?? null,
    tags: post?.tags ?? [],
    content: post?.content ?? null,
  };
}

/** "tieu-de" or "tieu-de-2" (made unique by the server) for the title "Tiêu đề". */
export function slugFollowsTitle(title: string, slug: string): boolean {
  const base = toSlug(title);
  return slug === base || (slug.startsWith(`${base}-`) && /^\d+$/.test(slug.slice(base.length + 1)));
}

/** The whole form (saves are partial on the server, but sending everything keeps them simple). */
export function toInput(draft: Draft): NewsPostInput {
  return {
    title: draft.title,
    // '' = follow the title. Ignored by the server once the post has been published.
    slug: draft.slugTouched ? draft.slug : '',
    categoryId: draft.categoryId,
    summary: draft.summary,
    cover: draft.cover,
    tags: draft.tags,
    content: draft.content ?? null,
  };
}

/** The address shown in the slug box and the Google preview. */
export function shownSlug(draft: Draft, post: HrNewsPostDto | null): string {
  if (post?.slugLocked) return post.slug;
  // Typed: shown as the server will store it. Emptied: back to following the title.
  if (draft.slugTouched && draft.slug.trim()) return toSlug(draft.slug);
  // The saved one when it already follows this title (it may carry the server's "-2").
  if (post && slugFollowsTitle(draft.title, post.slug)) return post.slug;
  return draft.title.trim() ? toSlug(draft.title) : (post?.slug ?? '');
}

/**
 * The article as the site will show it, from the editor's JSON (same checks and renderer as the API, minus
 * the image-address check, which only the server can do). Null when the content does not pass.
 */
export function renderDraft(content: unknown): RenderedArticle | null {
  if (!content) return { html: '', headings: [], plainText: '', hasToc: false };
  const parsed = parseArticleContent(content, { isAllowedImage: () => true });
  return parsed.ok ? renderArticle(parsed.value) : null;
}

/** Google's snippet: the summary, or the start of the article when it is empty (like the server). */
export function descriptionFor(summary: string, article: RenderedArticle | null): string {
  return summary.trim() || cutDescription(article?.plainText ?? '', NEWS_SUMMARY_MAX);
}

export const minutesFor = (article: RenderedArticle | null) => readingMinutes(article?.plainText ?? '');

/**
 * A new post is stored only once it has a title or some article content (text, a picture, a video): picking
 * a category or a hashtag alone does not leave an empty "Chưa có tiêu đề" draft in the list.
 */
export function hasTitleOrBody(input: NewsPostInput): boolean {
  if ((input.title ?? '').trim()) return true;
  const article = renderDraft(input.content ?? null);
  // Content that does not pass the checks is still something HR made: keep it.
  if (!article) return true;
  return article.plainText.trim() !== '' || /<(img|iframe)\b/.test(article.html);
}
