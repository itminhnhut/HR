import {
  PAYROLL_FORMULA_VERSION,
  PAYROLL_MONTH,
  payrollConfigFor,
  payrollDates,
  payrollTotals,
  periodMonthOf,
  reviewPayroll,
  sortPayrollRows,
  todayInVietnam,
  type PayrollConfig,
  type PayrollDates,
  type PayrollMonthDto,
  type PayrollRetroItemDto,
  type TimesheetRegionDto,
  isInUse,
} from '@careers/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { timesheetClosings, timesheetPeriods, timesheetRegions } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { firstMonth } from './payroll-catalogue.js';
import { firstMonthChecklist } from './payroll-checklist.js';
import { peopleFactsOf } from './payroll-month-facts.js';
import {
  indexOf,
  isApprovedPeriod,
  keyOf,
  partsOfKey,
  snapshotsOf,
  storedOf,
  type SnapshotOf,
  type StoredPeriod,
} from './payroll-month-index.js';
import { buildLine, type BuiltLine, type PersonFacts } from './payroll-month-lines.js';
import type { Reader } from './payroll-profile-store.js';
import { loadRows } from './payroll-settings.js';
import { payDayFor, type Row } from './payroll-versions.js';
import {
  manualRetroItems,
  retroDiffsFor,
  retroItemsOf,
  retroOutOf,
  staleRetroOf,
  withRetro,
  type MonthRetro,
  type RetroReaders,
} from './payroll-retro.js';
import { yearSoFarOf, type YearSoFar } from './payroll-year.js';
import { monthWords } from './payroll-words.js';
import { readClosing } from './timesheet-closings.js';

/**
 * Tháng lương (spec-luong.md R2, R3, R4, 10.2; steps 15–16, read side): a draft is computed by the engine from the
 * close of its timesheet period, the payroll profiles and the month's config; an approved or paid month reads its
 * approval snapshot (`payroll_runs`). A GET never writes (L-L22): a month nobody has worked on has no
 * `payroll_periods` row and reads as waiting or a draft from the timesheet alone.
 */

export type Stored = StoredPeriod;
type Closing = NonNullable<Awaited<ReturnType<typeof readClosing>>>;

const MONTHS_AHEAD = 12;

/** The month before `dates`, "YYYY-MM". */
const keyBefore = (dates: Pick<PayrollDates, 'year' | 'month'>) => keyOf(indexOf(dates.year, dates.month) - 1);

/** The months the API answers: the first payroll month on the web to a year after the current period. */
function checkRange(key: string, first: string, now: Date): { year: number; month: number } {
  const current = periodMonthOf(todayInVietnam(now));
  const last = keyOf(indexOf(current.year, current.month) + MONTHS_AHEAD);
  if (!PAYROLL_MONTH.test(key) || key < first || key > last) {
    throw notFound(`Có bảng lương từ ${monthWords(first)} đến ${monthWords(last)}.`);
  }
  return partsOfKey(key);
}

/**
 * An approved month keeps the close it was approved on; otherwise the latest close of a closed timesheet period.
 * `again`: an approved month computed as now (R6) reads the latest close too, when its timesheet was closed again.
 */
async function closingOf(
  db: Reader,
  dates: Pick<PayrollDates, 'year' | 'month'>,
  stored: Stored | undefined,
  again = false,
): Promise<Closing | undefined> {
  const pinned = isApprovedPeriod(stored) && stored.closingId ? stored.closingId : null;
  if (pinned && !again) return readClosing(db, pinned);
  const latest = await latestClosingOf(db, dates);
  return latest ?? (pinned ? readClosing(db, pinned) : undefined);
}

async function latestClosingOf(db: Reader, dates: Pick<PayrollDates, 'year' | 'month'>): Promise<Closing | undefined> {
  const [period] = await db
    .select()
    .from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.year, dates.year), eq(timesheetPeriods.month, dates.month)));
  if (period?.status !== 'closed') return undefined;
  const [latest] = await db
    .select({ id: timesheetClosings.id })
    .from(timesheetClosings)
    .where(eq(timesheetClosings.periodId, period.id))
    .orderBy(desc(timesheetClosings.closeNo))
    .limit(1);
  return latest ? readClosing(db, latest.id) : undefined;
}

/**
 * Công chuẩn of each person in the period before, the divisor of unused leave pay (spec 5.5). Read only when someone's
 * last working day is in this period; empty when the period before has no close on the web.
 */
async function previousNormsOf(db: Reader, dates: PayrollDates, closing: Closing): Promise<Map<string, number>> {
  const { from, to } = dates.period;
  const leaving = closing.rows.some((r) => r.leftOn !== null && r.leftOn >= from && r.leftOn <= to);
  if (!leaving) return new Map();
  const previous = partsOfKey(keyBefore(dates));
  const earlier = await closingOf(db, previous, await storedOf(db, previous.year, previous.month));
  return new Map((earlier?.rows ?? []).map((r) => [r.employeeId, r.norm]));
}

