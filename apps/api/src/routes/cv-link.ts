import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { applications } from '../db/schema.js';
import type { Env } from '../app.js';
import { notFound } from '../lib/http-error.js';
import { isCvLinkValid, readCvLinkToken } from '../lib/cv-link.js';
import { cvResponse } from '../lib/cv-response.js';

/** The same answer for every failure: it must not tell who has an application. */
const unusable = () => notFound('Link CV không còn dùng được. Vui lòng liên hệ HR.');

export const cvLinkRoutes = new Hono<Env>();

/** The CV in an interview invitation: needs no sign-in, because the signed address is the permission. */
cvLinkRoutes.get('/:token', async (c) => {
  const { db, config, cvStore, now } = c.get('deps');
  const token = readCvLinkToken(c.req.param('token'));
  if (!token) throw unusable();
  const row = await db.query.applications.findFirst({ where: eq(applications.id, token.id) });
  if (!row?.cvPathname || !isCvLinkValid(config.sessionSecret, token, row.cvPathname, now())) throw unusable();
  const stream = await cvStore.get(row.cvPathname);
  if (!stream) throw unusable();
  return cvResponse(stream, row.fullName);
});
