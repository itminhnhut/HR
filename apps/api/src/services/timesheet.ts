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
  type LeaveRule,
  LEAVE_MODES,
  type StaffType,
  type HrMe,
  type TimesheetDto,
  holidaysInEffect,
  restDayWork,
  leaveChangeSchema,
  saturdaysFor,
  monthStatus,
  type TimesheetLeaveChangeDto,
  employmentOn,
  staffLabelOf,
  type StaffKindDto,
  type TimesheetLogDto,
  type TimesheetTotals,
  type TimesheetMonthDto,
  type TimesheetRegionDto,
  type TimesheetRowDto,
} from '@careers/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  employees,
  timesheetAdjustments,
  timesheetEntries,
  timesheetLeaveChanges,
  timesheetLog,
  timesheetPeriods,
  timesheetSnapshots,
} from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { actorOf, dayWords, listHolidays, listRegions, listStaffKinds } from './timesheet-people.js';

/** Bảng chấm công (spec-cham-cong.md): reading, entering, closing. The arithmetic is in @careers/shared. */

type Period = typeof timesheetPeriods.$inferSelect;
type Employee = typeof employees.$inferSelect;
type Snapshot = typeof timesheetSnapshots.$inferSelect;



/** The log is read by HR: numbers as they appear in the Excel sheet. */
const numberWords = (n: number) => String(n).replace('.', ',');
const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

async function ensurePeriod(db: Db, year: number, month: number): Promise<Period> {
  const { from, to } = standardPeriod(year, month);
  const regions = await listRegions(db);
  const norms = Object.fromEntries(regions.map((r) => [r.id, suggestedNorm({ from, to }, saturdaysFor(r, monthKey(year, month)))]));
  const previous = await db.query.timesheetPeriods.findFirst({ orderBy: desc(timesheetPeriods.fromOn) });
  await db
    .insert(timesheetPeriods)
    .values({ year, month, fromOn: from, toOn: to, norms, ...(previous ? { leaveMode: previous.leaveMode } : {}) })
    .onConflictDoNothing();
  const period = await db.query.timesheetPeriods.findFirst({
    where: and(eq(timesheetPeriods.year, year), eq(timesheetPeriods.month, month)),
  });
  if (!period) throw new Error('Period missing after insert');
  return period;
}

async function findPeriod(db: Db, id: string): Promise<Period> {
  if (!isUuid(id)) throw notFound('Không tìm thấy kỳ công.');
  const period = await db.query.timesheetPeriods.findFirst({ where: eq(timesheetPeriods.id, id) });
  if (!period) throw notFound('Không tìm thấy kỳ công.');
  return period;
}

function requireOpen(period: Period) {
  if (period.status !== 'open') throw new HttpError(409, 'Kỳ công đã chốt. Mở lại kỳ để sửa.', {}, 'period_closed');
}

const nextMonth = (m: { year: number; month: number }) => (m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 });
const isBefore = (a: { year: number; month: number }, b: { year: number; month: number }) => monthKey(a.year, a.month) < monthKey(b.year, b.month);

/** Where HR began: the first month closed or entered, else this month. Before it, the balance is what HR typed. */
async function firstMonthInUse(db: Db, now: Date) {
  const [[first], [closed]] = await Promise.all([
    db.select({ day: timesheetEntries.day }).from(timesheetEntries).orderBy(asc(timesheetEntries.day)).limit(1),
    db.select({ year: timesheetPeriods.year, month: timesheetPeriods.month }).from(timesheetSnapshots)
      .innerJoin(timesheetPeriods, eq(timesheetPeriods.id, timesheetSnapshots.periodId)).orderBy(asc(timesheetPeriods.toOn)).limit(1),
  ]);
  const earliest = [periodMonthOf(todayInVietnam(now)), first && periodMonthOf(first.day), closed].flatMap((m) => (m ? [m] : []));
  return earliest.reduce((a, b) => (isBefore(b, a) ? b : a));
}

const MAX_MONTHS_CARRIED = 36;

/** Where a person's leave stands when a period opens: the balance, leave held from probation, and the yearly counts. */
export interface LeaveState {
  balance: number;
  pending: number;
  unpaidCounted: number;
  sickCounted: number;
  year: number;
}

const soFarOf = (state: LeaveState | undefined, year: number) => ({
  leavePending: state?.pending ?? 0,
  // The caps of Điều 65 are a year's: a new year starts them again.
  unpaidCountedBefore: state && state.year === year ? state.unpaidCounted : 0,
  sickCountedBefore: state && state.year === year ? state.sickCounted : 0,
});

