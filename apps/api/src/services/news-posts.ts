import {
  ARTICLE_IMAGE_TYPE,
  type ArticleHeadingRef,
  fieldErrors,
  newsPostInputSchema,
  NEWS_CONTENT_MAX_BYTES,
  parseArticleContent,
  renderArticle,
  toSlug,
  type ArticleState,
  type HrMe,
  type HrNewsListResponse,
  type HrNewsPostDto,
  type NewsImage,
} from '@careers/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { newsCategories, newsPosts, type NewNewsPost, type NewsPost } from '../db/schema.js';
import type { ImageStore } from '../lib/image-store.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { listNewsCategories } from './news-categories.js';
import { freeSlug, iso, publicPathsOf, toHrNewsPost } from './news-mappers.js';
import { setPostTags, tagNamesOf, tagsOfPosts } from './news-tags.js';

/** What a save did: the post as HR sees it now, and the public pages it touched (for IndexNow). */
export interface NewsChange {
  post: HrNewsPostDto;
  publicPaths: string[];
}

export interface NewsSaveContext {
  db: Db;
  imageStore: ImageStore;
  now: Date;
  me: HrMe;
}

/** Autosave may send only what changed: a field left out keeps its saved value. */
const saveSchema = newsPostInputSchema.partial();
interface ContentColumns {
  content: ArticleState | null;
  contentHtml: string;
  plainText: string;
  headings: ArticleHeadingRef[];
}
type Fields = Pick<NewsPost, 'title' | 'categoryId' | 'summary' | 'cover'>;
type Editable = Pick<NewsPost, 'title' | 'categoryId' | 'cover' | 'content' | 'plainText'>;

const EMPTY: Fields & ContentColumns = {
  title: '',
  categoryId: null,
  summary: '',
  cover: null,
  content: null,
  contentHtml: '',
  plainText: '',
  headings: [],
};

const NOT_SAVED = 'Chưa lưu được, kiểm tra các ô được đánh dấu.';

export async function findNewsPost(db: Db, id: string): Promise<NewsPost> {
  const post = isUuid(id) ? await db.query.newsPosts.findFirst({ where: eq(newsPosts.id, id) }) : undefined;
  if (!post) throw notFound('Không tìm thấy bài viết.');
  return post;
}

export async function listHrNews(db: Db): Promise<HrNewsListResponse> {
  const [rows, categories] = await Promise.all([
    db
      .select({
        id: newsPosts.id,
        title: newsPosts.title,
        slug: newsPosts.slug,
        status: newsPosts.status,
        categoryName: newsCategories.name,
        publishedAt: newsPosts.publishedAt,
        updatedAt: newsPosts.updatedAt,
        updatedBy: newsPosts.updatedBy,
        cover: newsPosts.cover,
      })
      .from(newsPosts)
      .leftJoin(newsCategories, eq(newsCategories.id, newsPosts.categoryId))
      .orderBy(desc(newsPosts.updatedAt)),
    listNewsCategories(db, 'all'),
  ]);
  const posts = rows.map((row) => ({
    ...row,
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
    updatedAt: iso(row.updatedAt),
  }));
  return { posts, categories };
}

/** Checked by the schema, limited to images we host, then rendered: reads never parse or render again. */
function contentColumns(raw: unknown, isOwnUrl: (url: string) => boolean): ContentColumns | string {
  if (raw === null) return { content: null, contentHtml: '', plainText: '', headings: [] };
  if (new TextEncoder().encode(JSON.stringify(raw)).length > NEWS_CONTENT_MAX_BYTES) {
    return `Bài viết quá dài (tối đa ${NEWS_CONTENT_MAX_BYTES / 1000} KB). Tách thành nhiều bài.`;
  }
  const parsed = parseArticleContent(raw, { isAllowedImage: isOwnUrl });
  if (!parsed.ok) return parsed.error;
  const rendered = renderArticle(parsed.value);
  return {
    content: parsed.value,
    contentHtml: rendered.html,
    plainText: rendered.plainText,
    headings: rendered.headings,
  };
}

/** Blocks that are content without any text: a picture or a video. */
const MEDIA_BLOCKS = new Set<string>([ARTICLE_IMAGE_TYPE, 'youtube']);

const hasBody = (content: ArticleState | null, plainText: string) =>
  !!content && (plainText.trim() !== '' || content.root.children.some((b) => MEDIA_BLOCKS.has(b.type)));

