import {
  adjustLine,
  PAYROLL_MONEY_CELLS,
  type PayrollDates,
  type PayrollLineDto,
  type PayrollMoneyCell,
  type PayrollMonthDto,
  type PayrollMonthSnapshot,
  type PayrollRetroCauseDto,
  type PayrollRetroInputDto,
  type PayrollRetroItemDto,
  type PayrollRetroOutDto,
} from '@careers/shared';
import { and, asc, gt, inArray } from 'drizzle-orm';
import { payrollLog } from '../db/schema.js';
import {
  indexOf,
  indexOfKey,
  isApprovedPeriod,
  keyOf,
  storedBetween,
  type SnapshotOf,
  type StoredPeriod,
} from './payroll-month-index.js';
import type { BuiltLine } from './payroll-month-lines.js';
import type { Reader } from './payroll-profile-store.js';
import { moneyWords, monthWords } from './payroll-words.js';
import { yearPartOfLine } from './payroll-year.js';

/**
 * Truy lĩnh / truy thu (spec-luong.md R6 (a), 11.4; step 17). An approved or paid month is never computed again in
 * place. Here it is computed "as now" beside its approval (nothing written): what differs, cell by cell and person by
 * person, less what approved months after it already carried, goes to the next open month. The receiving month's
 * approval keeps the items it carried, so they are not proposed again.
 */

type Cells = Partial<Record<PayrollMoneyCell, number>>;

/** How far back an approved month is still compared; an older change waits for the yearly settlement. */
export const RETRO_MONTHS_BACK = 6;
const MAX_CAUSES = 5;
const CAUSE_AREAS = ['ho-so', 'cau-hinh', 'cham-cong'] as const;

/** "YYYY-MM" as Rà soát and the log write it: "MM/YYYY". */
const retroWords = (origin: string) => `${origin.slice(5)}/${origin.slice(0, 4)}`;

const moneyOf = (line: PayrollLineDto | undefined, key: PayrollMoneyCell) => line?.cells[key] ?? 0;

const withoutZeros = (cells: Cells): Cells =>
  Object.fromEntries(Object.entries(cells).filter(([, value]) => value !== 0));

/** The month computed again minus its approval, less what was carried already; only the cells that differ. */
function remainingCells(
  now: PayrollLineDto | undefined,
  approved: PayrollLineDto | undefined,
  carried: readonly Cells[],
): Cells {
  const cells = PAYROLL_MONEY_CELLS.map((key) => {
    const done = carried.reduce((total, c) => total + (c[key] ?? 0), 0);
    return [key, moneyOf(now, key) - moneyOf(approved, key) - done] as const;
  });
  return withoutZeros(Object.fromEntries(cells));
}

interface PersonDiff {
  employeeId: string;
  code: string;
  fullName: string;
  cells: Cells;
}

/** What one approved month computes differently now, per person, not carried yet. */
export interface OriginDiff {
  origin: string;
  approvalNo: number | null;
  approvedAt: Date | null;
  people: PersonDiff[];
}

/**
 * Only an item a later approval placed on a row was carried: one without a row there paid nothing, so its difference
 * is still owed and goes to the next month where the person has a row.
 */
const carriedBy = (items: readonly PayrollRetroItemDto[], origin: string, employeeId: string) =>
  items.filter((r) => r.placed && r.origin === origin && r.employeeId === employeeId).map((r) => r.cells);

function peopleDiffs(
  origin: string,
  now: readonly PayrollLineDto[],
  approved: readonly PayrollLineDto[],
  carried: readonly PayrollRetroItemDto[],
): PersonDiff[] {
  const ids = [...new Set([...approved, ...now].map((l) => l.employeeId))];
  return ids.flatMap((id) => {
    const nowLine = now.find((l) => l.employeeId === id);
    const approvedLine = approved.find((l) => l.employeeId === id);
    const done = carriedBy(carried, origin, id);
    const cells = remainingCells(nowLine, approvedLine, done);
    const person = nowLine ?? approvedLine;
    if (!person || Object.keys(cells).length === 0) return [];
    return [{ employeeId: id, code: person.code, fullName: person.fullName, cells }];
  });
}

