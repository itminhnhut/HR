import {
  dayCode,
  daysBetweenInclusive,
  DEFAULT_LEAVE_RULE,
  fieldErrors,
  isWorkingOn,
  periodDays,
  periodMonthOf,
  standardPeriod,
  suggestedNorm,
  timesheetAdjustmentSchema,
  timesheetCellsSchema,
  timesheetNormsSchema,
  timesheetReopenSchema,
  timesheetTotals,
  TIMESHEET_MAX_DAYS,
  todayInVietnam,
  type AttendanceCode,
  type StaffType,
  type HrMe,
  type TimesheetDto,
  type TimesheetLogDto,
  type TimesheetRowDto,
} from '@careers/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  employees,
  timesheetAdjustments,
  timesheetEntries,
  timesheetLog,
  timesheetPeriods,
  timesheetSnapshots,
} from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { listHolidays, listRegions } from './timesheet-people.js';

/** Bảng chấm công (spec-cham-cong.md): reading, entering, closing. The arithmetic is in @careers/shared. */

type Period = typeof timesheetPeriods.$inferSelect;
type Employee = typeof employees.$inferSelect;


/** The log is read by HR: dates and numbers as they appear in the Excel sheet. */
const dayWords = (iso: string) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');
const numberWords = (n: number) => String(n).replace('.', ',');
const actor = (hr: HrMe) => hr.name || hr.email;
const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Someone who became official by the last day counts as official for the whole period. */
const employmentOn = (e: Pick<Employee, 'employment' | 'officialOn'>, lastDay: string): StaffType =>
  e.officialOn && e.officialOn <= lastDay ? 'official' : e.employment;

async function ensurePeriod(db: Db, year: number, month: number): Promise<Period> {
  const { from, to } = standardPeriod(year, month);
  const regions = await listRegions(db);
  const norms = Object.fromEntries(regions.map((r) => [r.id, suggestedNorm({ from, to }, r.saturdays)]));
  await db
    .insert(timesheetPeriods)
    .values({ year, month, fromOn: from, toOn: to, norms })
    .onConflictDoNothing();
  const period = await db.query.timesheetPeriods.findFirst({
    where: and(eq(timesheetPeriods.year, year), eq(timesheetPeriods.month, month)),
  });
  if (!period) throw new Error('Period missing after insert');
  return period;
}

async function findPeriod(db: Db, id: string): Promise<Period> {
  const period = await db.query.timesheetPeriods.findFirst({ where: eq(timesheetPeriods.id, id) });
  if (!period) throw notFound('Không tìm thấy kỳ công.');
  return period;
}

function requireOpen(period: Period) {
  if (period.status !== 'open') throw new HttpError(409, 'Kỳ công đã chốt. Mở lại kỳ để sửa.', {}, 'period_closed');
}

/** Each person's balance: what the last closed period before this one ended with, else what HR entered at the start. */
async function openingBalances(db: Db, fromOn: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ employeeId: timesheetSnapshots.employeeId, closing: timesheetSnapshots.leaveClosing })
    .from(timesheetSnapshots)
    .innerJoin(timesheetPeriods, eq(timesheetPeriods.id, timesheetSnapshots.periodId))
    .where(lt(timesheetPeriods.toOn, fromOn))
    .orderBy(asc(timesheetPeriods.toOn));
  return new Map(rows.map((r) => [r.employeeId, r.closing]));
}

async function adjustmentsFor(db: Db, ids: string[], key: string) {
  if (ids.length === 0) return new Map<string, TimesheetRowDto['adjustments']>();
  const rows = await db
    .select()
    .from(timesheetAdjustments)
    .where(
      and(
        inArray(timesheetAdjustments.employeeId, ids),
        lte(timesheetAdjustments.fromPeriod, key),
        or(isNull(timesheetAdjustments.toPeriod), gte(timesheetAdjustments.toPeriod, key)),
      ),
    )
    .orderBy(asc(timesheetAdjustments.createdAt));
  const out = new Map<string, TimesheetRowDto['adjustments']>();
  for (const a of rows) {
    const list = out.get(a.employeeId) ?? [];
    list.push({ id: a.id, amount: a.amount, reason: a.reason, isRecurring: a.toPeriod === null, createdBy: a.createdBy });
    out.set(a.employeeId, list);
  }
  return out;
}

