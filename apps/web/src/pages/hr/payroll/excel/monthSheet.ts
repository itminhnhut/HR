import type { Workbook, Worksheet } from 'exceljs';
import { GROUP_LABELS, payrollColumns, type ColumnGroup, type PayrollColumn } from './columns';
import { BOX, COMPANY, COMPANY_ADDRESS, fill, headCell, NUMBER_FORMATS, RED, SERIF, text, WHITE } from './excelStyle';
import { sheetName, signatureDate, stampText } from './format';
import { columnTotals, orderedRows } from './rows';
import type { PayrollDownload, PayrollExportMonth } from './types';

/**
 * One month as HR's workbook lays it out: company and norms on rows 4–6, groups on row 7, headers on row 8, column
 * numbers on row 9, people from row 10, TỔNG CỘNG, then the signature block (spec 12.1, Q4). The title, the stamp
 * (R8) and the labels (R6, R7) sit in column H of rows 2–4, beside the logo, where HR's file is empty.
 */

const GROUP_ROW = 7;
const HEAD_ROW = 8;
const NUMBER_ROW = 9;
const FIRST_ROW = 10;
const INFO_COLUMN = 8;

function writeTop(sheet: Worksheet, month: PayrollExportMonth, download: PayrollDownload): void {
  const { dates, stamp, norms, labels = [] } = month;
  text(sheet, 'A4', COMPANY, { bold: true, size: 12 });
  text(sheet, 'A5', COMPANY_ADDRESS);
  text(sheet, 'D4', 'Tháng lương:', { bold: true });
  text(sheet, 'F4', `${dates.month}/${dates.year}`, { bold: true, color: { argb: RED } });
  norms.forEach(({ region, norm }, i) => {
    // Two regions on rows 5–6 as in HR's file; more go on to the next pair of columns.
    const row = 5 + (i % 2);
    const col = 4 + 4 * Math.floor(i / 2);
    Object.assign(sheet.getCell(row, col), { value: `Ngày công chuẩn ${region}`, font: { name: SERIF } });
    Object.assign(sheet.getCell(row, col + 2), { value: norm, font: { name: SERIF, bold: true } });
  });
  const title = `BẢNG LƯƠNG THÁNG ${dates.month}/${dates.year}${stamp.kind === 'draft' ? ' (BẢN NHÁP)' : ''}`;
  text(sheet, 'H2', title, { bold: true, size: 14, color: { argb: RED } });
  text(sheet, 'H3', stampText(stamp, download), { italic: true });
  if (labels.length > 0) text(sheet, 'H4', labels.join(' · '), { bold: true, color: { argb: RED } });
}

function groupSpans(columns: readonly PayrollColumn[]): { group: ColumnGroup; start: number; stop: number }[] {
  return columns.reduce<{ group: ColumnGroup; start: number; stop: number }[]>((acc, column, i) => {
    const last = acc[acc.length - 1];
    if (last && last.group === column.group) return [...acc.slice(0, -1), { ...last, stop: i + 1 }];
    return [...acc, { group: column.group, start: i + 1, stop: i + 1 }];
  }, []);
}

function writeHeads(sheet: Worksheet, columns: readonly PayrollColumn[], hideBank: boolean): void {
  for (const { group, start, stop } of groupSpans(columns)) {
    if (stop > start) sheet.mergeCells(GROUP_ROW, start, GROUP_ROW, stop);
    headCell(sheet.getCell(GROUP_ROW, start), group === 'H' && hideBank ? 'H. GHI CHÚ' : GROUP_LABELS[group]);
  }
  columns.forEach((column, i) => {
    headCell(sheet.getCell(HEAD_ROW, i + 1), column.header);
    Object.assign(sheet.getCell(NUMBER_ROW, i + 1), {
      value: column.number ? `(${column.number})` : '',
      border: BOX,
      font: { name: SERIF, italic: true, size: 9 },
      alignment: { horizontal: 'center' },
    });
  });
  sheet.getRow(HEAD_ROW).height = 45;
}

