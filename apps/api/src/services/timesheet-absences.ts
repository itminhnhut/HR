import {
  ABSENCE_REASONS,
  absenceInputSchema,
  absenceKindSchema,
  approverSchema,
  fieldErrors,
  holidaysInEffect,
  isWeekend,
  isWorkingOn,
  type AbsenceKindDto,
  type AbsenceRowDto,
  type ApproverDto,
  type AttendanceCode,
  type HrMe,
  type TimesheetAbsenceDto,
} from '@careers/shared';
import { and, asc, desc, eq, gte, lte, ne } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetAbsenceKinds, timesheetAbsences, timesheetApprovers, timesheetEntries, timesheetPeriods } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { actorOf, dayWords, listHolidays, logChange } from './timesheet-people.js';

/**
 * An absence HR writes down for a person. Once someone has approved it, it fills the weekdays it covers, across periods;
 * each day stays HR's to change. Until then it waits and the sheet does not move.
 */

type Absence = typeof timesheetAbsences.$inferSelect;
type Person = typeof employees.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Being late is a fact, not a request: it goes on the sheet at once. */
const NEEDS_NO_APPROVAL: AttendanceCode = 'M';
const HALF_OF: Partial<Record<AttendanceCode, AttendanceCode>> = { P: 'P/2', KL: 'KL/2' };

