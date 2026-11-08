import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson, readMultipart } from '../lib/request.js';
import { deletePapersQuietly } from '../lib/paper-store.js';
import { createAbsenceBatch, listAbsenceBatches, removeAbsenceBatch, updateAbsenceBatch } from '../services/timesheet-absence-batches.js';
import { addAbsenceFile, papersToClear, readAbsenceFile, removeAbsenceFile } from '../services/timesheet-absence-files.js';
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
  setLeaveMode,
  openPeriodAhead,
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
  listStaffKinds,
  saveHoliday,
  saveHolidayRange,
  updateEmployee,
  updateRegion,
} from '../services/timesheet-people.js';
import { readLog } from '../services/timesheet-log.js';
import { addDepartment, addStaffKind, listDepartments, removeDepartment, removeStaffKind, renameDepartment, updateStaffKind } from '../services/timesheet-config.js';
import { addAbsenceKind, addApprover, listApprovers, removeApprover, listAbsenceKinds, listAbsences, listAbsencesOfYear, leaveBalanceFor, registerAbsence, removeAbsence, removeAbsenceKind, removeSheetLeave, updateAbsence, updateAbsenceKind, withHolidaysApplied, setNeedsPaper } from '../services/timesheet-absences.js';

/** Chấm công (spec-cham-cong.md). Mounted at /api/hr/timesheet behind requireHr. */
export const hrTimesheetRoutes = new Hono<Env>();

hrTimesheetRoutes.get('/range', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await getTimesheetRange(db, c.req.query('from') ?? '', c.req.query('to') ?? '', now()));
});

hrTimesheetRoutes.get('/departments', async (c) => c.json(await listDepartments(c.get('deps').db)));
hrTimesheetRoutes.post('/departments', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addDepartment(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/departments/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await renameDepartment(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/departments/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeDepartment(db, c.req.param('id'), hrOf(c), now()));
});
hrTimesheetRoutes.get('/staff-kinds', async (c) => c.json(await listStaffKinds(c.get('deps').db)));
hrTimesheetRoutes.post('/staff-kinds', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addStaffKind(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/staff-kinds/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateStaffKind(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.delete('/staff-kinds/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeStaffKind(db, c.req.param('id'), hrOf(c), now()));
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
hrTimesheetRoutes.get('/absence-batches', async (c) => c.json(await listAbsenceBatches(c.get('deps').db, Number(c.req.query('year')))));
hrTimesheetRoutes.post('/absence-batches', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await createAbsenceBatch(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/absence-batches/:id', async (c) => {
  const { db, paperStore, now } = c.get('deps');
  const { batch, papers } = await updateAbsenceBatch(db, c.req.param('id'), await readJson(c), hrOf(c), now());
  await deletePapersQuietly(paperStore, papers);
  return c.json(batch);
});
hrTimesheetRoutes.delete('/absence-batches/:id', async (c) => {
  const { db, paperStore, now } = c.get('deps');
  const { removed, papers } = await removeAbsenceBatch(db, c.req.param('id'), hrOf(c), now());
  await deletePapersQuietly(paperStore, papers);
  return c.json({ removed });
});
hrTimesheetRoutes.get('/employees/:id/leave-balance', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await leaveBalanceFor(db, c.req.param('id'), c.req.query(), now()));
});
hrTimesheetRoutes.get('/approvers', async (c) => c.json(await listApprovers(c.get('deps').db)));
hrTimesheetRoutes.post('/approvers', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addApprover(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.delete('/approvers/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeApprover(db, c.req.param('id'), hrOf(c), now()));
});
hrTimesheetRoutes.get('/absence-kinds', async (c) => c.json(await listAbsenceKinds(c.get('deps').db)));
hrTimesheetRoutes.post('/absence-kinds', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addAbsenceKind(db, await readJson(c), hrOf(c), now()), 201);
});
hrTimesheetRoutes.patch('/absence-kinds/:key', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await updateAbsenceKind(db, c.req.param('key'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.put('/absence-kinds/:key/needs-paper', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await setNeedsPaper(db, c.req.param('key'), await readJson(c), hrOf(c), now()));
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
  const { db, paperStore, now } = c.get('deps');
  const clearPapers = await papersToClear(db, paperStore, c.req.param('absenceId'), hrOf(c), now());
  const left = await removeAbsence(db, c.req.param('id'), c.req.param('absenceId'), hrOf(c), now());
  await clearPapers();
  return c.json(left);
});

// Papers kept with an absence: one file a request, private, read only here.
hrTimesheetRoutes.post('/absences/:id/files', async (c) => {
  const { db, paperStore, now } = c.get('deps');
  const { file } = await readMultipart(c, 'file');
  return c.json(await addAbsenceFile(db, paperStore, c.req.param('id'), file, hrOf(c), now()), 201);
});
hrTimesheetRoutes.get('/absence-files/:id', async (c) => {
  const { db, paperStore } = c.get('deps');
  return readAbsenceFile(db, paperStore, c.req.param('id'));
});
hrTimesheetRoutes.delete('/absence-files/:id', async (c) => {
  const { db, paperStore, now } = c.get('deps');
  return c.json(await removeAbsenceFile(db, paperStore, c.req.param('id'), hrOf(c), now()));
});
hrTimesheetRoutes.post('/employees/:id/sheet-leave/remove', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await removeSheetLeave(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
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
hrTimesheetRoutes.post('/periods/:year/:month', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await openPeriodAhead(db, Number(c.req.param('year')), Number(c.req.param('month')), hrOf(c), now()), 201);
});
hrTimesheetRoutes.put('/:id/leave-mode', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await setLeaveMode(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.post('/:id/reopen', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await reopenPeriod(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});
hrTimesheetRoutes.get('/log', async (c) => c.json(await readLog(c.get('deps').db, c.req.query())));
hrTimesheetRoutes.get('/:id/log', async (c) => c.json(await periodLog(c.get('deps').db, c.req.param('id'))));