/** The next state after a period's totals. */
const nextState = (state: LeaveState | undefined, year: number, totals: Pick<TimesheetTotals, 'leaveClosing' | 'leavePendingClosing' | 'unpaidCounted' | 'sickCounted'>): LeaveState => {
  const before = soFarOf(state, year);
  return { balance: totals.leaveClosing, pending: totals.leavePendingClosing, unpaidCounted: before.unpaidCountedBefore + totals.unpaidCounted, sickCounted: before.sickCountedBefore + totals.sickCounted, year };
};

/**
 * A close made before these fields were stored: work them out from its totals. What counted for leave is days worked
 * and paid leave, family days, insured days, holidays and approved unpaid leave, as the period's rule says.
 */
function storedOrDerived(s: { employment: StaffType; leaveClosing: number; totals: TimesheetTotals | null }, rule: LeaveRule, state: LeaveState | undefined, year: number) {
  const t = s.totals;
  if (t && t.leavePendingClosing !== undefined) return t;
  const before = soFarOf(state, year);
  const law = rule.mode === 'law';
  const unpaidCounted = law && t ? Math.min(t.unpaidLeave, Math.max(0, t.norm - before.unpaidCountedBefore)) : 0;
  const counted = t ? t.actual + t.leave + t.personalPaid + t.insured + (law ? t.holiday + unpaidCounted : 0) : 0;
  const earned = counted >= rule.threshold ? rule.perPeriod : 0;
  return { leaveClosing: s.leaveClosing, leavePendingClosing: law && s.employment === 'probation' ? before.leavePending + earned : 0, unpaidCounted, sickCounted: 0 };
}

async function openingStates(db: Db, fromOn: string): Promise<Map<string, LeaveState>> {
  const rows = await db
    .select({ employeeId: timesheetSnapshots.employeeId, employment: timesheetSnapshots.employment, leaveClosing: timesheetSnapshots.leaveClosing, totals: timesheetSnapshots.totals, year: timesheetPeriods.year, threshold: timesheetPeriods.leaveThreshold, perPeriod: timesheetPeriods.leavePerPeriod, mode: timesheetPeriods.leaveMode })
    .from(timesheetSnapshots)
    .innerJoin(timesheetPeriods, eq(timesheetPeriods.id, timesheetSnapshots.periodId))
    .where(and(lt(timesheetPeriods.toOn, fromOn), eq(timesheetPeriods.status, 'closed')))
    .orderBy(asc(timesheetPeriods.toOn));
  const states = new Map<string, LeaveState>();
  for (const r of rows) {
    const state = states.get(r.employeeId);
    states.set(r.employeeId, nextState(state, r.year, storedOrDerived(r, { threshold: r.threshold, perPeriod: r.perPeriod, mode: r.mode }, state, r.year)));
  }
  return states;
}

/**
 * Where leave stands when a period opens. Months since the last closed one count as they stand, so a month not closed
 * yet, or reopened, does not make the next one read short: the sheet this replaces looks up last month's closing figure.
 */
