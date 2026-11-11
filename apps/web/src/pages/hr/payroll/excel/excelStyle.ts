import type { Cell, Worksheet } from 'exceljs';
import type { CellFormat } from './columns';

/** The look of the timesheet export (../../timesheet/exportExcel.ts), shared by the payroll sheets and payslips. */

export const RED = 'FFFF0000';
export const WHITE = 'FFFFFFFF';
export const PALE_RED = 'FFFCE4D6';
export const PALE_YELLOW = 'FFFFF2CC';
export const GREY = 'FFD9D9D9';
export const SERIF = 'Times New Roman';
export const COMPANY = 'CÔNG TY TNHH TOP FLOW';

export const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const THIN = { style: 'thin' as const, color: { argb: 'FF8A8A8A' } };
export const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** HR's file shows 6,000,000 and a dash for zero; Excel puts the separators of the reader's locale. */
export const MONEY_FORMAT = '#,##0;-#,##0;"-"';

export const NUMBER_FORMATS: Record<CellFormat, string | undefined> = {
  index: '0',
  text: undefined,
  count: '0',
  bracket: '0;-0;"-"',
  money: MONEY_FORMAT,
  days: '0.0;-0.0;"-"',
  paidDays: '0.0',
  percent: '0%',
};

/** A white bold heading on red, as the timesheet's header cells. */
export function headCell(cell: Cell, value: string): void {
  Object.assign(cell, {
    value,
    fill: fill(RED),
    border: BOX,
    font: { bold: true, color: { argb: WHITE }, name: SERIF },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });
}

export function text(sheet: Worksheet, address: string, value: string | number, font: object = {}): void {
  Object.assign(sheet.getCell(address), { value, font: { name: SERIF, ...font } });
}

/** Saved as a file name with the sheet names Excel accepts: at most 31 characters, none of []:*?/\. */
export function safeSheetName(name: string, taken: ReadonlySet<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, '-').slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; taken.has(candidate); i += 1) candidate = `${base.slice(0, 27)} (${i})`;
  return candidate;
}
