import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { notFoundHtml } from '../lib/bot-page.js';
import { HttpError } from '../lib/http-error.js';
import { sharePagesRoutes } from './share-pages.js';
import { jobBotPage } from '../services/job-bot-page.js';
import { getJobPage } from '../services/public-jobs.js';
import { buildSitemap, SITEMAP_CACHE_CONTROL } from '../services/sitemap.js';

/**
 * Server-rendered pages for link previews and crawlers. vercel.json sends bot
 * user-agents (Zalo, Facebook, Google…) asking for /viec-lam/:slug here, so
 * previews and Google for Jobs see real content while people get the SPA.
 */
export const shareRoutes = new Hono<Env>();
shareRoutes.route('/', sharePagesRoutes);

/** /viec-lam/:slug only arrives here for crawler user-agents (see vercel.json). */
shareRoutes.get('/viec-lam/:slug', (c) => sharePage(c, c.req.param('slug')));
shareRoutes.get('/share/jobs/:slug', (c) => sharePage(c, c.req.param('slug')));

async function sharePage(c: Context<Env>, slug: string) {
  const { db, config, now } = c.get('deps');
  const site = { url: config.siteUrl, companyName: config.companyName };
  try {
    const { job, similar } = await getJobPage(db, slug, now());
    c.header('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
    return c.html(jobBotPage(site, job, similar));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return c.html(notFoundHtml({ href: `${site.url}/`, text: 'Xem vị trí đang mở' }), 404);
    }
    throw error;
  }
}

/** Built per request from the database (see services/sitemap.ts), so there is nothing to regenerate. */
shareRoutes.get('/sitemap.xml', async (c) => {
  const { db, config, now } = c.get('deps');
  const xml = await buildSitemap({ db, now: now(), siteUrl: config.siteUrl });
  c.header('content-type', 'application/xml; charset=utf-8');
  c.header('cache-control', SITEMAP_CACHE_CONTROL);
  return c.body(xml);
});

shareRoutes.get('/robots.txt', (c) => {
  const { config } = c.get('deps');
  return c.text(
    [
      'User-agent: *',
      // HR and account pages are not blocked here on purpose: crawlers must read them to see their
      // noindex (X-Robots-Tag in vercel.json), otherwise a linked page can be listed by its address alone.
      'Disallow: /api',
      `Sitemap: ${config.siteUrl}/sitemap.xml`,
      '',
    ].join('\n'),
  );
});

/** IndexNow ownership proof (lib/indexnow.ts): the key, as plain text, at /<key>.txt. Nothing else. */
shareRoutes.get('/:file{[a-zA-Z0-9-]{8,128}\\.txt}', (c) => {
  const key = c.get('deps').config.indexNowKey;
  if (!key || c.req.param('file') !== `${key}.txt`) return c.text('Không tìm thấy.', 404);
  return c.text(key);
});
