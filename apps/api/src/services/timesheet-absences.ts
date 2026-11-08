import {
  ABSENCE_REASONS,
  addDays,
  dayCode,
  leaveBalanceQuerySchema,
  periodDays,
  periodMonthOf,
  timesheetTotals,
  todayInVietnam,
  type LeaveBalanceDto,
  type TimesheetDto,
  type TimesheetRowDto,
  type TimesheetTotals,
  SHEET_APPROVER,
  SHEET_LEAVE_CODES,
  sheetLeaveSchema,
  needsPaperByDefault,
  needsPaperSchema,
  absenceInputSchema,
  absenceKindSchema,
  approverSchema,
  fieldErrors,
  holidaysInEffect,
  ATTENDANCE_LABEL,
  isWeekend,
  isWorkingOn,
  nextDay,
  type AbsenceFileDto,
  type AbsenceReasonKey,
  type AbsenceKindDto,
  type AbsenceRowDto,
  type ApproverDto,
  type AttendanceCode,
  type HrMe,
  type TimesheetAbsenceDto,
  workingDayCheck,
} from '@careers/shared';
import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetAbsenceBatches, timesheetAbsenceKinds, timesheetAbsences, timesheetApprovers, timesheetEntries, timesheetPeriods, timesheetReasonSettings } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { filesByAbsence } from './timesheet-absence-files.js';
import { getTimesheet } from './timesheet.js';
import { actorOf, dayWords, listHolidays, listRegions, logChange } from './timesheet-people.js';

/**
 * An absence HR writes down for a person. Once someone has approved it, it fills the weekdays it covers, across periods;
 * each day stays HR's to change. Until then it waits and the sheet does not move.
 */

type Absence = typeof timesheetAbsences.$inferSelect;
type Person = typeof employees.$inferSelect;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Being late is a fact, not a request: it goes on the sheet at once. */
const NEEDS_NO_APPROVAL: AttendanceCode = 'M';
const HALF_OF: Partial<Record<AttendanceCode, AttendanceCode>> = { P: 'P/2', KL: 'KL/2' };
/** An absence has written its days once approved; being late needs no approval. */
export const writesCells = (a: { approvedBy: string | null; code: string }) => !!a.approvedBy || a.code === NEEDS_NO_APPROVAL;

const toDto = (r: Absence, files: AbsenceFileDto[] = [], needsPaper = false): TimesheetAbsenceDto => ({
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
  files,
  needsPaper,
});

export async function listAbsences(db: Db, employeeId: string): Promise<TimesheetAbsenceDto[]> {
  const rows = await db.select().from(timesheetAbsences).where(eq(timesheetAbsences.employeeId, employeeId)).orderBy(desc(timesheetAbsences.fromOn));
  const [files, needsPaper] = await Promise.all([filesByAbsence(db, rows.map((r) => r.id)), paperRule(db)]);
  return rows.map((r) => toDto(r, files.get(r.id), needsPaper(r.reason)));
}

const SHEET_LEAVE = SHEET_LEAVE_CODES;

/** Days in a row with the same code, a weekend between them included, read as one line. */
function sheetLines(entries: readonly { employeeId: string; day: string; code: string; note: string | null; updatedBy: string }[]) {
  const lines: { employeeId: string; code: string; from: string; to: string; days: number; notes: string[]; by: string }[] = [];
  for (const e of [...entries].sort((a, b) => a.employeeId.localeCompare(b.employeeId) || a.day.localeCompare(b.day))) {
    const last = lines.at(-1);
    let next = last ? nextDay(last.to) : '';
    while (last && next < e.day && isWeekend(next)) next = nextDay(next);
    const half = e.code.endsWith('/2') ? 0.5 : 1;
    if (last && last.employeeId === e.employeeId && last.code === e.code && next === e.day) {
      lines[lines.length - 1] = { ...last, to: e.day, days: last.days + half, notes: e.note ? [...last.notes, e.note] : last.notes, by: e.updatedBy };
    } else {
      lines.push({ employeeId: e.employeeId, code: e.code, from: e.day, to: e.day, days: half, notes: e.note ? [e.note] : [], by: e.updatedBy });
    }
  }
  return lines;
}

