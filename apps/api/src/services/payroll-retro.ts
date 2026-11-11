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
import { and, asc, gt, inArray, sql } from 'drizzle-orm';
import { payrollLog, payrollPeriods } from '../db/schema.js';
import type { BuiltLine } from './payroll-month-lines.js';
import type { Reader } from './payroll-profile-store.js';
import { moneyWords, monthWords } from './payroll-words.js';
import { approvedSnapshotOf, yearPartOfLine } from './payroll-year.js';

/**
 * Truy lĩnh / truy thu (spec-luong.md R6 (a), 11.4; step 17). An approved or paid month is never computed again in
 * place. Here it is computed "as now" beside its approval (nothing written): what differs, cell by cell and person by
 * person, less what approved months after it already carried, goes to the next open month. The receiving month's
 * approval keeps the items it carried, so they are not proposed again.
 */

type Cells = Partial<Record<PayrollMoneyCell, number>>;
type Stored = typeof payrollPeriods.$inferSelect;

/** How far back an approved month is still compared; an older change waits for the yearly settlement. */
export const RETRO_MONTHS_BACK = 6;
const MAX_CAUSES = 5;
const CAUSE_AREAS = ['ho-so', 'cau-hinh', 'cham-cong'] as const;

const pad = (n: number) => String(n).padStart(2, '0');
const indexOf = (year: number, month: number) => year * 12 + month - 1;
const keyOf = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
const indexOfKey = (key: string) => indexOf(Number(key.slice(0, 4)), Number(key.slice(5)));
const isApproved = (s: Stored | undefined): s is Stored => s?.status === 'approved' || s?.status === 'paid';

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
    const done = carried.filter((r) => r.origin === origin && r.employeeId === id).map((r) => r.cells);
    const cells = remainingCells(nowLine, approvedLine, done);
    const person = nowLine ?? approvedLine;
    if (!person || Object.keys(cells).length === 0) return [];
    return [{ employeeId: id, code: person.code, fullName: person.fullName, cells }];
  });
}

async function storedBetween(db: Reader, from: number, to: number): Promise<Stored[]> {
  return db
    .select()
    .from(payrollPeriods)
    .where(sql`${payrollPeriods.year} * 12 + ${payrollPeriods.month} - 1 between ${from} and ${to}`);
}

interface Approved {
  key: string;
  stored: Stored;
  snapshot: PayrollMonthSnapshot;
}

/** The approved months in a row from `start`, going `step` (−1 back, +1 on), until the first month that is not. */
async function approvedRun(db: Reader, stored: readonly Stored[], start: number, step: 1 | -1): Promise<Approved[]> {
  const run: Approved[] = [];
  for (let i = start, n = 0; n < RETRO_MONTHS_BACK; i += step, n += 1) {
    const key = keyOf(i);
    const period = stored.find((s) => indexOf(s.year, s.month) === i);
    const snapshot = isApproved(period) ? await approvedSnapshotOf(db, period) : undefined;
    if (!period || !snapshot) break;
    run.push({ key, stored: period, snapshot });
  }
  return run;
}

export interface RetroArgs {
  /** The first payroll month on the web. */
  first: string;
  dates: Pick<PayrollDates, 'year' | 'month'>;
  /** An approved month computed as now, on its latest timesheet close; nothing is written. */
  recompute: (key: string) => Promise<PayrollMonthDto>;
}

/**
 * What the open month `dates` receives: the differences of the approved months right before it, oldest first. A
 * month before another open month is that month's to receive.
 */
export async function retroDiffsFor(db: Reader, { first, dates, recompute }: RetroArgs): Promise<OriginDiff[]> {
  const end = indexOf(dates.year, dates.month);
  const stored = await storedBetween(db, end - RETRO_MONTHS_BACK, end - 1);
  const chain = (await approvedRun(db, stored, end - 1, -1)).filter((m) => m.key >= first).reverse();
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
  recompute: RetroArgs['recompute'],
): Promise<PayrollRetroOutDto | null> {
  const start = indexOfKey(key) + 1;
  const later = await approvedRun(db, await storedBetween(db, start, start + RETRO_MONTHS_BACK), start, 1);
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

/** The log lines after the approval that can explain a person's difference: their profile, the config, the timesheet. */
function causesOf(lines: readonly LogLine[], origin: OriginDiff, code: string): PayrollRetroCauseDto[] {
  const since = origin.approvedAt;
  return lines
    .filter((l) => !since || l.at > since)
    .filter((l) => {
      if (l.area === 'cau-hinh') return true;
      if (l.area === 'cham-cong') return l.month === origin.origin;
      return mentions(l.detail, code);
    })
    .slice(-MAX_CAUSES)
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

const retroWords = (origin: string) => `${origin.slice(5)}/${origin.slice(0, 4)}`;

/** The row of the receiving month with its items inside: the cells, the totals, the yearly figures and Ghi chú. */
export function withRetro(built: BuiltLine, items: readonly PayrollRetroItemDto[]): BuiltLine {
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
