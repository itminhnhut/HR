import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import {
  addToReview,
  createReview,
  extendReview,
  getReview,
  listReviews,
  removeFromReview,
  replyInReview,
  revokeReview,
} from '../services/reviews.js';

/** "Sếp duyệt ứng viên", HR's side (spec-boss-review.md). Mounted at /api/hr/reviews behind requireHr. */
export const hrReviewRoutes = new Hono<Env>();

hrReviewRoutes.get('/', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listReviews(db, now()));
});

hrReviewRoutes.post('/', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await createReview(db, await readJson(c), hrOf(c), now()), 201);
});

hrReviewRoutes.get('/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getReview(db, c.req.param('id'), now()));
});

hrReviewRoutes.post('/:id/items', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addToReview(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});

hrReviewRoutes.delete('/:id/items/:itemId', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeFromReview(db, c.req.param('id'), c.req.param('itemId'), hrOf(c), now()));
});

hrReviewRoutes.post('/:id/items/:itemId/reply', async (c) => {
  const { db, now } = c.get('deps');
  const { id, itemId } = c.req.param();
  return c.json(await replyInReview(db, id, itemId, await readJson(c), hrOf(c), now()));
});

hrReviewRoutes.post('/:id/extend', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await extendReview(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});

hrReviewRoutes.post('/:id/revoke', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await revokeReview(db, c.req.param('id'), hrOf(c), now()));
});
