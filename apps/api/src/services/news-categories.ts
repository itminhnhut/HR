import { fieldErrors, newsCategoryInputSchema, toSlug, type NewsCategoryDto } from '@careers/shared';
import { asc, count, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { newsCategories, newsPosts, type NewsCategory } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { freeSlug } from './news-mappers.js';

/** "all": HR sees every post counted; "published": the public site counts only what it shows. */
export type CategoryCount = 'all' | 'published';

export async function listNewsCategories(db: Db, counting: CategoryCount): Promise<NewsCategoryDto[]> {
  const postCount =
    counting === 'all'
      ? sql<number>`count(${newsPosts.id})`.mapWith(Number)
      : sql<number>`count(${newsPosts.id}) filter (where ${newsPosts.status} = 'published')`.mapWith(Number);
  return db
    .select({ id: newsCategories.id, name: newsCategories.name, slug: newsCategories.slug, postCount })
    .from(newsCategories)
    .leftJoin(newsPosts, eq(newsPosts.categoryId, newsCategories.id))
    .groupBy(newsCategories.id)
    .orderBy(asc(newsCategories.sort), asc(newsCategories.name));
}

export async function findNewsCategory(db: Db, id: string): Promise<NewsCategory> {
  const row = isUuid(id) ? await db.query.newsCategories.findFirst({ where: eq(newsCategories.id, id) }) : undefined;
  if (!row) throw notFound('Không tìm thấy chuyên mục.');
  return row;
}

function parseName(raw: unknown): string {
  const parsed = newsCategoryInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chưa lưu được, kiểm tra tên chuyên mục.', fieldErrors(parsed.error));
  return parsed.data.name;
}

async function postCountOf(db: Db, categoryId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(newsPosts).where(eq(newsPosts.categoryId, categoryId));
  return row?.n ?? 0;
}

const toDto = (row: NewsCategory, postCount: number): NewsCategoryDto => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  postCount,
});

export async function createNewsCategory(db: Db, raw: unknown, now: Date): Promise<NewsCategoryDto> {
  const name = parseName(raw);
  const slug = await freeSlug(db, newsCategories, toSlug(name, 'chuyen-muc'), null);
  const [row] = await db.insert(newsCategories).values({ name, slug, createdAt: now, updatedAt: now }).returning();
  return toDto(row, 0);
}

/** Renaming keeps the slug: category links already shared or indexed keep working. */
export async function renameNewsCategory(db: Db, id: string, raw: unknown, now: Date): Promise<NewsCategoryDto> {
  const category = await findNewsCategory(db, id);
  const name = parseName(raw);
  const [row] = await db
    .update(newsCategories)
    .set({ name, updatedAt: now })
    .where(eq(newsCategories.id, category.id))
    .returning();
  return toDto(row, await postCountOf(db, row.id));
}

export async function deleteNewsCategory(db: Db, id: string): Promise<{ ok: true }> {
  const category = await findNewsCategory(db, id);
  if ((await postCountOf(db, category.id)) > 0) {
    throw new HttpError(409, 'Chuyên mục còn bài viết (kể cả bản nháp). Chuyển các bài sang chuyên mục khác rồi xoá.');
  }
  await db.delete(newsCategories).where(eq(newsCategories.id, category.id));
  return { ok: true };
}
