import type { PayrollCellKey } from '@careers/shared';
import type { PayrollLineDto, PayrollMonthDto } from '../../../../api';
import { FILTER_PARAMS, filterLines, monthKeyOf, type PayrollFilters } from '../payrollModel';

/**
 * Tổng quan without React (spec 11.8, step 26): every number is the sum of the month's lines, as the total row of
 * Bảng lương; a month is filtered by its own lines (L-G07); approved and draft months never add into one number (R8).
 */

export interface OverviewSums {
  people: number;
  income: number;
  employeeInsurance: number;
  companyInsurance: number;
  tax: number;
  netPay: number;
  totalCost: number;
}

export type OverviewMeasureId = Exclude<keyof OverviewSums, 'people'>;

/** The money figures in the order shown, each with the columns of HR's file it adds. */
export const OVERVIEW_MEASURES: readonly {
  id: OverviewMeasureId;
  label: string;
  columns: string;
  cells: readonly PayrollCellKey[];
}[] = [
  { id: 'income', label: 'Tổng thu nhập', columns: '(26)', cells: ['income'] },
  {
    id: 'employeeInsurance',
    label: 'BH người lao động',
    columns: '(28) + (29) + (30)',
    cells: ['social', 'health', 'unemployment'],
  },
  { id: 'companyInsurance', label: 'BH công ty', columns: '(47)', cells: ['companyTotal'] },
  { id: 'tax', label: 'Thuế TNCN', columns: '(40)', cells: ['tax'] },
  { id: 'netPay', label: 'Thực nhận', columns: '(42)', cells: ['netPay'] },
  { id: 'totalCost', label: 'Tổng chi phí', columns: '(48)', cells: ['totalCost'] },
];

const EMPTY_SUMS: OverviewSums = {
  people: 0,
  income: 0,
  employeeInsurance: 0,
  companyInsurance: 0,
  tax: 0,
  netPay: 0,
  totalCost: 0,
};

const add = (lines: readonly PayrollLineDto[], keys: readonly PayrollCellKey[]) =>
  lines.reduce((sum, line) => sum + keys.reduce((s, key) => s + (line.cells[key] ?? 0), 0), 0);

export function sumsOf(lines: readonly PayrollLineDto[]): OverviewSums {
  const money = Object.fromEntries(OVERVIEW_MEASURES.map((m) => [m.id, add(lines, m.cells)]));
  return { ...EMPTY_SUMS, ...money, people: lines.length };
}

export type OverviewDimension = 'block' | 'dept' | 'region' | 'contract';
type ListKey = keyof typeof FILTER_PARAMS;
export interface GridFilter {
  key: ListKey;
  value: string;
}

export const OVERVIEW_DIMENSIONS: readonly { id: OverviewDimension; label: string }[] = [
  { id: 'block', label: 'Khối' },
  { id: 'dept', label: 'Bộ phận' },
  { id: 'region', label: 'Khu vực' },
  { id: 'contract', label: 'Loại HĐ' },
];

export interface BreakdownRow {
  key: string;
  label: string;
  sums: OverviewSums;
  /** The filter of Bảng lương showing these lines; null for a part the grid has no filter for (no block, no profile). */
  filter: GridFilter | null;
}

const BLOCK_WORDS: Record<string, string> = { BO: 'BO · Văn phòng', KD: 'KD · Kinh doanh' };

interface Dimension {
  filterKey: ListKey;
  keyOf: (line: PayrollLineDto) => string;
  labelOf: (key: string, month: PayrollMonthDto) => string;
  /** The order of the parts: the month's own list first, then as the lines come. */
  known: (month: PayrollMonthDto) => readonly string[];
}

const DIMENSIONS: Record<OverviewDimension, Dimension> = {
  block: {
    filterKey: 'blocks',
    keyOf: (l) => l.block ?? '',
    labelOf: (key) => BLOCK_WORDS[key] ?? (key || 'Thiếu khối'),
    known: () => ['BO', 'KD'],
  },
  dept: {
    filterKey: 'depts',
    keyOf: (l) => l.department,
    labelOf: (key) => key || 'Chưa có bộ phận',
    known: () => [],
  },
  region: {
    filterKey: 'regions',
    keyOf: (l) => l.regionId,
    labelOf: (key, month) => month.regions.find((r) => r.id === key)?.name ?? (key || 'Chưa có khu vực'),
    known: (month) => month.regions.map((r) => r.id),
  },
  contract: {
    filterKey: 'contracts',
    keyOf: (l) => l.contractTypeId,
    labelOf: (key, month) => month.contractTypes.find((t) => t.id === key)?.name ?? (key || 'Chưa có hồ sơ lương'),
    known: (month) => month.contractTypes.map((t) => t.id),
  },
};