async function cellsFor(db: Db, ids: string[], from: string, to: string) {
  const out = new Map<string, TimesheetRowDto['cells']>();
  if (ids.length === 0) return out;
  const rows = await db
    .select()
    .from(timesheetEntries)
    .where(and(inArray(timesheetEntries.employeeId, ids), gte(timesheetEntries.day, from), lte(timesheetEntries.day, to)));
  for (const r of rows) {
    const cells = out.get(r.employeeId) ?? {};
    cells[r.day] = { entered: r.code as AttendanceCode | null, note: r.note };
    out.set(r.employeeId, cells);
  }
  return out;
}

const workingInRange = (from: string, to: string) =>
  and(or(isNull(employees.joinedOn), lte(employees.joinedOn, to)), or(isNull(employees.leftOn), gte(employees.leftOn, from)));

async function liveRows(db: Db, period: Period): Promise<TimesheetRowDto[]> {
  const people = await db.select().from(employees).where(workingInRange(period.fromOn, period.toOn)).orderBy(asc(employees.code));
  const ids = people.map((p) => p.id);
  const [opening, cells, adjustments, regions] = await Promise.all([
    openingBalances(db, period.fromOn),
    cellsFor(db, ids, period.fromOn, period.toOn),
    adjustmentsFor(db, ids, monthKey(period.year, period.month)),
    listRegions(db),
  ]);
  const range = { from: period.fromOn, to: period.toOn };
  return people.map((p) => ({
    employeeId: p.id,
    code: p.code,
    fullName: p.fullName,
    department: p.department,
    title: p.title,
    regionId: p.regionId,
    employment: employmentOn(p, period.toOn),
    joinedOn: p.joinedOn,
    leftOn: p.leftOn,
    leaveOpening: opening.get(p.id) ?? p.openingLeave,
    norm: period.norms[p.regionId] ?? suggestedNorm(range, regions.find((r) => r.id === p.regionId)?.saturdays ?? 0),
    cells: cells.get(p.id) ?? {},
    adjustments: adjustments.get(p.id) ?? [],
  }));
}

/** A closed period reads what it said when it closed, whatever happened to the person since. */
async function closedRows(db: Db, period: Period): Promise<TimesheetRowDto[]> {
  const rows = await db.select().from(timesheetSnapshots).where(eq(timesheetSnapshots.periodId, period.id)).orderBy(asc(timesheetSnapshots.code));
  const ids = rows.map((r) => r.employeeId);
  const [cells, adjustments] = await Promise.all([
    cellsFor(db, ids, period.fromOn, period.toOn),
    adjustmentsFor(db, ids, monthKey(period.year, period.month)),
  ]);
  return rows.map((r) => ({
    employeeId: r.employeeId,
    code: r.code,
    fullName: r.fullName,
    department: r.department,
    title: r.title,
    regionId: r.regionId,
    employment: r.employment,
    joinedOn: r.joinedOn,
    leftOn: r.leftOn,
    leaveOpening: r.leaveOpening,
    norm: r.norm,
    cells: cells.get(r.employeeId) ?? {},
    adjustments: adjustments.get(r.employeeId) ?? [],
  }));
}

async function latestClosed(db: Db) {
  return db.query.timesheetPeriods.findFirst({
    where: eq(timesheetPeriods.status, 'closed'),
    orderBy: desc(timesheetPeriods.toOn),
  });
}

