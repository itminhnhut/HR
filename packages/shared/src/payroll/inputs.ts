/** What HR types into a month (spec 2 (4)), checked where it enters the system. */

export const KPI_PERCENT_MAX = 2;

/** L-D08: no % for a person without KPI; 0–200% otherwise. */
export function kpiPercentError(percent: number, kpiAmount: number): string | null {
  if (kpiAmount <= 0) return 'Người này không có KPI, ô % khoá.';
  if (!Number.isFinite(percent) || percent < 0 || percent > KPI_PERCENT_MAX) return 'Nhập % trong khoảng 0–200%.';
  return null;
}

/** L-D09: overtime hours go in steps of half an hour. */
export function overtimeHoursError(hours: number): string | null {
  if (!Number.isFinite(hours) || hours < 0) return 'Nhập số giờ từ 0.';
  return Number.isInteger(hours * 2) ? null : 'Nhập giờ theo bước 0,5.';
}
