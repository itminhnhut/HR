import { vi, type MockInstance } from 'vitest';
import { api, isDemo, type Api } from '../api';
import { mockApi } from '../api/mock';

/** The method `key` of the API as a plain function type, so a spy on it knows its arguments and result. */
type ApiMethod<K extends keyof Api> = Api[K] extends (...args: infer A) => infer R ? (...args: A) => R : never;

/**
 * Spies on the API the screens really call. Without VITE_API_URL `api` is a proxy that looks each call up on the demo
 * API when it runs, so a spy on the proxy itself would never be called.
 */
export function spyOnApi<K extends keyof Api>(key: K): MockInstance<ApiMethod<K>> {
  const target: Api = isDemo ? mockApi : api;
  return vi.spyOn(target, key as never) as unknown as MockInstance<ApiMethod<K>>;
}