async function toDto(db: Db, period: Period, now: Date): Promise<TimesheetDto> {
  const [regions, holidays, rows, latest] = await Promise.all([
    listRegions(db),
    listHolidays(db),
    period.status === 'closed' ? closedRows(db, period) : liveRows(db, period),
    latestClosed(db),
  ]);
  return {
    periodId: period.id,
    year: period.year,
    month: period.month,
    from: period.fromOn,
    to: period.toOn,
    status: period.status,
    closedAt: period.closedAt?.toISOString() ?? null,
    closedBy: period.closedBy,
    canReopen: period.status === 'closed' && latest?.id === period.id,
    norms: period.norms,
    rule: { threshold: period.leaveThreshold, perPeriod: period.leavePerPeriod },
    today: todayInVietnam(now),
    regions,
    holidays: holidays.filter((h) => h.day >= period.fromOn && h.day <= period.toOn),
    rows,
  };
}

export async function getTimesheet(db: Db, year: number, month: number, now: Date): Promise<TimesheetDto> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    throw invalid('Tháng không hợp lệ.');
  }
  return toDto(db, await ensurePeriod(db, year, month), now);
}

/** Any days up to a month: to read and download. Entering and closing belong to the 26–25 periods. */
export async function getTimesheetRange(db: Db, from: string, to: string, now: Date): Promise<TimesheetDto> {
  const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!isDay(from) || !isDay(to) || from > to) throw invalid('Khoảng ngày không hợp lệ.');
  if (daysBetweenInclusive(from, to) > TIMESHEET_MAX_DAYS) throw invalid(`Tối đa ${TIMESHEET_MAX_DAYS} ngày.`);
  const { year, month } = periodMonthOf(to);
  const [people, regions, holidays] = await Promise.all([
    db.select().from(employees).where(workingInRange(from, to)).orderBy(asc(employees.code)),
    listRegions(db),
    listHolidays(db),
  ]);
  const ids = people.map((p) => p.id);
  const [cells, adjustments] = await Promise.all([cellsFor(db, ids, from, to), adjustmentsFor(db, ids, monthKey(year, month))]);
  return {
    periodId: null,
    year,
    month,
    from,
    to,
    status: 'open',
    closedAt: null,
    closedBy: null,
    canReopen: false,
    norms: Object.fromEntries(regions.map((r) => [r.id, suggestedNorm({ from, to }, r.saturdays)])),
    rule: DEFAULT_LEAVE_RULE,
    today: todayInVietnam(now),
    regions,
    holidays: holidays.filter((h) => h.day >= from && h.day <= to),
    rows: people.map((p) => ({
      employeeId: p.id,
      code: p.code,
      fullName: p.fullName,
      department: p.department,
      title: p.title,
      regionId: p.regionId,
      employment: employmentOn(p, to),
      joinedOn: p.joinedOn,
      leftOn: p.leftOn,
      leaveOpening: 0,
      norm: suggestedNorm({ from, to }, regions.find((r) => r.id === p.regionId)?.saturdays ?? 0),
      cells: cells.get(p.id) ?? {},
      adjustments: adjustments.get(p.id) ?? [],
    })),
  };
}

const describeCode = (code: string | null | undefined) => code ?? 'tự động';

