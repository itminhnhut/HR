/**
 * Which months a download takes (spec 11.8, 12.1): approved and draft months, never one still estimated (L-F15),
 * and what the shared download dialog says about the choice (L-F09).
 */

export type PayrollMonthStatus = 'approved' | 'paid' | 'draft' | 'waiting' | 'estimate' | 'empty';

export interface PayrollMonthChoice {
  month: number;
  status: PayrollMonthStatus;
}

const EXPORTABLE: ReadonlySet<PayrollMonthStatus> = new Set(['approved', 'paid', 'draft']);

export const canExportMonth = (m: PayrollMonthChoice) => EXPORTABLE.has(m.status);

/** "Tải cả năm": the months of the year that have numbers of their own, in order. */
export const yearExportMonths = (months: readonly PayrollMonthChoice[]): number[] =>
  months
    .filter(canExportMonth)
    .map((m) => m.month)
    .sort((a, b) => a - b);

/** "3 tháng · 1 bản nháp" */
export function exportSummary(chosen: readonly PayrollMonthChoice[]): string {
  if (chosen.length === 0) return 'Chưa chọn tháng nào';
  const drafts = chosen.filter((m) => m.status === 'draft').length;
  return `${chosen.length} tháng${drafts > 0 ? ` · ${drafts} bản nháp` : ''}`;
}
