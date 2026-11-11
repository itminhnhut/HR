import type { PayrollDates } from '@careers/shared';
import type { PayrollDownload, PayrollExportMonth, PayrollStamp } from './types';

/** Words and numbers as the payroll file and payslip print them: dd/mm/yyyy, 6.400.000, 1,5% (spec 4.15). */

const MONEY = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 });

export const money = (n: number) => MONEY.format(n);
export const decimal = (n: number) => NUMBER.format(n);
export const percent = (n: number) => PERCENT.format(n);

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-11-05` → `05/11/2026`. */
export const dayText = (iso: string) => {
  const [y = '', m = '', d = ''] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

/** `2026-11-08T09:10` → `08/11/2026 09:10`. */
export const timeText = (local: string) => `${dayText(local)} ${local.slice(11, 16)}`;

/** `2026-01` → `T1/2026`. */
export const monthKeyText = (key: string) => `T${Number(key.slice(5, 7))}/${key.slice(0, 4)}`;

export const monthText = (dates: PayrollDates) => `T${dates.month}/${dates.year}`;
export const sheetName = (dates: PayrollDates) => `Tháng ${dates.month}.${String(dates.year).slice(2)}`;

/** The version of the month (R8), as on the payslip and the "Tham số" sheet. */
export function versionText(stamp: PayrollStamp): string {
  if (stamp.kind === 'draft') return `BẢN NHÁP · tính lúc ${timeText(stamp.computedAt)}, số còn đổi`;
  const base = `Bản duyệt lần ${stamp.round} · duyệt ${timeText(stamp.approvedAt)} bởi ${stamp.approvedBy}`;
  return stamp.supersededBy ? `${base} · đã thay bởi lần ${stamp.supersededBy}` : base;
}

/** The stamp at the top of a month sheet: its version and the download (R8, L-F02, L-F05, L-F14). */
export function stampText(stamp: PayrollStamp, download: PayrollDownload): string {
  const fetched = `tải ${timeText(download.at)} bởi ${download.by}`;
  if (stamp.kind === 'draft' || !stamp.supersededBy) return `${versionText(stamp)} · ${fetched}`;
  const { supersededBy, ...rest } = stamp;
  return `${versionText(rest)} · ${fetched} · đã thay bởi lần ${supersededBy}`;
}

/** `TP. Hồ Chí Minh, ngày 05 tháng 11 năm 2026` from the pay date (L-F23). */
export function signatureDate(payDate: string): string {
  const [y = '', m = '', d = ''] = payDate.split('-');
  return `TP. Hồ Chí Minh, ngày ${pad(Number(d))} tháng ${pad(Number(m))} năm ${y}`;
}

const versionSuffix = (stamp: PayrollStamp) => (stamp.kind === 'draft' ? 'NHAP' : `lan-${stamp.round}`);

/** L-F13: `Bang-luong-10-2026-lan-2.xlsx`, `Bang-luong-11-2026-NHAP.xlsx`, `Bang-luong-2026-T08-T10.xlsx`. */
export function payrollFileName(months: readonly PayrollExportMonth[]): string {
  const sorted = [...months].sort((a, b) => a.dates.month - b.dates.month);
  const [first] = sorted;
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 'Bang-luong.xlsx';
  const { month, year } = first.dates;
  if (sorted.length === 1) return `Bang-luong-${month}-${year}-${versionSuffix(first.stamp)}.xlsx`;
  return `Bang-luong-${year}-T${pad(month)}-T${pad(last.dates.month)}.xlsx`;
}

export const payslipFileName = (month: PayrollExportMonth) =>
  `Phieu-luong-${month.dates.month}-${month.dates.year}-${versionSuffix(month.stamp)}.xlsx`;
