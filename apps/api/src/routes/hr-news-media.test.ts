import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NEWS_IMAGE_MAX_BYTES, type NewsCategoryDto } from '@careers/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { localImageStore } from '../lib/image-store.js';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, type TestContext } from '../test/harness.js';
import { UPLOADS_PER_HOUR } from './hr-news.js';
import { insertCategory, insertPost } from '../test/news-fixtures.js';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie });

describe('HR news categories', () => {
  it('should add a category with an address made from its name', async () => {
    const res = await hr('POST', '/news/categories', { name: '  Cẩm nang ứng viên ' });

    expect(res.status).toBe(200);
    expect(await json<NewsCategoryDto>(res)).toMatchObject({
      name: 'Cẩm nang ứng viên',
      slug: 'cam-nang-ung-vien',
      postCount: 0,
    });
  });

  it('should number the address when two categories share a name', async () => {
    await hr('POST', '/news/categories', { name: 'Đời sống' });

    const second = await json<NewsCategoryDto>(await hr('POST', '/news/categories', { name: 'Đời sống' }));

    expect(second.slug).toBe('doi-song-2');
  });

  it('should refuse a category without a name', async () => {
    const res = await hr('POST', '/news/categories', { name: '   ' });

    expect(res.status).toBe(422);
    expect((await json<{ fieldErrors: Record<string, string> }>(res)).fieldErrors).toHaveProperty('name');
  });

  it('should rename a category but keep its address', async () => {
    const category = await insertCategory(t, 'Đời sống');

    const renamed = await json<NewsCategoryDto>(
      await hr('PATCH', `/news/categories/${category.id}`, { name: 'Đời sống công ty' }),
    );

    expect(renamed).toMatchObject({ name: 'Đời sống công ty', slug: 'doi-song' });
  });

  it('should delete an empty category', async () => {
    const category = await insertCategory(t);

    const res = await hr('DELETE', `/news/categories/${category.id}`);

    expect(res.status).toBe(200);
    expect((await hr('DELETE', `/news/categories/${category.id}`)).status).toBe(404);
  });

  it('should refuse to delete a category that still has posts, even drafts', async () => {
    const category = await insertCategory(t);
    await insertPost(t, category.id, { status: 'draft', publishedAt: null });

    const res = await hr('DELETE', `/news/categories/${category.id}`);

    expect(res.status).toBe(409);
    expect((await json<{ error: string }>(res)).error).toMatch(/bài/);
  });

  it('should keep categories behind the HR sign-in', async () => {
    const res = await t.send('POST', '/api/hr/news/categories', { name: 'X' });

    expect(res.status).toBe(401);
  });
});

const fixture = (name: string) => readFileSync(new URL(`../test/images/${name}`, import.meta.url));

function upload(file: File | null, headers: Record<string, string> = { cookie }) {
  const form = new FormData();
  if (file) form.set('file', file);
  return t.request('/api/hr/news/images', {
    method: 'POST',
    headers: { 'x-requested-with': 'careers-web', ...headers },
    body: form,
  });
}

interface Uploaded {
  url: string;
  width: number;
  height: number;
}

describe('HR news image upload', () => {
  it('should store a JPEG publicly and answer its real size', async () => {
    const res = await upload(new File([fixture('baseline-7x5.jpg')], 'anh.jpg', { type: 'image/jpeg' }));
    const body = await json<Uploaded>(res);

    expect(res.status).toBe(200);
    expect(body).toEqual({ url: expect.stringMatching(/\.jpg$/), width: 7, height: 5 });
    expect(t.imageStore.isOwnUrl(body.url)).toBe(true);
    expect(t.imageStore.files.has(body.url)).toBe(true);
  });

  it('should go by the bytes, not the name: a PNG called .jpg is stored as PNG', async () => {
    const res = await upload(new File([fixture('plain-7x5.png')], 'anh.jpg', { type: 'image/jpeg' }));

    expect((await json<Uploaded>(res)).url).toMatch(/\.png$/);
  });

  it('should refuse a file that only pretends to be an image', async () => {
    const fake = new File(['<svg onload="alert(1)"></svg>'], 'anh.png', { type: 'image/png' });

    const res = await upload(fake);

    expect(res.status).toBe(422);
    expect(t.imageStore.files.size).toBe(0);
  });

  it('should refuse an image over the size limit', async () => {
    const big = new File([fixture('baseline-7x5.jpg'), new Uint8Array(NEWS_IMAGE_MAX_BYTES)], 'to.jpg', {
      type: 'image/jpeg',
    });

    const res = await upload(big);

    expect(res.status).toBe(422);
    expect(t.imageStore.files.size).toBe(0);
  });

  it('should ask for a file when none is sent', async () => {
    const res = await upload(null);

    expect(res.status).toBe(422);
  });

  it('should keep uploads behind the HR sign-in', async () => {
    const res = await upload(new File([fixture('baseline-7x5.jpg')], 'a.jpg'), {});

    expect(res.status).toBe(401);
  });

  it('should limit how many images one HR uploads in an hour', async () => {
    const file = () => new File([fixture('lossless-7x5.webp')], 'a.webp');
    for (let i = 0; i < UPLOADS_PER_HOUR; i++) expect((await upload(file())).status).toBe(200);

    const res = await upload(file());

    expect(res.status).toBe(429);
  });
});

describe('local news images', () => {
  const dir = mkdtempSync(join(tmpdir(), 'news-images-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('should serve files of the local image store during development', async () => {
    t.deps.imageStore = localImageStore(dir);
    const { url } = await t.deps.imageStore.put(new Blob([fixture('plain-7x5.png')]), 'png');

    const res = await t.request(url);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('should not serve local image files in production', async () => {
    t.deps.imageStore = localImageStore(dir);
    const { url } = await t.deps.imageStore.put(new Blob([fixture('plain-7x5.png')]), 'png');
    t.deps.config.isProduction = true;

    const res = await t.request(url);

    expect(res.status).toBe(404);
  });
});
