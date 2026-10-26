import {
  NEWS_PAGE_SIZE,
  type NewsCardDto,
  type NewsListResponse,
  type NewsPostDto,
  renderArticle,
} from '@careers/shared';
import { and, count, desc, eq, ne, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { newsCategories, newsPosts } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { listNewsCategories } from './news-categories.js';
import { cardColumns, toCard } from './news-mappers.js';
import { postsWithTag, publishedTag, tagsOfPosts, popularPublishedTags } from './news-tags.js';

/** Public reads: only published posts, never a draft. */

const isPublished = eq(newsPosts.status, 'published');
const newestFirst = [desc(newsPosts.publishedAt), desc(newsPosts.id)];

const slugParam = z.string().trim().max(100).optional().catch(undefined);
export const newsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  category: slugParam,
  tag: slugParam,
});
export type NewsQuery = z.infer<typeof newsQuerySchema>;

async function cards(
  db: Db,
  where: SQL | undefined,
  limit: number,
  { offset = 0, orderBy = newestFirst }: { offset?: number; orderBy?: SQL[] } = {},
): Promise<NewsCardDto[]> {
  const rows = await db
    .select(cardColumns)
    .from(newsPosts)
    .innerJoin(newsCategories, eq(newsCategories.id, newsPosts.categoryId))
    .where(and(isPublished, where))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);
  const tags = await tagsOfPosts(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toCard(row, tags.get(row.id) ?? []));
}

/**
 * /tin-tuc, /tin-tuc/chuyen-muc/<slug> and /tin-tuc/the/<slug>: 12 a page, newest first. A category that
 * does not exist, or a hashtag no published post uses, answers 404.
 */
export async function queryPublicNews(db: Db, query: NewsQuery): Promise<{ list: NewsListResponse; total: number }> {
  const [all, tag, popularTags] = await Promise.all([
    listNewsCategories(db, 'published'),
    query.tag ? publishedTag(db, query.tag) : null,
    popularPublishedTags(db),
  ]);
  const category = query.category ? (all.find((c) => c.slug === query.category) ?? null) : null;
  if (query.category && !category) throw notFound('Không tìm thấy chuyên mục.');
  if (query.tag && !tag) throw notFound('Không tìm thấy hashtag.');
  const where = and(
    category ? eq(newsPosts.categoryId, category.id) : undefined,
    tag ? postsWithTag(tag.id) : undefined,
  );
  const [counted] = await db.select({ n: count() }).from(newsPosts).where(and(isPublished, where));
  const total = counted?.n ?? 0;
  const list: NewsListResponse = {
    posts: await cards(db, where, NEWS_PAGE_SIZE, { offset: (query.page - 1) * NEWS_PAGE_SIZE }),
    categories: all.filter((c) => c.postCount > 0),
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE)),
    category,
    tag: tag ? { name: tag.name, slug: tag.slug } : null,
    popularTags,
  };
  return { list, total };
}

export const listPublicNews = async (db: Db, query: NewsQuery) => (await queryPublicNews(db, query)).list;

const RELATED_COUNT = 3;

/** Related posts: most hashtags in common first, then the same category, then the newest. */
function relatedOrder(postId: string, categoryId: string): SQL[] {
  const sharedTags = sql`(select count(*) from news_post_tags mine join news_post_tags theirs
    on theirs.tag_id = mine.tag_id where mine.post_id = ${postId} and theirs.post_id = ${newsPosts.id})`;
  return [desc(sharedTags), desc(sql`(${newsPosts.categoryId} = ${categoryId})`), ...newestFirst];
}

/** A published post with up to three related posts. Drafts answer 404. */
export async function getPublicNews(db: Db, slug: string): Promise<NewsPostDto> {
  const [row] = await db
    .select({
      ...cardColumns,
      categoryId: newsPosts.categoryId,
      html: newsPosts.contentHtml,
      headings: newsPosts.headings,
      content: newsPosts.content,
    })
    .from(newsPosts)
    .innerJoin(newsCategories, eq(newsCategories.id, newsPosts.categoryId))
    .where(and(isPublished, eq(newsPosts.slug, slug)))
    .limit(1);
  if (!row?.categoryId) throw notFound('Không tìm thấy bài viết.');
  const [tags, related] = await Promise.all([
    tagsOfPosts(db, [row.id]),
    cards(db, ne(newsPosts.id, row.id), RELATED_COUNT, { orderBy: relatedOrder(row.id, row.categoryId) }),
  ]);
  // Rendered again from the stored article (cheap, no DOM): improvements to the renderer reach every old post
  // without re-saving it. The stored HTML is only a fallback for a post without content.
  const fresh = row.content ? renderArticle(row.content) : null;
  return {
    ...toCard(row, tags.get(row.id) ?? []),
    html: fresh?.html ?? row.html,
    headings: fresh?.headings ?? row.headings,
    related,
  };
}
