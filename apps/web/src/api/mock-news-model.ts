import {
  cutDescription,
  fieldErrors,
  matchesQuery,
  newsCategoryInputSchema,
  newsPostInputSchema,
  parseArticleContent,
  readingMinutes,
  renderArticle,
  toSlug,
  type ArticleState,
  type HrNewsPostDto,
  type HrNewsRowDto,
  type NewsCardDto,
  type NewsCategoryDto,
  type NewsPostInput,
  type NewsTagDto,
} from '@careers/shared';
import { SAMPLE_IMAGES, siteOrigin, type MockNewsPost } from './mock-news-seed';
import type { MockDb } from './mock-seed';
import type { NewsTagSuggestion } from './types';

/** Same rules as the BE (spec-news.md): drafts are free-form, publishing needs the essentials. */

export const CHECK_FIELDS = 'Kiểm tra lại các ô được đánh dấu.';
export const NOT_FOUND = 'Không tìm thấy bài viết.';

/** "Our image store" in the demo: the site's own sample photos. */
export const isAllowedImage = (url: string) => url.startsWith(`${siteOrigin()}/images/`);

export function rendered(post: MockNewsPost) {
  return post.content ? renderArticle(post.content) : { html: '', headings: [], plainText: '' };
}

export function categoryOf(db: MockDb, post: MockNewsPost) {
  return db.newsCategories.find((c) => c.id === post.categoryId) ?? null;
}

export function categoryDto(db: MockDb, id: string, onlyPublished: boolean): NewsCategoryDto {
  const c = db.newsCategories.find((x) => x.id === id);
  if (!c) throw new Error(`No category ${id}`);
  const postCount = db.newsPosts.filter(
    (p) => p.categoryId === id && (!onlyPublished || p.status === 'published'),
  ).length;
  return { id: c.id, name: c.name, slug: c.slug, postCount };
}

export const categoryList = (db: MockDb, onlyPublished: boolean) =>
  db.newsCategories.map((c) => categoryDto(db, c.id, onlyPublished));

export const tagDto = (name: string): NewsTagDto => ({ name, slug: toSlug(name, '') });

export function toHrPost(post: MockNewsPost): HrNewsPostDto {
  const { createdAt: _c, ...rest } = post;
  return rest;
}

export function toRow(db: MockDb, post: MockNewsPost): HrNewsRowDto {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    categoryName: categoryOf(db, post)?.name ?? null,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    updatedBy: post.updatedBy,
    cover: post.cover,
  };
}

export function toCard(db: MockDb, post: MockNewsPost): NewsCardDto {
  const { plainText } = rendered(post);
  const category = categoryOf(db, post);
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary || cutDescription(plainText, 160),
    cover: post.cover,
    category: { name: category?.name ?? '', slug: category?.slug ?? '' },
    tags: post.tags.map(tagDto),
    publishedAt: post.publishedAt ?? post.updatedAt,
    updatedAt: post.updatedAt,
    readingMinutes: readingMinutes(plainText),
  };
}

