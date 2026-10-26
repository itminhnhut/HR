import { absoluteUrl, escapeHtml, pageTitle, SHARE_IMAGE } from '@careers/shared';

/**
 * HTML pages for crawlers and link previews (routes/share*.ts). One head for every page, so titles, canonical,
 * Open Graph and Twitter tags follow the same rules as the SPA (usePageMeta in apps/web/src/lib/hooks.ts).
 */
export interface Site {
  url: string;
  companyName: string;
}

export interface PageImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface Head {
  /** Without the brand: pageTitle adds " · <company>". */
  title: string;
  description: string;
  /** Path on the site, query included. */
  path: string;
  type: 'website' | 'article';
  /** Default: the site's share picture (/images/og-share.jpg). */
  image?: PageImage | null;
  extra?: string[];
  jsonLd: Record<string, unknown>[];
  /** Default: indexable, with large image previews. */
  robots?: string;
}

export const INDEXABLE = 'index, follow, max-image-preview:large';

export const meta = (attr: 'name' | 'property', key: string, value: string | number) =>
  `<meta ${attr}="${key}" content="${escapeHtml(String(value))}">`;
export const link = (href: string, text: string) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`;
/** "</script>" inside JSON would end the tag early. */
export const jsonLdScript = (data: Record<string, unknown>) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

export const defaultShareImage = (site: Site): PageImage => ({
  url: `${site.url}${SHARE_IMAGE.path}`,
  width: SHARE_IMAGE.width,
  height: SHARE_IMAGE.height,
  alt: `Đội ngũ ${site.companyName} tại gian hàng triển lãm`,
});

/** Share previews need a full address; the local development store saves site paths. */
function imageMeta(site: Site, image: PageImage | null | undefined): string[] {
  const picture = image ?? defaultShareImage(site);
  return [
    meta('property', 'og:image', absoluteUrl(site.url, picture.url)),
    meta('property', 'og:image:width', picture.width),
    meta('property', 'og:image:height', picture.height),
    meta('property', 'og:image:alt', picture.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
  ];
}

export function renderPage(site: Site, head: Head, body: string): string {
  const url = `${site.url}${head.path}`;
  const title = pageTitle(head.title, site.companyName);
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
${meta('name', 'description', head.description)}
<link rel="canonical" href="${escapeHtml(url)}">
<meta name="robots" content="${head.robots ?? INDEXABLE}">
${[
  meta('property', 'og:type', head.type),
  meta('property', 'og:site_name', site.companyName),
  meta('property', 'og:locale', 'vi_VN'),
  meta('property', 'og:title', title),
  meta('property', 'og:description', head.description),
  meta('property', 'og:url', url),
  ...imageMeta(site, head.image),
  ...(head.extra ?? []),
  ...head.jsonLd.map(jsonLdScript),
].join('\n')}
</head>
<body>
${body}
</body>
</html>`;
}

/** A real 404 for crawlers (they drop the address), with a way back. */
export function notFoundHtml(back: { href: string; text: string }): string {
  return (
    '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
    `<title>Không tìm thấy</title></head><body><p>Không tìm thấy trang này.</p><p>${link(back.href, back.text)}</p></body></html>`
  );
}

/** "Trang chủ › Tin tức › …" as links; the last crumb is plain text when it has no address. */
export function breadcrumbNav(crumbs: { name: string; href?: string }[]): string {
  return `<nav aria-label="Breadcrumb">${crumbs
    .map((crumb) => (crumb.href ? link(crumb.href, crumb.name) : escapeHtml(crumb.name)))
    .join(' › ')}</nav>`;
}
