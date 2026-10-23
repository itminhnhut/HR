import { httpApi } from './http';
import { mockApi } from './mock';
import type { Api } from './types';

/**
 * Demo data in the browser only when asked for: local dev or the preview
 * build without a BE, or VITE_DEMO=1. A production build without
 * VITE_API_URL talks to the same origin instead of silently faking data.
 */
const env = import.meta.env;
export const isDemo = !env.VITE_API_URL && (env.DEV || env.MODE === 'preview' || env.VITE_DEMO === '1');
export const api: Api = isDemo ? mockApi : httpApi;

export * from './types';
