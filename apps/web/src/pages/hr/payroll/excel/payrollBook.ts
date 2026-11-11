import type { Workbook } from 'exceljs';
import { logoBytes, saveBook } from '../../timesheet/exportExcel';
import { payrollFileName } from './format';
import { addMonthSheet } from './monthSheet';
import { addParamsSheet } from './paramsSheet';
import { addSummarySheet } from './summarySheet';
import type { PayrollDownload, PayrollExportMonth } from './types';

/**
 * The payroll file (spec 12.1): one sheet a month in month order, each by its own version (Q3), "Tổng hợp" when
 * there are several, then "Tham số". Months of two years go in two files (L-F16). The library loads on demand.
 */
export async function buildPayrollBook(
  months: readonly PayrollExportMonth[],
  download: PayrollDownload,
  logo?: ArrayBuffer,
): Promise<Workbook> {
  const years = new Set(months.map((m) => m.dates.year));
  if (years.size > 1) throw new Error('Mỗi file chỉ gồm các tháng của một năm. Muốn hai năm thì tải hai lần.');
  if (months.length === 0) throw new Error('Chưa chọn tháng nào.');
  const sorted = [...months].sort((a, b) => a.dates.month - b.dates.month);
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  sorted.forEach((month) => addMonthSheet(book, month, download, logo));
  if (sorted.length > 1) addSummarySheet(book, sorted);
  addParamsSheet(book, sorted);
  return book;
}

/** Entry point for the Bảng lương, Tổng quan and Phiếu lương download dialog (Q9). */
export async function exportPayroll(months: readonly PayrollExportMonth[], download: PayrollDownload): Promise<void> {
  const book = await buildPayrollBook(months, download, await logoBytes());
  await saveBook(book, payrollFileName(months));
}
