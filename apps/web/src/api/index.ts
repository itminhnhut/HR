import { httpApi } from './http';
import { mockApi } from './mock';
import type { Api } from './types';

/**
 * Demo data in the browser whenever no BE is configured. Going live means
 * setting VITE_API_URL; without it candidates' applications stay in their
 * own browser and never reach HR.
 */
const env = import.meta.env;
export const isDemo = !env.VITE_API_URL;
export const api: Api = isDemo ? mockApi : httpApi;

export * from './types';
