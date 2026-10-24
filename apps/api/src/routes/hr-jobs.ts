import { Hono } from 'hono';
import type { Env } from '../app.js';
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
import { jobTemplate, saveJobTemplate } from '../services/job-template.js';

/** Mounted at /api/hr/jobs behind requireHr. */
export const hrJobRoutes = new Hono<Env>();

hrJobRoutes.get('/', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listHrJobs(db, now()));
});

hrJobRoutes.get('/template', async (c) => c.json(await jobTemplate(c.get('deps').db)));

hrJobRoutes.put('/template', async (c) => c.json(await saveJobTemplate(c.get('deps').db, await readJson(c))));

hrJobRoutes.get('/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(toHrJob(await findJob(db, c.req.param('id')), now()));
});

hrJobRoutes.post('/', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await saveJob(db, null, await readJson(c), now()));
});

hrJobRoutes.put('/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await saveJob(db, c.req.param('id'), await readJson(c), now()));
});

hrJobRoutes.delete('/:id', async (c) => {
  return c.json(await deleteDraft(c.get('deps').db, c.req.param('id')));
});

hrJobRoutes.post('/:id/deadline', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await setDeadline(db, c.req.param('id'), await readJson(c), now()));
});

hrJobRoutes.post('/:id/:action{publish|close}', async (c) => {
  const { db, now } = c.get('deps');
  const action = c.req.param('action') as JobAction;
  return c.json(await runJobAction(db, c.req.param('id'), action, now()));
});