async function carriedStates(db: Db, period: Period, people: readonly Employee[], now: Date): Promise<Map<string, LeaveState>> {
  const states = await openingStates(db, period.fromOn);
  const latest = await db.query.timesheetPeriods.findFirst({
    where: and(eq(timesheetPeriods.status, 'closed'), lt(timesheetPeriods.toOn, period.fromOn)),
    orderBy: desc(timesheetPeriods.toOn),
  });
  const months: { year: number; month: number }[] = [];
  for (let m = latest ? nextMonth(latest) : await firstMonthInUse(db, now); isBefore(m, period) && months.length <= MAX_MONTHS_CARRIED; m = nextMonth(m)) months.push(m);
  const [firstMonth] = months;
  if (!firstMonth || people.length === 0 || months.length > MAX_MONTHS_CARRIED) return states;
  const ids = people.map((p) => p.id);
  const [cells, holidays, changes, rows] = await Promise.all([
    cellsFor(db, ids, standardPeriod(firstMonth.year, firstMonth.month).from, period.fromOn),
    listHolidays(db),
    db.select({ year: timesheetPeriods.year, month: timesheetPeriods.month, employeeId: timesheetLeaveChanges.employeeId, amount: timesheetLeaveChanges.amount })
      .from(timesheetLeaveChanges).innerJoin(timesheetPeriods, eq(timesheetPeriods.id, timesheetLeaveChanges.periodId)),
    db.select().from(timesheetPeriods).where(gte(timesheetPeriods.fromOn, standardPeriod(firstMonth.year, firstMonth.month).from)),
  ]);
  const holidayDays = new Set(holidaysInEffect(holidays).map((h) => h.day));
  const today = todayInVietnam(now);
  for (const m of months) {
    const range = standardPeriod(m.year, m.month);
    const days = periodDays(range);
    // A month not opened yet counts by the rule the next one will get.
    const own = rows.find((r) => r.year === m.year && r.month === m.month);
    const rule: LeaveRule = own ? ruleOf(own) : ruleOf(period);
    for (const p of people) {
      const codes = days.map((day) => dayCode({ day, entered: cells.get(p.id)?.[day]?.entered ?? null, isHoliday: holidayDays.has(day), today, joinedOn: p.joinedOn, leftOn: p.leftOn }));
      const leaveChange = changes.filter((c) => c.employeeId === p.id && c.year === m.year && c.month === m.month).reduce((sum, c) => sum + c.amount, 0);
      const state = states.get(p.id) ?? { balance: p.openingLeave, pending: 0, unpaidCounted: 0, sickCounted: 0, year: m.year };
      const norm = own?.norms[p.regionId] ?? 0;
      const totals = timesheetTotals({ codes, norm, leaveOpening: state.balance, employment: employmentOn(p, range.to), leaveChange, rule, ...soFarOf(state, m.year) });
      states.set(p.id, nextState(state, m.year, totals));
    }
  }
  return states;
}

const ruleOf = (p: Pick<Period, 'leaveThreshold' | 'leavePerPeriod' | 'leaveMode'>): LeaveRule => ({ threshold: p.leaveThreshold, perPeriod: p.leavePerPeriod, mode: p.leaveMode });