/** What a post needs before it can be public (and keep being public through later edits). */
function publishProblems(post: Editable): Record<string, string> {
  return {
    ...(post.title.trim() ? {} : { title: 'Nhập tiêu đề trước khi đăng.' }),
    ...(post.categoryId ? {} : { categoryId: 'Chọn chuyên mục.' }),
    ...(post.cover?.alt.trim() ? {} : { cover: 'Thêm ảnh bìa và mô tả ảnh (alt).' }),
    ...(hasBody(post.content, post.plainText) ? {} : { content: 'Viết ít nhất một đoạn nội dung.' }),
  };
}

/** "doi-song" or "doi-song-3" for the title "Đời sống": a slug nobody chose by hand. */
function isAutoSlug(slug: string, title: string): boolean {
  const base = toSlug(title);
  return slug === base || new RegExp(`^${base}-\\d+$`).test(slug);
}

/**
 * The address: frozen once published. Before that, a slug HR typed wins; '' goes back to the title; leaving
 * it out (or sending the current one back) follows the title unless HR had chosen a slug by hand.
 */
async function nextSlug(db: Db, base: NewsPost | null, input: string | undefined, title: string): Promise<string> {
  if (base?.publishedAt) return base.slug;
  const typed = input?.trim() ? toSlug(input) : null;
  const selfId = base?.id ?? null;
  if (typed && typed !== base?.slug) return freeSlug(db, newsPosts, typed, selfId);
  if (base && input?.trim() !== '' && !isAutoSlug(base.slug, base.title)) return base.slug;
  return freeSlug(db, newsPosts, toSlug(title), selfId);
}

async function categoryExists(db: Db, id: string): Promise<boolean> {
  return !!(await db.query.newsCategories.findFirst({ where: eq(newsCategories.id, id), columns: { id: true } }));
}

/** The cover and every smaller copy of it must come from our own image store. */
const isOwnCover = (ctx: NewsSaveContext, cover: NewsImage) =>
  [cover.url, ...(cover.srcset ?? []).map((v) => v.url)].every((url) => ctx.imageStore.isOwnUrl(url));

async function referenceErrors(ctx: NewsSaveContext, categoryId: string | null, cover: NewsImage | null) {
  return {
    ...(categoryId && !(await categoryExists(ctx.db, categoryId)) ? { categoryId: 'Chuyên mục không còn.' } : {}),
    ...(cover && !isOwnCover(ctx, cover) ? { cover: 'Ảnh bìa phải tải lên từ trình soạn bài.' } : {}),
  };
}

type SaveInput = ReturnType<typeof saveSchema.parse>;

const pickContent = (from: ContentColumns): ContentColumns => ({
  content: from.content,
  contentHtml: from.contentHtml,
  plainText: from.plainText,
  headings: from.headings,
});

function mergeFields(input: SaveInput, from: Fields): Fields {
  return {
    title: input.title ?? from.title,
    categoryId: input.categoryId === undefined ? from.categoryId : input.categoryId,
    summary: input.summary ?? from.summary,
    cover: input.cover === undefined ? from.cover : input.cover,
  };
}

async function saveErrors(
  ctx: NewsSaveContext,
  base: NewsPost | null,
  next: Fields,
  content: ContentColumns | string,
): Promise<Record<string, string>> {
  const refs = await referenceErrors(ctx, next.categoryId, next.cover);
  if (typeof content === 'string') return { ...refs, content };
  const rules = base?.status === 'published' ? publishProblems({ ...next, ...content }) : {};
  return { ...rules, ...refs };
}

interface AppliedSave {
  values: Omit<NewNewsPost, 'id'>;
  /** undefined: the save left hashtags out, so they stay as they are. */
  tags: string[] | undefined;
}

/** The row values after applying a save to `base` (null: a new post), or 422 with every problem. */
async function applySave(ctx: NewsSaveContext, base: NewsPost | null, raw: unknown): Promise<AppliedSave> {
  const parsed = saveSchema.safeParse(raw ?? {});
  if (!parsed.success) throw invalid(NOT_SAVED, fieldErrors(parsed.error));
  const input = parsed.data;
  const from = base ?? EMPTY;
  const next = mergeFields(input, from);
  const content =
    input.content === undefined
      ? pickContent(from)
      : contentColumns(input.content, (url) => ctx.imageStore.isOwnUrl(url));
  const errors = await saveErrors(ctx, base, next, content);
  if (typeof content === 'string' || Object.keys(errors).length > 0) throw invalid(NOT_SAVED, errors);
  const values = {
    ...next,
    ...content,
    slug: await nextSlug(ctx.db, base, input.slug, next.title),
    updatedAt: ctx.now,
    updatedBy: ctx.me.name || ctx.me.email,
  };
  return { values, tags: input.tags };
}

