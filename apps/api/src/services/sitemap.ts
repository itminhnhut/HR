import { newsCategoryPath, newsPath, newsTagPath } from '@careers/shared';
import { count, desc, eq, gte, isNotNull, max, ne } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { jobs, newsCategories, newsPostTags, newsPosts, newsTags } from '../db/schema.js';
import { NEWS_INDEX_PATH } from './news-mappers.js';
import { TAG_INDEX_MIN_POSTS } from './news-tags.js';
import { listedJobs } from './public-jobs.js';

/**
 * /sitemap.xml, built from a list of sources. Each source turns the database
 * into sitemap entries; adding a section of the site means adding one source.
 *
 * There is no "regenerate" step: the sitemap is built on every request and the
 * CDN keeps it for at most SITEMAP_CACHE_CONTROL's s-maxage, so a job posted,
 * edited or closed shows up within about five minutes without anyone pushing.
 * The site is small, so one <urlset> is enough (a sitemap index starts to pay
 * off near the 50,000 URL / 50 MB limit of a single file).
 */

export interface SitemapImage {
  /** Absolute URL, or a path on the site ("/anh/x.jpg"). */
  url: string;
  title?: string;
}

export interface SitemapEntry {
  /** Path on the public site, starting with "/". */
  path: string;
  lastmod?: Date;
  images?: SitemapImage[];
}

export interface SitemapContext {
  db: Db;
  now: Date;
}

export type SitemapSource = (ctx: SitemapContext) => Promise<SitemapEntry[]>;

export const SITEMAP_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

/** Newest update of a job that shows on the site (drafts are private). */
async function newestJobUpdate(db: Db): Promise<Date | undefined> {
  const [row] = await db
    .select({ newest: max(jobs.updatedAt) })
    .from(jobs)
    .where(ne(jobs.state, 'draft'));
  return row?.newest ?? undefined;
}

/**
 * Pages that are not stored in the database. The home page is the job board,
 * so it changes whenever a job is posted, edited or closed.
 */
export const staticPagesSource: SitemapSource = async ({ db }) => {
  const newestJob = await newestJobUpdate(db);
  return [{ path: '/', lastmod: newestJob }, { path: '/gioi-thieu' }, { path: '/chinh-sach-du-lieu' }];
};

/** BR-16: only jobs taking applications; closed, expired and draft jobs stay out. */
export const jobsSource: SitemapSource = async ({ db, now }) =>
  (await listedJobs(db, now)).map((job) => ({ path: `/viec-lam/${job.slug}`, lastmod: job.updatedAt }));

const isPublished = eq(newsPosts.status, 'published');

/** Hashtag pages with enough published posts, dated by the newest change among those posts. */
export const newsTagsSource: SitemapSource = async ({ db }) => {
  const rows = await db
    .select({ slug: newsTags.slug, newest: max(newsPosts.updatedAt) })
    .from(newsTags)
    .innerJoin(newsPostTags, eq(newsPostTags.tagId, newsTags.id))
    .innerJoin(newsPosts, eq(newsPosts.id, newsPostTags.postId))
    .where(isPublished)
    .groupBy(newsTags.slug)
    .having(gte(count(), TAG_INDEX_MIN_POSTS))
    .orderBy(newsTags.slug);
  return rows.map((row) => ({ path: newsTagPath(row.slug), lastmod: row.newest ?? undefined }));
};

/**
 * News (spec-news.md): /tin-tuc, each category page that has published posts, and each published post with
 * its cover image. /tin-tuc changes whenever a post that was ever public changes, taking one down included.
 * Drafts and posts taken down are never listed.
 */
export const newsSource: SitemapSource = async ({ db }) => {
  const [[index], categories, posts] = await Promise.all([
    db
      .select({ newest: max(newsPosts.updatedAt) })
      .from(newsPosts)
      .where(isNotNull(newsPosts.publishedAt)),
    db
      .select({ slug: newsCategories.slug, newest: max(newsPosts.updatedAt) })
      .from(newsPosts)
      .innerJoin(newsCategories, eq(newsCategories.id, newsPosts.categoryId))
      .where(isPublished)
      .groupBy(newsCategories.slug)
      .orderBy(newsCategories.slug),
    db
      .select({ slug: newsPosts.slug, title: newsPosts.title, cover: newsPosts.cover, updatedAt: newsPosts.updatedAt })
      .from(newsPosts)
      .where(isPublished)
      .orderBy(desc(newsPosts.publishedAt)),
  ]);
  return [
    { path: NEWS_INDEX_PATH, lastmod: index?.newest ?? undefined },
    ...categories.map((c) => ({ path: newsCategoryPath(c.slug), lastmod: c.newest ?? undefined })),
    ...posts.map((post) => ({
      path: newsPath(post.slug),
      lastmod: post.updatedAt,
      images: post.cover ? [{ url: post.cover.url, title: post.title }] : [],
    })),
  ];
};

/** Order here is the order in the file. */
export const SITEMAP_SOURCES: readonly SitemapSource[] = [staticPagesSource, jobsSource, newsSource, newsTagsSource];

const XML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch] ?? ch);

/** W3C date-time in UTC without milliseconds, e.g. 2026-10-20T03:00:00Z. */
const w3cDateTime = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Sitemaps want RFC 3986 URLs: non-ASCII and "<>\"" are percent-encoded, then the whole URL is XML-escaped. */
const absoluteUrl = (siteUrl: string, pathOrUrl: string) =>
  /^https?:\/\//.test(pathOrUrl) ? encodeURI(pathOrUrl) : `${siteUrl.replace(/\/+$/, '')}${encodeURI(pathOrUrl)}`;

function renderImage(siteUrl: string, image: SitemapImage): string {
  // Google ignores <image:title> since 2022; it is kept for other crawlers.
  const title = image.title ? `<image:title>${escapeXml(image.title)}</image:title>` : '';
  return `<image:image><image:loc>${escapeXml(absoluteUrl(siteUrl, image.url))}</image:loc>${title}</image:image>`;
}

function renderEntry(siteUrl: string, entry: SitemapEntry): string {
  const loc = `<loc>${escapeXml(absoluteUrl(siteUrl, entry.path))}</loc>`;
  const lastmod = entry.lastmod ? `<lastmod>${w3cDateTime(entry.lastmod)}</lastmod>` : '';
  const images = (entry.images ?? []).map((image) => renderImage(siteUrl, image)).join('');
  return `<url>${loc}${lastmod}${images}</url>`;
}

export function renderSitemap(siteUrl: string, entries: readonly SitemapEntry[]): string {
  const hasImages = entries.some((entry) => (entry.images ?? []).length > 0);
  const imageNs = hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>`,
    ...entries.map((entry) => renderEntry(siteUrl, entry)),
    '</urlset>',
    '',
  ].join('\n');
}

export async function buildSitemap(
  ctx: SitemapContext & { siteUrl: string },
  sources: readonly SitemapSource[] = SITEMAP_SOURCES,
): Promise<string> {
  const entries = (await Promise.all(sources.map((source) => source(ctx)))).flat();
  return renderSitemap(ctx.siteUrl, entries);
}
