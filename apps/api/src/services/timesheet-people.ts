import {
  employeeInputSchema,
  fieldErrors,
  holidayInputSchema,
  regionInputSchema,
  type EmployeeDto,
  type HrMe,
  type TimesheetHolidayDto,
  type TimesheetRegionDto,
} from '@careers/shared';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetHolidays, timesheetLog, timesheetRegions } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';

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

const actorOf = (hr: HrMe) => hr.name || hr.email;

async function log(db: Db, hr: HrMe, action: string, detail: string, now: Date) {
  await db.insert(timesheetLog).values({ actor: actorOf(hr), action, detail, at: now });
}

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
  await log(db, hr, 'Thêm khu vực', parsed.data.name, now);
  return listRegions(db);
}

export async function updateRegion(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetRegionDto[]> {
  const parsed = regionInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại khu vực.', fieldErrors(parsed.error));
  try {
    const [row] = await db.update(timesheetRegions).set(parsed.data).where(eq(timesheetRegions.id, id)).returning();
    if (!row) throw notFound('Không tìm thấy khu vực.');
  } catch (error) {
    if (isUniqueViolation(error)) throw invalid('Đã có khu vực này.', { name: 'Đã có khu vực này.' });
    throw error;
  }
  await log(db, hr, 'Sửa khu vực', parsed.data.name, now);
  return listRegions(db);
}

/** A region somebody belongs to cannot go: their old periods still name it. */
export async function deleteRegion(db: Db, id: string, hr: HrMe, now: Date): Promise<TimesheetRegionDto[]> {
  const inUse = await db.query.employees.findFirst({ where: eq(employees.regionId, id) });
  if (inUse) throw new HttpError(409, 'Khu vực này đang có nhân viên, không xoá được.');
  const [row] = await db.delete(timesheetRegions).where(eq(timesheetRegions.id, id)).returning();
  if (!row) throw notFound('Không tìm thấy khu vực.');
  await log(db, hr, 'Xoá khu vực', row.name, now);
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
    await log(db, hr, 'Thêm nhân viên', `${row.code} ${row.fullName}`, now);
    return toEmployee(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(input.code);
    throw error;
  }
}

export async function updateEmployee(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<EmployeeDto> {
  const input = await parseEmployee(db, raw);
  try {
    const [row] = await db.update(employees).set({ ...input, updatedAt: now }).where(eq(employees.id, id)).returning();
    if (!row) throw notFound('Không tìm thấy nhân viên.');
    await log(db, hr, 'Sửa nhân viên', `${row.code} ${row.fullName}`, now);
    return toEmployee(row);
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
  await log(db, hr, 'Lưu ngày lễ', `${day} ${name}`, now);
  return listHolidays(db);
}

export async function deleteHoliday(db: Db, day: string, hr: HrMe, now: Date): Promise<TimesheetHolidayDto[]> {
  const [row] = await db.delete(timesheetHolidays).where(eq(timesheetHolidays.day, day)).returning();
  if (!row) throw notFound('Không tìm thấy ngày lễ.');
  await log(db, hr, 'Xoá ngày lễ', `${day} ${row.name}`, now);
  return listHolidays(db);
}
