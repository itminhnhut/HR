import { LIVE_SITE_URL } from './env-value';

/** Google Analytics 4 property of the careers site (public, it is in every page). */
export const GA_ID = 'G-6V6FZ57EST';

/** Microsoft Clarity project (session recordings and heatmaps). */
export const CLARITY_ID = 'z3be4ov8ok';

/**
 * Pages never sent to Analytics: HR screens put candidate names and phone numbers in the address
 * (/hr/ho-so?q=0912…), and the candidate account is personal. No React here: vite.config.ts uses it too.
 */
export const UNTRACKED_PATHS = /^\/(hr|ho-so-cua-toi)(\/|$)/;

/** Only the live site counts: local runs and Vercel preview addresses would fill Analytics with test visits. */
export const TRACKED_ORIGIN = LIVE_SITE_URL;

export const isUntrackedPath = (path: string) => UNTRACKED_PATHS.test(path);