interface Approved {
  key: string;
  stored: StoredPeriod;
  snapshot: PayrollMonthSnapshot;
}

/** The approved months in a row from `start`, going `step` (−1 back, +1 on), until the first month that is not. */
async function approvedRun(
  snapshotOf: SnapshotOf,
  stored: readonly StoredPeriod[],
  start: number,
  step: 1 | -1,
): Promise<Approved[]> {
  const run: Approved[] = [];
  for (let i = start, n = 0; n < RETRO_MONTHS_BACK; i += step, n += 1) {
    const key = keyOf(i);
    const period = stored.find((s) => indexOf(s.year, s.month) === i);
    const snapshot = isApprovedPeriod(period) ? await snapshotOf(period) : undefined;
    if (!period || !snapshot) break;
    run.push({ key, stored: period, snapshot });
  }
  return run;
}

/** What the months around an approved month are read with: one request's approvals and its months computed as now. */
export interface RetroReaders {
  /** An approved month computed as now, on its latest timesheet close; nothing is written. */
  recompute: (key: string) => Promise<PayrollMonthDto>;
  /** The approval snapshots of the request (`snapshotsOf`). */
  snapshotOf: SnapshotOf;
}

export interface RetroArgs extends RetroReaders {
  /** The first payroll month on the web. */
  first: string;
  dates: Pick<PayrollDates, 'year' | 'month'>;
}

/**
 * What the open month `dates` receives: the differences of the approved months right before it, oldest first. A
 * month before another open month is that month's to receive.
 */
export async function retroDiffsFor(
  db: Reader,
  { first, dates, recompute, snapshotOf }: RetroArgs,
): Promise<OriginDiff[]> {
  const end = indexOf(dates.year, dates.month);
  const stored = await storedBetween(db, end - RETRO_MONTHS_BACK, end - 1);
  const chain = (await approvedRun(snapshotOf, stored, end - 1, -1)).filter((m) => m.key >= first).reverse();
  const diffs: OriginDiff[] = [];
  for (const [i, month] of chain.entries()) {
    const now = await recompute(month.key);
    const carried = chain.slice(i + 1).flatMap((later) => later.snapshot.retro ?? []);
    const people = peopleDiffs(month.key, now.lines, month.snapshot.lines, carried);
    if (people.length === 0) continue;
    const { approvalNo, approvedAt } = month.stored;
    diffs.push({ origin: month.key, approvalNo, approvedAt, people });
  }
  return diffs;
}

/** An approved month read now: where its difference goes, or null when it computes as approved (or was carried). */
export async function retroOutOf(
  db: Reader,
  key: string,
  snapshot: PayrollMonthSnapshot,
  { recompute, snapshotOf }: RetroReaders,
): Promise<PayrollRetroOutDto | null> {
  const start = indexOfKey(key) + 1;
  const later = await approvedRun(snapshotOf, await storedBetween(db, start, start + RETRO_MONTHS_BACK), start, 1);
  // Past the months still compared, the difference is no longer carried.
  if (later.length >= RETRO_MONTHS_BACK) return null;
  const now = await recompute(key);
  const carried = later.flatMap((m) => m.snapshot.retro ?? []);
  const people = peopleDiffs(key, now.lines, snapshot.lines, carried);
  if (people.length === 0) return null;
  const net = people.reduce((total, p) => total + (p.cells.netPay ?? 0), 0);
  return { month: keyOf(start + later.length), people: people.length, net };
}

type LogLine = typeof payrollLog.$inferSelect;