/** The post as the editor loads it, hashtags included. */
async function hrView(db: Db, row: NewsPost): Promise<HrNewsPostDto> {
  return toHrNewsPost(row, await tagNamesOf(db, row.id));
}

export async function getHrNewsPost(db: Db, id: string): Promise<HrNewsPostDto> {
  return hrView(db, await findNewsPost(db, id));
}

export async function createNewsPost(ctx: NewsSaveContext, raw: unknown): Promise<NewsChange> {
  const { values, tags } = await applySave(ctx, null, raw);
  const [row] = await ctx.db
    .insert(newsPosts)
    .values({ ...values, createdAt: ctx.now })
    .returning();
  if (tags && tags.length > 0) await setPostTags(ctx.db, row.id, tags);
  return { post: await hrView(ctx.db, row), publicPaths: [] };
}

/**
 * Autosave. A published post is updated live, so it must still pass the publish rules; drafts and hidden
 * posts are private and save freely (a hidden post keeps its locked address).
 */
export async function saveNewsPost(ctx: NewsSaveContext, id: string, raw: unknown): Promise<NewsChange> {
  const before = await findNewsPost(ctx.db, id);
  const { values, tags } = await applySave(ctx, before, raw);
  // Hashtag pages the post leaves change too.
  const previousTags =
    before.status === 'published' && tags ? (await tagsOfPosts(ctx.db, [before.id])).get(before.id) : [];
  const [row] = await ctx.db.update(newsPosts).set(values).where(eq(newsPosts.id, before.id)).returning();
  if (tags) await setPostTags(ctx.db, row.id, tags);
  const publicPaths = await publicPathsOf(
    ctx.db,
    [before, row],
    (previousTags ?? []).map((tag) => tag.slug),
  );
  return { post: await hrView(ctx.db, row), publicPaths };
}

/** "Đăng" a draft, or show a hidden post again: same rules, first publish date and address kept. */
export async function publishNewsPost(ctx: NewsSaveContext, id: string): Promise<NewsChange> {
  const post = await findNewsPost(ctx.db, id);
  const problems = publishProblems(post);
  if (Object.keys(problems).length > 0) throw invalid('Chưa đăng được, còn thiếu vài mục.', problems);
  const [row] = await ctx.db
    .update(newsPosts)
    .set({
      status: 'published',
      publishedAt: post.publishedAt ?? ctx.now,
      updatedAt: ctx.now,
      updatedBy: ctx.me.name || ctx.me.email,
    })
    .where(eq(newsPosts.id, post.id))
    .returning();
  return { post: await hrView(ctx.db, row), publicPaths: await publicPathsOf(ctx.db, [row]) };
}

/**
 * "Ẩn bài": a published post goes to hidden. The public page answers 404, the address stays reserved and
 * "Đăng" shows it again. Hiding a hidden post changes nothing; a draft was never public, so it cannot be hidden.
 */
export async function hideNewsPost(ctx: NewsSaveContext, id: string): Promise<NewsChange> {
  const before = await findNewsPost(ctx.db, id);
  if (before.status === 'draft') throw new HttpError(422, 'Bản nháp chưa đăng nên không cần ẩn.');
  if (before.status === 'hidden') return { post: await hrView(ctx.db, before), publicPaths: [] };
  const [row] = await ctx.db
    .update(newsPosts)
    .set({ status: 'hidden', updatedAt: ctx.now, updatedBy: ctx.me.name || ctx.me.email })
    .where(eq(newsPosts.id, before.id))
    .returning();
  return { post: await hrView(ctx.db, row), publicPaths: await publicPathsOf(ctx.db, [before]) };
}

/** Deletes the post and its hashtag links; the tags themselves stay for other posts and autocomplete. */
export async function deleteNewsPost(db: Db, id: string): Promise<{ publicPaths: string[] }> {
  const before = await findNewsPost(db, id);
  const publicPaths = await publicPathsOf(db, [before]);
  await db.delete(newsPosts).where(eq(newsPosts.id, before.id));
  return { publicPaths };
}