/** (42) of each person in the approval of the month before, for "lệch quá 10%" (spec 11.3); empty when not approved. */
async function previousNetsOf(ctx: LiveContext, dates: PayrollDates): Promise<Map<string, number>> {
  const previous = partsOfKey(keyBefore(dates));
  const snapshot = await ctx.snapshotOf(await storedOf(ctx.db, previous.year, previous.month));
  return new Map((snapshot?.lines ?? []).map((l) => [l.employeeId, l.cells.netPay]));
}

const regionDto = (r: Pick<TimesheetRegionDto, 'id' | 'name' | 'tone'>) => ({ id: r.id, name: r.name, tone: r.tone });

async function regionsOf(db: Reader, closing: Closing | undefined): Promise<PayrollMonthDto['regions']> {
  if (closing) return closing.closing.regions.map(regionDto);
  const all = await db
    .select()
    .from(timesheetRegions)
    .orderBy(asc(timesheetRegions.createdAt), asc(timesheetRegions.name));
  return all.filter((r) => !r.hidden).map(regionDto);
}

function approvalOf(stored: Stored | undefined): PayrollMonthDto['approval'] {
  if (!stored || stored.approvalNo === null || !stored.approvedAt || !stored.approvedBy) return null;
  return { no: stored.approvalNo, at: stored.approvedAt.toISOString(), by: stored.approvedBy };
}

type Shell = Omit<PayrollMonthDto, 'status' | 'computedAt' | 'lines' | 'totals' | 'review'>;

function shellOf(dates: PayrollDates, config: PayrollConfig, stored: Stored | undefined): Omit<Shell, 'regions'> {
  return {
    year: dates.year,
    month: dates.month,
    monthKey: dates.monthKey,
    period: dates.period,
    payDate: dates.payDate,
    approval: approvalOf(stored),
    paidOn: stored?.paidOn ?? null,
    components: config.components.map((c) => ({ id: c.id, name: c.name })),
    contractTypes: config.contractTypes.map((t) => ({
      id: t.id,
      name: t.name,
      ...(isInUse(t, dates.monthKey) ? {} : { stopped: true }),
    })),
  };
}

/** R9: the month before is not approved yet (only from the first month on the web). */
async function previousIsDraft(db: Reader, dates: PayrollDates, first: string): Promise<boolean> {
  const previous = keyBefore(dates);
  if (previous < first) return false;
  const { year, month } = partsOfKey(previous);
  return !isApprovedPeriod(await storedOf(db, year, month));
}

interface ReviewArgs {
  built: readonly BuiltLine[];
  closing: Closing;
  dates: PayrollDates;
  first: string;
  year: YearSoFar;
  retro: readonly PayrollRetroItemDto[];
}

async function reviewOf(db: Db, { built, closing, dates, first, year, retro }: ReviewArgs) {
  const firstWebMonth = dates.monthKey === first;
  // A month of the same tax year still open is named with what the yearly figures read of it; R9's own line is
  // left for a month before of another tax year.
  const previousNamed = year.openMonths.some((m) => m.month === keyBefore(dates).slice(5));
  return reviewPayroll({
    rows: built.map((b) => b.review),
    blockFromPerson: built.filter((b) => b.dto.blockFromPerson).length,
    previousMonthDraft: !previousNamed && (await previousIsDraft(db, dates, first)),
    yearOpenMonths: year.openMonths,
    retroFrom: [...new Set(retro.map((r) => r.origin))].sort().map((origin) => origin.slice(5)),
    // R6: a difference the month has no row to pay it in waits for HR (`placed: false`).
    retroPending: retro.filter((r) => !r.placed).length,
    firstWebMonth,
    // A close made on the web is the one HR saw; a backfilled one is confirmed in the checklist (spec 4.21, 17.2).
    closingConfirmed: closing.closing.source === 'web',
    checklistPending: firstWebMonth ? (await firstMonthChecklist(db)).unconfirmed : 0,
  });
}

function orderLines(built: readonly BuiltLine[], regions: PayrollMonthDto['regions'], config: PayrollConfig) {
  const regionOrder = (id: string) => {
    const i = regions.findIndex((r) => r.id === id);
    return i === -1 ? regions.length : i;
  };
  const rows = built.map((b) => ({
    ...b.dto,
    regionOrder: regionOrder(b.regionId),
    contractTypeId: b.dto.contractTypeId || null,
  }));
  const sorted = sortPayrollRows(rows, config.contractTypes);
  return sorted.map(({ regionOrder: _order, contractTypeId, ...dto }) => ({
    ...dto,
    contractTypeId: contractTypeId ?? '',
  }));
}

