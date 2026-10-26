import { NEWS_IMAGE_MAX_BYTES, NEWS_TAG_MAX } from '@careers/shared';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { HttpError } from '../lib/http-error.js';
import { indexNowInBackground } from '../lib/indexnow.js';
import { enforceLimits } from '../lib/rate-limit.js';
import { readJson, readMultipart } from '../lib/request.js';
import {
  createNewsCategory,
  deleteNewsCategory,
  listNewsCategories,
  renameNewsCategory,
} from '../services/news-categories.js';
import { uploadNewsImage } from '../services/news-images.js';
import {
  createNewsPost,
  deleteNewsPost,
  getHrNewsPost,
  hideNewsPost,
  listHrNews,
  publishNewsPost,
  saveNewsPost,
  type NewsChange,
  type NewsSaveContext,
} from '../services/news-posts.js';
import { suggestTags } from '../services/news-tags.js';

/** "Tin tức" in the HR admin. Mounted at /api/hr/news behind requireHr (and the CSRF header check). */
export const hrNewsRoutes = new Hono<Env>();

const HOUR = 60 * 60_000;
/** Files, not pictures: each picture goes up with up to 3 smaller WebP copies (srcset), so about 60 pictures. */
export const UPLOADS_PER_HOUR = 240;
/** Room for the multipart envelope around the largest allowed image. */
const UPLOAD_BODY_MAX = NEWS_IMAGE_MAX_BYTES + 64 * 1024;

const saveContext = (c: Context<Env>): NewsSaveContext => {
  const { db, imageStore, now } = c.get('deps');
  return { db, imageStore, now: now(), me: hrOf(c) };
};

/** Answers with the post and tells search engines about the public pages that changed. */
const answer = (c: Context<Env>, change: NewsChange) => {
  indexNowInBackground(c, change.publicPaths);
  return c.json(change.post);
};

hrNewsRoutes.get('/', async (c) => c.json(await listHrNews(c.get('deps').db)));

hrNewsRoutes.get('/categories', async (c) => c.json(await listNewsCategories(c.get('deps').db, 'all')));
hrNewsRoutes.post('/categories', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await createNewsCategory(db, await readJson(c), now()));
});
hrNewsRoutes.patch('/categories/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await renameNewsCategory(db, c.req.param('id'), await readJson(c), now()));
});
hrNewsRoutes.delete('/categories/:id', async (c) =>
  c.json(await deleteNewsCategory(c.get('deps').db, c.req.param('id'))),
);

/** Hashtag autocomplete: `?q=` matches without accents; up to 20, most used first. */
hrNewsRoutes.get('/tags', async (c) => {
  const q = z
    .string()
    .max(NEWS_TAG_MAX)
    .catch('')
    .parse(c.req.query('q') ?? '');
  return c.json(await suggestTags(c.get('deps').db, q));
});

hrNewsRoutes.post('/images', async (c) => {
  const { db, imageStore, now } = c.get('deps');
  const me = hrOf(c);
  await enforceLimits(
    db,
    [{ key: `news-image:hr:${me.id}`, max: UPLOADS_PER_HOUR, windowMs: HOUR }],
    now(),
    'Bạn tải nhiều ảnh quá. Thử lại sau ít phút.',
  );
  if (Number(c.req.header('content-length') ?? 0) > UPLOAD_BODY_MAX) {
    throw new HttpError(413, 'Ảnh quá lớn. Giảm kích thước ảnh rồi thử lại.');
  }
  const { file } = await readMultipart(c, 'file');
  return c.json(await uploadNewsImage(imageStore, file));
});

hrNewsRoutes.post('/', async (c) => answer(c, await createNewsPost(saveContext(c), await readJson(c))));
hrNewsRoutes.get('/:id', async (c) => c.json(await getHrNewsPost(c.get('deps').db, c.req.param('id'))));
hrNewsRoutes.put('/:id', async (c) =>
  answer(c, await saveNewsPost(saveContext(c), c.req.param('id'), await readJson(c))),
);
hrNewsRoutes.post('/:id/publish', async (c) => answer(c, await publishNewsPost(saveContext(c), c.req.param('id'))));
/** "Ẩn bài" (published → hidden). /unpublish is the older name of the same action. */
hrNewsRoutes.post('/:id/:action{hide|unpublish}', async (c) =>
  answer(c, await hideNewsPost(saveContext(c), c.req.param('id'))),
);
hrNewsRoutes.delete('/:id', async (c) => {
  const { publicPaths } = await deleteNewsPost(c.get('deps').db, c.req.param('id'));
  indexNowInBackground(c, publicPaths);
  return c.json({ ok: true });
});
