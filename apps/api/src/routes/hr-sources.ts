import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import { createSource, deleteSource, listSources, updateSource } from '../services/sources.js';

/** "Nguồn hồ sơ" (spec-custom-sources.md). Mounted at /api/hr/sources behind requireHr. */
export const hrSourceRoutes = new Hono<Env>();

hrSourceRoutes.get('/', async (c) => c.json(await listSources(c.get('deps').db)));

hrSourceRoutes.post('/', async (c) => c.json(await createSource(c.get('deps').db, await readJson(c), hrOf(c)), 201));

hrSourceRoutes.patch('/:key', async (c) =>
  c.json(await updateSource(c.get('deps').db, c.req.param('key'), await readJson(c))),
);

hrSourceRoutes.delete('/:key', async (c) => c.json(await deleteSource(c.get('deps').db, c.req.param('key'))));
