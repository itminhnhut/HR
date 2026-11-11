import {
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
  type PayrollPeriodStatus,
  type PayrollRetroItemDto,
  type TimesheetRegionDto,
} from '@careers/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollPeriods, payrollRuns, timesheetClosings, timesheetPeriods, timesheetRegions } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { firstMonth } from './payroll-catalogue.js';
import { firstMonthChecklist } from './payroll-checklist.js';
import { peopleFactsOf } from './payroll-month-facts.js';
import { buildLine, type BuiltLine, type PersonFacts } from './payroll-month-lines.js';
import type { Reader } from './payroll-profile-store.js';
import { loadRows } from './payroll-settings.js';
import { payDayFor, type Row } from './payroll-versions.js';
import { retroDiffsFor, retroItemsOf, retroOutOf, withRetro } from './payroll-retro.js';
import { approvedSnapshotOf, yearSoFarOf, type YearSoFar } from './payroll-year.js';
import { monthWords } from './payroll-words.js';
import { readClosing } from './timesheet-closings.js';

/**
 * Tháng lương (spec-luong.md R2, R3, R4, 10.2; steps 15–16, read side): a draft is computed by the engine from the
 * close of its timesheet period, the payroll profiles and the month's config; an approved or paid month reads its
 * approval snapshot (`payroll_runs`). A GET never writes (L-L22): a month nobody has worked on has no
 * `payroll_periods` row and reads as waiting or a draft from the timesheet alone.
 */

export type Stored = typeof payrollPeriods.$inferSelect;
type Closing = NonNullable<Awaited<ReturnType<typeof readClosing>>>;

const MONTHS_AHEAD = 12;
const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
const indexOf = (year: number, month: number) => year * 12 + month - 1;
const isApproved = (status: PayrollPeriodStatus | undefined) => status === 'approved' || status === 'paid';

/** The months the API answers: the first payroll month on the web to a year after the current period. */
function checkRange(key: string, first: string, now: Date): { year: number; month: number } {
  const current = periodMonthOf(todayInVietnam(now));
  const last = keyOf(indexOf(current.year, current.month) + MONTHS_AHEAD);
  const match = MONTH_KEY.exec(key);
  if (!match || key < first || key > last) {
    throw notFound(`Có bảng lương từ ${monthWords(first)} đến ${monthWords(last)}.`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export async function storedOf(db: Reader, year: number, month: number): Promise<Stored | undefined> {
  const [stored] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, year), eq(payrollPeriods.month, month)));
  return stored;
}

/** Bản duyệt lần `no` of a payroll month. */
export async function runOf(db: Reader, periodId: string, no: number) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.periodId, periodId), eq(payrollRuns.approvalNo, no)));
  return run;
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
  const pinned = isApproved(stored?.status) && stored?.closingId ? stored.closingId : null;
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
  const before = keyOf(indexOf(dates.year, dates.month) - 1);
  const previous = { year: Number(before.slice(0, 4)), month: Number(before.slice(5)) };
  const earlier = await closingOf(db, previous, await storedOf(db, previous.year, previous.month));
  return new Map((earlier?.rows ?? []).map((r) => [r.employeeId, r.norm]));
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
    contractTypes: config.contractTypes.map((t) => ({ id: t.id, name: t.name })),
  };
}