/** The month as the engine computes it now, with the close it read (null while waiting). */
export interface LiveMonth {
  dto: PayrollMonthDto;
  closingId: string | null;
}

/** "YYYY-MM" checked against the range the API answers (404 outside it). */
export async function monthInRange(db: Reader, key: string, now: Date): Promise<{ year: number; month: number }> {
  return checkRange(key, firstMonth(await loadRows(db)), now);
}

/** What one request reads months with; nothing in it outlives the request. */
interface LiveContext {
  db: Db;
  rows: readonly Row[];
  first: string;
  now: Date;
  /** Approved months computed as now during this read, so each is computed once. */
  again: Map<string, Promise<PayrollMonthDto>>;
  /** The approval snapshots read during this read, each once. */
  snapshotOf: SnapshotOf;
}

const contextOf = (db: Db, rows: readonly Row[], now: Date): LiveContext => ({
  db,
  rows,
  first: firstMonth(rows),
  now,
  again: new Map(),
  snapshotOf: snapshotsOf(db),
});

/**
 * How a month is computed: `read` for the month asked for, with Rà soát; `again` an approved month as it would
 * compute now (R6), on its latest close; `year` an earlier draft read only for the yearly figures. Neither of the
 * last two has Rà soát.
 */
type Mode = 'read' | 'again' | 'year';

/** An approved month computed as now, beside its approval (R6); nothing is written. */
function recomputeOf(ctx: LiveContext): (key: string) => Promise<PayrollMonthDto> {
  return (key) => {
    const known = ctx.again.get(key);
    if (known) return known;
    const computed = computeMonth(ctx, key, undefined, 'again').then((live) => live.dto);
    ctx.again.set(key, computed);
    return computed;
  };
}

const readersOf = (ctx: LiveContext): RetroReaders => ({ recompute: recomputeOf(ctx), snapshotOf: ctx.snapshotOf });

/**
 * Truy lĩnh / truy thu of the month (R6 (a)): a draft receives what the approved months right before it compute
 * differently now; an approved month keeps the items of its approval.
 */
async function retroOf(
  ctx: LiveContext,
  stored: Stored | undefined,
  dates: PayrollDates,
  built: readonly BuiltLine[],
  facts: ReadonlyMap<string, PersonFacts>,
): Promise<MonthRetro> {
  if (isApprovedPeriod(stored)) return { items: (await ctx.snapshotOf(stored))?.retro ?? [], stale: new Map() };
  const diffs = await retroDiffsFor(ctx.db, { first: ctx.first, dates, ...readersOf(ctx) });
  const typed = (id: string) => facts.get(id)?.inputs.retro ?? [];
  const paid = built.flatMap((b) => (b.line ? [b.dto] : []));
  const placed = new Set(paid.map((p) => p.employeeId));
  const computed = diffs.length === 0 ? [] : await retroItemsOf(ctx.db, { diffs, typed, placed });
  // What HR added by hand for a month with no computed difference comes after the computed ones.
  const items = [...computed, ...manualRetroItems(paid, typed, computed)];
  return { items, stale: staleRetroOf(paid, typed, computed) };
}

/** Computed from the close, the profiles and the config (R3): a draft, or a month still waiting for its close. */
export async function liveMonthOf(db: Db, key: string, now: Date): Promise<LiveMonth> {
  const ctx = contextOf(db, await loadRows(db), now);
  checkRange(key, ctx.first, now);
  return computeMonth(ctx, key);
}

/**
 * The block the approval took from the person where the close had none (F19). The month computed as now (R6) keeps
 * it; without it every such person would lose the block, and a truy thu would be proposed though nothing changed.
 */
async function approvedBlocksOf(snapshotOf: SnapshotOf, stored: Stored) {
  const snapshot = await snapshotOf(stored);
  const lines = snapshot?.lines.filter((l) => l.blockFromPerson) ?? [];
  return new Map(lines.map((l) => [l.employeeId, l.block]));
}

/** A month whose timesheet period is not closed yet: no row, nothing to review. */
const waitingDto = (shell: Shell): PayrollMonthDto => ({
  ...shell,
  status: 'waiting',
  computedAt: null,
  lines: [],
  totals: {},
  review: [],
  closingNo: null,
});

/** A month with its close, before its rows are built. */
interface MonthBase {
  stored: Stored | undefined;
  dates: PayrollDates;
  config: PayrollConfig;
  closing: Closing;
  shell: Shell;
}

