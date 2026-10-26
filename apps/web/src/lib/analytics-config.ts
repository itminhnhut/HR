import { envValue, LIVE_SITE_URL } from './env-value';

/** Google Analytics 4 property of the careers site (public, it is in every page). */
export const GA_ID = 'G-6V6FZ57EST';

/** Microsoft Clarity project (session recordings and heatmaps). */
export const CLARITY_ID = 'z3be4ov8ok';

/**
 * Pages never sent to Analytics nor recorded: HR screens put candidate names and phone numbers in the address
 * (/hr/ho-so?q=0912…), and the candidate account is personal. Any letter case: the router opens /HR/… too.
 * No React here: vite.config.ts uses it too.
 */
export const UNTRACKED_PATHS = /^\/(hr|ho-so-cua-toi)(\/|$)/i;

export const isUntrackedPath = (path: string) => UNTRACKED_PATHS.test(path);

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    // Not an address (a typo in VITE_SITE_URL): it simply does not count as the live site.
    return '';
  }
};

/**
 * Where visits count: the live site with and without "www", and the address in VITE_SITE_URL (a new domain).
 * Local runs and Vercel preview addresses would fill Analytics with test visits.
 */
export function trackedOrigins(env: Record<string, string | undefined>): string[] {
  const live = originOf(LIVE_SITE_URL);
  const origins = [live, live.replace('://www.', '://'), originOf(envValue(env.VITE_SITE_URL))];
  return [...new Set(origins.filter(Boolean))];
}