async function leaveChangesFor(db: Db, periodId: string) {
  const rows = await db.select().from(timesheetLeaveChanges).where(eq(timesheetLeaveChanges.periodId, periodId)).orderBy(asc(timesheetLeaveChanges.createdAt));
  const out = new Map<string, TimesheetLeaveChangeDto[]>();
  for (const r of rows) out.set(r.employeeId, [...(out.get(r.employeeId) ?? []), { id: r.id, amount: r.amount, reason: r.reason, createdBy: r.createdBy }]);
  return out;
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

const personOf = (p: Employee, lastDay: string, kinds: readonly StaffKindDto[]) => ({
  staffLabel: staffLabelOf(kinds, p.staffKindId, employmentOn(p, lastDay)),
  employeeId: p.id,
  code: p.code,
  fullName: p.fullName,
  department: p.department,
  title: p.title,
  regionId: p.regionId,
  employment: employmentOn(p, lastDay),
  joinedOn: p.joinedOn,
  officialOn: p.officialOn,
  leftOn: p.leftOn,
});

const datesOf = (live: { joinedOn: string | null; leftOn: string | null } | undefined) => (live ? { joinedOn: live.joinedOn, leftOn: live.leftOn } : {});

const frozenPersonOf = (s: Snapshot, kinds: readonly StaffKindDto[]) => ({
  staffLabel: s.staffLabel ?? staffLabelOf(kinds, null, s.employment),
  employeeId: s.employeeId,
  code: s.code,
  fullName: s.fullName,
  department: s.department,
  title: s.title,
  regionId: s.regionId,
  employment: s.employment,
  joinedOn: s.joinedOn,
  leftOn: s.leftOn,
});

/**
 * Who a period lists. Once closed it reads what it said then, whatever happened to the person since, and reopening it
 * to fix a cell does not change that. Only someone it never listed comes from the staff list, and only while open.
 */
async function sheetRows(db: Db, period: Period, regions: readonly TimesheetRegionDto[], now: Date): Promise<TimesheetRowDto[]> {
  const frozen = await db.select().from(timesheetSnapshots).where(eq(timesheetSnapshots.periodId, period.id));
  const frozenIds = new Set(frozen.map((f) => f.employeeId));
  // A last or first day HR learned later is a fact, not what the period said: it is why the period was reopened.
  const liveDates = period.status === 'closed' || frozen.length === 0
    ? []
    : await db.select({ id: employees.id, joinedOn: employees.joinedOn, leftOn: employees.leftOn }).from(employees).where(inArray(employees.id, [...frozenIds]));
  const people = period.status === 'closed'
    ? []
    : (await db.select().from(employees).where(workingInRange(period.fromOn, period.toOn))).filter((p) => !frozenIds.has(p.id));
  const ids = [...frozenIds, ...people.map((p) => p.id)];
  const [opening, cells, adjustments, leaveChanges, kinds] = await Promise.all([
    carriedStates(db, period, people, now),
    cellsFor(db, ids, period.fromOn, period.toOn),
    adjustmentsFor(db, ids, monthKey(period.year, period.month)),
    leaveChangesFor(db, period.id),
    listStaffKinds(db),
  ]);
  const range = { from: period.fromOn, to: period.toOn };
  const key = monthKey(period.year, period.month);
  const normOf = (regionId: string) => {
    const region = regions.find((r) => r.id === regionId);
    return suggestedNorm(range, region ? saturdaysFor(region, key) : 0);
  };
  const extras = (employeeId: string) => ({ cells: cells.get(employeeId) ?? {}, adjustments: adjustments.get(employeeId) ?? [], leaveChanges: leaveChanges.get(employeeId) ?? [] });
  return sortedRows([
    ...frozen.map((f) => ({
      ...frozenPersonOf(f, kinds),
      ...datesOf(liveDates.find((l) => l.id === f.employeeId)),
      leaveOpening: f.leaveOpening,
      leaveSoFar: soFarOf(opening.get(f.employeeId), period.year),
      norm: period.norms[f.regionId] ?? f.norm,
      frozenTotals: period.status === 'closed' ? f.totals : null,
      ...extras(f.employeeId),
    })),
    ...people.map((p) => ({
      ...personOf(p, period.toOn, kinds),
      leaveOpening: opening.get(p.id)?.balance ?? p.openingLeave,
      leaveSoFar: soFarOf(opening.get(p.id), period.year),
      norm: period.norms[p.regionId] ?? normOf(p.regionId),
      frozenTotals: null,
      ...extras(p.id),
    })),
  ], regions);
}

/** As both sheets list people: by region, official before probation, then by code. */
function sortedRows<T extends { regionId: string; employment: StaffType; code: string }>(rows: T[], regions: readonly TimesheetRegionDto[]): T[] {
  const place = new Map(regions.map((r, i) => [r.id, i]));
  const regionOf = (row: T) => place.get(row.regionId) ?? regions.length;
  return [...rows].sort((a, b) =>
    regionOf(a) - regionOf(b) ||
    Number(a.employment === 'probation') - Number(b.employment === 'probation') ||
    a.code.localeCompare(b.code));
}

async function latestClosed(db: Db) {
  return db.query.timesheetPeriods.findFirst({
    where: eq(timesheetPeriods.status, 'closed'),
    orderBy: desc(timesheetPeriods.toOn),
  });
}

async function toDto(db: Db, period: Period, now: Date): Promise<TimesheetDto> {
  const frozen = period.status === 'closed' ? period.frozen : null;
  const [liveRegions, liveHolidays, latest] = await Promise.all([listRegions(db), listHolidays(db), latestClosed(db)]);
  const regions = frozen?.regions ?? liveRegions;
  const range = { from: period.fromOn, to: period.toOn };
  const suggested = Object.fromEntries(regions.map((r) => [r.id, suggestedNorm(range, saturdaysFor(r, monthKey(period.year, period.month)))]));
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
    norms: { ...suggested, ...period.norms },
    rule: ruleOf(period),
    today: todayInVietnam(now),
    regions,
    holidays: frozen?.holidays ?? holidaysInEffect(liveHolidays).filter((h) => h.day >= period.fromOn && h.day <= period.toOn),
    rows: await sheetRows(db, period, regions, now),
  };
}

export async function getTimesheet(db: Db, year: number, month: number, now: Date): Promise<TimesheetDto> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    throw invalid('Tháng không hợp lệ.');
  }
  // A month not started yet is only to look at: storing it would make empty periods that every change is then logged
  // into. Leave planned ahead goes through the Nghỉ tab, which writes the days without a period.
  if (standardPeriod(year, month).from > todayInVietnam(now)) {
    const stored = await db.query.timesheetPeriods.findFirst({ where: and(eq(timesheetPeriods.year, year), eq(timesheetPeriods.month, month)) });
    if (stored) return toDto(db, stored, now);
    return { ...(await toDto(db, await periodHolding(db, standardPeriod(year, month).from), now)), periodId: null };
  }
  return toDto(db, await ensurePeriod(db, year, month), now);
}

