import { eq, or, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { newsPosts } from '../db/schema.js';
import { LOCAL_IMAGE_ROUTE } from './image-store.js';

/** What the local image store used to save: an absolute address that only works on the developer's machine. */
const OLD_LOCAL_PREFIX = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/api\/news-images\//g;

/** Every old local image address inside a string, array or object becomes a site path ("/api/news-images/…"). */
export function relativizeLocalImageUrls<T>(value: T): T {
  if (typeof value === 'string') return value.replace(OLD_LOCAL_PREFIX, `${LOCAL_IMAGE_ROUTE}/`) as T;
  if (Array.isArray(value)) return value.map((item: unknown) => relativizeLocalImageUrls(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]: [string, unknown]) => [key, relativizeLocalImageUrls(item)]),
    ) as T;
  }
  return value;
}

const mentionsOldLocalUrl = (
  column: typeof newsPosts.cover | typeof newsPosts.content | typeof newsPosts.contentHtml,
) => sql`${column}::text ~ ${OLD_LOCAL_PREFIX.source}`;

/**
 * Local development only (local-dev.ts, never on Vercel): posts saved before images got site paths still point
 * at http://localhost:<port>/…, which breaks on phones. Rewrites cover, content and HTML; safe to run on every
 * start (rows already rewritten are not touched). Returns how many posts changed.
 */
export async function rewriteLocalImageUrls(db: Db): Promise<number> {
  const rows = await db
    .select({
      id: newsPosts.id,
      cover: newsPosts.cover,
      content: newsPosts.content,
      contentHtml: newsPosts.contentHtml,
      updatedAt: newsPosts.updatedAt,
    })
    .from(newsPosts)
    .where(
      or(
        mentionsOldLocalUrl(newsPosts.cover),
        mentionsOldLocalUrl(newsPosts.content),
        mentionsOldLocalUrl(newsPosts.contentHtml),
      ),
    );
  for (const row of rows) {
    await db
      .update(newsPosts)
      .set({
        cover: relativizeLocalImageUrls(row.cover),
        content: relativizeLocalImageUrls(row.content),
        contentHtml: relativizeLocalImageUrls(row.contentHtml),
        // A path change is not an edit: keep the date readers and the sitemap see.
        updatedAt: row.updatedAt,
      })
      .where(eq(newsPosts.id, row.id));
  }
  return rows.length;
}
