import { useEffect } from 'react';
import { GA_ID, TRACKED_ORIGIN } from './analytics-config';

export { GA_ID, isUntrackedPath } from './analytics-config';

/** Google's own switch: while it is true, gtag sends nothing for this property. */
const DISABLE_KEY = `ga-disable-${GA_ID}`;

function setAnalyticsOff(off: boolean) {
  (window as unknown as Record<string, unknown>)[DISABLE_KEY] = off;
}

/**
 * Switches Analytics off (and stops Clarity recording) while an HR or candidate account screen is open (index.html already does it when
 * the site is opened on one of them), so their addresses never reach Google.
 */
export function useNoAnalytics() {
  useEffect(() => {
    setAnalyticsOff(true);
    // Clarity records the screen: stop for the rest of this visit (it starts again on the next page load
    // of a public page, see index.html).
    (window as unknown as { clarity?: (command: string) => void }).clarity?.('stop');
    // Back to the site default: on only on the live site.
    return () => setAnalyticsOff(window.location.origin !== TRACKED_ORIGIN);
  }, []);
}
