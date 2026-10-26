import { CLARITY_ID, GA_ID, trackedOrigins, UNTRACKED_PATHS } from './analytics-config';
import { DEFAULT_COMPANY, envValue, LIVE_SITE_URL } from './env-value';

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);

/**
 * Fills %SITE_URL%, %COMPANY% and the Analytics settings in index.html at build time, so link previews (Zalo, Facebook) and Google
 * see the real name and absolute image address without running the app.
 */
export function fillSiteHtml(html: string, env: Record<string, string | undefined>): string {
  const url = (envValue(env.VITE_SITE_URL) || LIVE_SITE_URL).replace(/\/$/, '');
  const company = envValue(env.VITE_COMPANY_NAME) || DEFAULT_COMPANY;
  return html
    .replaceAll('%SITE_URL%', escapeHtml(url))
    .replaceAll('%COMPANY%', escapeHtml(company))
    .replaceAll('%GA_ID%', GA_ID)
    .replaceAll('%CLARITY_ID%', CLARITY_ID)
    .replaceAll('%TRACKED_ORIGINS%', JSON.stringify(trackedOrigins(env)))
    .replaceAll('%UNTRACKED_PATHS%', String(UNTRACKED_PATHS));
}