/** Leave typed straight into the sheet on days no absence covers, so the list holds every day away. */
async function sheetLeaveOfYear(db: Db, year: number, absences: readonly AbsenceRowDto[]): Promise<AbsenceRowDto[]> {
  const rows = await db
    .select({ employeeId: timesheetEntries.employeeId, day: timesheetEntries.day, code: timesheetEntries.code, note: timesheetEntries.note, updatedBy: timesheetEntries.updatedBy, employeeCode: employees.code, fullName: employees.fullName })
    .from(timesheetEntries)
    .innerJoin(employees, eq(employees.id, timesheetEntries.employeeId))
    .where(and(gte(timesheetEntries.day, `${year}-01-01`), lte(timesheetEntries.day, `${year}-12-31`), inArray(timesheetEntries.code, [...SHEET_LEAVE])));
  // A day is the absence's only when it wrote it: same code, once approved. Another code typed inside its dates is still listed.
  const covered = (employeeId: string, day: string, code: string) => absences.some((a) => a.employeeId === employeeId && a.code === code && writesCells(a) && a.from <= day && day <= a.to);
  const free = rows.flatMap((r) => (r.code && !covered(r.employeeId, r.day, r.code) ? [{ ...r, code: r.code }] : []));
  const who = new Map(rows.map((r) => [r.employeeId, { employeeCode: r.employeeCode, fullName: r.fullName }]));
  return sheetLines(free).map((l) => ({
    id: `sheet-${l.employeeId}-${l.from}`,
    source: 'sheet' as const,
    reason: 'sheet',
    code: l.code,
    from: l.from,
    to: l.to,
    days: l.days,
    note: l.notes.join('; '),
    label: ATTENDANCE_LABEL[l.code as AttendanceCode] ?? l.code,
    approvedBy: SHEET_APPROVER,
    handover: '',
    createdBy: l.by,
    files: [],
    needsPaper: false,
    employeeId: l.employeeId,
    employeeCode: who.get(l.employeeId)?.employeeCode ?? '',
    fullName: who.get(l.employeeId)?.fullName ?? '',
  }));
}

export async function listAbsencesOfYear(db: Db, year: number): Promise<AbsenceRowDto[]> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw invalid('Năm không hợp lệ.');
  const rows = await db
    .select({ absence: timesheetAbsences, employeeCode: employees.code, fullName: employees.fullName, batchName: timesheetAbsenceBatches.name })
    .from(timesheetAbsences)
    .innerJoin(employees, eq(employees.id, timesheetAbsences.employeeId))
    .leftJoin(timesheetAbsenceBatches, eq(timesheetAbsenceBatches.id, timesheetAbsences.batchId))
    .where(and(lte(timesheetAbsences.fromOn, `${year}-12-31`), gte(timesheetAbsences.toOn, `${year}-01-01`)))
    .orderBy(desc(timesheetAbsences.fromOn));
  const [files, needsPaper] = await Promise.all([filesByAbsence(db, rows.map((r) => r.absence.id)), paperRule(db)]);
  const registered = rows.map((r): AbsenceRowDto => ({ ...toDto(r.absence, files.get(r.absence.id), needsPaper(r.absence.reason)), source: 'absence', employeeId: r.absence.employeeId, employeeCode: r.employeeCode, fullName: r.fullName, batch: r.absence.batchId ? { id: r.absence.batchId, name: r.batchName ?? '' } : null }));
  const typed = await sheetLeaveOfYear(db, year, registered);
  return [...registered, ...typed].sort((a, b) => b.from.localeCompare(a.from));
}

// Kinds

export async function listAbsenceKinds(db: Db): Promise<AbsenceKindDto[]> {
  const [own, settings] = await Promise.all([
    db.select().from(timesheetAbsenceKinds).orderBy(asc(timesheetAbsenceKinds.name)),
    db.select().from(timesheetReasonSettings),
  ]);
  const chosen = new Map<string, boolean>(settings.map((s) => [s.reasonKey, s.needsPaper]));
  return [
    ...ABSENCE_REASONS.map((r) => ({ key: r.key as string, name: r.label as string, code: r.code as AttendanceCode, days: r.days as number | null, isOwn: false, needsPaper: chosen.get(r.key) ?? needsPaperByDefault(r.key) })),
    ...own.map((k) => ({ key: k.id, name: k.name, code: k.code, days: k.days, isOwn: true, needsPaper: k.needsPaper })),
  ];
}

/** Whether a reason asks for papers now: the switch in Cấu hình, read when the list is shown. */
async function paperRule(db: Db): Promise<(reason: string) => boolean> {
  const asking = new Set((await listAbsenceKinds(db)).filter((k) => k.needsPaper).map((k) => k.key));
  return (reason) => asking.has(reason);
}

