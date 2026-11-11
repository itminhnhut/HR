import type { PayrollMonthDto } from '../../../../api';
import { canExportDto } from '../excel/fromMonth';
import { canExportMonth, type PayrollMonthChoice } from '../excel/selection';
import type { MonthLoad } from '../overview/overviewModel';

/** Which months a payroll download asks the server for (spec 12.1, 11.8): only months with numbers of their own. */

const statusOf = (month: PayrollMonthDto): PayrollMonthChoice['status'] => {
  if (canExportDto(month)) return month.status;
  return month.status === 'waiting' ? 'waiting' : 'empty';
};

/** T1…T12 of a pay year as the download sees them; a month not read (yet) cannot be chosen. */
export const yearChoicesOf = (loads: readonly MonthLoad[]): PayrollMonthChoice[] =>
  loads.map((load, i) => ({ month: i + 1, status: load.kind === 'month' ? statusOf(load.month) : 'empty' }));

/** The months with numbers from one month to another, either way round. */
export function rangeChoices(choices: readonly PayrollMonthChoice[], from: number, to: number): PayrollMonthChoice[] {
  const [first, last] = from <= to ? [from, to] : [to, from];
  return choices.filter((c) => canExportMonth(c) && c.month >= first && c.month <= last);
}

export const monthKeysOf = (year: number, months: readonly number[]): string[] =>
  months.map((m) => `${year}-${String(m).padStart(2, '0')}`);

/** `?phieu=<employeeId>` over the grid: the tab, the month and the filters stay. */
export function payslipSearch(search: string, employeeId: string): string {
  const next = new URLSearchParams(search);
  next.set('phieu', employeeId);
  return `?${next.toString()}`;
}

/** "(NHÁP)" beside a month that is not approved yet, as its file is marked. */
export const draftMark = (month: PayrollMonthDto) => (month.status === 'draft' ? ' (NHÁP)' : '');
