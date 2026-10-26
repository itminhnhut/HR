import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { IMAGE_CONTENT_TYPE, type ImageExt } from './image-info.js';

/**
 * Where article images live. They are PUBLIC: pages and crawlers load them straight from the store.
 * `isOwnUrl` is how article content and covers are limited to images uploaded through the editor.
 */
export interface ImageStore {
  put(file: Blob, ext: ImageExt): Promise<{ url: string }>;
  isOwnUrl(url: string): boolean;
  /** Local development only: the file behind LOCAL_IMAGE_ROUTE. */
  read?(name: string): Promise<Uint8Array<ArrayBuffer> | null>;
}

/** "<uuid>.jpg": the only names this app ever gives an image. */
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
export const isImageName = (name: string) => IMAGE_NAME.test(name);

const newName = (ext: ImageExt) => `${crypto.randomUUID()}.${ext}`;
const NEWS_PREFIX = 'news/';
const PUBLIC_BLOB_HOST = '.public.blob.vercel-storage.com';
/** Names are random and never reused, so caches may keep a file for a year. */
const ONE_YEAR_S = 365 * 24 * 60 * 60;

/** A plain address: no credentials, query or fragment that could smuggle anything along. */
function parseUrl(raw: string): URL | null {
  if (!URL.canParse(raw)) return null;
  const url = new URL(raw);
  return url.username || url.password || url.search || url.hash ? null : url;
}

/** A read-write token is "vercel_blob_rw_<storeId>_<secret>" (how @vercel/blob itself reads the store id). */
const storeIdOf = (token: string | undefined) => token?.split('_')[3]?.toLowerCase() || null;

/**
 * Vercel Blob, PUBLIC store. Access (public/private) is fixed per store, so this cannot be the CV store:
 * it needs its own store and token (NEWS_BLOB_READ_WRITE_TOKEN, see main.ts). With a token the check is
 * tied to that store's host; without one, any public Blob host passes.
 */
export function vercelBlobImageStore(token: string | undefined): ImageStore {
  const storeId = storeIdOf(token);
  return {
    async put(file, ext) {
      const blob = await put(`${NEWS_PREFIX}${newName(ext)}`, file, {
        access: 'public',
        token,
        contentType: IMAGE_CONTENT_TYPE[ext],
        cacheControlMaxAge: ONE_YEAR_S,
      });
      return { url: blob.url };
    },
    isOwnUrl(raw) {
      const url = parseUrl(raw);
      if (!url || url.protocol !== 'https:') return false;
      const hostOk = storeId
        ? url.hostname === `${storeId}${PUBLIC_BLOB_HOST}`
        : url.hostname.endsWith(PUBLIC_BLOB_HOST);
      return hostOk && url.pathname.startsWith(`/${NEWS_PREFIX}`) && isImageName(url.pathname.slice(6));
    },
  };
}

/** Served by routes/public-news.ts outside production. */
export const LOCAL_IMAGE_ROUTE = '/api/news-images';

/**
 * Local development without a Blob token: files under apps/api/.data/news-images. Addresses are site paths
 * ("/api/news-images/<uuid>.jpg"), so phones on the same wifi load them too ("localhost" is the phone itself).
 * Bot pages, share tags and the sitemap make them absolute (absoluteUrl in @careers/shared).
 */
export function localImageStore(dir: string): ImageStore {
  const base = `${LOCAL_IMAGE_ROUTE}/`;
  return {
    async put(file, ext) {
      const name = newName(ext);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), new Uint8Array(await file.arrayBuffer()));
      return { url: `${base}${name}` };
    },
    isOwnUrl(raw) {
      return raw.startsWith(base) && isImageName(raw.slice(base.length));
    },
    async read(name) {
      if (!isImageName(name)) return null;
      try {
        return new Uint8Array(await readFile(join(dir, name)));
      } catch (error) {
        console.warn('Local news image missing', name, error instanceof Error ? error.message : error);
        return null;
      }
    },
  };
}
