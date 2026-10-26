import { absoluteUrl } from '@careers/shared';

const srcsetOf = (siteUrl: string, value: string) =>
  value
    .split(',')
    .map((entry) => {
      const [url = '', ...descriptor] = entry.trim().split(/\s+/);
      return [absoluteUrl(siteUrl, url), ...descriptor].join(' ');
    })
    .join(', ');

/**
 * Article HTML for bots: images saved by the local development store have site paths ("/api/news-images/…");
 * crawlers and previews get full addresses. Only <img> src and srcset change; links stay as they are.
 */
export function absoluteImageHtml(siteUrl: string, html: string): string {
  return html.replace(/<img\b[^>]*>/g, (tag) =>
    tag.replace(/\s(src|srcset)="([^"]*)"/g, (_match, attr: string, value: string) =>
      attr === 'src' ? ` src="${absoluteUrl(siteUrl, value)}"` : ` srcset="${srcsetOf(siteUrl, value)}"`,
    ),
  );
}
