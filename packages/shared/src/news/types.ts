import { z } from 'zod';
import { ARTICLE_ALT_MAX, type ArticleState } from './content.js';
import type { ArticleHeadingRef } from './render.js';
import { imageAddressSchema, srcsetSchema, type NewsImageVariant } from './images.js';
import { squashSpaces, toSlug } from './text.js';

/** "#tuyển  dụng" → "tuyển dụng"; empty and repeated tags (same slug) are dropped. */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = squashSpaces(raw.replace(/^#+/, ''));
    const slug = toSlug(name, '');
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(name);
  }
  return out;
}

/**
 * draft: never published, HR-only, address still editable. published: public. hidden: was published, taken
 * down by HR (not public, out of the sitemap), keeps its address and first publish date; "Hiện lại" republishes.
 */
export type NewsStatus = 'draft' | 'published' | 'hidden';

export const NEWS_STATUS_LABEL: Record<NewsStatus, string> = {
  draft: 'Nháp',
  published: 'Đã đăng',
  hidden: 'Đã ẩn',
};

export const NEWS_TITLE_MAX = 160;
export const NEWS_SUMMARY_MAX = 160;
export const NEWS_CATEGORY_MAX = 60;
/** Serialized editor state, a little above what a long article with many images needs. */
export const NEWS_CONTENT_MAX_BYTES = 200_000;
export const NEWS_PAGE_SIZE = 12;
/** Hashtags per post, and the length of one. */
export const NEWS_TAGS_MAX = 10;
export const NEWS_TAG_MAX = 40;
/** Under Vercel's 4.5 MB request body limit; the editor shrinks bigger photos before upload. */
export const NEWS_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const NEWS_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface NewsImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** Smaller WebP copies made at upload, plus the picture itself. Older images have none. */
  srcset?: NewsImageVariant[];
}

export interface NewsCategoryDto {
  id: string;
  name: string;
  slug: string;
  /** Published posts in it (public) or all posts (HR). */
  postCount: number;
}

/** A hashtag: "#Tuyển dụng" is stored as name "Tuyển dụng", slug "tuyen-dung". */
export interface NewsTagDto {
  name: string;
  slug: string;
}

/** A hashtag with how many published posts use it ("Hashtag nổi bật" on /tin-tuc). */
export interface NewsTagCountDto extends NewsTagDto {
  postCount: number;
}

/** A post in a list (public). */
export interface NewsCardDto {
  slug: string;
  title: string;
  summary: string;
  cover: NewsImage | null;
  category: { name: string; slug: string };
  tags: NewsTagDto[];
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
}

/** A published post page (public). `html` comes from renderArticle on the server. */
export interface NewsPostDto extends NewsCardDto {
  html: string;
  headings: ArticleHeadingRef[];
  related: NewsCardDto[];
}

export interface NewsListResponse {
  posts: NewsCardDto[];
  categories: NewsCategoryDto[];
  page: number;
  pageCount: number;
  /** Set when listing one category. */
  category: NewsCategoryDto | null;
  /** Set when listing one hashtag. */
  tag: NewsTagDto | null;
  /** Most used hashtags of published posts, most used first (at most 12). */
  popularTags: NewsTagCountDto[];
}

/** A row in HR's list. */
export interface HrNewsRowDto {
  id: string;
  title: string;
  slug: string;
  status: NewsStatus;
  categoryName: string | null;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  /** The cover, for the thumbnail in the list (optional: older servers leave it out). */
  cover?: NewsImage | null;
}

/** What the editor loads and saves. */
export interface HrNewsPostDto {
  id: string;
  title: string;
  slug: string;
  /** The address is frozen once published: links people shared keep working. */
  slugLocked: boolean;
  status: NewsStatus;
  categoryId: string | null;
  summary: string;
  cover: NewsImage | null;
  /** Hashtag names, in the order HR typed them. */
  tags: string[];
  content: ArticleState | null;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface HrNewsListResponse {
  posts: HrNewsRowDto[];
  categories: NewsCategoryDto[];
}

export const newsCategoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên chuyên mục.').max(NEWS_CATEGORY_MAX, `Tối đa ${NEWS_CATEGORY_MAX} ký tự.`),
});

export const newsImageSchema = z.object({
  url: imageAddressSchema,
  alt: z.string().trim().min(1, 'Ảnh bìa cần mô tả (alt).').max(ARTICLE_ALT_MAX),
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  /** Addresses are checked against our own storage by the API, like `url`. */
  srcset: srcsetSchema(),
});

/**
 * Saving a post (draft or published). Content is checked separately with parseArticleContent, which needs
 * to know which image addresses are ours. Everything is optional in a draft; publishing checks the rest.
 */
export const newsPostInputSchema = z.object({
  title: z.string().trim().max(NEWS_TITLE_MAX, `Tiêu đề tối đa ${NEWS_TITLE_MAX} ký tự.`),
  slug: z.string().trim().max(80).optional(),
  categoryId: z.uuid().nullable(),
  summary: z.string().trim().max(NEWS_SUMMARY_MAX, `Tóm tắt tối đa ${NEWS_SUMMARY_MAX} ký tự.`),
  cover: newsImageSchema.nullable(),
  /** Hashtag names; "#" and extra spaces are dropped, duplicates (ignoring accents and case) merged. */
  tags: z
    .array(z.string().trim().max(NEWS_TAG_MAX, `Mỗi hashtag tối đa ${NEWS_TAG_MAX} ký tự.`))
    .max(NEWS_TAGS_MAX, `Tối đa ${NEWS_TAGS_MAX} hashtag.`)
    .transform(cleanTags)
    .optional(),
  content: z.unknown(),
});
export type NewsPostInput = z.infer<typeof newsPostInputSchema>;
