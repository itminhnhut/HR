import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import {
  addAdjustment,
  closePeriod,
  getTimesheet,
  getTimesheetRange,
  periodLog,
  removeAdjustment,
  reopenPeriod,
  saveCells,
  saveNorms,
} from '../services/timesheet.js';
import {
  createEmployee,
  createRegion,
  deleteHoliday,
  deleteRegion,
  listEmployees,
  listHolidays,
  listRegions,
  saveHoliday,
  updateEmployee,
  updateRegion,
} from '../services/timesheet-people.js';

/** Chấm công (spec-cham-cong.md). Mounted at /api/hr/timesheet behind requireHr. */
export const hrTimesheetRoutes = new Hono<Env>();

hrTimesheetRoutes.get('/range', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getTimesheetRange(db, c.req.query('from') ?? '', c.req.query('to') ?? '', now()));
});

hrTimesheetRoutes.get('/employees', async (c) => c.json(await listEmployees(c.get('deps').db)));
hrTimesheetRoutes.post('/employees', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await createEmployee(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/employees/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateEmployee(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});

hrTimesheetRoutes.get('/regions', async (c) => c.json(await listRegions(c.get('deps').db)));
hrTimesheetRoutes.post('/regions', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await createRegion(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/regions/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateRegion(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/regions/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await deleteRegion(db, c.req.param('id'), hrOf(c), now()));
});

hrTimesheetRoutes.get('/holidays', async (c) => c.json(await listHolidays(c.get('deps').db)));
hrTimesheetRoutes.post('/holidays', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await saveHoliday(db, await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/holidays/:day', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await deleteHoliday(db, c.req.param('day'), hrOf(c), now()));
});

hrTimesheetRoutes.get('/periods/:year/:month', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getTimesheet(db, Number(c.req.param('year')), Number(c.req.param('month')), now()));
});
hrTimesheetRoutes.patch('/:id/cells', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await saveCells(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.patch('/:id/norms', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await saveNorms(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.post('/:id/adjustments', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addAdjustment(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/:id/adjustments/:adjustmentId', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeAdjustment(db, c.req.param('id'), c.req.param('adjustmentId'), hrOf(c), now()));
});
hrTimesheetRoutes.post('/:id/close', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await closePeriod(db, c.req.param('id'), hrOf(c), now()));
});
hrTimesheetRoutes.post('/:id/reopen', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await reopenPeriod(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.get('/:id/log', async (c) => c.json(await periodLog(c.get('deps').db, c.req.param('id'))));
