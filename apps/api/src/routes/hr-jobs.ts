import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { indexNowInBackground } from '../lib/indexnow.js';
import { readJson } from '../lib/request.js';
import {
  deleteDraft,
  findJob,
  listHrJobs,
  runJobAction,
  saveJob,
  setDeadline,
  type JobAction,
} from '../services/hr-jobs.js';
import { toHrJob } from '../services/job-mappers.js';
import { addTemplateChoice, jobTemplate, saveJobTemplate } from '../services/job-template.js';

/** Mounted at /api/hr/jobs behind requireHr. */
export const hrJobRoutes = new Hono<Env>();

/** A public job changed: tell search engines about its page and the home page (the job board). */
function announceJob(c: Context<Env>, job: { slug: string; status: string }) {
  if (job.status !== 'draft') indexNowInBackground(c, [`/viec-lam/${job.slug}`, '/']);
}

async function announceJobById(c: Context<Env>, id: string) {
  const { db, now } = c.get('deps');
  announceJob(c, toHrJob(await findJob(db, id), now()));
}

hrJobRoutes.get('/', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listHrJobs(db, now()));
});

hrJobRoutes.get('/template', async (c) => c.json(await jobTemplate(c.get('deps').db)));

hrJobRoutes.post('/template/choices', async (c) =>
  c.json(await addTemplateChoice(c.get('deps').db, await readJson(c))),
);

hrJobRoutes.put('/template', async (c) => c.json(await saveJobTemplate(c.get('deps').db, await readJson(c))));

hrJobRoutes.get('/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(toHrJob(await findJob(db, c.req.param('id')), now()));
});

hrJobRoutes.post('/', async (c) => {
  const { db, now } = c.get('deps');
  const job = await saveJob(db, null, await readJson(c), now());
  announceJob(c, job);
  return c.json(job);
});

hrJobRoutes.put('/:id', async (c) => {
  const { db, now } = c.get('deps');
  const job = await saveJob(db, c.req.param('id'), await readJson(c), now());
  announceJob(c, job);
  return c.json(job);
});

hrJobRoutes.delete('/:id', async (c) => {
  return c.json(await deleteDraft(c.get('deps').db, c.req.param('id')));
});

hrJobRoutes.post('/:id/deadline', async (c) => {
  const { db, now } = c.get('deps');
  const result = await setDeadline(db, c.req.param('id'), await readJson(c), now());
  await announceJobById(c, c.req.param('id'));
  return c.json(result);
});

hrJobRoutes.post('/:id/:action{publish|close}', async (c) => {
  const { db, now } = c.get('deps');
  const action = c.req.param('action') as JobAction;
  const result = await runJobAction(db, c.req.param('id'), action, now());
  await announceJobById(c, c.req.param('id'));
  return c.json(result);
});
