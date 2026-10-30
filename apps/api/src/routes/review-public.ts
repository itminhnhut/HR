import { Hono } from 'hono';
import type { Env } from '../app.js';
import { notFound } from '../lib/http-error.js';
import { readJson } from '../lib/request.js';
import { decideInReview, finishReview, openReviewPage, reviewCvOf } from '../services/review-public.js';

/**
 * The reviewer's link (spec-boss-review.md): no sign-in, the token is the key. Mounted at /api/review.
 * Answers are personal data: never cached, never indexed.
 */
export const reviewPublicRoutes = new Hono<Env>();

reviewPublicRoutes.use(async (c, next) => {
  await next();
  c.header('cache-control', 'private, no-store');
  c.header('x-robots-tag', 'noindex, nofollow');
});

reviewPublicRoutes.get('/:token', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await openReviewPage(db, c.req.param('token'), now()));
});

reviewPublicRoutes.put('/:token/items/:itemId', async (c) => {
  const { db, now } = c.get('deps');
  const { token, itemId } = c.req.param();
  return c.json(await decideInReview(db, token, itemId, await readJson(c), now()));
});

reviewPublicRoutes.post('/:token/done', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await finishReview(db, c.req.param('token'), now()));
});

/** Streams the CV from the PRIVATE blob store, only for an application of this batch. */
reviewPublicRoutes.get('/:token/items/:itemId/cv', async (c) => {
  const { db, cvStore, now } = c.get('deps');
  const { token, itemId } = c.req.param();
  const { pathname, fullName } = await reviewCvOf(db, token, itemId, now());
  const stream = await cvStore.get(pathname);
  if (!stream) throw notFound('Không đọc được file CV.');
  return new Response(stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`CV-${fullName}.pdf`)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
});