/** A month not started yet, opened so HR can type in it ahead: set its norm, plan its days. */
export async function openPeriodAhead(db: Db, year: number, month: number, hr: HrMe, now: Date): Promise<TimesheetDto> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2020 || year > 2100) throw invalid('Tháng không hợp lệ.');
  const existed = await db.query.timesheetPeriods.findFirst({ where: and(eq(timesheetPeriods.year, year), eq(timesheetPeriods.month, month)) });
  const period = existed ?? (await ensurePeriod(db, year, month));
  if (!existed) await db.insert(timesheetLog).values({ periodId: period.id, actor: actorOf(hr), action: 'Mở kỳ để nhập trước', detail: `Tháng ${month}/${year}`, at: now });
  return toDto(db, period, now);
}

/** The twelve months of a year, for choosing one to read or several to download. Reading this creates nothing. */
export async function listYear(db: Db, year: number, now: Date): Promise<TimesheetMonthDto[]> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw invalid('Năm không hợp lệ.');
  const first = standardPeriod(year, 1).from;
  const last = standardPeriod(year, 12).to;
  const [periods, entered] = await Promise.all([
    db.select().from(timesheetPeriods).where(eq(timesheetPeriods.year, year)),
    db.selectDistinct({ day: timesheetEntries.day }).from(timesheetEntries).where(and(gte(timesheetEntries.day, first), lte(timesheetEntries.day, last))),
  ]);
  const today = todayInVietnam(now);
  const monthsEntered = new Set(entered.map((e) => periodMonthOf(e.day).month));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const range = standardPeriod(year, month);
    const period = periods.find((p) => p.month === month);
    return {
      year,
      month,
      from: range.from,
      to: range.to,
      status: monthStatus({ isClosed: period?.status === 'closed', hasEntries: monthsEntered.has(month), range, today }),
      closedBy: period?.closedBy ?? null,
    };
  });
}

/** Any days up to a month: to read and download. Entering and closing belong to the 26–25 periods. */
/** The id of a period not stored: nothing has it, so reading by it finds nothing. */
const NO_PERIOD = '00000000-0000-0000-0000-000000000000';

/** The period a day falls in, as stored, or as it would be opened, without opening it. */
async function periodHolding(db: Db, day: string): Promise<Period> {
  const { year, month } = periodMonthOf(day);
  const own = await db.query.timesheetPeriods.findFirst({ where: and(eq(timesheetPeriods.year, year), eq(timesheetPeriods.month, month)) });
  if (own) return own;
  const previous = await db.query.timesheetPeriods.findFirst({ orderBy: desc(timesheetPeriods.fromOn) });
  const { from, to } = standardPeriod(year, month);
  return {
    id: NO_PERIOD, year, month, fromOn: from, toOn: to, status: 'open', norms: {}, leaveThreshold: DEFAULT_LEAVE_RULE.threshold, leavePerPeriod: DEFAULT_LEAVE_RULE.perPeriod,
    leaveMode: previous?.leaveMode ?? 'law', closedAt: null, closedBy: null, frozen: null, createdAt: new Date(0),
  };
}

