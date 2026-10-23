import { Hono } from 'hono';
import type { Env } from '../app.js';
import { readJson, readMultipart } from '../lib/request.js';
import { apply, subscribe } from '../services/apply.js';
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

publicRoutes.post('/applications', async (c) => {
  return c.json(await apply(c.get('deps'), await readMultipart(c, 'cv')));
});

publicRoutes.post('/subscribers', async (c) => {
  return c.json(await subscribe(c.get('deps'), await readJson(c)));
});
