import { renderArticle, toSlug, type ArticleState, type NewsImage, type NewsPostInput } from '@careers/shared';
import { eq, inArray } from 'drizzle-orm';
import {
  newsCategories,
  newsPostTags,
  newsPosts,
  newsTags,
  type NewsCategory,
  type NewsPost,
  type NewNewsPost,
} from '../db/schema.js';
import { MemoryImageStore } from './fakes.js';
import type { TestContext } from './harness.js';

let counter = 0;

/** An image address the test image store accepts as its own. */
export const ownImageUrl = (ext = 'jpg') => `${MemoryImageStore.BASE}${crypto.randomUUID()}.${ext}`;

export const coverImage = (overrides: Partial<NewsImage> = {}): NewsImage => ({
  url: ownImageUrl(),
  alt: 'Văn phòng công ty',
  width: 1200,
  height: 630,
  ...overrides,
});

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', text, format: 0, style: '', version: 1 }],
});

/** Editor state the way Lexical saves it: one H2 and the given paragraphs. */
export function articleState(...paragraphs: string[]): ArticleState {
  const content = {
    root: {
      type: 'root',
      version: 1,
      children: [
        { type: 'heading', tag: 'h2', version: 1, children: [{ type: 'text', text: 'Giới thiệu', format: 0 }] },
        ...paragraphs.map(paragraph),
      ],
    },
  };
  return content as unknown as ArticleState;
}

/** A save that passes every publish rule. */
export function newsInput(categoryId: string, overrides: Partial<NewsPostInput> = {}): NewsPostInput {
  return {
    title: 'Một ngày ở TOP FLOW',
    categoryId,
    summary: 'Chuyện thường ngày của đội kỹ thuật.',
    cover: coverImage(),
    content: articleState('Buổi sáng bắt đầu bằng cà phê.'),
    ...overrides,
  };
}

export async function insertCategory(t: TestContext, name = `Chuyên mục ${++counter}`): Promise<NewsCategory> {
  const [row] = await t.db
    .insert(newsCategories)
    .values({ name, slug: toSlug(name) })
    .returning();
  return row;
}

/** A published post in `categoryId`, published and updated at the test clock unless overridden. */
export async function insertPost(
  t: TestContext,
  categoryId: string,
  overrides: Partial<NewNewsPost> = {},
): Promise<NewsPost> {
  counter += 1;
  const content = articleState(`Đoạn văn của bài ${counter}.`);
  const rendered = renderArticle(content);
  const [row] = await t.db
    .insert(newsPosts)
    .values({
      title: `Bài ${counter}`,
      slug: `bai-${counter}`,
      status: 'published',
      categoryId,
      summary: `Tóm tắt bài ${counter}`,
      cover: coverImage(),
      content,
      contentHtml: rendered.html,
      plainText: rendered.plainText,
      headings: rendered.headings,
      publishedAt: t.clock.now,
      updatedAt: t.clock.now,
      updatedBy: 'Phòng Nhân sự',
      ...overrides,
    })
    .returning();
  return row;
}

/** Gives a post these hashtags (in this order), creating the tags that do not exist yet. */
export async function tagPost(t: TestContext, postId: string, names: string[]): Promise<void> {
  const slugs = names.map((name) => toSlug(name));
  if (names.length > 0) {
    await t.db
      .insert(newsTags)
      .values(names.map((name, i) => ({ name, slug: slugs[i] })))
      .onConflictDoNothing();
  }
  const tags = slugs.length > 0 ? await t.db.select().from(newsTags).where(inArray(newsTags.slug, slugs)) : [];
  await t.db.delete(newsPostTags).where(eq(newsPostTags.postId, postId));
  const rows = tags.map((tag) => ({ postId, tagId: tag.id, position: slugs.indexOf(tag.slug) }));
  if (rows.length > 0) await t.db.insert(newsPostTags).values(rows);
}