function writeRows(sheet: Worksheet, columns: readonly PayrollColumn[], month: PayrollExportMonth): number {
  const rows = orderedRows(month);
  rows.forEach((row, index) => {
    columns.forEach((column, i) => {
      const value = column.format === 'index' ? index + 1 : column.value(row);
      Object.assign(sheet.getCell(FIRST_ROW + index, i + 1), {
        value,
        border: BOX,
        font: { name: SERIF, bold: column.key === 'netPay' },
        numFmt: NUMBER_FORMATS[column.format],
        alignment: { vertical: 'middle', wrapText: column.key === 'note' },
      });
    });
  });
  return FIRST_ROW + rows.length;
}

/** A filtered file never reads as the whole payroll: its total row says whose total it is. */
const totalWords = (month: PayrollExportMonth) =>
  month.partial ? `TỔNG CỘNG (đã lọc ${month.partial.shown}/${month.partial.total} người)` : 'TỔNG CỘNG';

function writeTotals(sheet: Worksheet, columns: readonly PayrollColumn[], month: PayrollExportMonth, row: number) {
  const totals = columnTotals(columns, month);
  columns.forEach((column, i) => {
    Object.assign(sheet.getCell(row, i + 1), {
      value: i === 0 ? totalWords(month) : totals[i],
      fill: fill(RED),
      border: BOX,
      font: { name: SERIF, bold: true, color: { argb: WHITE } },
      numFmt: NUMBER_FORMATS[column.format],
      alignment: { horizontal: i === 0 ? 'center' : undefined },
    });
  });
  sheet.mergeCells(row, 1, row, INFO_COLUMN);
}

/** Người lập biểu under the names, Kế toán trưởng under (27), Giám đốc under (41), as HR's file (L-F23). */
function writeSignature(sheet: Worksheet, columns: readonly PayrollColumn[], payDate: string, totalRow: number) {
  const at = (number: string, fallback: number) => {
    const i = columns.findIndex((c) => c.number === number);
    return i === -1 ? fallback : i + 1;
  };
  const places = [3, at('27', 20), at('41', 30)];
  const [dateRow, titleRow, hintRow] = [totalRow + 2, totalRow + 3, totalRow + 4];
  const director = places[2] ?? 30;
  Object.assign(sheet.getCell(dateRow, director), {
    value: signatureDate(payDate),
    font: { name: SERIF, italic: true },
  });
  const titles = ['NGƯỜI LẬP BIỂU', 'KẾ TOÁN TRƯỞNG', 'GIÁM ĐỐC'];
  places.forEach((col, i) => {
    Object.assign(sheet.getCell(titleRow, col), { value: titles[i], font: { name: SERIF, bold: true } });
    Object.assign(sheet.getCell(hintRow, col), { value: '(Ký, ghi rõ họ tên)', font: { name: SERIF, italic: true } });
  });
}

export function addMonthSheet(
  book: Workbook,
  month: PayrollExportMonth,
  download: PayrollDownload,
  logo?: ArrayBuffer,
) {
  const hideBank = download.hideBank ?? false;
  const columns = payrollColumns(month.config, { hideBank });
  const sheet = book.addWorksheet(sheetName(month.dates), {
    views: [{ state: 'frozen', xSplit: 3, ySplit: NUMBER_ROW, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sheet.pageSetup.printTitlesRow = `${GROUP_ROW}:${NUMBER_ROW}`;
  sheet.columns = columns.map((c) => ({ width: c.width }));
  if (logo) {
    const image = book.addImage({ buffer: logo, extension: 'png' });
    sheet.addImage(image, { tl: { col: 0.2, row: 0.2 }, ext: { width: 200, height: 50 } });
  }
  writeTop(sheet, month, download);
  writeHeads(sheet, columns, hideBank);
  const totalRow = writeRows(sheet, columns, month);
  writeTotals(sheet, columns, month, totalRow);
  writeSignature(sheet, columns, month.dates.payDate, totalRow);
  return sheet;
}