/** Turns "Cần giấy tờ" on or off for a reason in the law or one HR added. */
export async function setNeedsPaper(db: Db, key: string, raw: unknown, hr: HrMe, now: Date): Promise<AbsenceKindDto[]> {
  const kind = (await listAbsenceKinds(db)).find((k) => k.key === key);
  if (!kind) throw notFound('Không tìm thấy loại nghỉ.');
  const parsed = needsPaperSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chọn có hoặc không.', fieldErrors(parsed.error));
  const { needsPaper } = parsed.data;
  if (kind.isOwn) {
    await db.update(timesheetAbsenceKinds).set({ needsPaper }).where(eq(timesheetAbsenceKinds.id, key));
  } else {
    const row = { reasonKey: key as AbsenceReasonKey, needsPaper, updatedBy: actorOf(hr), updatedAt: now };
    await db.insert(timesheetReasonSettings).values(row).onConflictDoUpdate({ target: timesheetReasonSettings.reasonKey, set: row });
  }
  await logChange(db, hr, 'Sửa loại nghỉ', `${kind.name}: ${needsPaper ? 'cần giấy tờ' : 'không cần giấy tờ'}`, now);
  return listAbsenceKinds(db);
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
  if (!isUuid(key)) throw notFound('Không tìm thấy loại nghỉ.');
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
  if (!isUuid(key)) throw notFound('Không tìm thấy loại nghỉ.');
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

/** A name new to the list joins it, and the log says so. */
export async function rememberApprover(db: Db, hr: HrMe, name: string | null, now: Date) {
  if (!name) return;
  const added = await db.insert(timesheetApprovers).values({ name }).onConflictDoNothing().returning();
  if (added.length > 0) await logChange(db, hr, 'Thêm người duyệt', name, now);
}

export async function addApprover(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<ApproverDto[]> {
  const parsed = approverSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại người duyệt.', fieldErrors(parsed.error));
  await rememberApprover(db, hr, parsed.data.name, now);
  return listApprovers(db);
}

/** Lines already approved keep the name they were approved under. */
export async function removeApprover(db: Db, id: string, hr: HrMe, now: Date): Promise<ApproverDto[]> {
  if (!isUuid(id)) throw notFound('Không tìm thấy người duyệt.');
  const found = await db.query.timesheetApprovers.findFirst({ where: eq(timesheetApprovers.id, id) });
  // HR approves what HR types on the sheet, so it always stays on the list.
  if (found && found.name.toLowerCase() === SHEET_APPROVER.toLowerCase()) {
    throw new HttpError(409, `"${SHEET_APPROVER}" luôn có trong danh sách người duyệt, không xoá được.`, {}, 'approver_kept');
  }
  const [row] = await db.delete(timesheetApprovers).where(eq(timesheetApprovers.id, id)).returning();
  if (!row) throw notFound('Không tìm thấy người duyệt.');
  await logChange(db, hr, 'Xoá người duyệt', row.name, now);
  return listApprovers(db);
}

// Checks

export async function requireNoClosedPeriod(db: Db, from: string, to: string) {
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

/** The person's region's working days, the rule the absence form counts with too (workingDayCheck). */
async function workedDayCheck(db: Db, person: Person) {
  return workingDayCheck((await listRegions(db)).find((r) => r.id === person.regionId));
}

/** Working days only (see workedDayCheck). Holidays keep NL, except maternity leave, which runs through them. */
async function daysToFill(db: Db, person: Person, from: string, to: string, runsThroughHolidays: boolean) {
  const holidays = new Set(holidaysInEffect(await listHolidays(db)).map((h) => h.day));
  const isWorked = await workedDayCheck(db, person);
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDay(day)) {
    if (isWorked(day) && isWorkingOn(person, day) && (runsThroughHolidays || !holidays.has(day))) days.push(day);
  }
  return days;
}

type Line = { code: string; from: string; to: string };
type Input = NonNullable<ReturnType<typeof absenceInputSchema.safeParse>['data']>;

/** Days of a person's sheet that carry a code, between two days. */
async function codedCells(db: Db | Tx, employeeId: string, from: string, to: string) {
  const rows = await db.select({ day: timesheetEntries.day, code: timesheetEntries.code }).from(timesheetEntries).where(and(eq(timesheetEntries.employeeId, employeeId), gte(timesheetEntries.day, from), lte(timesheetEntries.day, to)));
  return rows.flatMap((r) => (r.code ? [{ day: r.day, code: r.code }] : []));
}

/** What an absence wrote itself: the days in its dates still carrying its code, once it has written any. */
async function ownCells(db: Db, absence: Absence): Promise<string[]> {
  if (!writesCells(absence)) return [];
  return (await codedCells(db, absence.employeeId, absence.fromOn, absence.toOn)).filter((c) => c.code === absence.code).map((c) => c.day);
}

/**
 * A day HR marked by hand stays HR's: an absence fills around it, and owns only what it wrote itself (or the typed line it
 * takes over). A hand day with the absence's own code would be read as the absence's later, so it is refused instead.
 */
async function daysFreeOfHandEntries(db: Db, person: Person, range: { from: string; to: string }, code: string, owned: readonly string[]): Promise<string[]> {
  const hand = (await codedCells(db, person.id, range.from, range.to)).filter((c) => !owned.includes(c.day));
  const clash = hand.filter((c) => c.code === code).map((c) => dayWords(c.day));
  if (clash.length > 0) {
    throw new HttpError(409, `${clash.join(', ')} đã chấm ${code} trên bảng công. Dùng "Sửa" trên dòng đó để gộp vào, hoặc chọn ngày khác.`, {}, 'sheet_typed');
  }
  const days = await daysToFill(db, person, range.from, range.to, code === 'TS');
  return days.filter((d) => !hand.some((c) => c.day === d));
}

/** The reason's name and code the input comes to, half a day applied. */
async function kindOf(db: Db, input: Input, current?: Absence) {
  const kind = (await listAbsenceKinds(db)).find((k) => k.key === input.reason);
  // A kind since removed can still be edited, keeping what it said.
  const isKept = !kind && current?.reason === input.reason;
  const baseCode = input.code ?? kind?.code ?? (isKept ? (current.code.replace('/2', '') as AttendanceCode) : null);
  const label = kind?.name ?? (isKept ? current.label : null);
  if (!baseCode || !label) throw invalid('Chọn lý do nghỉ.', { reason: 'Chọn lý do nghỉ.' });
  const halfCode = HALF_OF[baseCode];
  if (input.isHalf && !halfCode) throw invalid('Loại này không nghỉ nửa ngày được.', { reason: 'Loại này không nghỉ nửa ngày được.' });
  return { label, code: input.isHalf && halfCode ? halfCode : baseCode };
}

/** The typed days a takeover gets: the line must still be on the sheet as the list showed it, and HR approved it, so it stays approved. */
async function takenOver(db: Db, employeeId: string, input: Input, approvedBy: string | null, code: AttendanceCode): Promise<string[]> {
  const line = input.replacesSheet;
  if (!line) return [];
  if (!approvedBy && code !== NEEDS_NO_APPROVAL) {
    const message = `Dòng gõ trên bảng công đã được ${SHEET_APPROVER} duyệt: sửa thì giữ người duyệt.`;
    throw invalid(message, { approvedBy: message });
  }
  await requireNoClosedPeriod(db, line.from, line.to);
  const days = await typedLineDays(db, employeeId, line);
  if (!days) throw new HttpError(409, 'Dòng gõ trên bảng công này đã đổi. Tải lại danh sách.', {}, 'sheet_changed');
  return days;
}

/**
 * What the input comes to: the reason's name and code, half a day applied, the days it fills and the typed days it takes
 * over. It may fill no day at all: a company day off leaves such people out, one absence is refused (resolve).
 */
export async function resolveFor(db: Db, person: Person, raw: unknown, current?: Absence) {
  const parsed = absenceInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại đăng ký nghỉ.', fieldErrors(parsed.error));
  const input = parsed.data;
  // Before anything reads the sheet: a closed period, or another absence, says no first.
  await requireNoClosedPeriod(db, input.from, input.to);
  await requireNoOverlap(db, person.id, input.from, input.to, current?.id);
  const { label, code } = await kindOf(db, input, current);
  // Being late is not approved by anyone: no name is kept for it.
  const approvedBy = code === NEEDS_NO_APPROVAL ? null : input.approvedBy || null;
  const taken = current ? [] : await takenOver(db, person.id, input, approvedBy, code);
  const owned = current ? await ownCells(db, current) : taken;
  const fill = await daysFreeOfHandEntries(db, person, input, code, owned);
  return { input, label, code, fill, taken, days: input.isHalf ? 0.5 : fill.length, cellNote: input.note || label, approvedBy };
}

async function resolve(db: Db, person: Person, raw: unknown, current?: Absence) {
  const resolved = await resolveFor(db, person, raw, current);
  if (resolved.fill.length === 0) throw invalid('Khoảng này không có ngày làm việc nào còn trống.', { to: 'Không có ngày làm việc nào còn trống.' });
  return resolved;
}

export type Resolved = Awaited<ReturnType<typeof resolveFor>>;

export async function writeCells(tx: Tx, employeeId: string, r: Resolved, actor: string, now: Date) {
  if (!writesCells(r)) return;
  // A note already on a day stays with that day.
  const noted = await tx.select({ day: timesheetEntries.day, note: timesheetEntries.note }).from(timesheetEntries).where(and(eq(timesheetEntries.employeeId, employeeId), inArray(timesheetEntries.day, r.fill)));
  const noteOn = new Map(noted.map((n) => [n.day, n.note]));
  await tx
    .insert(timesheetEntries)
    .values(r.fill.map((day) => ({ employeeId, day, code: r.code, note: noteOn.get(day) ?? r.cellNote, updatedBy: actor, updatedAt: now })))
    .onConflictDoUpdate({
      target: [timesheetEntries.employeeId, timesheetEntries.day],
      set: { code: sql`excluded.code`, note: sql`excluded.note`, updatedBy: actor, updatedAt: now },
    });
}

/** Only the days still saying what the absence wrote: a day HR changed by hand stays, and so does a note of HR's own. */
export async function eraseCells(tx: Tx, absence: Absence) {
  if (!writesCells(absence)) return;
  const own = and(eq(timesheetEntries.employeeId, absence.employeeId), gte(timesheetEntries.day, absence.fromOn), lte(timesheetEntries.day, absence.toOn), eq(timesheetEntries.code, absence.code));
  const written = absence.note || absence.label;
  await tx.delete(timesheetEntries).where(and(own, eq(timesheetEntries.note, written)));
  await tx.update(timesheetEntries).set({ code: null }).where(own);
}

export const fieldsOf = (r: Resolved) => ({
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

export const rangeWords = (from: string, to: string) => (from === to ? dayWords(from) : `${dayWords(from)}–${dayWords(to)}`);
export const daysWords = (days: number) => String(days).replace('.', ',');
export const whoOf = (person: Person) => `${person.code} ${person.fullName}`;

function changesBetween(before: Absence, after: ReturnType<typeof fieldsOf>): string {
  const pairs: [string, string, string][] = [
    ['Lý do', before.label, after.label],
    ['Cách tính', before.code, after.code],
    ['Ngày', rangeWords(before.fromOn, before.toOn), rangeWords(after.fromOn, after.toOn)],
    ['Số ngày', daysWords(before.days), daysWords(after.days)],
    ['Người duyệt', before.approvedBy ?? 'chưa', after.approvedBy ?? 'chưa'],
    ['Bàn giao', before.handover || 'không', after.handover || 'không'],
    ['Ghi chú', before.note || 'không', after.note || 'không'],
  ];
  return pairs.filter(([, a, b]) => a !== b).map(([what, a, b]) => `${what} ${a} → ${b}`).join('; ') || 'Không đổi';
}

// Writing

async function findPerson(db: Db, id: string): Promise<Person> {
  const person = isUuid(id) ? await db.query.employees.findFirst({ where: eq(employees.id, id) }) : undefined;
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  return person;
}

async function findAbsence(db: Db, employeeId: string, id: string): Promise<Absence> {
  const absence = isUuid(id) ? await db.query.timesheetAbsences.findFirst({ where: and(eq(timesheetAbsences.id, id), eq(timesheetAbsences.employeeId, employeeId)) }) : undefined;
  if (!absence) throw notFound('Không tìm thấy đăng ký nghỉ.');
  return absence;
}

/** A line a company day off wrote is changed with the whole of it, in tab Nghỉ công ty. */
async function requireOwnLine(db: Db, absence: Absence) {
  if (!absence.batchId) return;
  const batch = await db.query.timesheetAbsenceBatches.findFirst({ where: eq(timesheetAbsenceBatches.id, absence.batchId) });
  throw new HttpError(409, `Dòng này thuộc đợt nghỉ công ty "${batch?.name ?? ''}". Sửa ở tab Nghỉ công ty.`, {}, 'in_batch');
}

export async function registerAbsence(db: Db, employeeId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const person = await findPerson(db, employeeId);
  const resolved = await resolve(db, person, raw);
  const line = resolved.input.replacesSheet;
  const actor = actorOf(hr);
  // The typed line becomes this absence: its days outside what the absence fills go, the rest are written over.
  const cleared = resolved.taken.filter((d) => !resolved.fill.includes(d));
  await db.transaction(async (tx) => {
    await clearDays(tx, employeeId, cleared);
    await writeCells(tx, employeeId, resolved, actor, now);
    await tx.insert(timesheetAbsences).values({ employeeId, ...fieldsOf(resolved), createdBy: actor });
  });
  await rememberApprover(db, hr, resolved.approvedBy, now);
  await logRegistered(db, hr, person, resolved, now);
  if (line && cleared.length > 0) await logTypedCleared(db, hr, person, line.code, cleared, now, `thay bằng ${resolved.label}`);
  return listAbsences(db, employeeId);
}

/** One line a person, as HR reads it: who, why, when, how many days and whether it is approved. */
async function logRegistered(db: Db, hr: HrMe, person: Person, resolved: Resolved, now: Date) {
  const { from, to } = resolved.input;
  const state = resolved.code === NEEDS_NO_APPROVAL ? 'đã ghi' : resolved.approvedBy ? `${resolved.approvedBy} duyệt` : 'chờ duyệt';
  await logChange(db, hr, 'Đăng ký nghỉ', `${whoOf(person)}: ${resolved.label}, ${rangeWords(from, to)}, ${daysWords(resolved.days)} ngày, ${state}`, now, { from, to });
}

async function logTypedCleared(db: Db, hr: HrMe, person: Person, code: string, days: readonly string[], now: Date, why: string) {
  const label = ATTENDANCE_LABEL[code as AttendanceCode] ?? code;
  const span = { from: days[0] ?? '', to: days.at(-1) ?? '' };
  await logChange(db, hr, 'Xoá nghỉ gõ trên bảng công', `${whoOf(person)}: ${label}, ${days.map(dayWords).join(', ')}, ${days.length} ô, ${why}`, now, span);
}

/** Days of one code a person has typed on the sheet in a range: none of them written by an absence of that code. */
async function typedDays(db: Db | Tx, employeeId: string, line: Line): Promise<string[]> {
  const [cells, absences] = await Promise.all([
    codedCells(db, employeeId, line.from, line.to),
    db.select().from(timesheetAbsences).where(and(eq(timesheetAbsences.employeeId, employeeId), eq(timesheetAbsences.code, line.code), lte(timesheetAbsences.fromOn, line.to), gte(timesheetAbsences.toOn, line.from))),
  ]);
  const isAbsencesOwn = (day: string) => absences.some((a) => writesCells(a) && a.fromOn <= day && day <= a.toOn);
  return cells.filter((c) => c.code === line.code && !isAbsencesOwn(c.day)).map((c) => c.day);
}

const LINE_REACH = 7;

/** The typed days that form exactly this line, as the list shows it (within one year), or null when the sheet no longer has it. */
async function typedLineDays(db: Db | Tx, employeeId: string, line: Line): Promise<string[] | null> {
  const year = line.from.slice(0, 4);
  const before = addDays(line.from, -LINE_REACH);
  const after = addDays(line.to, LINE_REACH);
  const around = { code: line.code, from: before < `${year}-01-01` ? `${year}-01-01` : before, to: after > `${year}-12-31` ? `${year}-12-31` : after };
  const days = await typedDays(db, employeeId, around);
  const lines = sheetLines(days.map((day) => ({ employeeId, day, code: line.code, note: null, updatedBy: '' })));
  return lines.some((l) => l.from === line.from && l.to === line.to) ? days.filter((d) => d >= line.from && d <= line.to) : null;
}

async function clearDays(tx: Tx, employeeId: string, days: readonly string[]) {
  if (days.length > 0) await tx.delete(timesheetEntries).where(and(eq(timesheetEntries.employeeId, employeeId), inArray(timesheetEntries.day, [...days])));
}

/** "Xoá" on a line typed on the sheet: its days go back to empty, as if never typed. Not in a closed period. */
export async function removeSheetLeave(db: Db, employeeId: string, raw: unknown, hr: HrMe, now: Date): Promise<{ removed: number }> {
  const person = await findPerson(db, employeeId);
  const parsed = sheetLeaveSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dòng này không hợp lệ.', fieldErrors(parsed.error));
  const line = parsed.data;
  await requireNoClosedPeriod(db, line.from, line.to);
  const removed = await db.transaction(async (tx) => {
    const days = (await typedLineDays(tx, employeeId, line)) ?? [];
    await clearDays(tx, employeeId, days);
    return days;
  });
  if (removed.length === 0) throw notFound('Các ô này đã đổi trên bảng công. Tải lại danh sách.');
  const label = ATTENDANCE_LABEL[line.code as AttendanceCode] ?? line.code;
  await logChange(db, hr, 'Xoá nghỉ gõ trên bảng công', `${whoOf(person)}: ${label}, ${rangeWords(line.from, line.to)}, ${removed.length} ô`, now, line);
  return { removed: removed.length };
}

export async function updateAbsence(db: Db, employeeId: string, absenceId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const person = await findPerson(db, employeeId);
  const current = await findAbsence(db, employeeId, absenceId);
  await requireOwnLine(db, current);
  await requireNoClosedPeriod(db, current.fromOn, current.toOn);
  const resolved = await resolve(db, person, raw, current);
  const { from, to } = resolved.input;
  const fields = fieldsOf(resolved);
  await db.transaction(async (tx) => {
    await eraseCells(tx, current);
    await writeCells(tx, employeeId, resolved, actorOf(hr), now);
    await tx.update(timesheetAbsences).set(fields).where(eq(timesheetAbsences.id, absenceId));
  });
  await rememberApprover(db, hr, resolved.approvedBy, now);
  const span = { from: from < current.fromOn ? from : current.fromOn, to: to > current.toOn ? to : current.toOn };
  await logChange(db, hr, 'Sửa đăng ký nghỉ', `${whoOf(person)}: ${changesBetween(current, fields)}`, now, span);
  return listAbsences(db, employeeId);
}

export async function removeAbsence(db: Db, employeeId: string, absenceId: string, hr: HrMe, now: Date): Promise<TimesheetAbsenceDto[]> {
  const person = await findPerson(db, employeeId);
  const absence = await findAbsence(db, employeeId, absenceId);
  await requireOwnLine(db, absence);
  await requireNoClosedPeriod(db, absence.fromOn, absence.toOn);
  await db.transaction(async (tx) => {
    await eraseCells(tx, absence);
    await tx.delete(timesheetAbsences).where(eq(timesheetAbsences.id, absenceId));
  });
  await logChange(db, hr, 'Huỷ đăng ký nghỉ', `${whoOf(person)}: ${absence.label}, ${rangeWords(absence.fromOn, absence.toOn)}`, now, { from: absence.fromOn, to: absence.toOn });
  return listAbsences(db, employeeId);
}

// Leave balance

const NOTHING_ADDED: ReadonlyMap<string, AttendanceCode> = new Map();
/** Leave planned more than a year ahead is not looked at period by period. */
const MAX_PERIODS = 14;

/** A row's totals as the sheet counts them, with days not saved yet laid on its empty days and its opening moved. */
export function rowTotals(sheet: TimesheetDto, row: TimesheetRowDto, added: ReadonlyMap<string, AttendanceCode> = NOTHING_ADDED, openingShift = 0): TimesheetTotals {
  if (row.frozenTotals) return row.frozenTotals;
  const holidays = new Set(sheet.holidays.map((h) => h.day));
  const codes = periodDays(sheet).map((day) => dayCode({ day, entered: row.cells[day]?.entered ?? added.get(day) ?? null, isHoliday: holidays.has(day), today: sheet.today, joinedOn: row.joinedOn, leftOn: row.leftOn }));
  return timesheetTotals({
    codes,
    norm: row.norm,
    leaveOpening: row.leaveOpening + openingShift,
    employment: row.employment,
    rule: sheet.rule,
    adjustment: row.adjustments.reduce((sum, a) => sum + a.amount, 0),
    leaveChange: row.leaveChanges.reduce((sum, c) => sum + c.amount, 0),
    ...row.leaveSoFar,
  });
}

/** Period by period, as it stands and with the absence added: what each closes on, and the leave taken beyond the balance. */
function leaveRun(sheets: readonly TimesheetDto[], employeeId: string, added: ReadonlyMap<string, AttendanceCode>) {
  let shift = 0;
  let overdrawn = 0;
  const steps: ({ plain: TimesheetTotals; added: TimesheetTotals } | null)[] = [];
  for (const sheet of sheets) {
    const row = sheet.rows.find((r) => r.employeeId === employeeId);
    if (!row) {
      steps.push(null);
      continue;
    }
    const plain = rowTotals(sheet, row, NOTHING_ADDED, 0);
    const withAbsence = rowTotals(sheet, row, added, shift);
    shift = withAbsence.leaveClosing - plain.leaveClosing;
    overdrawn += withAbsence.leaveOverdrawn - plain.leaveOverdrawn;
    steps.push({ plain, added: withAbsence });
  }
  return { steps, overdrawn };
}

const monthKeyOf = (m: { year: number; month: number }) => m.year * 12 + m.month;

/** The periods from the one holding `first` to the one holding `last`. */
function periodsSpanning(first: string, last: string) {
  const end = monthKeyOf(periodMonthOf(last));
  const months: { year: number; month: number }[] = [];
  for (let m = periodMonthOf(first); monthKeyOf(m) <= end && months.length < MAX_PERIODS; m = m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 }) months.push(m);
  return months;
}

/** The days the absence would fill: working days of the person's region, not a holiday, nothing on the sheet yet. */
async function daysItWouldFill(db: Db, person: Person, from: string, to: string, code: AttendanceCode) {
  const coded = new Set((await codedCells(db, person.id, from, to)).map((c) => c.day));
  return (await daysToFill(db, person, from, code.endsWith('/2') ? from : to, code === 'TS')).filter((d) => !coded.has(d));
}

/**
 * Leave left today, as the sheet of the period running today counts it, and after the absence about to be saved, counted
 * the same way through every period from today's to the one it ends in. Taken beyond the balance, it is unpaid.
 */
export async function leaveBalanceFor(db: Db, employeeId: string, query: Record<string, string>, now: Date): Promise<LeaveBalanceDto> {
  const person = await findPerson(db, employeeId);
  const parsed = leaveBalanceQuerySchema.safeParse(query);
  if (!parsed.success) throw invalid('Kiểm tra lại ngày nghỉ.', fieldErrors(parsed.error));
  const { from, to, code } = parsed.data;
  const today = todayInVietnam(now);
  const added = new Map((await daysItWouldFill(db, person, from, to, code)).map((d) => [d, code]));
  const months = periodsSpanning(from < today ? from : today, to > today ? to : today);
  const sheets: TimesheetDto[] = [];
  for (const m of months) sheets.push(await getTimesheet(db, m.year, m.month, now));
  const { steps, overdrawn } = leaveRun(sheets, person.id, added);
  const current = monthKeyOf(periodMonthOf(today));
  const leftToday = steps[months.findIndex((m) => monthKeyOf(m) === current)]?.plain.leaveClosing ?? person.openingLeave;
  const last = steps.filter((s) => s !== null).at(-1);
  return { now: leftToday, after: (last?.added.leaveClosing ?? leftToday) - overdrawn, overdrawn };
}

// Holidays

/** What a change of holidays means for absences: a day that became a holiday is no longer charged, and the other way round. */
export async function withHolidaysApplied<T>(db: Db, hr: HrMe, now: Date, change: () => Promise<T>): Promise<T> {
  const before = new Set(holidaysInEffect(await listHolidays(db)).map((h) => h.day));
  const result = await change();
  const after = new Set(holidaysInEffect(await listHolidays(db)).map((h) => h.day));
  const added = [...after].filter((d) => !before.has(d));
  const removed = [...before].filter((d) => !after.has(d));
  for (const day of [...added, ...removed]) await applyHolidayChange(db, day, after.has(day), hr, now);
  return result;
}

async function applyHolidayChange(db: Db, day: string, isHoliday: boolean, hr: HrMe, now: Date) {
  const closed = await db.query.timesheetPeriods.findFirst({ where: and(eq(timesheetPeriods.status, 'closed'), lte(timesheetPeriods.fromOn, day), gte(timesheetPeriods.toOn, day)) });
  if (closed) return;
  const covering = await db.select().from(timesheetAbsences).where(and(lte(timesheetAbsences.fromOn, day), gte(timesheetAbsences.toOn, day)));
  for (const absence of covering.filter((a) => a.code !== 'TS' && a.code !== NEEDS_NO_APPROVAL)) {
    const person = await findPerson(db, absence.employeeId);
    if (!(await workedDayCheck(db, person))(day) || !isWorkingOn(person, day)) continue;
    const isApproved = !!absence.approvedBy;
    const moved = await db.transaction(async (tx) => {
      const where = and(eq(timesheetEntries.employeeId, absence.employeeId), eq(timesheetEntries.day, day));
      if (isHoliday) return isApproved ? (await tx.delete(timesheetEntries).where(and(where, eq(timesheetEntries.code, absence.code))).returning()).length > 0 : true;
      if (!isApproved) return true;
      const [existing] = await tx.select().from(timesheetEntries).where(where);
      if (existing?.code) return false;
      await tx.insert(timesheetEntries).values({ employeeId: absence.employeeId, day, code: absence.code, note: absence.note || absence.label, updatedBy: actorOf(hr), updatedAt: now })
        .onConflictDoUpdate({ target: [timesheetEntries.employeeId, timesheetEntries.day], set: { code: absence.code, updatedBy: actorOf(hr), updatedAt: now } });
      return true;
    });
    if (!moved) continue;
    const days = Math.max(0, absence.days + (isHoliday ? -1 : 1) * (absence.code.endsWith('/2') ? 0.5 : 1));
    await db.update(timesheetAbsences).set({ days }).where(eq(timesheetAbsences.id, absence.id));
    await logChange(db, hr, 'Sửa đăng ký nghỉ', `${person.code} ${person.fullName}: ${absence.label}, ${dayWords(day)} ${isHoliday ? 'thành ngày lễ, không tính nghỉ' : 'không còn là ngày lễ, tính nghỉ lại'}`, now, { from: day, to: day });
  }
}