export const published = (db: MockDb) =>
  db.newsPosts
    .filter((p) => p.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

export function uniqueSlug(db: MockDb, wanted: string, selfId: string | null): string {
  const base = toSlug(wanted);
  let slug = base;
  for (let i = 2; db.newsPosts.some((p) => p.slug === slug && p.id !== selfId); i++) slug = `${base}-${i}`;
  return slug;
}

/** "Needs content": some text, a picture or a video (an image-only or video-only post is fine). */
export const hasContent = (content: ArticleState | null) =>
  !!content?.root.children.some(
    (block) =>
      block.type === 'article-image' ||
      block.type === 'youtube' ||
      !!renderArticle({ root: { type: 'root', children: [block] } }).plainText,
  );

/** What publishing needs: title, category, cover, some content. */
export function publishProblems(post: Pick<MockNewsPost, 'title' | 'categoryId' | 'cover' | 'content'>) {
  const errors: Record<string, string> = {};
  if (!post.title.trim()) errors.title = 'Nhập tiêu đề trước khi đăng.';
  if (!post.categoryId) errors.categoryId = 'Chọn chuyên mục.';
  if (!post.cover) errors.cover = 'Thêm ảnh bìa (có mô tả) trước khi đăng.';
  if (!hasContent(post.content)) errors.content = 'Bài cần ít nhất một đoạn văn, ảnh hoặc video.';
  return errors;
}

/** Saves are partial: a field left out keeps its stored value (same as the BE). */
export type CheckedInput = Partial<Omit<NewsPostInput, 'content'>> & { content?: ArticleState | null };
export type Checked = { ok: true; input: CheckedInput } | { ok: false; errors: Record<string, string> };

export function checkContent(raw: unknown): { ok: true; value: ArticleState | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  const content = parseArticleContent(raw, { isAllowedImage });
  return content.ok ? content : { ok: false, error: content.error };
}

export function checkInput(db: MockDb, raw: Partial<NewsPostInput>): Checked {
  const parsed = newsPostInputSchema.partial().safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { content: rawContent, ...input } = parsed.data;
  if (input.categoryId && !db.newsCategories.some((c) => c.id === input.categoryId)) {
    return { ok: false, errors: { categoryId: 'Chuyên mục không còn, chọn chuyên mục khác.' } };
  }
  const coverUrls = input.cover ? [input.cover.url, ...(input.cover.srcset ?? []).map((v) => v.url)] : [];
  if (!coverUrls.every(isAllowedImage)) {
    return { ok: false, errors: { cover: 'Ảnh bìa phải được tải lên từ trang soạn bài.' } };
  }
  if (rawContent === undefined) return { ok: true, input };
  const content = checkContent(rawContent);
  return content.ok
    ? { ok: true, input: { ...input, content: content.value } }
    : { ok: false, errors: { content: content.error } };
}

/**
 * Slug: a typed one wins, '' follows the title again, left out keeps the stored one; once the post was ever
 * published it never changes, so links people shared keep working.
 */
export function nextSlug(db: MockDb, post: MockNewsPost, slug: string | undefined): string {
  if (post.slugLocked) return post.slug;
  if (slug === undefined && post.slug) return post.slug;
  return uniqueSlug(db, slug?.trim() || post.title, post.id);
}

export function applyInput(db: MockDb, post: MockNewsPost, input: CheckedInput) {
  if (input.title !== undefined) post.title = input.title;
  if (input.categoryId !== undefined) post.categoryId = input.categoryId;
  if (input.summary !== undefined) post.summary = input.summary;
  if (input.cover !== undefined) post.cover = input.cover;
  if (input.content !== undefined) post.content = input.content;
  if (input.tags !== undefined) post.tags = input.tags;
  post.slug = nextSlug(db, post, input.slug);
}

export function findPost(db: MockDb, id: string): MockNewsPost | null {
  return db.newsPosts.find((p) => p.id === id) ?? null;
}

export const touch = (post: MockNewsPost, by: string) => {
  post.updatedAt = new Date().toISOString();
  post.updatedBy = by;
};

/** Picks a sample photo for an "upload" (the demo keeps no files). */
export function sampleFor(file: File) {
  const n = [...file.name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % SAMPLE_IMAGES.length;
  const img = SAMPLE_IMAGES[n];
  return { url: `${siteOrigin()}${img.path}`, width: img.width, height: img.height };
}

export function categoryNameProblem(db: MockDb, name: string, selfId: string | null): string | null {
  const parsed = newsCategoryInputSchema.safeParse({ name });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Tên chưa hợp lệ.';
  const slug = toSlug(parsed.data.name);
  if (db.newsCategories.some((c) => c.id !== selfId && c.slug === slug)) return 'Đã có chuyên mục này.';
  return null;
}

/** Hashtags in use (drafts included), most used first, matched without accents; at most 20. */
export function tagSuggestions(db: MockDb, q: string): NewsTagSuggestion[] {
  const bySlug = new Map<string, NewsTagSuggestion>();
  for (const name of db.newsPosts.flatMap((p) => p.tags)) {
    const { slug } = tagDto(name);
    const found = bySlug.get(slug);
    bySlug.set(slug, found ? { ...found, postCount: found.postCount + 1 } : { name, slug, postCount: 1 });
  }
  return [...bySlug.values()]
    .filter((t) => !q.trim() || matchesQuery(t.name, q.replace(/^#/, '')))
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name, 'vi'))
    .slice(0, 20);
}

/** Up to 3 published posts sharing the most hashtags, then the same category, newest first. */
export function relatedPosts(db: MockDb, post: MockNewsPost): MockNewsPost[] {
  const mine = new Set(post.tags.map((t) => tagDto(t).slug));
  const score = (p: MockNewsPost) =>
    p.tags.filter((t) => mine.has(tagDto(t).slug)).length * 2 + (p.categoryId === post.categoryId ? 1 : 0);
  return published(db)
    .filter((p) => p.id !== post.id && score(p) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);
}