export async function getTimesheetRange(db: Db, from: string, to: string, now: Date): Promise<TimesheetDto> {
  const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!isDay(from) || !isDay(to) || from > to) throw invalid('Khoảng ngày không hợp lệ.');
  if (daysBetweenInclusive(from, to) > TIMESHEET_MAX_DAYS) throw invalid(`Tối đa ${TIMESHEET_MAX_DAYS} ngày.`);
  const { year, month } = periodMonthOf(to);
  const standard = standardPeriod(year, month);
  if (standard.from === from && standard.to === to) {
    // The same days must say the same as the period, balance and edited norms included. Still only to read.
    const sheet = await getTimesheet(db, year, month, now);
    return { ...sheet, periodId: null, status: 'open', closedAt: null, closedBy: null, canReopen: false };
  }
  const [people, regions, holidays, kinds] = await Promise.all([
    db.select().from(employees).where(workingInRange(from, to)),
    listRegions(db),
    listHolidays(db),
    listStaffKinds(db),
  ]);
  const ids = people.map((p) => p.id);
  // Leave starts where it stood when the period holding the first day opened, and counts by that period's rule.
  const start = await periodHolding(db, from);
  const [cells, adjustments, states] = await Promise.all([cellsFor(db, ids, from, to), adjustmentsFor(db, ids, monthKey(year, month)), carriedStates(db, start, people, now)]);
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
    norms: Object.fromEntries(regions.map((r) => [r.id, suggestedNorm({ from, to }, saturdaysFor(r, monthKey(year, month)))])),
    rule: ruleOf(start),
    today: todayInVietnam(now),
    regions,
    holidays: holidaysInEffect(holidays).filter((h) => h.day >= from && h.day <= to),
    rows: sortedRows(people.map((p) => ({
      ...personOf(p, to, kinds),
      leaveOpening: states.get(p.id)?.balance ?? p.openingLeave,
      leaveSoFar: soFarOf(states.get(p.id), start.year),
      norm: suggestedNorm({ from, to }, saturdaysFor(regions.find((r) => r.id === p.regionId) ?? { saturdays: 0 }, monthKey(year, month))),
      cells: cells.get(p.id) ?? {},
      adjustments: adjustments.get(p.id) ?? [],
      leaveChanges: [],
      frozenTotals: null,
    })), regions),
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
          .values({ employeeId: cell.employeeId, day: cell.day, code, note, updatedBy: actorOf(hr), updatedAt: now })
          .onConflictDoUpdate({
            target: [timesheetEntries.employeeId, timesheetEntries.day],
            set: { code, note, updatedBy: actorOf(hr), updatedAt: now },
          });
      }
      const person = byId.get(cell.employeeId);
      const changes = [
        code !== (before?.code ?? null) ? `${describeCode(before?.code)} → ${describeCode(code)}` : null,
        note !== (before?.note ?? null) ? `ghi chú: ${note ?? 'đã xoá'}` : null,
      ].filter(Boolean);
      lines.push({ periodId, actor: actorOf(hr), action: 'Chấm công', detail: `${person?.code} ${person?.fullName}, ${dayWords(cell.day)}: ${changes.join('; ')}`, at: now });
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
  const words = Object.entries(parsed.data.norms).map(([id, n]) => `${regions.find((r) => r.id === id)?.name ?? id} ${numberWords(n)}`).join(', ');
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Sửa định mức', detail: words, at: now });
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
  await db.insert(timesheetAdjustments).values({ employeeId, amount, reason, fromPeriod: key, toPeriod: isRecurring ? null : key, createdBy: actorOf(hr) });
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Điều chỉnh công', detail: `${person.code} ${person.fullName}: ${numberWords(amount)} công, ${isRecurring ? 'mỗi kỳ' : 'chỉ kỳ này'} (${reason})`, at: now });
  return toDto(db, period, now);
}

/** A recurring one stops from this period; closed periods before it keep theirs. */
export async function removeAdjustment(db: Db, periodId: string, adjustmentId: string, hr: HrMe, now: Date): Promise<TimesheetDto> {
  if (!isUuid(adjustmentId)) throw notFound('Không tìm thấy điều chỉnh công.');
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
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Bỏ điều chỉnh công', detail: `${numberWords(row.amount)} công (${row.reason})`, at: now });
  return toDto(db, period, now);
}

/**
 * Periods close one after another, or a period's leave is lost. Before the first close, only a month HR has entered
 * something in counts: a look at an older month does not make it the start of the timesheet.
 */
async function requireNextToClose(db: Db, period: Period, now: Date): Promise<void> {
  const latest = await latestClosed(db);
  const blockedBy = (year: number, month: number) =>
    new HttpError(409, `Chốt kỳ tháng ${month}/${year} trước, vì phép của kỳ này tính tiếp từ kỳ đó.`, {}, 'earlier_open');
  if (latest) {
    if (latest.toOn >= period.toOn) throw new HttpError(409, `Kỳ này cũ hơn kỳ tháng ${latest.month}/${latest.year} đã chốt.`, {}, 'older_than_closed');
    const next = latest.month === 12 ? { year: latest.year + 1, month: 1 } : { year: latest.year, month: latest.month + 1 };
    if (next.year !== period.year || next.month !== period.month) throw blockedBy(next.year, next.month);
    return;
  }
  const [first] = await db.select({ day: timesheetEntries.day }).from(timesheetEntries).where(lt(timesheetEntries.day, period.fromOn)).orderBy(asc(timesheetEntries.day)).limit(1);
  if (first) {
    const owner = periodMonthOf(first.day);
    throw blockedBy(owner.year, owner.month);
  }
  await requireInUse(db, period, now);
}