export async function saveCells(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const parsed = timesheetCellsSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại ô chấm công.', fieldErrors(parsed.error));
  const { cells } = parsed.data;
  const ids = [...new Set(cells.map((c) => c.employeeId))];
  const people = await db.select().from(employees).where(inArray(employees.id, ids));
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const cell of cells) {
    const person = byId.get(cell.employeeId);
    if (!person) throw notFound('Không tìm thấy nhân viên.');
    if (cell.day < period.fromOn || cell.day > period.toOn) throw invalid('Ngày này không thuộc kỳ công.');
    if (!isWorkingOn(person, cell.day)) throw invalid(`${person.fullName} không làm việc ngày ${cell.day}.`);
  }
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(timesheetEntries)
      .where(and(inArray(timesheetEntries.employeeId, ids), gte(timesheetEntries.day, period.fromOn), lte(timesheetEntries.day, period.toOn)));
    const current = new Map(existing.map((e) => [`${e.employeeId}|${e.day}`, e]));
    const lines: (typeof timesheetLog.$inferInsert)[] = [];
    for (const cell of cells) {
      const key = `${cell.employeeId}|${cell.day}`;
      const before = current.get(key);
      const code = cell.code === undefined ? (before?.code ?? null) : cell.code;
      const note = cell.note === undefined ? (before?.note ?? null) : cell.note || null;
      if (code === (before?.code ?? null) && note === (before?.note ?? null)) continue;
      const where = and(eq(timesheetEntries.employeeId, cell.employeeId), eq(timesheetEntries.day, cell.day));
      if (code === null && note === null) await tx.delete(timesheetEntries).where(where);
      else {
        await tx
          .insert(timesheetEntries)
          .values({ employeeId: cell.employeeId, day: cell.day, code, note, updatedBy: actor(hr), updatedAt: now })
          .onConflictDoUpdate({
            target: [timesheetEntries.employeeId, timesheetEntries.day],
            set: { code, note, updatedBy: actor(hr), updatedAt: now },
          });
      }
      const person = byId.get(cell.employeeId);
      const changes = [
        code !== (before?.code ?? null) ? `${describeCode(before?.code)} → ${describeCode(code)}` : null,
        note !== (before?.note ?? null) ? `ghi chú: ${note ?? 'đã xoá'}` : null,
      ].filter(Boolean);
      lines.push({ periodId, actor: actor(hr), action: 'Chấm công', detail: `${person?.code} ${person?.fullName}, ${dayWords(cell.day)}: ${changes.join('; ')}`, at: now });
    }
    if (lines.length > 0) await tx.insert(timesheetLog).values(lines);
  });
  return toDto(db, period, now);
}

export async function saveNorms(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const parsed = timesheetNormsSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Định mức không hợp lệ.', fieldErrors(parsed.error));
  const norms = { ...period.norms, ...parsed.data.norms };
  const [row] = await db.update(timesheetPeriods).set({ norms }).where(eq(timesheetPeriods.id, periodId)).returning();
  if (!row) throw notFound('Không tìm thấy kỳ công.');
  const regions = await listRegions(db);
  const words = Object.entries(parsed.data.norms).map(([id, n]) => `${regions.find((r) => r.id === id)?.name ?? id}: ${numberWords(n)}`).join(', ');
  await db.insert(timesheetLog).values({ periodId, actor: actor(hr), action: 'Sửa định mức', detail: words, at: now });
  return toDto(db, row, now);
}

export async function addAdjustment(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const parsed = timesheetAdjustmentSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại điều chỉnh công.', fieldErrors(parsed.error));
  const { employeeId, amount, reason, isRecurring } = parsed.data;
  const person = await db.query.employees.findFirst({ where: eq(employees.id, employeeId) });
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  const key = monthKey(period.year, period.month);
  await db.insert(timesheetAdjustments).values({ employeeId, amount, reason, fromPeriod: key, toPeriod: isRecurring ? null : key, createdBy: actor(hr) });
  await db.insert(timesheetLog).values({ periodId, actor: actor(hr), action: 'Điều chỉnh công', detail: `${person.code} ${person.fullName}: ${numberWords(amount)} công, ${isRecurring ? 'mỗi kỳ' : 'chỉ kỳ này'} (${reason})`, at: now });
  return toDto(db, period, now);
}

/** A recurring one stops from this period; closed periods before it keep theirs. */
export async function removeAdjustment(db: Db, periodId: string, adjustmentId: string, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const row = await db.query.timesheetAdjustments.findFirst({ where: eq(timesheetAdjustments.id, adjustmentId) });
  if (!row) throw notFound('Không tìm thấy điều chỉnh.');
  const key = monthKey(period.year, period.month);
  if (row.fromPeriod >= key) await db.delete(timesheetAdjustments).where(eq(timesheetAdjustments.id, adjustmentId));
  else {
    const previous = period.month === 1 ? monthKey(period.year - 1, 12) : monthKey(period.year, period.month - 1);
    await db.update(timesheetAdjustments).set({ toPeriod: previous }).where(eq(timesheetAdjustments.id, adjustmentId));
  }
  await db.insert(timesheetLog).values({ periodId, actor: actor(hr), action: 'Bỏ điều chỉnh công', detail: `${numberWords(row.amount)} công (${row.reason})`, at: now });
  return toDto(db, period, now);
}

