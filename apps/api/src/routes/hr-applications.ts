import { Hono } from 'hono';
import type { Env } from '../app.js';
import { notFound } from '../lib/http-error.js';
import { readJson } from '../lib/request.js';
import {
  cvOf,
  deleteSubscriber,
  listApplications,
  listSubscribers,
  openApplication,
  updateApplication,
} from '../services/hr-applications.js';

/** Mounted at /api/hr behind requireHr. */
export const hrApplicationRoutes = new Hono<Env>();

hrApplicationRoutes.get('/applications', async (c) => {
  return c.json(await listApplications(c.get('deps').db, c.req.query('jobId') || undefined));
});

hrApplicationRoutes.get('/applications/:id', async (c) => {
  return c.json(await openApplication(c.get('deps').db, c.req.param('id')));
});

hrApplicationRoutes.patch('/applications/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateApplication(db, c.req.param('id'), await readJson(c), now()));
});

/** Streams the CV from the PRIVATE blob store; the URL only works with an HR session. */
hrApplicationRoutes.get('/applications/:id/cv', async (c) => {
  const { db, cvStore } = c.get('deps');
  const { pathname, fullName } = await cvOf(db, c.req.param('id'));
  const stream = await cvStore.get(pathname);
  if (!stream) throw notFound('Không đọc được file CV.');
  return new Response(stream, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`CV-${fullName}.pdf`)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
});

hrApplicationRoutes.get('/subscribers', async (c) => {
  return c.json(await listSubscribers(c.get('deps').db));
});

hrApplicationRoutes.delete('/subscribers/:id', async (c) => {
  return c.json(await deleteSubscriber(c.get('deps').db, c.req.param('id')));
});
