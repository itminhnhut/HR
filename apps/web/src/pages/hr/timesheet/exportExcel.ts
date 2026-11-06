import { ATTENDANCE_LABEL, type AttendanceCode } from '@careers/shared';
import type { Workbook, Worksheet } from 'exceljs';
import logoUrl from '../../../assets/logo/top-flow-logo.png?url';
import type { DayColumn, GridRow } from './timesheetModel';

const RED = 'FFFF0000';
const YELLOW = 'FFFFFF00';
const GREY = 'FFD9D9D9';
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const THIN = { style: 'thin' as const, color: { argb: 'FF8A8A8A' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const SERIF = 'Times New Roman';
const HEADING_COLUMN = 15;

const CODE_FILL: Record<string, string> = {
  '1': 'FFE2EFDA', M: 'FFC6E0B4', NL: 'FFA9D08E', P: 'FFFCE4D6', 'P/2': 'FFF8CBAD', KL: 'FFF4B084', KP: 'FFFF0000', 'KL/2': 'FFFFFFFF', CL: 'FFD9E1F2', TS: 'FFDDEBF7', OM: 'FFEDEDED',
};

const TOTALS: [key: string, label: string, argb: string][] = [
  ['thucTe', 'Công thực tế', 'FFFCE4D6'],
  ['diTre', 'Đi trễ/ về sớm (lần)', 'FFFCE4D6'],
  ['nghiPhep', 'Nghỉ phép', 'FFFCE4D6'],
  ['khongLuong', 'Nghỉ không lương', 'FFFCE4D6'],
  ['khongPhep', 'Nghỉ không phép', 'FFFCE4D6'],
  ['le', 'Nghỉ lễ', 'FFFCE4D6'],
  ['chuan', 'Công chuẩn', 'FFE2EFDA'],
  ['huong', 'Công hưởng lương', 'FFE2EFDA'],
  ['ot', 'Công vượt chuẩn (OT)', 'FFE2EFDA'],
  ['tonDau', 'Phép tồn đầu kỳ', 'FFFFF2CC'],
  ['tonCuoi', 'Phép tồn cuối kỳ', 'FFFFF2CC'],
];

/** Only in a month someone used them, so that every other month stays column for column HR's sheet. */
const EXTRA_TOTALS: typeof TOTALS = [
  ['coLuong', 'Nghỉ có lương', 'FFFCE4D6'],
  ['bhxh', 'Nghỉ BHXH', 'FFFCE4D6'],
  ['lamCN', 'Làm Chủ nhật', 'FFFCE4D6'],
  ['lamLe', 'Làm ngày lễ', 'FFFCE4D6'],
];

/** Leave figures HR's sheet has no column for: after its last one, so AK–AU stay where HR has them. */
const TRAILING_TOTALS: typeof TOTALS = [
  ['phepVuot', 'Nghỉ vượt phép (không lương)', 'FFFFF2CC'],
  ['phepCho', 'Phép chờ (thử việc)', 'FFFFF2CC'],
];
const FIRST_PAY_TOTAL = 6;

function totalsFor(rows: readonly GridRow[]): typeof TOTALS {
  const used = (list: typeof TOTALS) => list.filter(([key]) => rows.some((r) => Number(r[key]) > 0));
  return [...TOTALS.slice(0, FIRST_PAY_TOTAL), ...used(EXTRA_TOTALS), ...TOTALS.slice(FIRST_PAY_TOTAL), ...used(TRAILING_TOTALS)];
}

export interface ExportArgs {
  rows: readonly GridRow[];
  days: readonly DayColumn[];
  regions: readonly { id: string; name: string; norm: number }[];
  notes: Record<string, string>;
  adjustmentNotes: Record<string, string>;
  isClosed: boolean;
  isFreeRange: boolean;
  from: string;
  to: string;
  year: number;
  month: number;
}

const FIRST_DAY = 7;

/** HR's wording in the sheet, which capitalises every word: "Chính Thức". */
const asSheetWords = (name: string) => name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** Where "Tháng 11.26" has each code: column I, N and R, from row 2 down. */
const LEGEND: [code: AttendanceCode, column: number, row: number][] = [
  ['P', 9, 2], ['P/2', 9, 3], ['KL', 9, 4],
  ['1', 14, 2], ['M', 14, 3], ['NL', 14, 4],
  ['KP', 18, 3], ['KL/2', 18, 4],
];

/** Only in a month that has them, in column V beyond HR's own legend. */
const RARE_LEGEND: [code: AttendanceCode, row: number][] = [['CL', 2], ['TS', 3], ['OM', 4]];

function writeTop(sheet: Worksheet, book: Workbook, logo: ArrayBuffer, args: ExportArgs): void {
  const { regions, year, month } = args;
  sheet.mergeCells('A1:C3');
  sheet.addImage(book.addImage({ buffer: logo, extension: 'png' }), { tl: { col: 0.2, row: 0.2 }, ext: { width: 230, height: 58 } });
  sheet.mergeCells('A4:C4');
  Object.assign(sheet.getCell('A4'), { value: 'Công Ty TNHH TOP FLOW', font: { bold: true, name: SERIF, size: 12 }, alignment: { horizontal: 'center' } });
  sheet.mergeCells('A5:D5');
  sheet.getCell('D2').value = 'Năm';
  sheet.getCell('G2').value = year;
  sheet.getCell('D3').value = 'Tháng';
  sheet.getCell('G3').value = month;
  sheet.getCell('D4').value = 'Định mức công';
  regions.forEach((region, i) => {
    // Two regions fit F4:G5 as in the sheet. Others follow on row 5, in pairs, around the title in column O.
    const extra = 8 + (i - 2) * 2;
    const [row, col] = i < 2 ? [4 + i, 6] : [5, extra >= HEADING_COLUMN ? extra + 8 : extra];
    const color = { argb: i > 0 ? RED : 'FF000000' };
    Object.assign(sheet.getCell(row, col), { value: region.name, font: { bold: i > 0, color } });
    Object.assign(sheet.getCell(row, col + 1), { value: region.norm, font: { bold: i > 0, color } });
  });
}

function writeLegend(sheet: Worksheet, args: ExportArgs): void {
  const { rows } = args;
  Object.assign(sheet.getCell('I1'), { value: 'Quy Ước:', font: { bold: true, color: { argb: RED }, name: SERIF } });
  for (const [code, col, row] of LEGEND) {
    Object.assign(sheet.getCell(row, col), { value: code === '1' ? 1 : code, alignment: { horizontal: 'center' }, fill: fill(CODE_FILL[code] ?? 'FFFFFFFF') });
    sheet.getCell(row, col + 1).value = ATTENDANCE_LABEL[code];
  }
  RARE_LEGEND.filter(([code]) => rows.some((r) => args.days.some((d) => r[d.key] === code))).forEach(([code, row]) => {
    Object.assign(sheet.getCell(row, 22), { value: code, alignment: { horizontal: 'center' }, fill: fill(CODE_FILL[code] ?? 'FFFFFFFF') });
    sheet.getCell(row, 23).value = ATTENDANCE_LABEL[code];
  });
  sheet.getCell('R2').fill = fill(GREY);
  sheet.getCell('S2').value = 'Off/ Chưa OB';
}

function writeHeadings(sheet: Worksheet, args: ExportArgs): void {
  const { days, isClosed, isFreeRange, month, from, to, rows } = args;
  const firstTotal = FIRST_DAY + days.length;
  const totals = totalsFor(rows);
  const pay = firstTotal + totals.length - 5;
  const heading = isFreeRange ? `BẢNG CHẤM CÔNG ${from} ĐẾN ${to}` : `BẢNG CHẤM CÔNG THÁNG ${month}${isClosed ? '' : ' (BẢN NHÁP)'}`;
  Object.assign(sheet.getCell(5, HEADING_COLUMN), { value: heading, font: { bold: true, color: { argb: RED }, size: 12, name: SERIF } });
  const group = (start: number, stop: number, label: string) => {
    sheet.mergeCells(6, start, 6, stop);
    Object.assign(sheet.getCell(6, start), { value: label, alignment: { horizontal: 'center' }, font: { bold: true, color: { argb: RED }, name: SERIF, size: 12 } });
  };
  group(1, 6, 'THÔNG TIN NHÂN VIÊN');
  group(FIRST_DAY, firstTotal - 1, 'NGÀY CÔNG TRONG KÌ');
  group(firstTotal, pay - 1, 'TỔNG HỢP CÔNG');
  group(pay, pay + 2, 'TÍNH LƯƠNG');
  group(pay + 3, pay + 4, 'PHÉP NĂM');
  const headCell = (row: number, col: number, value: string, argb = RED, color = 'FFFFFFFF') => {
    Object.assign(sheet.getCell(row, col), {
      value, fill: fill(argb), border: BOX,
      font: { bold: true, color: { argb: color }, name: SERIF },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    });
  };
  ['STT', 'MNV', 'Họ Và Tên', 'Bộ Phận', 'Địa Điểm', 'Nhân Viên'].forEach((label, i) => {
    sheet.mergeCells(7, i + 1, 8, i + 1);
    headCell(7, i + 1, label);
  });
  days.forEach((d, i) => {
    headCell(7, FIRST_DAY + i, d.label, d.isWeekend ? YELLOW : RED, d.isWeekend ? 'FF000000' : 'FFFFFFFF');
    headCell(8, FIRST_DAY + i, d.weekday, d.isWeekend ? YELLOW : RED, d.isWeekend ? 'FF000000' : 'FFFFFFFF');
  });
  totals.forEach(([, label], i) => {
    sheet.mergeCells(7, firstTotal + i, 8, firstTotal + i);
    headCell(7, firstTotal + i, label);
  });
  sheet.getRow(7).height = 30;
  sheet.getRow(8).height = 30;
}

/** T7 and CN stay yellow even for someone not at work, as "Tháng 10.26" has them. */
function dayFill(person: GridRow, day: DayColumn, raw: string): string | null {
  if (day.isWeekend) return YELLOW;
  const isOff = (person.ngayVao && day.iso < String(person.ngayVao)) || (person.ngayNghi && day.iso > String(person.ngayNghi));
  if (isOff) return GREY;
  return raw && raw !== '1' ? (CODE_FILL[raw] ?? 'FFFFFFFF') : null;
}

function writePerson(sheet: Worksheet, person: GridRow, index: number, args: ExportArgs): void {
  const { days, regions, notes, adjustmentNotes, rows } = args;
  const rowNo = 9 + index;
  const font = { name: SERIF };
  const regionName = regions.find((r) => r.id === String(person.regionId))?.name ?? '';
  [index + 1, person.ma, person.ten, person.bp, regionName, asSheetWords(String(person.loaiTen))].forEach((value, i) => {
    Object.assign(sheet.getCell(rowNo, i + 1), { value, border: BOX, font });
  });
  days.forEach((d, i) => {
    const cell = sheet.getCell(rowNo, FIRST_DAY + i);
    const raw = String(person[d.key] ?? '');
    Object.assign(cell, { value: raw === '1' ? 1 : raw || null, alignment: { horizontal: 'center' }, border: BOX, font });
    const argb = dayFill(person, d, raw);
    if (argb) cell.fill = fill(argb);
    const note = notes[`${person.id}:${d.key}`];
    if (note) cell.note = note;
  });
  totalsFor(rows).forEach(([key, , argb], i) => {
    const cell = sheet.getCell(rowNo, FIRST_DAY + days.length + i);
    Object.assign(cell, { value: Number(person[key]) || 0, numFmt: 'General;-General;"-"', fill: fill(argb), border: BOX, font });
    if (key !== 'huong') return;
    cell.font = { ...font, bold: true, color: { argb: RED } };
    const adjustment = adjustmentNotes[person.id];
    if (adjustment) cell.note = adjustment;
  });
}

/** The row of column numbers under the last person, from column B, as the sheet's VLOOKUPs count them. */
function writeColumnNumbers(sheet: Worksheet, people: number, lastColumn: number): void {
  const row = 9 + people;
  for (let col = 2; col <= lastColumn; col += 1) {
    Object.assign(sheet.getCell(row, col), { value: col - 1, font: { name: SERIF }, alignment: { horizontal: 'center' } });
  }
}

function addMonthSheet(book: Workbook, args: ExportArgs, logo: ArrayBuffer): void {
  const { rows, days, year, month } = args;
  const sheet = book.addWorksheet(`Tháng ${month}.${String(year).slice(2)}`, {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 8, showGridLines: false }],
    // HR's own PDF of the sheet is one landscape A4.
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  sheet.columns = [
    { width: 5 }, { width: 8 }, { width: 28 }, { width: 18 }, { width: 8 }, { width: 11 },
    ...days.map(() => ({ width: 6.5 })),
    ...totalsFor(rows).map(() => ({ width: 10 })),
  ];
  writeTop(sheet, book, logo, args);
  writeLegend(sheet, args);
  writeHeadings(sheet, args);
  rows.forEach((person, index) => writePerson(sheet, person, index, args));
  writeColumnNumbers(sheet, rows.length, FIRST_DAY + days.length + totalsFor(rows).length - 1);
}

/** One file with one sheet a month, as HR's workbook; only opened on demand, because the library is large. */
export async function buildTimesheetBook(months: readonly ExportArgs[], logo: ArrayBuffer): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  months.forEach((args) => addMonthSheet(book, args, logo));
  return book;
}

export const buildTimesheetWorkbook = (args: ExportArgs, logo: ArrayBuffer) => buildTimesheetBook([args], logo);

async function saveBook(book: Workbook, fileName: string): Promise<void> {
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const logoBytes = async () => (await fetch(logoUrl)).arrayBuffer();

export async function exportTimesheet(args: ExportArgs): Promise<void> {
  const { isFreeRange, year, month, from, to } = args;
  const book = await buildTimesheetWorkbook(args, await logoBytes());
  await saveBook(book, `Bang-cham-cong-${isFreeRange ? `${from}-${to}` : `${month}-${year}`}.xlsx`);
}

/** Several months of one year: Bang-cham-cong-2026-T10-T11.xlsx */
export async function exportTimesheetMonths(months: readonly ExportArgs[]): Promise<void> {
  const [first] = months;
  if (!first) return;
  const book = await buildTimesheetBook(months, await logoBytes());
  await saveBook(book, `Bang-cham-cong-${first.year}-${months.map((m) => `T${m.month}`).join('-')}.xlsx`);
}
