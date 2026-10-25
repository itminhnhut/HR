import { httpApi } from './http';
import { demoHrPassword, mockApi } from './mock';
import { DEMO_HR } from './mock-seed';
import type { Api } from './types';

/**
 * Demo data in the browser whenever no BE is configured. Going live means
 * setting VITE_API_URL; without it candidates' applications stay in their
 * own browser and never reach HR.
 */
const env = import.meta.env;
export const isDemo = !env.VITE_API_URL;
export const api: Api = isDemo ? mockApi : httpApi;

/** Demo mode only: the account to try on the HR sign-in page, or null (live site, or demo account deleted). */
export function demoHrSignIn(): { email: string; password: string } | null {
  const password = isDemo ? demoHrPassword() : '';
  return password ? { email: DEMO_HR.email, password } : null;
}

export * from './types';
