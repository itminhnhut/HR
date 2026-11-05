import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import {
  addAdjustment,
  addLeaveChange,
  closePeriod,
  removeLeaveChange,
  listYear,
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
  deleteEmployee,
  deleteHoliday,
  deleteHolidayRange,
  deleteRegion,
  listEmployees,
  listHolidays,
  listRegions,
  saveHoliday,
  saveHolidayRange,
  updateEmployee,
  updateRegion,
} from '../services/timesheet-people.js';
import { addAbsenceKind, addApprover, listApprovers, removeApprover, listAbsenceKinds, listAbsences, listAbsencesOfYear, registerAbsence, removeAbsence, removeAbsenceKind, updateAbsence, updateAbsenceKind, withHolidaysApplied } from '../services/timesheet-absences.js';

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
hrTimesheetRoutes.delete('/employees/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await deleteEmployee(db, c.req.param('id'), hrOf(c), now()));
});
hrTimesheetRoutes.get('/absences', async (c) => c.json(await listAbsencesOfYear(c.get('deps').db, Number(c.req.query('year')))));
hrTimesheetRoutes.get('/approvers', async (c) => c.json(await listApprovers(c.get('deps').db)));
hrTimesheetRoutes.post('/approvers', async (c) => c.json(await addApprover(c.get('deps').db, await readJson(c)), 201));
hrTimesheetRoutes.delete('/approvers/:id', async (c) => c.json(await removeApprover(c.get('deps').db, c.req.param('id'))));
hrTimesheetRoutes.get('/absence-kinds', async (c) => c.json(await listAbsenceKinds(c.get('deps').db)));
hrTimesheetRoutes.post('/absence-kinds', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addAbsenceKind(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/absence-kinds/:key', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateAbsenceKind(db, c.req.param('key'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/absence-kinds/:key', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeAbsenceKind(db, c.req.param('key'), hrOf(c), now()));
});
hrTimesheetRoutes.patch('/employees/:id/absences/:absenceId', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateAbsence(db, c.req.param('id'), c.req.param('absenceId'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.get('/employees/:id/absences', async (c) => c.json(await listAbsences(c.get('deps').db, c.req.param('id'))));
hrTimesheetRoutes.post('/employees/:id/absences', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await registerAbsence(db, c.req.param('id'), await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.delete('/employees/:id/absences/:absenceId', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeAbsence(db, c.req.param('id'), c.req.param('absenceId'), hrOf(c), now()));
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
hrTimesheetRoutes.post('/holidays/range', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await withHolidaysApplied(db, hrOf(c), now(), async () => saveHolidayRange(db, await readJson(c), hrOf(c), now())));
});
hrTimesheetRoutes.delete('/holidays/range', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await withHolidaysApplied(db, hrOf(c), now(), () => deleteHolidayRange(db, c.req.query('from') ?? '', c.req.query('to') ?? '', hrOf(c), now())));
});
hrTimesheetRoutes.post('/holidays', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await withHolidaysApplied(db, hrOf(c), now(), async () => saveHoliday(db, await readJson(c), hrOf(c), now())));
});
hrTimesheetRoutes.delete('/holidays/:day', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await withHolidaysApplied(db, hrOf(c), now(), () => deleteHoliday(db, c.req.param('day'), hrOf(c), now())));
});

hrTimesheetRoutes.get('/years/:year', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listYear(db, Number(c.req.param('year')), now()));
});
hrTimesheetRoutes.get('/periods/:year/:month', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getTimesheet(db, Number(c.req.param('year')), Number(c.req.param('month')), now()));
});
hrTimesheetRoutes.post('/:id/leave-changes', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addLeaveChange(db, c.req.param('id'), await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.delete('/:id/leave-changes/:changeId', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeLeaveChange(db, c.req.param('id'), c.req.param('changeId'), hrOf(c), now()));
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
