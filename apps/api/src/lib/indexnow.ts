import type { Context } from 'hono';
import type { Env } from '../app.js';

/**
 * IndexNow: tells Bing, Cốc Cốc, Yandex… right away that a page changed, instead of waiting for their bots
 * to come back (Google does not take part; it reads the sitemap). The key proves the site is ours: the same
 * key is served as /<key>.txt (routes/share.ts). A failed ping only logs; saving never depends on it.
 */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;
const TIMEOUT_MS = 10_000;

/** The part of `fetch` the app uses; tests pass a fake through Deps. */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export const isValidIndexNowKey = (key: unknown): key is string => typeof key === 'string' && KEY_PATTERN.test(key);

export interface IndexNowTarget {
  siteUrl: string;
  key: string;
  fetch: FetchFn;
}

/** Posts the changed pages (paths on the site). Throws when IndexNow does not accept them. */
export async function notifyIndexNow(target: IndexNowTarget, paths: readonly string[]): Promise<void> {
  const urls = [...new Set(paths)].map((path) => `${target.siteUrl}${encodeURI(path)}`);
  if (urls.length === 0) return;
  const res = await target.fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(target.siteUrl).host,
      key: target.key,
      keyLocation: `${target.siteUrl}/${target.key}.txt`,
      urlList: urls,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // 200/202: received. 403: key file not found yet, 422: URLs not on this host, 429: too many.
  if (!res.ok) throw new Error(`IndexNow answered HTTP ${res.status}`);
}

interface WaitUntil {
  waitUntil(promise: Promise<unknown>): void;
}

/** Where Vercel's runtime exposes waitUntil for the current request (what @vercel/functions reads). */
const VERCEL_REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

function vercelWaitUntil(): WaitUntil | null {
  const holder = (globalThis as Record<symbol, { get?: () => Partial<WaitUntil> | undefined } | undefined>)[
    VERCEL_REQUEST_CONTEXT
  ];
  const ctx = holder?.get?.();
  return typeof ctx?.waitUntil === 'function' ? { waitUntil: ctx.waitUntil.bind(ctx) } : null;
}

/**
 * Pings IndexNow after the response, without delaying or failing it. On Vercel, waitUntil keeps the function
 * alive until it is done; elsewhere (local, tests) it simply runs on.
 */
export function indexNowInBackground(c: Context<Env>, paths: readonly string[]): void {
  const { config, fetch } = c.get('deps');
  if (!config.indexNowKey || paths.length === 0) return;
  const task = notifyIndexNow({ siteUrl: config.siteUrl, key: config.indexNowKey, fetch }, paths).catch(
    (error: unknown) => {
      console.warn('IndexNow ping failed', paths, error instanceof Error ? error.message : error);
    },
  );
  vercelWaitUntil()?.waitUntil(task);
}
