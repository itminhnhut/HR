import { DEFAULT_COMPANY, envValue } from './env-value';

/** Where the site lives when VITE_SITE_URL is not set: share previews need absolute addresses. */
export const LIVE_SITE_URL = 'https://www.lee-hr.com';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);

/**
 * Fills %SITE_URL% and %COMPANY% in index.html at build time, so link previews (Zalo, Facebook) and Google
 * see the real name and absolute image address without running the app.
 */
export function fillSiteHtml(html: string, env: Record<string, string | undefined>): string {
  const url = (envValue(env.VITE_SITE_URL) || LIVE_SITE_URL).replace(/\/$/, '');
  const company = envValue(env.VITE_COMPANY_NAME) || DEFAULT_COMPANY;
  return html.replaceAll('%SITE_URL%', escapeHtml(url)).replaceAll('%COMPANY%', escapeHtml(company));
}