/** A first close on an old month nobody used would pay full automatic attendance and force every month after it. */
async function requireInUse(db: Db, period: Period, now: Date) {
  const { year, month } = periodMonthOf(todayInVietnam(now));
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  if (!isBefore(period, previous)) return;
  const [entered] = await db.select({ day: timesheetEntries.day }).from(timesheetEntries).where(and(gte(timesheetEntries.day, period.fromOn), lte(timesheetEntries.day, period.toOn))).limit(1);
  if (!entered) throw new HttpError(409, `Tháng ${period.month}/${period.year} chưa có dữ liệu. Chốt từ tháng đầu tiên HR dùng.`, {}, 'empty_month');
}

const COMPARED: [key: 'paid' | 'overtime' | 'leaveClosing', label: string][] = [['paid', 'Công hưởng lương'], ['overtime', 'OT'], ['leaveClosing', 'Phép cuối kỳ']];

/** When a reopened period closes again: what moved since the figures that were paid. */
function closeDifferences(before: readonly Snapshot[], after: readonly { employeeId: string; code: string; totals: TimesheetTotals }[]): string {
  return after
    .flatMap((row) => {
      const old = before.find((b) => b.employeeId === row.employeeId)?.totals;
      if (!old) return [];
      const moved = COMPARED.filter(([key]) => old[key] !== row.totals[key]).map(([key, label]) => `${label} ${numberWords(old[key])} → ${numberWords(row.totals[key])}`);
      return moved.length > 0 ? [`${row.code}: ${moved.join(', ')}`] : [];
    })
    .join('; ');
}

export async function closePeriod(db: Db, periodId: string, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  await requireNextToClose(db, period, now);
  if (todayInVietnam(now) < period.toOn) throw new HttpError(409, `Kỳ chưa hết, chốt được từ ngày ${dayWords(period.toOn)}.`, {}, 'period_running');
  const dto = await toDto(db, period, now);
  const holidays = new Set(dto.holidays.map((h) => h.day));
  const days = periodDays({ from: period.fromOn, to: period.toOn });
  const snapshots = dto.rows.map((row) => {
    const codes = days.map((day) => dayCode({ day, entered: row.cells[day]?.entered ?? null, isHoliday: holidays.has(day), today: dto.today, joinedOn: row.joinedOn, leftOn: row.leftOn }));
    const totals = timesheetTotals({
      codes,
      norm: row.norm,
      leaveOpening: row.leaveOpening,
      employment: row.employment,
      rule: dto.rule,
      adjustment: row.adjustments.reduce((sum, a) => sum + a.amount, 0),
      leaveChange: row.leaveChanges.reduce((sum, c) => sum + c.amount, 0),
      ...row.leaveSoFar,
    });
    // What payroll pays at its own rate, kept with the close so later edits of the cells do not change it.
    Object.assign(totals, restDayWork(days, codes, holidays));
    return { periodId, employeeId: row.employeeId, code: row.code, fullName: row.fullName, department: row.department, title: row.title, regionId: row.regionId, employment: row.employment, staffLabel: row.staffLabel, joinedOn: row.joinedOn, leftOn: row.leftOn, norm: row.norm, leaveOpening: row.leaveOpening, leaveClosing: totals.leaveClosing, totals };
  });
  const before = await db.select().from(timesheetSnapshots).where(eq(timesheetSnapshots.periodId, periodId));
  const differences = closeDifferences(before, snapshots);
  const updated = await db.transaction(async (tx) => {
    await tx.delete(timesheetSnapshots).where(eq(timesheetSnapshots.periodId, periodId));
    if (snapshots.length > 0) await tx.insert(timesheetSnapshots).values(snapshots);
    const [row] = await tx.update(timesheetPeriods).set({ status: 'closed', closedAt: now, closedBy: actorOf(hr), frozen: { holidays: dto.holidays, regions: dto.regions } }).where(eq(timesheetPeriods.id, periodId)).returning();
    if (differences) await tx.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Chênh lệch khi chốt lại', detail: differences, at: now });
    await tx.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Chốt kỳ', detail: `Tháng ${period.month}/${period.year}`, at: now });
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
    const [row] = await tx.update(timesheetPeriods).set({ status: 'open', closedAt: null, closedBy: null, frozen: null }).where(eq(timesheetPeriods.id, periodId)).returning();
    await tx.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Mở lại kỳ', detail: parsed.data.reason, at: now });
    return row;
  });
  if (!updated) throw notFound('Không tìm thấy kỳ công.');
  return toDto(db, updated, now);
}