const nextDay = (day: string) => {
  const [y = 2000, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

const toDto = (r: Absence): TimesheetAbsenceDto => ({
  id: r.id,
  reason: r.reason,
  label: r.label,
  code: r.code,
  from: r.fromOn,
  to: r.toOn,
  days: r.days,
  note: r.note,
  approvedBy: r.approvedBy,
  handover: r.handover,
  createdBy: r.createdBy,
});

export async function listAbsences(db: Db, employeeId: string): Promise<TimesheetAbsenceDto[]> {
  const rows = await db.select().from(timesheetAbsences).where(eq(timesheetAbsences.employeeId, employeeId)).orderBy(desc(timesheetAbsences.fromOn));
  return rows.map(toDto);
}

export async function listAbsencesOfYear(db: Db, year: number): Promise<AbsenceRowDto[]> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw invalid('Năm không hợp lệ.');
  const rows = await db
    .select({ absence: timesheetAbsences, employeeCode: employees.code, fullName: employees.fullName })
    .from(timesheetAbsences)
    .innerJoin(employees, eq(employees.id, timesheetAbsences.employeeId))
    .where(and(lte(timesheetAbsences.fromOn, `${year}-12-31`), gte(timesheetAbsences.toOn, `${year}-01-01`)))
    .orderBy(desc(timesheetAbsences.fromOn));
  return rows.map((r) => ({ ...toDto(r.absence), employeeId: r.absence.employeeId, employeeCode: r.employeeCode, fullName: r.fullName }));
}

// Kinds

export async function listAbsenceKinds(db: Db): Promise<AbsenceKindDto[]> {
  const own = await db.select().from(timesheetAbsenceKinds).orderBy(asc(timesheetAbsenceKinds.name));
  return [
    ...ABSENCE_REASONS.map((r) => ({ key: r.key as string, name: r.label as string, code: r.code as AttendanceCode, days: r.days as number | null, isOwn: false })),
    ...own.map((k) => ({ key: k.id, name: k.name, code: k.code, days: k.days, isOwn: true })),
  ];
}

export async function addAbsenceKind(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<AbsenceKindDto[]> {
  const parsed = absenceKindSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại loại nghỉ.', fieldErrors(parsed.error));
  const known = await listAbsenceKinds(db);
  if (known.some((k) => k.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    throw invalid('Đã có loại nghỉ này.', { name: 'Đã có loại nghỉ này.' });
  }
  await db.insert(timesheetAbsenceKinds).values({ ...parsed.data, createdBy: actorOf(hr) });
  await logChange(db, hr, 'Thêm loại nghỉ', `${parsed.data.name} (${parsed.data.code})`, now);
  return listAbsenceKinds(db);
}

export async function updateAbsenceKind(db: Db, key: string, raw: unknown, hr: HrMe, now: Date): Promise<AbsenceKindDto[]> {
  if (!UUID.test(key)) throw notFound('Không tìm thấy loại nghỉ.');
  const parsed = absenceKindSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại loại nghỉ.', fieldErrors(parsed.error));
  const known = await listAbsenceKinds(db);
  if (known.some((k) => k.key !== key && k.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    throw invalid('Đã có loại nghỉ này.', { name: 'Đã có loại nghỉ này.' });
  }
  const before = known.find((k) => k.key === key);
  const [row] = await db.update(timesheetAbsenceKinds).set(parsed.data).where(eq(timesheetAbsenceKinds.id, key)).returning();
  if (!row) throw notFound('Không tìm thấy loại nghỉ.');
  await logChange(db, hr, 'Sửa loại nghỉ', `${before?.name ?? ''} → ${row.name} (${row.code}${row.days ? `, ${row.days} ngày` : ''})`, now);
  return listAbsenceKinds(db);
}

/** Absences already written keep their name and way of counting, so removing a kind changes nothing behind it. */
export async function removeAbsenceKind(db: Db, key: string, hr: HrMe, now: Date): Promise<AbsenceKindDto[]> {
  if (!UUID.test(key)) throw notFound('Không tìm thấy loại nghỉ.');
  const [row] = await db.delete(timesheetAbsenceKinds).where(eq(timesheetAbsenceKinds.id, key)).returning();
  if (!row) throw notFound('Không tìm thấy loại nghỉ.');
  await logChange(db, hr, 'Xoá loại nghỉ', row.name, now);
  return listAbsenceKinds(db);
}

// Approvers

export async function listApprovers(db: Db): Promise<ApproverDto[]> {
  const rows = await db.select().from(timesheetApprovers).orderBy(asc(timesheetApprovers.name));
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

async function rememberApprover(db: Db, name: string | null) {
  if (name) await db.insert(timesheetApprovers).values({ name }).onConflictDoNothing();
}

export async function addApprover(db: Db, raw: unknown): Promise<ApproverDto[]> {
  const parsed = approverSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại người duyệt.', fieldErrors(parsed.error));
  await rememberApprover(db, parsed.data.name);
  return listApprovers(db);
}

/** Lines already approved keep the name they were approved under. */
export async function removeApprover(db: Db, id: string): Promise<ApproverDto[]> {
  if (!UUID.test(id)) throw notFound('Không tìm thấy người duyệt.');
  const [row] = await db.delete(timesheetApprovers).where(eq(timesheetApprovers.id, id)).returning();
  if (!row) throw notFound('Không tìm thấy người duyệt.');
  return listApprovers(db);
}

// Checks

async function requireNoClosedPeriod(db: Db, from: string, to: string) {
  const closed = await db.query.timesheetPeriods.findFirst({
    where: and(eq(timesheetPeriods.status, 'closed'), lte(timesheetPeriods.fromOn, to), gte(timesheetPeriods.toOn, from)),
  });
  if (closed) throw new HttpError(409, `Kỳ tháng ${closed.month}/${closed.year} đã chốt. Mở lại kỳ để sửa.`, {}, 'period_closed');
}

async function requireNoOverlap(db: Db, employeeId: string, from: string, to: string, ownId?: string) {
  const other = await db.query.timesheetAbsences.findFirst({
    where: and(
      eq(timesheetAbsences.employeeId, employeeId),
      lte(timesheetAbsences.fromOn, to),
      gte(timesheetAbsences.toOn, from),
      ownId ? ne(timesheetAbsences.id, ownId) : undefined,
    ),
  });
  if (other) throw new HttpError(409, `Trùng với ${other.label} ${dayWords(other.fromOn)}–${dayWords(other.toOn)}.`, {}, 'absence_overlap');
}

/** Weekdays only: Saturdays stay HR's. Holidays keep NL, except maternity leave, which runs through them. */
async function daysToFill(db: Db, person: Person, from: string, to: string, runsThroughHolidays: boolean) {
  const holidays = new Set(holidaysInEffect(await listHolidays(db)).map((h) => h.day));
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDay(day)) {
    if (!isWeekend(day) && isWorkingOn(person, day) && (runsThroughHolidays || !holidays.has(day))) days.push(day);
  }
  return days;
}

/** What the input comes to: the reason's name and code, half a day applied, and the days it fills. */
async function resolve(db: Db, person: Person, raw: unknown, current?: Absence) {
  const parsed = absenceInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại đăng ký nghỉ.', fieldErrors(parsed.error));
  const input = parsed.data;
  const kind = (await listAbsenceKinds(db)).find((k) => k.key === input.reason);
  // A kind since removed can still be edited, keeping what it said.
  const isKept = !kind && current?.reason === input.reason;
  const baseCode = input.code ?? kind?.code ?? (isKept ? (current.code.replace('/2', '') as AttendanceCode) : null);
  const label = kind?.name ?? (isKept ? current.label : null);
  if (!baseCode || !label) throw invalid('Chọn lý do nghỉ.', { reason: 'Chọn lý do nghỉ.' });
  const halfCode = HALF_OF[baseCode];
  if (input.isHalf && !halfCode) throw invalid('Loại này không nghỉ nửa ngày được.', { reason: 'Loại này không nghỉ nửa ngày được.' });
  const code = input.isHalf && halfCode ? halfCode : baseCode;
  const fill = await daysToFill(db, person, input.from, input.to, code === 'TS');
  if (fill.length === 0) throw invalid('Khoảng này không có ngày làm việc nào.', { to: 'Không có ngày làm việc nào.' });
  return { input, label, code, fill, days: input.isHalf ? 0.5 : fill.length, cellNote: input.note || label, approvedBy: input.approvedBy || null };
}

type Resolved = Awaited<ReturnType<typeof resolve>>;

async function writeCells(tx: Tx, employeeId: string, r: Resolved, actor: string, now: Date) {
  if (!r.approvedBy && r.code !== NEEDS_NO_APPROVAL) return;
  const set = { code: r.code, note: r.cellNote, updatedBy: actor, updatedAt: now };
  await tx
    .insert(timesheetEntries)
    .values(r.fill.map((day) => ({ employeeId, day, ...set })))
    .onConflictDoUpdate({ target: [timesheetEntries.employeeId, timesheetEntries.day], set });
}

/** Only the days still saying what the absence wrote: a day HR changed by hand stays. */
async function eraseCells(tx: Tx, absence: Absence) {
  if (!absence.approvedBy && absence.code !== NEEDS_NO_APPROVAL) return;
  await tx
    .delete(timesheetEntries)
    .where(and(eq(timesheetEntries.employeeId, absence.employeeId), gte(timesheetEntries.day, absence.fromOn), lte(timesheetEntries.day, absence.toOn), eq(timesheetEntries.code, absence.code)));
}

const fieldsOf = (r: Resolved) => ({
  reason: r.input.reason,
  label: r.label,
  code: r.code,
  fromOn: r.input.from,
  toOn: r.input.to,
  days: r.days,
  note: r.input.note ?? '',
  approvedBy: r.approvedBy,
  handover: r.input.handover ?? '',
});

const rangeWords = (from: string, to: string) => (from === to ? dayWords(from) : `${dayWords(from)}–${dayWords(to)}`);

function changesBetween(before: Absence, after: ReturnType<typeof fieldsOf>): string {
  const pairs: [string, string, string][] = [
    ['Lý do', before.label, after.label],
    ['Ngày', rangeWords(before.fromOn, before.toOn), rangeWords(after.fromOn, after.toOn)],
    ['Người duyệt', before.approvedBy ?? 'chưa', after.approvedBy ?? 'chưa'],
    ['Bàn giao', before.handover || 'không', after.handover || 'không'],
    ['Ghi chú', before.note || 'không', after.note || 'không'],
  ];
  return pairs.filter(([, a, b]) => a !== b).map(([what, a, b]) => `${what} ${a} → ${b}`).join('; ') || 'Không đổi';
}

// Writing

async function findPerson(db: Db, id: string): Promise<Person> {
  const person = UUID.test(id) ? await db.query.employees.findFirst({ where: eq(employees.id, id) }) : undefined;
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  return person;
}

async function findAbsence(db: Db, employeeId: string, id: string): Promise<Absence> {
  const absence = UUID.test(id) ? await db.query.timesheetAbsences.findFirst({ where: and(eq(timesheetAbsences.id, id), eq(timesheetAbsences.employeeId, employeeId)) }) : undefined;
  if (!absence) throw notFound('Không tìm thấy đăng ký nghỉ.');
  return absence;
}

export async function registerAbsence(db: Db, employeeId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const person = await findPerson(db, employeeId);
  const resolved = await resolve(db, person, raw);
  const { from, to } = resolved.input;
  await requireNoClosedPeriod(db, from, to);
  await requireNoOverlap(db, employeeId, from, to);
  const actor = actorOf(hr);
  await db.transaction(async (tx) => {
    await writeCells(tx, employeeId, resolved, actor, now);
    await tx.insert(timesheetAbsences).values({ employeeId, ...fieldsOf(resolved), createdBy: actor });
  });
  await rememberApprover(db, resolved.approvedBy);
  const state = resolved.approvedBy ? `${resolved.approvedBy} duyệt` : resolved.code === NEEDS_NO_APPROVAL ? 'đã ghi' : 'chờ duyệt';
  await logChange(db, hr, 'Đăng ký nghỉ', `${person.code} ${person.fullName}: ${resolved.label}, ${rangeWords(from, to)}, ${String(resolved.days).replace('.', ',')} ngày, ${state}`, now, { from, to });
  return listAbsences(db, employeeId);
}

export async function updateAbsence(db: Db, employeeId: string, absenceId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const person = await findPerson(db, employeeId);
  const current = await findAbsence(db, employeeId, absenceId);
  const resolved = await resolve(db, person, raw, current);
  const { from, to } = resolved.input;
  await requireNoClosedPeriod(db, current.fromOn, current.toOn);
  await requireNoClosedPeriod(db, from, to);
  await requireNoOverlap(db, employeeId, from, to, absenceId);
  const fields = fieldsOf(resolved);
  await db.transaction(async (tx) => {
    await eraseCells(tx, current);
    await writeCells(tx, employeeId, resolved, actorOf(hr), now);
    await tx.update(timesheetAbsences).set(fields).where(eq(timesheetAbsences.id, absenceId));
  });
  await rememberApprover(db, resolved.approvedBy);
  const span = { from: from < current.fromOn ? from : current.fromOn, to: to > current.toOn ? to : current.toOn };
  await logChange(db, hr, 'Sửa đăng ký nghỉ', `${person.code} ${person.fullName}: ${changesBetween(current, fields)}`, now, span);
  return listAbsences(db, employeeId);
}

export async function removeAbsence(db: Db, employeeId: string, absenceId: string, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const absence = await findAbsence(db, employeeId, absenceId);
  await requireNoClosedPeriod(db, absence.fromOn, absence.toOn);
  await db.transaction(async (tx) => {
    await eraseCells(tx, absence);
    await tx.delete(timesheetAbsences).where(eq(timesheetAbsences.id, absenceId));
  });
  await logChange(db, hr, 'Huỷ đăng ký nghỉ', `${absence.label}, ${rangeWords(absence.fromOn, absence.toOn)}`, now, { from: absence.fromOn, to: absence.toOn });
  return listAbsences(db, employeeId);
}
