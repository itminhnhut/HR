import type { Workbook, Worksheet } from 'exceljs';
import { saveBook } from '../../timesheet/exportExcel';
import { BOX, COMPANY, fill, GREY, MONEY_FORMAT, PALE_RED, RED, safeSheetName, SERIF, text } from './excelStyle';
import { payslipFileName } from './format';
import type { Payslip, PayslipFormat } from './payslip';
import type { PayrollExportMonth } from './types';

/**
 * Payslips as one file, one sheet a person (spec 11.7, L-F22), each fitting one A4 page. A draft says NHÁP at the
 * top and across the printed page (L-F19). No signature block on a payslip (Q4).
 */

const FORMATS: Record<PayslipFormat, string> = {
  money: MONEY_FORMAT,
  days: '0.0;-0.0;"-"',
  hours: '0.0;-0.0;"-"',
  percent: '0%',
};

function writeHead(sheet: Worksheet, slip: Payslip): number {
  text(sheet, 'A1', COMPANY, { bold: true });
  if (slip.isDraft) {
    Object.assign(sheet.getCell('C1'), {
      value: 'NHÁP',
      font: { name: SERIF, bold: true, size: 20, color: { argb: RED } },
    });
    sheet.headerFooter.oddHeader = '&C&"Times New Roman,Bold"&36&KFF0000NHÁP';
  }
  sheet.mergeCells('A2:C2');
  Object.assign(sheet.getCell('A2'), {
    value: slip.title,
    font: { name: SERIF, bold: true, size: 14, color: { argb: RED } },
    alignment: { horizontal: 'center' },
  });
  text(sheet, 'A3', slip.stamp, { italic: true, size: 9 });
  if (slip.replaces) text(sheet, 'A4', slip.replaces, { italic: true, size: 9, color: { argb: RED } });
  const first = 6;
  slip.info.forEach(([label, value], i) => {
    text(sheet, `A${first + i}`, label);
    sheet.mergeCells(first + i, 2, first + i, 3);
    text(sheet, `B${first + i}`, value, { bold: label === 'Họ và tên' });
  });
  return first + slip.info.length + 1;
}

function writeSections(sheet: Worksheet, slip: Payslip, start: number): number {
  let row = start;
  for (const section of slip.sections) {
    ['', 'Mức', 'Thực nhận'].forEach((label, i) => {
      Object.assign(sheet.getCell(row, i + 1), {
        value: i === 0 ? section.title : label,
        fill: fill(PALE_RED),
        border: BOX,
        font: { name: SERIF, bold: true },
      });
    });
    row += 1;
    for (const line of section.lines) {
      const font = { name: SERIF, bold: line.isTotal ?? false, italic: line.isDetail ?? false };
      Object.assign(sheet.getCell(row, 1), {
        value: line.isDetail ? `   ${line.label}` : line.label,
        border: BOX,
        font,
      });
      Object.assign(sheet.getCell(row, 2), { value: line.base ?? null, border: BOX, font, numFmt: MONEY_FORMAT });
      Object.assign(sheet.getCell(row, 3), { value: line.amount, border: BOX, font, numFmt: FORMATS[line.format] });
      row += 1;
    }
  }
  return row;
}

function writeFoot(sheet: Worksheet, slip: Payslip, start: number): void {
  const style = { border: BOX, fill: fill(GREY), font: { name: SERIF, bold: true, size: 12 } };
  Object.assign(sheet.getCell(start, 1), { ...style, value: 'THỰC NHẬN' });
  Object.assign(sheet.getCell(start, 2), { ...style, value: null });
  Object.assign(sheet.getCell(start, 3), { ...style, value: slip.netPay, numFmt: MONEY_FORMAT });
  text(sheet, `A${start + 1}`, `Chuyển khoản: ${slip.bank}`);
  slip.notes.forEach((note, i) => text(sheet, `A${start + 2 + i}`, note, { italic: true, size: 9 }));
}

function addPayslipSheet(book: Workbook, slip: Payslip, taken: Set<string>): void {
  const name = safeSheetName(slip.code, taken);
  taken.add(name);
  const sheet = book.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  sheet.columns = [{ width: 42 }, { width: 16 }, { width: 18 }];
  const sections = writeHead(sheet, slip);
  const foot = writeSections(sheet, slip, sections);
  writeFoot(sheet, slip, foot + 1);
}

export async function buildPayslipBook(slips: readonly Payslip[]): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const taken = new Set<string>();
  slips.forEach((slip) => addPayslipSheet(book, slip, taken));
  return book;
}

/** Entry point for "Tải Excel" on the Phiếu lương tab: the chosen people of one month in one file (L-L33). */
export async function exportPayslips(month: PayrollExportMonth, slips: readonly Payslip[]): Promise<void> {
  await saveBook(await buildPayslipBook(slips), payslipFileName(month));
}