/** The row of each person of the close, before truy lĩnh / truy thu, and what the month knows about them. */
async function plainLinesOf(ctx: LiveContext, base: MonthBase, yearSoFar: YearSoFar, mode: Mode) {
  const { db, rows } = ctx;
  const { stored, dates, closing } = base;
  const facts = await peopleFactsOf(db, closing.rows, rows, dates, {
    yearMonths: yearSoFar.byEmployee,
    previousNorms: await previousNormsOf(db, dates, closing),
    previousNets: mode === 'read' ? await previousNetsOf(ctx, dates) : new Map<string, number>(),
  });
  const approvedBlocks = isApprovedPeriod(stored) ? await approvedBlocksOf(ctx.snapshotOf, stored) : null;
  const plain = closing.rows.flatMap((row) => {
    const person = facts.get(row.employeeId);
    if (!person) return [];
    // Only a draft reads the person's block of today; an approved month stands on its close and its approval.
    const currentBlock = approvedBlocks ? (approvedBlocks.get(row.employeeId) ?? null) : person.currentBlock;
    return [buildLine(row, { ...person, currentBlock }, rows, dates)];
  });
  return { plain, facts };
}

/** The month's rows, truy lĩnh / truy thu, totals and (to read it) Rà soát, on the earlier months of its tax year. */
async function computedMonth(ctx: LiveContext, base: MonthBase, known: YearSoFar | undefined, mode: Mode) {
  const { db, rows, first, now, snapshotOf } = ctx;
  const { stored, dates, config, closing, shell } = base;
  const draftOf = async (earlier: string, soFar: YearSoFar) => (await computeMonth(ctx, earlier, soFar, 'year')).dto;
  const yearSoFar = known ?? (await yearSoFarOf(db, { rows, first, dates, draftOf, snapshotOf }));
  const { plain, facts } = await plainLinesOf(ctx, base, yearSoFar, mode);
  const monthRetro = await retroOf(ctx, stored, dates, plain, facts);
  const retro = [...monthRetro.items];
  const built = plain.map((b) => withRetro(b, monthRetro));
  const lines = built.flatMap((b) => (b.line ? [b.line] : []));
  const status = isApprovedPeriod(stored) ? stored.status : 'draft';
  const dto: PayrollMonthDto = {
    ...shell,
    status,
    computedAt: status === 'draft' ? now.toISOString() : null,
    lines: orderLines(built, shell.regions, config),
    totals: payrollTotals(lines, config.options.rounding),
    review: mode === 'read' ? await reviewOf(db, { built, closing, dates, first, year: yearSoFar, retro }) : [],
    retro,
    closingNo: closing.closing.closeNo,
    formulaVersion: PAYROLL_FORMULA_VERSION,
  };
  return { dto, closingId: closing.closing.id };
}

/** The month on the earlier months of its tax year; an earlier draft is computed the same way, oldest first. */
async function computeMonth(ctx: LiveContext, key: string, known?: YearSoFar, mode: Mode = 'read'): Promise<LiveMonth> {
  const { db, rows } = ctx;
  const { year, month } = partsOfKey(key);
  const stored = await storedOf(db, year, month);
  const dates = payrollDates(year, month, stored?.payDate ?? undefined, payDayFor(rows, key));
  const config = payrollConfigFor(rows, null, dates);
  const closing = await closingOf(db, dates, stored, mode === 'again');
  const shell = { ...shellOf(dates, config, stored), regions: await regionsOf(db, closing) };
  if (!closing) return { dto: waitingDto(shell), closingId: null };
  return computedMonth(ctx, { stored, dates, config, closing, shell }, known, mode);
}

/** Bản duyệt lần N of an approved or paid month (R4), with the month's state on top. */
async function frozenOf(snapshotOf: SnapshotOf, stored: Stored | undefined): Promise<PayrollMonthDto | undefined> {
  if (!isApprovedPeriod(stored)) return undefined;
  const snapshot = await snapshotOf(stored);
  if (!snapshot) return undefined;
  return {
    ...snapshot,
    status: stored.status,
    computedAt: null,
    approval: approvalOf(stored),
    paidOn: stored.paidOn,
  };
}

/** An approved month as it would compute today (R6), for what its approval did not keep; nothing is written. */
export async function monthAsNow(db: Db, key: string, now: Date): Promise<PayrollMonthDto> {
  return recomputeOf(contextOf(db, await loadRows(db), now))(key);
}

/**
 * `GET /months/:YYYY-MM`: an approved or paid month reads its approval snapshot, with what it computes differently
 * now and where that goes (R6); any other month is computed.
 */
export async function payrollMonthOf(db: Db, key: string, now: Date): Promise<PayrollMonthDto> {
  const ctx = contextOf(db, await loadRows(db), now);
  const { year, month } = checkRange(key, ctx.first, now);
  const frozen = await frozenOf(ctx.snapshotOf, await storedOf(db, year, month));
  if (!frozen) return (await computeMonth(ctx, key)).dto;
  return { ...frozen, retroOut: await retroOutOf(db, key, frozen, readersOf(ctx)) };
}
