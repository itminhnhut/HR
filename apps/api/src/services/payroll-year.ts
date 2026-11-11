import {
  EMPTY_YEAR_PART,
  type PayrollDates,
  type PayrollLine,
  type PayrollLineDto,
  type PayrollMonthDto,
  type PayrollMonthSnapshot,
  type PayrollProfileMonthDto,
  type PayrollYearPartDto,
  type ReviewMonthInput,
} from '@careers/shared';
import { and, eq, sql } from 'drizzle-orm';
import { payrollPeriods, payrollRuns } from '../db/schema.js';
import type { Reader } from './payroll-profile-store.js';
import { payDateOf, payDayFor, type Row } from './payroll-versions.js';

/**
 * Số cộng dồn năm thuế (spec-luong.md R9, câu 29, 34): what the earlier pay months of a month's tax year add to the
 * opening balance. The tax year is the year of the pay date, so T12 paid in January counts in the next year. An
 * approved or paid month is read from its approval snapshot and never computed again; a month still in draft is
 * computed now and named, so Rà soát can say the yearly figures stand on a draft.
 */

type OpenMonth = NonNullable<ReviewMonthInput['yearOpenMonths']>[number];

export interface YearSoFar {
  /** Σ of the earlier months of the tax year, by person; someone without a line in them is absent. */
  byEmployee: ReadonlyMap<string, PayrollYearPartDto>;
  openMonths: readonly OpenMonth[];
}

export const NO_YEAR_SO_FAR: YearSoFar = { byEmployee: new Map(), openMonths: [] };

const MONTHS_BACK = 12;
const pad = (n: number) => String(n).padStart(2, '0');
const indexOf = (year: number, month: number) => year * 12 + month - 1;
const keyOf = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;

export const addYearParts = (a: PayrollYearPartDto, b: PayrollYearPartDto): PayrollYearPartDto => ({
  clothingExempt: a.clothingExempt + b.clothingExempt,
  overtimeHours: a.overtimeHours + b.overtimeHours,
  taxable: a.taxable + b.taxable,
  tax: a.tax + b.tax,
  insurance: a.insurance + b.insurance,
});

/** What one computed row adds to the year. */
export const yearPartOfLine = (line: PayrollLine): PayrollYearPartDto => ({
  clothingExempt: line.tax.clothing.exempt,
  overtimeHours: line.tax.overtimeHours.total,
  taxable: line.cells.taxable,
  tax: line.cells.tax,
  insurance: line.cells.insuranceDeduction,
});

/** The year before this pay as the engine reads it: the opening balance HR entered plus the months on the web. */
export function yearBeforeOf(facts: PayrollProfileMonthDto, months: PayrollYearPartDto): PayrollYearPartDto {
  const { opening } = facts;
  if (!opening) return months;
  const entered: PayrollYearPartDto = {
    clothingExempt: opening.clothingPaid,
    overtimeHours: opening.overtimeHours,
    taxable: opening.taxableIncome,
    tax: opening.taxWithheld,
    insurance: 0,
  };
  return addYearParts(entered, months);
}

/**
 * A row of a month as stored or computed. A snapshot approved before the web kept the yearly figures has the cells
 * only: taxable income, tax, insurance and weekday overtime hours are read from them; the clothing exempted and the
 * hours of rest-day work are not known (`partial`).
 */
function partOfDto(line: PayrollLineDto): { part: PayrollYearPartDto; partial: boolean } {
  if (line.year) return { part: line.year.month, partial: false };
  if (!line.contractTypeId) return { part: EMPTY_YEAR_PART, partial: false };
  const { cells } = line;
  const part: PayrollYearPartDto = {
    clothingExempt: 0,
    overtimeHours: cells.overtimeHours,
    taxable: cells.taxable,
    tax: cells.tax,
    insurance: cells.insuranceDeduction,
  };
  return { part, partial: true };
}

function withLines(
  soFar: YearSoFar,
  lines: readonly PayrollLineDto[],
  open: OpenMonth | null,
  month: string,
): YearSoFar {
  const parts = lines.map((line) => ({ id: line.employeeId, ...partOfDto(line) }));
  const byEmployee = new Map(soFar.byEmployee);
  for (const { id, part } of parts) byEmployee.set(id, addYearParts(byEmployee.get(id) ?? EMPTY_YEAR_PART, part));
  const partial: OpenMonth[] = !open && parts.some((p) => p.partial) ? [{ month, state: 'partial' }] : [];
  return { byEmployee, openMonths: [...soFar.openMonths, ...(open ? [open] : []), ...partial] };
}

type Stored = typeof payrollPeriods.$inferSelect;

/** Bản duyệt in force of an approved or paid month; undefined for any other month. */
export async function approvedSnapshotOf(
  db: Reader,
  stored: Stored | undefined,
): Promise<PayrollMonthSnapshot | undefined> {
  const approved = stored?.status === 'approved' || stored?.status === 'paid';
  if (!stored || !approved || stored.approvalNo === null) return undefined;
  const [run] = await db
    .select({ snapshot: payrollRuns.snapshot })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.periodId, stored.id), eq(payrollRuns.approvalNo, stored.approvalNo)));
  return run?.snapshot;
}

export interface YearSoFarArgs {
  rows: readonly Row[];
  /** The first payroll month on the web: the months before it are in the opening balance. */
  first: string;
  dates: PayrollDates;
  /** A month not approved, computed now on the year so far; `waiting` while its timesheet is not closed. */
  draftOf: (key: string, soFar: YearSoFar) => Promise<PayrollMonthDto>;
}

/** The earlier pay months of the tax year of `dates`, oldest first, summed by person. */
export async function yearSoFarOf(db: Reader, { rows, first, dates, draftOf }: YearSoFarArgs): Promise<YearSoFar> {
  const end = indexOf(dates.year, dates.month);
  const stored = await db
    .select()
    .from(payrollPeriods)
    .where(sql`${payrollPeriods.year} * 12 + ${payrollPeriods.month} - 1 between ${end - MONTHS_BACK} and ${end - 1}`);
  const storedOf = (key: string) => stored.find((s) => `${s.year}-${pad(s.month)}` === key);
  const payYearOf = (key: string) =>
    Number((storedOf(key)?.payDate ?? payDateOf(key, payDayFor(rows, key))).slice(0, 4));
  const keys = Array.from({ length: MONTHS_BACK }, (_, i) => keyOf(end - MONTHS_BACK + i)).filter(
    (key) => key >= first && payYearOf(key) === dates.taxYear,
  );
  let soFar = NO_YEAR_SO_FAR;
  for (const key of keys) {
    const month = key.slice(5);
    const approved = await approvedSnapshotOf(db, storedOf(key));
    if (approved) {
      soFar = withLines(soFar, approved.lines, null, month);
      continue;
    }
    const draft = await draftOf(key, soFar);
    const state = draft.status === 'waiting' ? 'waiting' : 'draft';
    soFar = withLines(soFar, draft.lines, { month, state }, month);
  }
  return soFar;
}