/** R9: the month before is not approved yet (only from the first month on the web). */
async function previousIsDraft(db: Reader, dates: PayrollDates, first: string): Promise<boolean> {
  const previous = keyOf(indexOf(dates.year, dates.month) - 1);
  if (previous < first) return false;
  const stored = await storedOf(db, Number(previous.slice(0, 4)), Number(previous.slice(5)));
  return !isApproved(stored?.status);
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
  const previousNamed = year.openMonths.some((m) => m.month === keyOf(indexOf(dates.year, dates.month) - 1).slice(5));
  return reviewPayroll({
    rows: built.map((b) => b.review),
    previousMonthDraft: !previousNamed && (await previousIsDraft(db, dates, first)),
    yearOpenMonths: year.openMonths,
    retroFrom: [...new Set(retro.map((r) => r.origin))].sort().map((origin) => origin.slice(5)),
    retroPending: 0,
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

interface LiveContext {
  db: Db;
  rows: readonly Row[];
  first: string;
  now: Date;
  /** Approved months computed as now during this read, so each is computed once. */
  again: Map<string, Promise<PayrollMonthDto>>;
}

/** An approved month computed as now, beside its approval (R6); nothing is written. */
function recomputeOf(ctx: LiveContext): (key: string) => Promise<PayrollMonthDto> {
  return (key) => {
    const known = ctx.again.get(key);
    if (known) return known;
    const computed = computeMonth(ctx, key, undefined, true).then((live) => live.dto);
    ctx.again.set(key, computed);
    return computed;
  };
}

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
): Promise<PayrollRetroItemDto[]> {
  if (isApproved(stored?.status)) return (await approvedSnapshotOf(ctx.db, stored))?.retro ?? [];
  const diffs = await retroDiffsFor(ctx.db, { first: ctx.first, dates, recompute: recomputeOf(ctx) });
  if (diffs.length === 0) return [];
  return retroItemsOf(ctx.db, {
    diffs,
    typed: (id) => facts.get(id)?.inputs.retro ?? [],
    placed: new Set(built.flatMap((b) => (b.line ? [b.dto.employeeId] : []))),
  });
}

/** Computed from the close, the profiles and the config (R3): a draft, or a month still waiting for its close. */
export async function liveMonthOf(db: Db, key: string, now: Date): Promise<LiveMonth> {
  const rows = await loadRows(db);
  const first = firstMonth(rows);
  checkRange(key, first, now);
  return computeMonth({ db, rows, first, now, again: new Map() }, key);
}

/**
 * The month on the earlier months of its tax year; an earlier draft is computed the same way, oldest first.
 * `again`: an approved month as it would compute now, without Rà soát.
 */
async function computeMonth(ctx: LiveContext, key: string, known?: YearSoFar, again = false): Promise<LiveMonth> {
  const { db, rows, first, now } = ctx;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5));
  const stored = await storedOf(db, year, month);
  const dates = payrollDates(year, month, stored?.payDate ?? undefined, payDayFor(rows, key));
  const config = payrollConfigFor(rows, null, dates);
  const closing = await closingOf(db, dates, stored, again);
  const regions = await regionsOf(db, closing);
  const shell = { ...shellOf(dates, config, stored), regions };
  if (!closing) {
    const dto: PayrollMonthDto = { ...shell, status: 'waiting', computedAt: null, lines: [], totals: {}, review: [] };
    return { dto, closingId: null };
  }
  const draftOf = async (earlier: string, soFar: YearSoFar) => (await computeMonth(ctx, earlier, soFar)).dto;
  const yearSoFar = known ?? (await yearSoFarOf(db, { rows, first, dates, draftOf }));
  const previousNorms = await previousNormsOf(db, dates, closing);
  const facts = await peopleFactsOf(db, closing.rows, rows, dates, yearSoFar.byEmployee, previousNorms);
  const status = isApproved(stored?.status) && stored ? stored.status : 'draft';
  const plain = closing.rows.flatMap((row) => {
    const person = facts.get(row.employeeId);
    if (!person) return [];
    // Only a draft reads the person's block of today; an approved month stands on its close alone.
    return [buildLine(row, status === 'draft' ? person : { ...person, currentBlock: null }, rows, dates)];
  });
  const retro = await retroOf(ctx, stored, dates, plain, facts);
  const built = plain.map((b) => withRetro(b, retro));
  const lines = built.flatMap((b) => (b.line ? [b.line] : []));
  const dto: PayrollMonthDto = {
    ...shell,
    status,
    computedAt: status === 'draft' ? now.toISOString() : null,
    lines: orderLines(built, regions, config),
    totals: payrollTotals(lines, config.options.rounding),
    review: again ? [] : await reviewOf(db, { built, closing, dates, first, year: yearSoFar, retro }),
    retro,
  };
  return { dto, closingId: closing.closing.id };
}

/** Bản duyệt lần N of an approved or paid month (R4), with the month's state on top. */
async function frozenOf(db: Reader, stored: Stored | undefined): Promise<PayrollMonthDto | undefined> {
  if (!stored || !isApproved(stored.status) || stored.approvalNo === null) return undefined;
  const run = await runOf(db, stored.id, stored.approvalNo);
  if (!run) return undefined;
  return {
    ...run.snapshot,
    status: stored.status,
    computedAt: null,
    approval: approvalOf(stored),
    paidOn: stored.paidOn,
  };
}

/** What an approved month computes differently now and where it goes (R6); null when nothing differs. */
async function retroOutFor(db: Db, key: string, frozen: PayrollMonthDto, now: Date) {
  const rows = await loadRows(db);
  const ctx: LiveContext = { db, rows, first: firstMonth(rows), now, again: new Map() };
  return retroOutOf(db, key, frozen, recomputeOf(ctx));
}

/** `GET /months/:YYYY-MM`: an approved or paid month reads its approval snapshot, any other month is computed. */
export async function payrollMonthOf(db: Db, key: string, now: Date): Promise<PayrollMonthDto> {
  const { year, month } = await monthInRange(db, key, now);
  const frozen = await frozenOf(db, await storedOf(db, year, month));
  if (!frozen) return (await liveMonthOf(db, key, now)).dto;
  return { ...frozen, retroOut: await retroOutFor(db, key, frozen, now) };
}