export async function closePeriod(db: Db, periodId: string, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const earlier = await db.query.timesheetPeriods.findFirst({
    where: and(eq(timesheetPeriods.status, 'open'), lt(timesheetPeriods.toOn, period.fromOn)),
    orderBy: asc(timesheetPeriods.toOn),
  });
  if (earlier) throw new HttpError(409, `Chốt kỳ tháng ${earlier.month}/${earlier.year} trước, vì phép của kỳ này tính tiếp từ kỳ đó.`, {}, 'earlier_open');
  if (todayInVietnam(now) < period.toOn) throw new HttpError(409, `Kỳ chưa hết, chốt được từ ngày ${dayWords(period.toOn)}.`, {}, 'period_running');
  const dto = await toDto(db, period, now);
  const holidays = new Set(dto.holidays.map((h) => h.day));
  const days = periodDays({ from: period.fromOn, to: period.toOn });
  const snapshots = dto.rows.map((row) => {
    const codes = days.map((day) => dayCode({ day, entered: row.cells[day]?.entered ?? null, isHoliday: holidays.has(day), today: dto.today, joinedOn: row.joinedOn, leftOn: row.leftOn }));
    const { leaveClosing } = timesheetTotals({ codes, norm: row.norm, leaveOpening: row.leaveOpening, employment: row.employment, rule: dto.rule });
    return { periodId, employeeId: row.employeeId, code: row.code, fullName: row.fullName, department: row.department, title: row.title, regionId: row.regionId, employment: row.employment, joinedOn: row.joinedOn, leftOn: row.leftOn, norm: row.norm, leaveOpening: row.leaveOpening, leaveClosing };
  });
  const updated = await db.transaction(async (tx) => {
    if (snapshots.length > 0) await tx.insert(timesheetSnapshots).values(snapshots);
    const [row] = await tx.update(timesheetPeriods).set({ status: 'closed', closedAt: now, closedBy: actor(hr) }).where(eq(timesheetPeriods.id, periodId)).returning();
    await tx.insert(timesheetLog).values({ periodId, actor: actor(hr), action: 'Chốt kỳ', detail: `Tháng ${period.month}/${period.year}`, at: now });
    return row;
  });
  if (!updated) throw notFound('Không tìm thấy kỳ công.');
  return toDto(db, updated, now);
}

/** Only the latest closed period: reopening an older one would change the balances the later ones started from. */
export async function reopenPeriod(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  if (period.status !== 'closed') throw new HttpError(409, 'Kỳ công đang mở.');
  const parsed = timesheetReopenSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Nhập lý do mở lại.', fieldErrors(parsed.error));
  const latest = await latestClosed(db);
  if (latest?.id !== period.id) throw new HttpError(409, 'Chỉ mở lại được kỳ chốt gần nhất. Sai ở kỳ cũ thì điều chỉnh ở kỳ hiện tại.', {}, 'not_latest');
  const updated = await db.transaction(async (tx) => {
    await tx.delete(timesheetSnapshots).where(eq(timesheetSnapshots.periodId, periodId));
    const [row] = await tx.update(timesheetPeriods).set({ status: 'open', closedAt: null, closedBy: null }).where(eq(timesheetPeriods.id, periodId)).returning();
    await tx.insert(timesheetLog).values({ periodId, actor: actor(hr), action: 'Mở lại kỳ', detail: parsed.data.reason, at: now });
    return row;
  });
  if (!updated) throw notFound('Không tìm thấy kỳ công.');
  return toDto(db, updated, now);
}

export async function periodLog(db: Db, periodId: string): Promise<TimesheetLogDto[]> {
  const rows = await db.select().from(timesheetLog).where(eq(timesheetLog.periodId, periodId)).orderBy(desc(timesheetLog.at)).limit(300);
  return rows.map((r) => ({ id: r.id, actor: r.actor, action: r.action, detail: r.detail, at: r.at.toISOString() }));
}
