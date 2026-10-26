import { DEMO_HR } from './demo-accounts';
import { httpApi } from './http';
import type { Api } from './types';

/**
 * Demo data in the browser whenever no BE is configured. Going live means
 * setting VITE_API_URL; without it candidates' applications stay in their
 * own browser and never reach HR.
 */
export const isDemo = !import.meta.env.VITE_API_URL;

type MockModule = typeof import('./mock');
let mockModule: Promise<MockModule> | null = null;

/** The demo API and its data (zod, sample jobs and posts) load on first use, never on the live site. */
const loadMock = (): Promise<MockModule> => (mockModule ??= import('./mock'));

/**
 * Same shape as the real API, so callers stay the same: every call waits for the demo module, then runs.
 * hrCvUrl is the one call that answers at once; the demo stores no files, so it has no link.
 */
function lazyMockApi(): Api {
  const handler: ProxyHandler<Api> = {
    get(_target, key) {
      if (key === 'hrCvUrl') return () => null;
      return async (...args: unknown[]) => {
        const { mockApi } = await loadMock();
        const method: unknown = Reflect.get(mockApi, key);
        if (typeof method !== 'function') throw new Error(`Demo API has no ${String(key)}`);
        return method.apply(mockApi, args);
      };
    },
  };
  return new Proxy(httpApi, handler);
}

export const api: Api = isDemo ? lazyMockApi() : httpApi;

/** Demo mode only: the account to try on the HR sign-in page, or null (live site, or demo account deleted). */
export async function demoHrSignIn(): Promise<{ email: string; password: string } | null> {
  if (!isDemo) return null;
  const password = (await loadMock()).demoHrPassword();
  return password ? { email: DEMO_HR.email, password } : null;
}

export * from './types';
