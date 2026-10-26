import {
  cutDescription,
  newsCategoryPath,
  newsPath,
  newsTagPath,
  readingMinutes,
  type HrNewsPostDto,
  type NewsCardDto,
  type NewsTagDto,
} from '@careers/shared';
import { and, inArray, like, ne } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../db/index.js';
import { newsCategories, newsPosts, type NewsPost } from '../db/schema.js';
import { tagsOfPosts } from './news-tags.js';

/** The page that lists every post; it changes whenever a post goes up, comes down or changes. */
export const NEWS_INDEX_PATH = '/tin-tuc';

export const iso = (date: Date) => date.toISOString();

/** `base`, or `base-2`, `base-3`… whichever no other row uses yet. */
export async function freeSlug(
  db: Db,
  table: PgTable & { id: PgColumn; slug: PgColumn },
  base: string,
  selfId: string | null,
): Promise<string> {
  const taken = await db
    .select({ slug: table.slug })
    .from(table)
    .where(and(like(table.slug, `${base}%`), selfId ? ne(table.id, selfId) : undefined));
  const used = new Set(taken.map((row) => String(row.slug)));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function toHrNewsPost(row: NewsPost, tags: string[]): HrNewsPostDto {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    slugLocked: row.publishedAt !== null,
    status: row.status,
    categoryId: row.categoryId,
    summary: row.summary,
    cover: row.cover,
    tags,
    content: row.content,
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

/** The columns a public card needs (no content or HTML). */
export const cardColumns = {
  id: newsPosts.id,
  slug: newsPosts.slug,
  title: newsPosts.title,
  summary: newsPosts.summary,
  cover: newsPosts.cover,
  plainText: newsPosts.plainText,
  publishedAt: newsPosts.publishedAt,
  updatedAt: newsPosts.updatedAt,
  categoryName: newsCategories.name,
  categorySlug: newsCategories.slug,
};

export interface CardRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  cover: NewsPost['cover'];
  plainText: string;
  publishedAt: Date | null;
  updatedAt: Date;
  categoryName: string;
  categorySlug: string;
}

/** An empty summary falls back to the start of the article (spec-news.md). */
export const summaryOf = (row: Pick<CardRow, 'summary' | 'plainText'>) =>
  row.summary.trim() || cutDescription(row.plainText, 160);

export function toCard(row: CardRow, tags: NewsTagDto[]): NewsCardDto {
  return {
    slug: row.slug,
    title: row.title,
    summary: summaryOf(row),
    cover: row.cover,
    category: { name: row.categoryName, slug: row.categorySlug },
    tags,
    publishedAt: iso(row.publishedAt ?? row.updatedAt),
    updatedAt: iso(row.updatedAt),
    readingMinutes: readingMinutes(row.plainText),
  };
}

/**
 * Public pages a change touched, for IndexNow: each published version's own page, the news index, its
 * category page and hashtag pages (current ones plus `previousTagSlugs`). Drafts are private: nothing.
 */
export async function publicPathsOf(
  db: Db,
  versions: (NewsPost | null)[],
  previousTagSlugs: readonly string[] = [],
): Promise<string[]> {
  const live = versions.filter((post): post is NewsPost => post?.status === 'published');
  if (live.length === 0) return [];
  const categoryIds = live.map((post) => post.categoryId).filter((id): id is string => id !== null);
  const categories =
    categoryIds.length > 0
      ? await db
          .select({ slug: newsCategories.slug })
          .from(newsCategories)
          .where(inArray(newsCategories.id, categoryIds))
      : [];
  const tags = await tagsOfPosts(
    db,
    live.map((post) => post.id),
  );
  const tagSlugs = [...previousTagSlugs, ...[...tags.values()].flat().map((tag) => tag.slug)];
  return [
    ...new Set([
      ...live.map((post) => newsPath(post.slug)),
      NEWS_INDEX_PATH,
      ...categories.map((c) => newsCategoryPath(c.slug)),
      ...tagSlugs.map(newsTagPath),
    ]),
  ];
}
