import { createCvLink } from '../lib/cv-link.js';
import { cvResponse } from '../lib/cv-response.js';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { notFound } from '../lib/http-error.js';
import { readJson, readMultipart } from '../lib/request.js';
import { addApplication, hrReplaceCv, updateContact } from '../services/hr-intake.js';
import { readCvContact } from '../services/cv-contact.js';
import { hrOf } from '../lib/hr-auth.js';
import {
  cvOf,
  deleteApplication,
  deleteSubscriber,
  logContact,
  scoreCvOf,
  applicationDetail,
  listApplications,
  listSubscribers,
  openApplication,
  updateApplication,
} from '../services/hr-applications.js';
import { scorePending } from '../services/cv-score.js';
import { readRecruitmentLog } from '../services/recruitment-log.js';
import { logReach } from '../services/reach.js';
import { addNote, deleteNote, editNote } from '../services/application-notes.js';

/** Mounted at /api/hr behind requireHr. */
export const hrApplicationRoutes = new Hono<Env>();

hrApplicationRoutes.get('/applications', async (c) => {
  const source = c.req.query('source');
  return c.json(
    await listApplications(
      c.get('deps').db,
      c.req.query('jobId') || undefined,
      c.req.query('q')?.slice(0, 100),
      source?.trim() || undefined,
      c.get('deps').now(),
    ),
  );
});

/** "Thêm hồ sơ" (multipart: fields + optional "cv" file). 409 { code: "duplicate", existing } for the same phone and job. */
hrApplicationRoutes.post('/applications', async (c) => {
  const body = await readMultipart(c, 'cv');
  return c.json(await addApplication(c.get('deps'), body, hrOf(c)), 201);
});

/**
 * "Thêm hồ sơ" pre-fill (multipart "cv" PDF) → ParsedCvDto. Only reads the file, nothing is stored.
 * Registered before /applications/:id so "parse-cv" is not read as an id.
 */
hrApplicationRoutes.post('/applications/parse-cv', async (c) => {
  return c.json(await readCvContact(await readMultipart(c, 'cv')));
});

hrApplicationRoutes.delete('/applications/:id', async (c) =>
  c.json(await deleteApplication(c.get('deps'), c.req.param('id'), hrOf(c))),
);

hrApplicationRoutes.get('/applications/:id', async (c) => {
  return c.json(await openApplication(c.get('deps').db, c.req.param('id'), hrOf(c)));
});

/** Scores CV files without an up-to-date result, a batch at a time (the list calls it until none remain). */
hrApplicationRoutes.post('/applications/score-pending', async (c) => c.json(await scorePending(c.get('deps'))));

hrApplicationRoutes.post('/applications/:id/score', async (c) => {
  return c.json(await scoreCvOf(c.get('deps'), c.req.param('id'), hrOf(c)));
});

hrApplicationRoutes.patch('/applications/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateApplication(db, c.req.param('id'), await readJson(c), now(), hrOf(c)));
});

/** "Thêm CV" / "Đổi CV" (multipart: "cv" file or "cvLink"). */
hrApplicationRoutes.put('/applications/:id/cv', async (c) => {
  const deps = c.get('deps');
  await hrReplaceCv(deps, c.req.param('id'), await readMultipart(c, 'cv'), hrOf(c));
  return c.json(await openApplication(deps.db, c.req.param('id'), hrOf(c)));
});

/** Phone, email, source of an application HR added. */
hrApplicationRoutes.patch('/applications/:id/contact', async (c) => {
  const deps = c.get('deps');
  await updateContact(deps, c.req.param('id'), await readJson(c), hrOf(c));
  return c.json(await openApplication(deps.db, c.req.param('id'), hrOf(c)));
});

hrApplicationRoutes.post('/applications/:id/reach', async (c) => {
  const { db, now } = c.get('deps');
  await logReach(db, c.req.param('id'), await readJson(c), hrOf(c), now());
  return c.body(null, 204);
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
  return cvResponse(stream, fullName);
});

/** The address an interview invitation carries. Only for a stored file: a pasted job-site address may hold its own key. */
hrApplicationRoutes.get('/applications/:id/cv-link', async (c) => {
  const { db, config, now } = c.get('deps');
  const id = c.req.param('id');
  const { pathname } = await cvOf(db, id);
  return c.json(createCvLink(config.sessionSecret, config.siteUrl, id, pathname, now()));
});

/** "Ghi chú nội bộ": add { body } (201), edit { body }, delete. Each answers with the application's detail. */
hrApplicationRoutes.post('/applications/:id/notes', async (c) => {
  const { db, now } = c.get('deps');
  const id = c.req.param('id');
  await applicationDetail(db, id);
  await addNote(db, id, await readJson(c), hrOf(c), now());
  return c.json(await applicationDetail(db, id), 201);
});

hrApplicationRoutes.patch('/applications/:id/notes/:noteId', async (c) => {
  const { db, now } = c.get('deps');
  const { id, noteId } = c.req.param();
  await editNote(db, id, noteId, await readJson(c), hrOf(c), now());
  return c.json(await applicationDetail(db, id));
});

hrApplicationRoutes.delete('/applications/:id/notes/:noteId', async (c) => {
  const { db, now } = c.get('deps');
  const { id, noteId } = c.req.param();
  await deleteNote(db, id, noteId, hrOf(c), now());
  return c.json(await applicationDetail(db, id));
});

/** "Nhật ký tuyển dụng": ?nhom= group, ?tim= words, ?tu= offset; 100 lines a page, newest first. */
hrApplicationRoutes.get('/recruitment-log', async (c) => c.json(await readRecruitmentLog(c.get('deps').db, c.req.query())));

hrApplicationRoutes.get('/subscribers', async (c) => {
  return c.json(await listSubscribers(c.get('deps').db));
});

hrApplicationRoutes.delete('/subscribers/:id', async (c) => {
  return c.json(await deleteSubscriber(c.get('deps').db, c.req.param('id')));
});
