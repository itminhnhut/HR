import {
  daysOfHolidayBreak,
  holidayRangeSchema,
  saturdaysFor,
  suggestedNorm,
  employeeInputSchema,
  fieldErrors,
  holidayInputSchema,
  regionInputSchema,
  type EmployeeDto,
  type HrMe,
  type TimesheetHolidayDto,
  type TimesheetRegionDto,
} from '@careers/shared';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetAbsences, timesheetAdjustments, timesheetEntries, timesheetHolidays, timesheetLeaveChanges, timesheetLog, timesheetPeriods, timesheetRegions, timesheetSnapshots } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';

/** The people, regions and holidays a timesheet is made from (spec-cham-cong.md). */

/** The regions migration 0022 creates; tests put them back after emptying the tables. */
export const DEFAULT_REGIONS = [
  { name: 'HCM', saturdays: 2, tone: 'blue' },
  { name: 'HN', saturdays: 4, tone: 'rose' },
] as const;

/** Drizzle wraps the driver's error, so its code can be one level down. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ('code' in error && error.code === '23505') return true;
  return 'cause' in error && isUniqueViolation(error.cause);
}

export const actorOf = (hr: HrMe) => hr.name || hr.email;

interface Span {
  from: string | null;
  to: string | null;
}

/** Written into each open period the change touches, because HR reads the log period by period. Kept when none is open. */
export async function logChange(db: Db, hr: HrMe, action: string, detail: string, now: Date, span: Span = { from: null, to: null }) {
  const open = await db
    .select({ id: timesheetPeriods.id })
    .from(timesheetPeriods)
    .where(
      and(
        eq(timesheetPeriods.status, 'open'),
        span.to ? lte(timesheetPeriods.fromOn, span.to) : undefined,
        span.from ? gte(timesheetPeriods.toOn, span.from) : undefined,
      ),
    );
  const line = { actor: actorOf(hr), action, detail, at: now };
  await db.insert(timesheetLog).values(open.length > 0 ? open.map((p) => ({ ...line, periodId: p.id })) : [line]);
}

export const dayWords = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export async function listRegions(db: Db): Promise<TimesheetRegionDto[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(timesheetRegions).orderBy(asc(timesheetRegions.createdAt), asc(timesheetRegions.name)),
    db
      .select({ regionId: employees.regionId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(employees)
      .groupBy(employees.regionId),
  ]);
  const used = new Map(counts.map((c) => [c.regionId, c.n]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    saturdays: r.saturdays,
    saturdayChanges: r.saturdayChanges,
    tone: r.tone,
    hidden: r.hidden,
    employees: used.get(r.id) ?? 0,
  }));
}