/** The code as a whole word: "NV01" is not in "NV010". */
const mentions = (detail: string, code: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(detail);

/** A config line for everyone; one for a single person names them ("cho NV01 …", `payroll-settings`). */
const isForEveryone = (detail: string) => detail.includes('cho tất cả');

/**
 * The log lines after the approval that can explain a person's difference: their profile, the config for everyone
 * or for them, the timesheet of that month. The lines about the person come first, then the latest others, up to
 * MAX_CAUSES, in time order.
 */
function causesOf(lines: readonly LogLine[], origin: OriginDiff, code: string): PayrollRetroCauseDto[] {
  const since = origin.approvedAt;
  const after = lines.filter((l) => !since || l.at > since);
  const own = after.filter((l) => l.area !== 'cham-cong' && mentions(l.detail, code));
  const others = after.filter((l) =>
    l.area === 'cham-cong' ? l.month === origin.origin : l.area === 'cau-hinh' && isForEveryone(l.detail),
  );
  const kept = own.slice(-MAX_CAUSES);
  const room = MAX_CAUSES - kept.length;
  const picked = new Set([...kept, ...(room > 0 ? others.slice(-room) : [])]);
  return after
    .filter((l) => picked.has(l))
    .map((l) => ({ area: l.area, action: l.action, detail: l.detail, by: l.actor, at: l.at.toISOString() }));
}

async function causeLines(db: Reader, diffs: readonly OriginDiff[]): Promise<LogLine[]> {
  const times = diffs.flatMap((d) => (d.approvedAt ? [d.approvedAt.getTime()] : []));
  if (times.length === 0) return [];
  return db
    .select()
    .from(payrollLog)
    .where(and(inArray(payrollLog.area, [...CAUSE_AREAS]), gt(payrollLog.at, new Date(Math.min(...times)))))
    .orderBy(asc(payrollLog.at));
}

export interface RetroItemsArgs {
  diffs: readonly OriginDiff[];
  /** What HR typed for the month, by person. */
  typed: (employeeId: string) => readonly PayrollRetroInputDto[];
  /** People with a computed row in the receiving month. */
  placed: ReadonlySet<string>;
}

/** The items of the receiving month: computed, or as HR typed over them (0: left out), each with its causes. */
export async function retroItemsOf(
  db: Reader,
  { diffs, typed, placed }: RetroItemsArgs,
): Promise<PayrollRetroItemDto[]> {
  const lines = await causeLines(db, diffs);
  return diffs.flatMap((origin) =>
    origin.people.map((person) => {
      const input = typed(person.employeeId).find((t) => t.origin === origin.origin);
      const computed = person.cells.netPay ?? 0;
      const isPlaced = placed.has(person.employeeId);
      return {
        ...person,
        origin: origin.origin,
        originApproval: origin.approvalNo,
        computed,
        typed: input ? input.amount : null,
        reason: input?.reason ?? '',
        amount: isPlaced ? (input ? input.amount : computed) : 0,
        placed: isPlaced,
        causes: causesOf(lines, origin, person.code),
      };
    }),
  );
}

/** The amounts typed for a person with no computed item of their month, and not left out (0). */
function uncomputedInputs(
  employeeId: string,
  typed: (employeeId: string) => readonly PayrollRetroInputDto[],
  computed: readonly PayrollRetroItemDto[],
): PayrollRetroInputDto[] {
  const isComputed = (origin: string) => computed.some((c) => c.employeeId === employeeId && c.origin === origin);
  return typed(employeeId).filter((input) => input.amount !== 0 && !isComputed(input.origin));
}

/**
 * Truy lĩnh / truy thu HR adds by hand (C03): an amount typed for a month the web computed no difference of — pay
 * forgotten before the web, money to take back. It is HR's own number, so it moves (32) and (42) only, as an amount
 * typed over a computed one does; it carries no cells, so a later difference of that month is never reduced by it.
 * An amount typed over a computed difference that is gone since is not one of them (`staleRetroOf`).
 */
export function manualRetroItems(
  people: readonly { employeeId: string; code: string; fullName: string }[],
  typed: (employeeId: string) => readonly PayrollRetroInputDto[],
  computed: readonly PayrollRetroItemDto[],
): PayrollRetroItemDto[] {
  return people.flatMap((person) =>
    uncomputedInputs(person.employeeId, typed, computed)
      .filter((input) => !input.overComputed)
      .map((input) => ({
        employeeId: person.employeeId,
        code: person.code,
        fullName: person.fullName,
        origin: input.origin,
        originApproval: null,
        cells: {},
        computed: 0,
        typed: input.amount,
        reason: input.reason,
        amount: input.amount,
        placed: true,
        causes: [],
      })),
  );
}

/** By person, the months "MM/YYYY" of the amounts typed over a computed difference that is gone: not paid. */
export function staleRetroOf(
  people: readonly { employeeId: string }[],
  typed: (employeeId: string) => readonly PayrollRetroInputDto[],
  computed: readonly PayrollRetroItemDto[],
): Map<string, string[]> {
  const stale = people.flatMap(({ employeeId }) => {
    const origins = uncomputedInputs(employeeId, typed, computed)
      .filter((input) => input.overComputed)
      .map((input) => retroWords(input.origin));
    return origins.length > 0 ? [[employeeId, origins] as const] : [];
  });
  return new Map(stale);
}

/** What the row's cells move by: every cell of a computed item; (32) and (42) alone for an amount HR typed. */
const movesOf = (item: PayrollRetroItemDto): Cells =>
  item.typed === null ? item.cells : { cash: item.typed, netPay: item.typed };

function sumCells(all: readonly Cells[]): Cells {
  const total: Cells = {};
  for (const cells of all) {
    for (const key of PAYROLL_MONEY_CELLS) {
      const value = cells[key];
      if (value) total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

const signed = (amount: number) => (amount > 0 ? `+${moneyWords(amount)}` : moneyWords(amount));

function noteOf(item: PayrollRetroItemDto): string {
  if (item.typed === 0) return '';
  const kind = item.amount > 0 ? 'Truy lĩnh' : item.amount < 0 ? 'Truy thu' : 'Điều chỉnh';
  return `${kind} ${monthWords(item.origin)} ${signed(item.amount)}${item.typed === null ? '' : ' (HR gõ)'}`;
}

/** The amounts typed over a difference that is gone, for Rà soát. */
function withStale(built: BuiltLine, stale: readonly string[]): BuiltLine {
  if (stale.length === 0) return built;
  return { ...built, review: { ...built.review, inputs: { ...built.review.inputs, retroStale: stale } } };
}

/** What the receiving month carries: its items and, by person, the typed amounts left out as stale. */
export interface MonthRetro {
  items: readonly PayrollRetroItemDto[];
  stale: ReadonlyMap<string, readonly string[]>;
}

/** The row of the receiving month with its items inside: the cells, the totals, the yearly figures and Ghi chú. */
export function withRetro(plain: BuiltLine, { items, stale }: MonthRetro): BuiltLine {
  const built = withStale(plain, stale.get(plain.dto.employeeId) ?? []);
  const mine = items.filter((i) => i.employeeId === built.dto.employeeId && i.placed);
  if (!built.line || mine.length === 0) return built;
  const line = adjustLine(built.line, sumCells(mine.map(movesOf)));
  const notes = [built.dto.note, ...mine.map(noteOf)].filter(Boolean).join('; ');
  const dto: PayrollLineDto = {
    ...built.dto,
    cells: { ...built.dto.cells, ...line.cells },
    note: notes,
    retroNet: mine.reduce((total, i) => total + i.amount, 0),
    year: built.dto.year ? { ...built.dto.year, month: yearPartOfLine(line) } : undefined,
  };
  const retroTyped = mine.flatMap((i) =>
    i.typed === null ? [] : [{ origin: retroWords(i.origin), computed: i.computed, typed: i.typed }],
  );
  const review = { ...built.review, line, inputs: { ...built.review.inputs, retroTyped } };
  return { ...built, dto, line, review };
}
