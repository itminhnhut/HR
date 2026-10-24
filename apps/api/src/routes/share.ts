import { placeLabel, EMPLOYMENT_TYPE_LABEL, formatDate, formatSalary, isListed, jobPostingData } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { jobs } from '../db/schema.js';
import { toDetail } from '../services/job-mappers.js';
import { listedJobs } from '../services/public-jobs.js';

/**
 * Server-rendered pages for link previews and crawlers. vercel.json sends bot
 * user-agents (Zalo, Facebook, Google…) asking for /viec-lam/:slug here, so
 * previews and Google for Jobs see real content while people get the SPA.
 */
export const shareRoutes = new Hono<Env>();

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);

const list = (heading: string, lines: string[]) =>
  lines.length > 0
    ? `<h2>${escapeHtml(heading)}</h2><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
    : '';

/** /viec-lam/:slug only arrives here for crawler user-agents (see vercel.json). */
shareRoutes.get('/viec-lam/:slug', (c) => sharePage(c, c.req.param('slug')));
shareRoutes.get('/share/jobs/:slug', (c) => sharePage(c, c.req.param('slug')));

async function sharePage(c: Context<Env>, slug: string) {
  const { db, config, now } = c.get('deps');
  const row = await db.query.jobs.findFirst({ where: eq(jobs.slug, slug) });
  if (!row || row.state === 'draft') {
    return c.html(
      '<!doctype html><html lang="vi"><title>Không tìm thấy</title><p>Không tìm thấy vị trí này.</p></html>',
      404,
    );
  }

  const job = toDetail(row, now());
  const listed = isListed(job.status);
  const url = `${config.siteUrl}/viec-lam/${job.slug}`;
  const title = `${job.title} – ${config.companyName}`;
  const summary = `${formatSalary(job)} · ${placeLabel(job.address)} · ${EMPLOYMENT_TYPE_LABEL[job.employmentType]} · Hạn nộp ${formatDate(job.deadline)}`;
  // BR-05: a closed job keeps its page; BR-16: but drops out of Google for Jobs.
  const description = listed ? summary : `Vị trí này đã ngừng nhận hồ sơ. ${summary}`;
  // "</" inside JSON would end the script tag early.
  const jsonLd = JSON.stringify(jobPostingData(job, { name: config.companyName, url: config.siteUrl })).replace(
    /</g,
    '\\u003c',
  );

  c.header('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
  return c.html(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
${listed ? '' : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(config.companyName)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
${listed ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body>
<h1>${escapeHtml(job.title)}</h1>
<p>${escapeHtml(description)}</p>
${list('Bạn sẽ làm gì', job.responsibilities)}
${list('Chúng tôi cần ở bạn', job.requirements)}
<p><a href="${escapeHtml(url)}">Xem và ứng tuyển</a></p>
</body>
</html>`);
}

shareRoutes.get('/sitemap.xml', async (c) => {
  const { db, config, now } = c.get('deps');
  const site = escapeHtml(config.siteUrl);
  // BR-16: only jobs taking applications are in the sitemap.
  const urls = (await listedJobs(db, now())).map(
    (job) =>
      `<url><loc>${site}/viec-lam/${escapeHtml(job.slug)}</loc><lastmod>${job.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`,
  );
  c.header('content-type', 'application/xml; charset=utf-8');
  c.header('cache-control', 'public, s-maxage=600');
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${site}/</loc></url>
<url><loc>${site}/gioi-thieu</loc></url>
${urls.join('\n')}
</urlset>`);
});

shareRoutes.get('/robots.txt', (c) => {
  const { config } = c.get('deps');
  return c.text(
    [
      'User-agent: *',
      'Disallow: /hr',
      'Disallow: /api',
      'Disallow: /ho-so-cua-toi',
      'Disallow: /dang-nhap',
      'Disallow: /tra-cuu-ho-so',
      `Sitemap: ${config.siteUrl}/sitemap.xml`,
      '',
    ].join('\n'),
  );
});
