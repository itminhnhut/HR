import type { Location } from 'react-router';
import { GA_ID, isUntrackedPath } from './analytics-config';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (command: string) => void;
    /** Google's own switch, set up by index.html: true = gtag sends nothing (off the live site, HR pages). */
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

/** The part of a router analytics needs (the app's browser router, a memory router in tests). */
interface RouterLike {
  state: { location: Location };
  subscribe: (listener: (state: { location: Location }) => void) => () => void;
}

/** Long enough for the new page to set its title (usePageMeta runs after it is drawn). */
const TITLE_DELAY_MS = 300;

/** A previous page that is an HR or account address becomes the bare site, so it never reaches Google. */
export function safeReferrer(referrer: string, origin: string): string {
  if (!referrer.startsWith(origin)) return referrer;
  const path = referrer.slice(origin.length) || '/';
  return isUntrackedPath(path) ? `${origin}/` : referrer;
}

/**
 * Counts page views and stops screen recording from one place, the router, so no page can forget it:
 * - an HR or account address stops Clarity as soon as the address changes, before React draws that page;
 * - each public page sends one page_view (index.html turns Google's automatic one off), with the previous
 *   public page as referrer, never an HR address.
 * Returns the unsubscribe function.
 */
export function startAnalytics(router: RouterLike, origin: string, referrer: string): () => void {
  let previous = safeReferrer(referrer, origin);
  let shownKey = '';
  const show = (location: Location) => {
    if (location.key === shownKey) return;
    shownKey = location.key;
    if (isUntrackedPath(location.pathname)) {
      window.clarity?.('stop');
      return;
    }
    const url = `${origin}${location.pathname}${location.search}`;
    const referrerNow = previous;
    previous = url;
    setTimeout(() => {
      // Off the live site (and on HR pages) index.html keeps Google's switch on: send nothing.
      if (window[`ga-disable-${GA_ID}`] !== false) return;
      window.gtag?.('event', 'page_view', { page_location: url, page_referrer: referrerNow });
    }, TITLE_DELAY_MS);
  };
  show(router.state.location);
  return router.subscribe((state) => show(state.location));
}