export async function createRegion(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetRegionDto[]> {
  const parsed = regionInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại khu vực.', fieldErrors(parsed.error));
  try {
    await db.insert(timesheetRegions).values(parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) throw invalid('Đã có khu vực này.', { name: 'Đã có khu vực này.' });
    throw error;
  }
  await logChange(db, hr, 'Thêm khu vực', parsed.data.name, now);
  return listRegions(db);
}

/** Open months from that one on follow the new number, unless HR set their norm by hand. Closed months never move. */
async function moveNorms(db: Db, region: typeof timesheetRegions.$inferSelect, from: string, saturdays: number) {
  const open = await db.select().from(timesheetPeriods).where(eq(timesheetPeriods.status, 'open'));
  for (const period of open) {
    const key = `${period.year}-${String(period.month).padStart(2, '0')}`;
    if (key < from) continue;
    const range = { from: period.fromOn, to: period.toOn };
    if (period.norms[region.id] !== suggestedNorm(range, saturdaysFor(region, key))) continue;
    const norms = { ...period.norms, [region.id]: suggestedNorm(range, saturdays) };
    await db.update(timesheetPeriods).set({ norms }).where(eq(timesheetPeriods.id, period.id));
  }
}

export async function updateRegion(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetRegionDto[]> {
  if (!isUuid(id)) throw notFound('Không tìm thấy khu vực.');
  const parsed = regionInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại khu vực.', fieldErrors(parsed.error));
  const { saturdaysFrom, ...fields } = parsed.data;
  try {
    const current = await db.query.timesheetRegions.findFirst({ where: eq(timesheetRegions.id, id) });
    if (!current) throw notFound('Không tìm thấy khu vực.');
    if (saturdaysFrom && fields.saturdays === saturdaysFor(current, saturdaysFrom)) {
      // Only a name or a colour changed: nothing planned for later months may move.
      await db.update(timesheetRegions).set({ name: fields.name, tone: fields.tone }).where(eq(timesheetRegions.id, id));
    } else if (saturdaysFrom) {
      await moveNorms(db, current, saturdaysFrom, fields.saturdays);
      const saturdayChanges = [...current.saturdayChanges.filter((c) => c.from < saturdaysFrom), { from: saturdaysFrom, saturdays: fields.saturdays }];
      await db.update(timesheetRegions).set({ name: fields.name, tone: fields.tone, saturdayChanges }).where(eq(timesheetRegions.id, id));
    } else {
      await db.update(timesheetRegions).set(fields).where(eq(timesheetRegions.id, id));
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw invalid('Đã có khu vực này.', { name: 'Đã có khu vực này.' });
    throw error;
  }
  await logChange(db, hr, 'Sửa khu vực', parsed.data.name, now);
  return listRegions(db);
}

/** A region somebody belongs to cannot go: their old periods still name it. */
export async function deleteRegion(db: Db, id: string, hr: HrMe, now: Date): Promise<TimesheetRegionDto[]> {
  if (!isUuid(id)) throw notFound('Không tìm thấy khu vực.');
  const inUse = await db.query.employees.findFirst({ where: eq(employees.regionId, id) });
  if (inUse) throw new HttpError(409, 'Khu vực này đang có nhân viên, không xoá được.');
  const [row] = await db.delete(timesheetRegions).where(eq(timesheetRegions.id, id)).returning();
  if (!row) throw notFound('Không tìm thấy khu vực.');
  await logChange(db, hr, 'Xoá khu vực', row.name, now);
  return listRegions(db);
}

const toEmployee = (e: typeof employees.$inferSelect): EmployeeDto => ({
  id: e.id,
  code: e.code,
  fullName: e.fullName,
  department: e.department,
  title: e.title,
  regionId: e.regionId,
  employment: e.employment,
  joinedOn: e.joinedOn,
  officialOn: e.officialOn,
  leftOn: e.leftOn,
  openingLeave: e.openingLeave,
});

export async function listEmployees(db: Db): Promise<EmployeeDto[]> {
  const rows = await db.select().from(employees).orderBy(asc(employees.code));
  return rows.map(toEmployee);
}

async function parseEmployee(db: Db, raw: unknown) {
  const parsed = employeeInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại thông tin nhân viên.', fieldErrors(parsed.error));
  const region = await db.query.timesheetRegions.findFirst({ where: eq(timesheetRegions.id, parsed.data.regionId) });
  if (!region) throw invalid('Chọn khu vực.', { regionId: 'Chọn khu vực.' });
  return parsed.data;
}

const duplicateCode = (code: string) => invalid(`Mã ${code} đã có người dùng.`, { code: `Mã ${code} đã có người dùng.` });

export async function createEmployee(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<EmployeeDto> {
  const input = await parseEmployee(db, raw);
  try {
    const [row] = await db.insert(employees).values(input).returning();
    if (!row) throw new Error('Insert returned nothing');
    await logChange(db, hr, 'Thêm nhân viên', `${row.code} ${row.fullName}`, now, { from: row.joinedOn, to: row.leftOn });
    return toEmployee(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(input.code);
    throw error;
  }
}

/** Told of a last day after the month closed: that month paid days after it, and the leave is still owed. */
async function leavingWarning(db: Db, employeeId: string, leftOn: string | null): Promise<string | undefined> {
  if (!leftOn) return undefined;
  const [closed] = await db
    .select({ year: timesheetPeriods.year, month: timesheetPeriods.month, leave: timesheetSnapshots.leaveClosing })
    .from(timesheetSnapshots)
    .innerJoin(timesheetPeriods, eq(timesheetPeriods.id, timesheetSnapshots.periodId))
    .where(and(eq(timesheetSnapshots.employeeId, employeeId), eq(timesheetPeriods.status, 'closed'), gte(timesheetPeriods.toOn, leftOn)))
    .orderBy(asc(timesheetPeriods.toOn))
    .limit(1);
  if (!closed) return undefined;
  return `Kỳ tháng ${closed.month}/${closed.year} đã chốt vẫn tính công sau ngày nghỉ việc ${dayWords(leftOn)}, còn ${String(closed.leave).replace('.', ',')} ngày phép cần thanh toán. Mở lại kỳ để sửa.`;
}

export async function deleteEmployee(db: Db, id: string, hr: HrMe, now: Date): Promise<EmployeeDto[]> {
  const person = isUuid(id) ? await db.query.employees.findFirst({ where: eq(employees.id, id) }) : undefined;
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  const records = await Promise.all([
    db.query.timesheetEntries.findFirst({ where: eq(timesheetEntries.employeeId, id) }),
    db.query.timesheetSnapshots.findFirst({ where: eq(timesheetSnapshots.employeeId, id) }),
    db.query.timesheetAdjustments.findFirst({ where: eq(timesheetAdjustments.employeeId, id) }),
    db.query.timesheetAbsences.findFirst({ where: eq(timesheetAbsences.employeeId, id) }),
    db.query.timesheetLeaveChanges.findFirst({ where: eq(timesheetLeaveChanges.employeeId, id) }),
  ]);
  if (records.some(Boolean)) throw new HttpError(409, 'Người này đã có dữ liệu chấm công. Dùng Ngày nghỉ việc thay vì xoá.', {}, 'has_records');
  await db.delete(employees).where(eq(employees.id, id));
  await logChange(db, hr, 'Xoá nhân viên', `${person.code} ${person.fullName}`, now);
  return listEmployees(db);
}

export async function updateEmployee(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<EmployeeDto> {
  if (!isUuid(id)) throw notFound('Không tìm thấy nhân viên.');
  const input = await parseEmployee(db, raw);
  const current = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  const hasClosed = await db.query.timesheetSnapshots.findFirst({ where: eq(timesheetSnapshots.employeeId, id) });
  const startIgnored = !!current && !!hasClosed && current.openingLeave !== input.openingLeave;
  try {
    const [row] = await db.update(employees).set({ ...input, updatedAt: now }).where(eq(employees.id, id)).returning();
    if (!row) throw notFound('Không tìm thấy nhân viên.');
    await logChange(db, hr, 'Sửa nhân viên', `${row.code} ${row.fullName}`, now, { from: row.joinedOn, to: row.leftOn });
    const warning = startIgnored ? 'Đã có kỳ chốt nên Phép tồn ban đầu không còn tác dụng. Dùng Điều chỉnh phép trên bảng công.' : await leavingWarning(db, id, row.leftOn);
    return warning ? { ...toEmployee(row), warning } : toEmployee(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(input.code);
    throw error;
  }
}

export async function listHolidays(db: Db): Promise<TimesheetHolidayDto[]> {
  return db.select({ day: timesheetHolidays.day, name: timesheetHolidays.name }).from(timesheetHolidays).orderBy(asc(timesheetHolidays.day));
}

export async function saveHoliday(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetHolidayDto[]> {
  const parsed = holidayInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại ngày lễ.', fieldErrors(parsed.error));
  const { day, name } = parsed.data;
  await db
    .insert(timesheetHolidays)
    .values({ day, name, createdBy: actorOf(hr) })
    .onConflictDoUpdate({ target: timesheetHolidays.day, set: { name } });
  await logChange(db, hr, 'Lưu ngày lễ', `${dayWords(day)} ${name}`, now, { from: day, to: day });
  return listHolidays(db);
}

/** A long break such as Tết, saved in one go: everyone gets NL on its days, and HR can still change a person's day. */
export async function saveHolidayRange(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetHolidayDto[]> {
  const parsed = holidayRangeSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại đợt nghỉ.', fieldErrors(parsed.error));
  const { from, to, name } = parsed.data;
  const rows = daysOfHolidayBreak(from, to).map((day) => ({ day, name, createdBy: actorOf(hr) }));
  await db.insert(timesheetHolidays).values(rows).onConflictDoUpdate({ target: timesheetHolidays.day, set: { name } });
  await logChange(db, hr, 'Lưu ngày lễ', `${dayWords(from)}–${dayWords(to)} ${name}`, now, { from, to });
  return listHolidays(db);
}

export async function deleteHolidayRange(db: Db, from: string, to: string, hr: HrMe, now: Date): Promise<TimesheetHolidayDto[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw invalid('Khoảng ngày không hợp lệ.');
  const rows = await db.delete(timesheetHolidays).where(and(gte(timesheetHolidays.day, from), lte(timesheetHolidays.day, to))).returning();
  if (rows.length === 0) throw notFound('Không tìm thấy ngày lễ.');
  await logChange(db, hr, 'Xoá ngày lễ', `${dayWords(from)}–${dayWords(to)} ${rows[0]?.name ?? ''}`, now, { from, to });
  return listHolidays(db);
}

export async function deleteHoliday(db: Db, day: string, hr: HrMe, now: Date): Promise<TimesheetHolidayDto[]> {
  const [row] = await db.delete(timesheetHolidays).where(eq(timesheetHolidays.day, day)).returning();
  if (!row) throw notFound('Không tìm thấy ngày lễ.');
  await logChange(db, hr, 'Xoá ngày lễ', `${dayWords(day)} ${row.name}`, now, { from: day, to: day });
  return listHolidays(db);
}
