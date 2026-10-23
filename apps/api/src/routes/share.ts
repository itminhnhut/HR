import {
  deadlineEnd,
  EMPLOYMENT_TYPE_LABEL,
  formatDate,
  formatSalary,
  hasSalary,
  isListed,
  locationLabel,
  type JobDetailDto,
} from '@careers/shared';
import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { config } from '../lib/config.js';
import { toJobDetail } from '../lib/mappers.js';

/**
 * Server-rendered pages for crawlers only. The frontend's vercel.json routes
 * bot user-agents (Zalo, Facebook, Googlebot…) for /jobs/:slug here, so link
 * previews and Google Jobs see real content while people get the SPA.
 */
export const shareRoutes = new Hono();

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const GOOGLE_EMPLOYMENT_TYPE = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  internship: 'INTERN',
  contract: 'CONTRACTOR',
} as const;

function jobPostingJsonLd(job: JobDetailDto): string {
  const description = [
    ['Bạn sẽ làm gì', job.responsibilities],
    ['Chúng tôi cần ở bạn', job.requirements],
    ['Bạn nhận được', job.benefits],
  ]
    .filter(([, lines]) => lines.length > 0)
    .map(
      ([heading, lines]) =>
        `<p><b>${escapeHtml(heading as string)}</b></p><ul>${(lines as string[]).map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
    )
    .join('');

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted: job.publishedAt,
    validThrough: deadlineEnd(job.deadline).toISOString(),
    employmentType: GOOGLE_EMPLOYMENT_TYPE[job.employmentType],
    hiringOrganization: { '@type': 'Organization', name: config.companyName, sameAs: config.siteUrl },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: job.address ?? undefined,
        addressLocality: job.city,
        addressCountry: 'VN',
      },
    },
    directApply: true,
  };
  // BR-08: only send salary when HR actually entered one.
  if (hasSalary(job)) {
    data.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryMin != null ? job.salaryMin * 1_000_000 : undefined,
        maxValue: job.salaryMax != null ? job.salaryMax * 1_000_000 : undefined,
        unitText: 'MONTH',
      },
    };
  }
  // "</" would end the script tag early.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

shareRoutes.get('/jobs/:slug', async (c) => {
  const [row] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.slug, c.req.param('slug')), ne(jobs.state, 'draft')))
    .limit(1);
  if (!row) return c.html('<!doctype html><title>Không tìm thấy</title><p>Không tìm thấy vị trí này.</p>', 404);

  const job = toJobDetail(row);
  const listed = isListed(job.status);
  const url = `${config.siteUrl}/jobs/${job.slug}`;
  const title = `${job.title} – ${config.companyName}`;
  const summary = `${formatSalary(job)} · ${locationLabel(job)} · ${EMPLOYMENT_TYPE_LABEL[job.employmentType]} · Hạn nộp ${formatDate(job.deadline)}`;
  const description = listed ? summary : `Vị trí này đã ngừng nhận hồ sơ. ${summary}`;

  c.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  return c.html(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
${listed ? '' : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(config.siteUrl)}/og-image.png">
${listed ? `<script type="application/ld+json">${jobPostingJsonLd(job)}</script>` : ''}
</head>
<body>
<h1>${escapeHtml(job.title)}</h1>
<p>${escapeHtml(description)}</p>
${job.responsibilities.length ? `<h2>Bạn sẽ làm gì</h2><ul>${job.responsibilities.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
${job.requirements.length ? `<h2>Chúng tôi cần ở bạn</h2><ul>${job.requirements.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
${job.benefits.length ? `<h2>Bạn nhận được</h2><ul>${job.benefits.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
<p><a href="${escapeHtml(url)}">Xem và ứng tuyển</a></p>
</body>
</html>`);
});

shareRoutes.get('/sitemap.xml', async (c) => {
  const rows = await getDb().select().from(jobs).where(eq(jobs.state, 'published'));
  const urls = rows
    .map((row) => toJobDetail(row))
    .filter((job) => isListed(job.status))
    .map((job) => `<url><loc>${escapeHtml(`${config.siteUrl}/jobs/${job.slug}`)}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${escapeHtml(config.siteUrl)}/</loc></url>
<url><loc>${escapeHtml(config.siteUrl)}/about</loc></url>
${urls.join('\n')}
</urlset>`;
  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=600');
  return c.body(xml);
});

shareRoutes.get('/robots.txt', (c) =>
  c.text(`User-agent: *\nDisallow: /hr\nDisallow: /api\nSitemap: ${config.siteUrl}/sitemap.xml\n`),
);
