import { toSlug, type NewsTagDto } from '@careers/shared';
import { and, asc, count, desc, eq, inArray, like, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { newsPostTags, newsPosts, newsTags } from '../db/schema.js';

/**
 * Hashtags. Tags are shared between posts and outlive them (deleting a post only drops its links); every
 * public read goes through published posts, so a tag nobody published under never shows.
 */

/** A tag in HR's autocomplete, with how many posts (drafts included) use it. */
export interface NewsTagCount extends NewsTagDto {
  postCount: number;
}

const SUGGESTIONS = 20;

/**
 * A hashtag page needs this many published posts to be indexed and listed in the sitemap; a page with a
 * single post is thin content (noindex, follow).
 */
export const TAG_INDEX_MIN_POSTS = 2;

/** Replaces a post's tags with `names` (already cleaned by cleanTags), creating missing ones by slug. */
export async function setPostTags(db: Db, postId: string, names: readonly string[]): Promise<void> {
  const slugs = names.map((name) => toSlug(name));
  await db.transaction(async (tx) => {
    if (names.length > 0) {
      // An existing slug keeps its first spelling: "TUYỂN DỤNG" reuses "Tuyển dụng".
      await tx
        .insert(newsTags)
        .values(names.map((name, i) => ({ name, slug: slugs[i] })))
        .onConflictDoNothing({ target: newsTags.slug });
    }
    const tags = names.length > 0 ? await tx.select().from(newsTags).where(inArray(newsTags.slug, slugs)) : [];
    await tx.delete(newsPostTags).where(eq(newsPostTags.postId, postId));
    const links = tags.map((tag) => ({ postId, tagId: tag.id, position: slugs.indexOf(tag.slug) }));
    if (links.length > 0) await tx.insert(newsPostTags).values(links);
  });
}

/** Tags of each post, in HR's order. Posts without tags get an empty list. */
export async function tagsOfPosts(db: Db, postIds: readonly string[]): Promise<Map<string, NewsTagDto[]>> {
  const rows =
    postIds.length > 0
      ? await db
          .select({ postId: newsPostTags.postId, name: newsTags.name, slug: newsTags.slug })
          .from(newsPostTags)
          .innerJoin(newsTags, eq(newsTags.id, newsPostTags.tagId))
          .where(inArray(newsPostTags.postId, [...postIds]))
          .orderBy(asc(newsPostTags.position))
      : [];
  return new Map(
    postIds.map((id) => [id, rows.filter((r) => r.postId === id).map(({ name, slug }) => ({ name, slug }))]),
  );
}

export async function tagNamesOf(db: Db, postId: string): Promise<string[]> {
  return ((await tagsOfPosts(db, [postId])).get(postId) ?? []).map((tag) => tag.name);
}

/** HR autocomplete: tags whose slug contains what was typed (accents ignored), most used first. */
export async function suggestTags(db: Db, query: string): Promise<NewsTagCount[]> {
  const typed = toSlug(query.replace(/^#+/, ''), '');
  const postCount = count(newsPostTags.postId);
  return db
    .select({ name: newsTags.name, slug: newsTags.slug, postCount })
    .from(newsTags)
    .leftJoin(newsPostTags, eq(newsPostTags.tagId, newsTags.id))
    .where(typed ? like(newsTags.slug, `%${typed}%`) : undefined)
    .groupBy(newsTags.id)
    .orderBy(desc(postCount), asc(newsTags.name))
    .limit(SUGGESTIONS);
}

/** A tag with the number of published posts using it; null when none does (so it stays invisible). */
export async function publishedTag(
  db: Db,
  slug: string,
): Promise<(NewsTagDto & { id: string; postCount: number }) | null> {
  const [row] = await db
    .select({ id: newsTags.id, name: newsTags.name, slug: newsTags.slug, postCount: count() })
    .from(newsTags)
    .innerJoin(newsPostTags, eq(newsPostTags.tagId, newsTags.id))
    .innerJoin(newsPosts, and(eq(newsPosts.id, newsPostTags.postId), eq(newsPosts.status, 'published')))
    .where(eq(newsTags.slug, slug))
    .groupBy(newsTags.id);
  return row ?? null;
}

/** Posts carrying a tag, for `where … in (…)`. */
export const postsWithTag = (tagId: string) =>
  sql`${newsPosts.id} in (select ${newsPostTags.postId} from ${newsPostTags} where ${newsPostTags.tagId} = ${tagId})`;

const POPULAR = 12;

/** Most used hashtags among published posts, for the "Hashtag nổi bật" row on /tin-tuc. */
export async function popularPublishedTags(db: Db): Promise<NewsTagCount[]> {
  const postCount = count(newsPostTags.postId);
  return db
    .select({ name: newsTags.name, slug: newsTags.slug, postCount })
    .from(newsTags)
    .innerJoin(newsPostTags, eq(newsPostTags.tagId, newsTags.id))
    .innerJoin(newsPosts, and(eq(newsPosts.id, newsPostTags.postId), eq(newsPosts.status, 'published')))
    .groupBy(newsTags.id)
    .orderBy(desc(postCount), asc(newsTags.name))
    .limit(POPULAR);
}
