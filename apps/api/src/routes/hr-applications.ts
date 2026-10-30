import { Hono } from 'hono';
import type { Env } from '../app.js';
import { notFound } from '../lib/http-error.js';
import { readJson, readMultipart } from '../lib/request.js';
import { isApplicationSource } from '@careers/shared';
import { addApplication, hrReplaceCv, updateContact } from '../services/hr-intake.js';
import { hrOf } from '../lib/hr-auth.js';
import {
  cvOf,
  deleteApplication,
  deleteDueApplications,
  deleteSubscriber,
  logContact,
  scoreCvOf,
  listApplications,
  listSubscribers,
  openApplication,
  updateApplication,
} from '../services/hr-applications.js';
import { scorePending } from '../services/cv-score.js';

/** Mounted at /api/hr behind requireHr. */
export const hrApplicationRoutes = new Hono<Env>();

hrApplicationRoutes.get('/applications', async (c) => {
  const source = c.req.query('source');
  return c.json(
    await listApplications(
      c.get('deps').db,
      c.req.query('jobId') || undefined,
      c.req.query('q')?.slice(0, 100),
      isApplicationSource(source) ? source : undefined,
    ),
  );
});

/** "Thêm hồ sơ" (multipart: fields + optional "cv" file). 409 { code: "duplicate", existing } for the same phone and job. */
hrApplicationRoutes.post('/applications', async (c) => {
  const body = await readMultipart(c, 'cv');
  return c.json(await addApplication(c.get('deps'), body, hrOf(c)), 201);
});

/** Registered before /applications/:id so "due" is not read as an id. */
hrApplicationRoutes.delete('/applications/due', async (c) => c.json(await deleteDueApplications(c.get('deps'))));

hrApplicationRoutes.delete('/applications/:id', async (c) =>
  c.json(await deleteApplication(c.get('deps'), c.req.param('id'))),
);

hrApplicationRoutes.get('/applications/:id', async (c) => {
  return c.json(await openApplication(c.get('deps').db, c.req.param('id')));
});

/** Scores CV files without an up-to-date result, a batch at a time (the list calls it until none remain). */
hrApplicationRoutes.post('/applications/score-pending', async (c) => c.json(await scorePending(c.get('deps'))));

hrApplicationRoutes.post('/applications/:id/score', async (c) => {
  return c.json(await scoreCvOf(c.get('deps'), c.req.param('id')));
});

hrApplicationRoutes.patch('/applications/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateApplication(db, c.req.param('id'), await readJson(c), now(), hrOf(c)));
});

/** "Thêm CV" / "Đổi CV" (multipart: "cv" file or "cvLink"). */
hrApplicationRoutes.put('/applications/:id/cv', async (c) => {
  const deps = c.get('deps');
  await hrReplaceCv(deps, c.req.param('id'), await readMultipart(c, 'cv'), hrOf(c));
  return c.json(await openApplication(deps.db, c.req.param('id')));
});

/** Phone, email, source of an application HR added. */
hrApplicationRoutes.patch('/applications/:id/contact', async (c) => {
  const deps = c.get('deps');
  await updateContact(deps, c.req.param('id'), await readJson(c));
  return c.json(await openApplication(deps.db, c.req.param('id')));
});

hrApplicationRoutes.post('/applications/:id/contacts', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await logContact(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
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
