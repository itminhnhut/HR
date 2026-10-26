import { Hono } from 'hono';
import type { Env } from '../app.js';
import { IMAGE_CONTENT_TYPE, type ImageExt } from '../lib/image-info.js';
import { getPublicNews, listPublicNews, newsQuerySchema } from '../services/news-public.js';

/** Public news API (no sign-in): published posts only. Mounted under /api. */
export const publicNewsRoutes = new Hono<Env>();

/** A new or edited post shows up within a minute; the CDN serves the rest. */
export const NEWS_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

publicNewsRoutes.get('/news', async (c) => {
  const query = newsQuerySchema.parse({
    page: c.req.query('page'),
    category: c.req.query('category'),
    tag: c.req.query('tag'),
  });
  const body = await listPublicNews(c.get('deps').db, query);
  c.header('cache-control', NEWS_CACHE_CONTROL);
  return c.json(body);
});

publicNewsRoutes.get('/news/:slug', async (c) => {
  const body = await getPublicNews(c.get('deps').db, c.req.param('slug'));
  c.header('cache-control', NEWS_CACHE_CONTROL);
  return c.json(body);
});

const IMAGE_EXTS: readonly ImageExt[] = ['jpg', 'png', 'webp'];

/** Local development only: images of the file store (lib/image-store.ts). Production uses public Blob URLs. */
publicNewsRoutes.get('/news-images/:name', async (c) => {
  const { config, imageStore } = c.get('deps');
  const name = c.req.param('name');
  const ext = IMAGE_EXTS.find((e) => name.endsWith(`.${e}`));
  const bytes = config.isProduction || !ext ? null : await imageStore.read?.(name);
  if (!bytes || !ext) return c.json({ error: 'Không tìm thấy.' }, 404);
  return c.body(bytes, 200, {
    'content-type': IMAGE_CONTENT_TYPE[ext],
    'x-content-type-options': 'nosniff',
    'cache-control': 'public, max-age=31536000, immutable',
  });
});
