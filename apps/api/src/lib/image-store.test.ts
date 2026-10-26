import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { localImageStore, LOCAL_IMAGE_ROUTE, vercelBlobImageStore } from './image-store.js';

const UUID = '0b6f3c1e-2a4d-4f5b-9c8d-7e6f5a4b3c2d';

describe('vercelBlobImageStore.isOwnUrl', () => {
  const store = vercelBlobImageStore('vercel_blob_rw_AbC123xyz_secretpart');

  it('should accept an image this store uploaded under news/', () => {
    expect(store.isOwnUrl(`https://abc123xyz.public.blob.vercel-storage.com/news/${UUID}.jpg`)).toBe(true);
    expect(store.isOwnUrl(`https://abc123xyz.public.blob.vercel-storage.com/news/${UUID}.webp`)).toBe(true);
  });

  it.each([
    ['another store', `https://other1.public.blob.vercel-storage.com/news/${UUID}.jpg`],
    ['the private store', `https://abc123xyz.private.blob.vercel-storage.com/news/${UUID}.jpg`],
    ['plain http', `http://abc123xyz.public.blob.vercel-storage.com/news/${UUID}.jpg`],
    ['a look-alike host', `https://abc123xyz.public.blob.vercel-storage.com.evil.test/news/${UUID}.jpg`],
    ['a CV path', `https://abc123xyz.public.blob.vercel-storage.com/cv/${UUID}.pdf`],
    ['a nested path', `https://abc123xyz.public.blob.vercel-storage.com/news/../cv/${UUID}.jpg`],
    ['a query string', `https://abc123xyz.public.blob.vercel-storage.com/news/${UUID}.jpg?x=1`],
    ['credentials', `https://u:p@abc123xyz.public.blob.vercel-storage.com/news/${UUID}.jpg`],
    ['an SVG', `https://abc123xyz.public.blob.vercel-storage.com/news/${UUID}.svg`],
    ['not a URL', 'javascript:alert(1)'],
  ])('should refuse %s', (_label, url) => {
    expect(store.isOwnUrl(url)).toBe(false);
  });

  it('should accept any public Blob store when the token does not name one', () => {
    const anyStore = vercelBlobImageStore(undefined);

    expect(anyStore.isOwnUrl(`https://zz9.public.blob.vercel-storage.com/news/${UUID}.png`)).toBe(true);
    expect(anyStore.isOwnUrl(`https://zz9.private.blob.vercel-storage.com/news/${UUID}.png`)).toBe(false);
  });
});

describe('localImageStore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'news-images-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const store = localImageStore(dir);

  it('should keep the file on disk and give back a site path that works from any device', async () => {
    // Act
    const { url } = await store.put(new Blob([new Uint8Array([1, 2, 3])]), 'png');

    // Assert
    expect(url).toMatch(new RegExp(`^${LOCAL_IMAGE_ROUTE}/[0-9a-f-]{36}\\.png$`));
    expect(store.isOwnUrl(url)).toBe(true);
    const name = url.split('/').pop() ?? '';
    expect(Array.from((await store.read?.(name)) ?? [])).toEqual([1, 2, 3]);
  });

  it.each([
    ['an address on one machine only', `http://localhost:3344${LOCAL_IMAGE_ROUTE}/${UUID}.png`],
    ['another host without a scheme', `//evil.test${LOCAL_IMAGE_ROUTE}/${UUID}.png`],
    ['a name that leaves the folder', `${LOCAL_IMAGE_ROUTE}/../x.png`],
    ['a query string', `${LOCAL_IMAGE_ROUTE}/${UUID}.png?x=1`],
    ['an SVG', `${LOCAL_IMAGE_ROUTE}/${UUID}.svg`],
  ])('should refuse %s', (_label, url) => {
    expect(store.isOwnUrl(url)).toBe(false);
  });

  it('should not read names that leave the folder', async () => {
    expect(await store.read?.('../hr-login.txt')).toBeNull();
  });
});
