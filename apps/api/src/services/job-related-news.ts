import { pickRelatedPosts, type RelatedPostDto } from '@careers/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { newsCategories, newsPosts } from '../db/schema.js';
import { iso } from './news-mappers.js';
import { tagsOfPosts } from './news-tags.js';

/** Newest published posts the matcher looks at: far more than the site has, and still one cheap query. */
const CANDIDATES = 200;

/** "Bài viết liên quan" of a job page: published posts only, matched by pickRelatedPosts (shared). */
export async function relatedNewsForJob(db: Db, job: { title: string; department: string }): Promise<RelatedPostDto[]> {
  const rows = await db
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      cover: newsPosts.cover,
      publishedAt: newsPosts.publishedAt,
      updatedAt: newsPosts.updatedAt,
      categoryName: newsCategories.name,
      categorySlug: newsCategories.slug,
    })
    .from(newsPosts)
    .innerJoin(newsCategories, eq(newsCategories.id, newsPosts.categoryId))
    .where(eq(newsPosts.status, 'published'))
    .orderBy(desc(newsPosts.publishedAt), desc(newsPosts.id))
    .limit(CANDIDATES);
  const tags = await tagsOfPosts(
    db,
    rows.map((row) => row.id),
  );
  const candidates = rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    cover: row.cover,
    tags: (tags.get(row.id) ?? []).map((tag) => tag.name),
    category: { name: row.categoryName, slug: row.categorySlug },
    publishedAt: iso(row.publishedAt ?? row.updatedAt),
  }));
  return pickRelatedPosts(job, candidates).map(({ slug, title, cover, category }) => ({
    slug,
    title,
    cover,
    category,
  }));
}