const leaveModeSchema = z.object({ mode: z.enum(LEAVE_MODES) });
const LEAVE_MODE_WORDS = { law: 'Theo luật (NĐ 145)', excel: 'Như Excel cũ' } as const;

/** How leave counts, for this open period and the open ones after it. Closed periods keep what they closed with. */
export async function setLeaveMode(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const parsed = leaveModeSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chọn cách tính phép.', fieldErrors(parsed.error));
  const { mode } = parsed.data;
  if (mode === period.leaveMode) return toDto(db, period, now);
  await db.update(timesheetPeriods).set({ leaveMode: mode }).where(and(eq(timesheetPeriods.status, 'open'), gte(timesheetPeriods.fromOn, period.fromOn)));
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Đổi cách tính phép', detail: `${LEAVE_MODE_WORDS[period.leaveMode]} → ${LEAVE_MODE_WORDS[mode]}, từ tháng ${period.month}/${period.year}`, at: now });
  return toDto(db, await findPeriod(db, periodId), now);
}

/** What a change of balance stands on: someone on probation has no balance to take from, whatever was typed at the start. */
const balanceBase = (row: Pick<TimesheetRowDto, 'employment' | 'leaveOpening'>, rule: LeaveRule) => (row.employment === 'probation' && rule.mode !== 'law' ? 0 : row.leaveOpening);

export async function addLeaveChange(db: Db, periodId: string, raw: unknown, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  const parsed = leaveChangeSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại điều chỉnh phép.', fieldErrors(parsed.error));
  const { employeeId, amount, reason } = parsed.data;
  const dto = await toDto(db, period, now);
  const row = dto.rows.find((r) => r.employeeId === employeeId);
  if (!row) throw notFound('Không tìm thấy nhân viên trong kỳ này.');
  const already = row.leaveChanges.reduce((sum, c) => sum + c.amount, 0);
  if (balanceBase(row, dto.rule) + already + amount < 0) throw invalid('Không trừ quá số phép đang có.', { amount: 'Không trừ quá số phép đang có.' });
  await db.insert(timesheetLeaveChanges).values({ periodId, employeeId, amount, reason, createdBy: actorOf(hr) });
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Điều chỉnh phép', detail: `${row.code} ${row.fullName}: ${numberWords(amount)} ngày (${reason})`, at: now });
  return toDto(db, period, now);
}

export async function removeLeaveChange(db: Db, periodId: string, changeId: string, hr: HrMe, now: Date): Promise<TimesheetDto> {
  const period = await findPeriod(db, periodId);
  requireOpen(period);
  if (!isUuid(changeId)) throw notFound('Không tìm thấy điều chỉnh phép.');
  const dto = await toDto(db, period, now);
  const person = dto.rows.find((r) => r.leaveChanges.some((c) => c.id === changeId));
  const change = person?.leaveChanges.find((c) => c.id === changeId);
  if (!person || !change) throw notFound('Không tìm thấy điều chỉnh phép.');
  const left = person.leaveChanges.reduce((sum, c) => sum + c.amount, 0) - change.amount;
  if (balanceBase(person, dto.rule) + left < 0) throw invalid('Bỏ điều chỉnh này thì phép bị âm. Bỏ khoản trừ trước.');
  const [row] = await db.delete(timesheetLeaveChanges).where(eq(timesheetLeaveChanges.id, changeId)).returning();
  if (!row) throw notFound('Không tìm thấy điều chỉnh phép.');
  await db.insert(timesheetLog).values({ periodId, actor: actorOf(hr), action: 'Bỏ điều chỉnh phép', detail: `${numberWords(row.amount)} ngày (${row.reason})`, at: now });
  return toDto(db, period, now);
}

export async function periodLog(db: Db, periodId: string): Promise<TimesheetLogDto[]> {
  const rows = await db.select().from(timesheetLog).where(eq(timesheetLog.periodId, periodId)).orderBy(desc(timesheetLog.at)).limit(300);
  return rows.map((r) => ({ id: r.id, actor: r.actor, action: r.action, detail: r.detail, at: r.at.toISOString() }));
}
