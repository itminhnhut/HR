import { ABSENCE_COUNTING, SHEET_APPROVER, type AbsenceRowDto } from '@careers/shared';
import type { Workbook } from 'exceljs';

/** The leave list as HR filtered it, as an Excel file in the style of the sheet's own export (exportExcel.ts). */

const RED = 'FFFF0000';
const SERIF = 'Times New Roman';
const THIN = { style: 'thin' as const, color: { argb: 'FF8A8A8A' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

export const LEAVE_HEADS = ['Ngày', 'Nhân viên', 'Mã NV', 'Bộ phận', 'Lý do', 'Cách tính', 'Số ngày', 'Người duyệt', 'Bàn giao', 'Ghi chú', 'Giấy tờ'];
const WIDTHS = [24, 26, 10, 20, 26, 26, 9, 18, 30, 30, 9];

const fullDay = (iso: string) => iso.split('-').reverse().join('/');

/** How a line counts, in the list's words. */
export const countingWords = (code: string) => (code === 'M' ? 'Vẫn 1 công, đếm 1 lần' : ABSENCE_COUNTING[code as keyof typeof ABSENCE_COUNTING] ?? '');

/** Who approved, or that it waits; being late needs nobody, and HR approved what HR typed on the sheet. */
export function approvalWords(row: AbsenceRowDto): string {
  if (row.code === 'M') return 'Không cần duyệt';
  const by = row.source === 'sheet' ? (row.approvedBy ?? SHEET_APPROVER) : row.approvedBy;
  return by || 'Chờ duyệt';
}

export function leaveSheetRows(rows: readonly AbsenceRowDto[], departmentOf: (employeeId: string) => string): (string | number)[][] {
  return rows.map((r) => [
    r.from === r.to ? fullDay(r.from) : `${fullDay(r.from)} – ${fullDay(r.to)}`,
    r.fullName,
    r.employeeCode,
    departmentOf(r.employeeId),
    r.label,
    countingWords(r.code),
    r.days,
    approvalWords(r),
    r.handover,
    r.note,
    r.files.length,
  ]);
}

export const leaveFileName = (year: number, period: number | null) => (period ? `Nghi-T${period}-${year}.xlsx` : `Nghi-${year}.xlsx`);

/** Opened on demand, because the library is large. */
export async function buildLeaveBook(rows: readonly AbsenceRowDto[], departmentOf: (employeeId: string) => string, title: string): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Nghỉ, đi muộn', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.columns = WIDTHS.map((width) => ({ width }));
  Object.assign(sheet.getCell('A1'), { value: `DANH SÁCH NGHỈ, ĐI MUỘN – ${title}`, font: { bold: true, color: { argb: RED }, size: 12, name: SERIF } });
  LEAVE_HEADS.forEach((label, i) => {
    Object.assign(sheet.getCell(3, i + 1), { value: label, fill: fill(RED), border: BOX, font: { bold: true, color: { argb: 'FFFFFFFF' }, name: SERIF }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
  });
  sheet.getRow(3).height = 24;
  leaveSheetRows(rows, departmentOf).forEach((line, r) => {
    line.forEach((value, i) => Object.assign(sheet.getCell(4 + r, i + 1), { value, border: BOX, font: { name: SERIF }, alignment: { vertical: 'top', wrapText: i >= 8 } }));
  });
  return book;
}

async function saveBook(book: Workbook, fileName: string): Promise<void> {
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Exactly the lines shown: "Nghi-T11-2026.xlsx" for a period, "Nghi-2026.xlsx" for the year. */
export async function exportLeaveList(rows: readonly AbsenceRowDto[], departmentOf: (employeeId: string) => string, year: number, period: number | null, title: string): Promise<void> {
  await saveBook(await buildLeaveBook(rows, departmentOf, title), leaveFileName(year, period));
}
