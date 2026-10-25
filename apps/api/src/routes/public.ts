import { Hono } from 'hono';
import type { Env } from '../app.js';
import { requireCaptcha } from '../lib/captcha.js';
import { clientIp, enforceLimits } from '../lib/rate-limit.js';
import { readJson, readMultipart } from '../lib/request.js';
import { apply, subscribe } from '../services/apply.js';
import { currentCandidate } from '../services/candidate-auth.js';
import { lookupByPhone } from '../services/lookup.js';
import { getJobPage, listJobs } from '../services/public-jobs.js';

export const publicRoutes = new Hono<Env>();

publicRoutes.get('/jobs', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listJobs(db, now()));
});

publicRoutes.get('/jobs/:slug', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getJobPage(db, c.req.param('slug'), now()));
});

const HOUR = 60 * 60_000;
const TOO_MANY = 'Bạn gửi nhiều lần quá. Thử lại sau ít phút.';

publicRoutes.post('/applications', async (c) => {
  const { db, now } = c.get('deps');
  // Each submission may store a 4 MB file: cap it per device so a script cannot flood HR or the storage.
  await enforceLimits(db, [{ key: `apply:ip:${clientIp(c)}`, max: 20, windowMs: HOUR }], now(), TOO_MANY);
  const account = await currentCandidate(c);
  const body = await readMultipart(c, 'cv');
  await requireCaptcha(c.get('deps').verifyCaptcha, body.fields.captchaToken, clientIp(c));
  return c.json(await apply(c.get('deps'), body, account));
});

/** Public lookup by phone (POST so the number never lands in URLs or logs). */
publicRoutes.post('/applications/lookup', async (c) => {
  const { db, now, verifyCaptcha } = c.get('deps');
  const raw = await readJson(c);
  await requireCaptcha(verifyCaptcha, (raw as { captchaToken?: unknown } | null)?.captchaToken, clientIp(c));
  return c.json(await lookupByPhone(db, raw, clientIp(c), now()));
});

publicRoutes.post('/subscribers', async (c) => {
  const { db, now } = c.get('deps');
  await enforceLimits(db, [{ key: `subscribe:ip:${clientIp(c)}`, max: 10, windowMs: HOUR }], now(), TOO_MANY);
  return c.json(await subscribe(c.get('deps'), await readJson(c)));
});