/** The lines shown, split by one attribute of the month itself; only the parts that have someone. */
export function breakdownOf(
  month: PayrollMonthDto,
  lines: readonly PayrollLineDto[],
  dimension: OverviewDimension,
): BreakdownRow[] {
  const d = DIMENSIONS[dimension];
  const present = [...new Set(lines.map(d.keyOf))];
  const known = d.known(month).filter((key) => present.includes(key));
  const others = present.filter((key) => !known.includes(key) && key !== '');
  const keys = [...known, ...others, ...(present.includes('') ? [''] : [])];
  return keys.map((key) => ({
    key,
    label: d.labelOf(key, month),
    sums: sumsOf(lines.filter((l) => d.keyOf(l) === key)),
    filter: key ? { key: d.filterKey, value: key } : null,
  }));
}

function gridParams(monthKey: string, filters: PayrollFilters, only?: GridFilter | null): URLSearchParams {
  const params = new URLSearchParams({ ky: monthKey });
  (Object.keys(FILTER_PARAMS) as ListKey[]).forEach((key) => {
    const values = only?.key === key ? [only.value] : filters[key];
    if (values.length > 0) params.set(FILTER_PARAMS[key], values.join(','));
  });
  if (filters.query.trim()) params.set('tim', filters.query);
  return params;
}

/** Bảng lương on that month with the same filters (and one part of a breakdown): its total row is the number clicked. */
export const gridLink = (monthKey: string, filters: PayrollFilters, only?: GridFilter | null): string =>
  `/hr/luong?${gridParams(monthKey, filters, only).toString()}`;

/** Rà soát open over the grid of that month (`rs=1`). */
export function reviewLink(monthKey: string, filters: PayrollFilters): string {
  const params = gridParams(monthKey, filters);
  params.set('rs', '1');
  return `/hr/luong?${params.toString()}`;
}

export type OverviewView = 'thang' | 'nam';
export interface OverviewChoice {
  view: OverviewView;
  year: number;
}

/** `?xem=thang|nam&nam=2026`: the month view and the year of the page's pay month unless the address says else. */
export function overviewFromParams(params: URLSearchParams, payYear: number): OverviewChoice {
  const year = params.get('nam') ?? '';
  return { view: params.get('xem') === 'nam' ? 'nam' : 'thang', year: /^\d{4}$/.test(year) ? Number(year) : payYear };
}

/** The address of Tổng quan for a view and a year: the month and the filters stay; a default is not written. */
export function overviewSearch(search: string, choice: OverviewChoice, payYear: number): string {
  const next = new URLSearchParams(search);
  next.delete('xem');
  next.delete('nam');
  if (choice.view === 'nam') next.set('xem', 'nam');
  if (choice.year !== payYear) next.set('nam', String(choice.year));
  return `?${next.toString()}`;
}

/** What the page knows of one month of the year. `none`: the server has no payroll for it (before the web). */
export type MonthLoad =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'month'; month: PayrollMonthDto };

export type YearRowStatus = 'loading' | 'none' | 'error' | PayrollMonthDto['status'];

export interface YearRow {
  month: number;
  monthKey: string;
  status: YearRowStatus;
  /** Why the month could not be read. */
  message: string | null;
  loaded: PayrollMonthDto | null;
  /** Null when the month has no number to show: not there, loading, failed, or waiting for the timesheet. */
  sums: OverviewSums | null;
  employeeIds: readonly string[];
}

function yearRowOf(year: number, month: number, load: MonthLoad, filters: PayrollFilters): YearRow {
  const base = { month, monthKey: monthKeyOf(year, month), message: null, loaded: null, sums: null, employeeIds: [] };
  if (load.kind === 'error') return { ...base, status: 'error', message: load.message };
  if (load.kind !== 'month') return { ...base, status: load.kind };
  if (load.month.status === 'waiting') return { ...base, status: 'waiting', loaded: load.month };
  const lines = filterLines(load.month.lines, filters);
  return {
    ...base,
    status: load.month.status,
    loaded: load.month,
    sums: sumsOf(lines),
    employeeIds: lines.map((l) => l.employeeId),
  };
}

/** T1–T12 of the pay year, each month filtered by its own lines. */
export const yearRowsOf = (year: number, loads: readonly MonthLoad[], filters: PayrollFilters): YearRow[] =>
  Array.from({ length: 12 }, (_, i) => yearRowOf(year, i + 1, loads[i] ?? { kind: 'loading' }, filters));

export interface YearPart {
  months: number;
  /** `people`: each person once, however many months they were paid. */
  sums: OverviewSums;
}

function partOf(rows: readonly YearRow[]): YearPart {
  const money = rows.reduce<OverviewSums>((total, row) => {
    const sums = row.sums ?? EMPTY_SUMS;
    return Object.fromEntries(
      Object.entries(total).map(([key, value]) => [key, value + sums[key as keyof OverviewSums]]),
    ) as unknown as OverviewSums;
  }, EMPTY_SUMS);
  return { months: rows.length, sums: { ...money, people: new Set(rows.flatMap((r) => r.employeeIds)).size } };
}

/** The year in two totals, each named (R8, L-G06): approved months (paid ones too) and draft months. */
export function yearTotalsOf(rows: readonly YearRow[]): { approved: YearPart; draft: YearPart } {
  return {
    approved: partOf(rows.filter((r) => r.status === 'approved' || r.status === 'paid')),
    draft: partOf(rows.filter((r) => r.status === 'draft')),
  };
}
