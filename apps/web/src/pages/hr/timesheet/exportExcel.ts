import { ATTENDANCE_CODES, ATTENDANCE_LABEL, STAFF_TYPE_LABEL, type StaffType } from '@careers/shared';
import logoUrl from '../../../assets/logo/top-flow-logo.png?url';
import type { DayColumn, GridRow } from './timesheetModel';

const RED = 'FFEE3124';
const YELLOW = 'FFFFFF00';
const GREY = 'FFD9D9D9';
const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const THIN = { style: 'thin' as const, color: { argb: 'FF8A8A8A' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const SERIF = 'Times New Roman';

const CODE_FILL: Record<string, string> = {
  '1': 'FFE2EFDA', M: 'FFC6E0B4', NL: 'FFA9D08E', P: 'FFFCE4D6', 'P/2': 'FFF8CBAD', KL: 'FFF4B084', KP: 'FFFF0000', 'KL/2': 'FFFFFFFF',
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

/** The sheet HR sends the boss, laid out like the workbook; only opened on demand, because the library is large. */
export async function exportTimesheet(args: ExportArgs): Promise<void> {
  const { rows, days, regions, notes, adjustmentNotes, isClosed, isFreeRange, year, month } = args;
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const name = `Tháng ${month}.${String(year).slice(2)}`;
  const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 4, ySplit: 8, showGridLines: false }] });
  const firstDay = 7;
  const firstTotal = firstDay + days.length;
  sheet.columns = [
    { width: 5 }, { width: 8 }, { width: 28 }, { width: 18 }, { width: 8 }, { width: 11 },
    ...days.map(() => ({ width: 6.5 })),
    ...TOTALS.map(() => ({ width: 10 })),
  ];

  const logo = await (await fetch(logoUrl)).arrayBuffer();
  sheet.addImage(book.addImage({ buffer: logo, extension: 'png' }), { tl: { col: 0.2, row: 0.2 }, ext: { width: 230, height: 58 } });
  sheet.mergeCells('A4:C4');
  Object.assign(sheet.getCell('A4'), { value: 'Công Ty TNHH TOP FLOW', font: { bold: true, name: SERIF, size: 12 }, alignment: { horizontal: 'center' } });
  sheet.getCell('D2').value = 'Năm';
  sheet.getCell('E2').value = year;
  sheet.getCell('D3').value = 'Tháng';
  sheet.getCell('E3').value = month;
  sheet.getCell('D4').value = 'Định mức công';
  regions.forEach((region, i) => {
    const color = { argb: i > 0 ? RED : 'FF000000' };
    Object.assign(sheet.getCell(4 + i, 6), { value: region.name, font: { bold: i > 0, color } });
    Object.assign(sheet.getCell(4 + i, 7), { value: region.norm, font: { bold: i > 0, color } });
  });

  Object.assign(sheet.getCell(1, firstDay + 1), { value: 'Quy Ước:', font: { bold: true, color: { argb: RED }, name: SERIF } });
  ATTENDANCE_CODES.forEach((code, i) => {
    const col = firstDay + 1 + Math.floor(i / 3) * 6;
    const row = 2 + (i % 3);
    Object.assign(sheet.getCell(row, col), { value: code === '1' ? 1 : code, alignment: { horizontal: 'center' }, fill: fill(CODE_FILL[code] ?? 'FFFFFFFF') });
    sheet.getCell(row, col + 1).value = ATTENDANCE_LABEL[code];
  });
  sheet.getCell(4, firstDay + 13).fill = fill(GREY);
  sheet.getCell(4, firstDay + 14).value = 'Off/ Chưa OB';

  const heading = isFreeRange ? `BẢNG CHẤM CÔNG ${args.from} ĐẾN ${args.to}` : `BẢNG CHẤM CÔNG THÁNG ${month}${isClosed ? '' : ' (BẢN NHÁP)'}`;
  Object.assign(sheet.getCell(5, firstDay + 8), { value: heading, font: { bold: true, color: { argb: RED }, size: 12, name: SERIF } });

  const group = (from: number, to: number, label: string) => {
    sheet.mergeCells(6, from, 6, to);
    Object.assign(sheet.getCell(6, from), { value: label, alignment: { horizontal: 'center' }, font: { bold: true, color: { argb: RED }, name: SERIF, size: 12 } });
  };
  group(1, 6, 'THÔNG TIN NHÂN VIÊN');
  group(firstDay, firstTotal - 1, 'NGÀY CÔNG TRONG KÌ');
  group(firstTotal, firstTotal + 5, 'TỔNG HỢP CÔNG');
  group(firstTotal + 6, firstTotal + 8, 'TÍNH LƯƠNG');
  group(firstTotal + 9, firstTotal + 10, 'PHÉP NĂM');

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
    headCell(7, firstDay + i, d.label, d.isWeekend ? YELLOW : RED, d.isWeekend ? 'FF000000' : 'FFFFFFFF');
    headCell(8, firstDay + i, d.weekday, d.isWeekend ? YELLOW : RED, d.isWeekend ? 'FF000000' : 'FFFFFFFF');
  });
  TOTALS.forEach(([, label], i) => {
    sheet.mergeCells(7, firstTotal + i, 8, firstTotal + i);
    headCell(7, firstTotal + i, label);
  });
  sheet.getRow(7).height = 30;
  sheet.getRow(8).height = 30;

  const regionName = new Map(regions.map((r) => [r.id, r.name]));
  rows.forEach((person, index) => {
    const rowNo = 9 + index;
    const info = [index + 1, person.ma, person.ten, person.bp, regionName.get(String(person.regionId)) ?? '', STAFF_TYPE_LABEL[person.loai as StaffType]];
    info.forEach((value, i) => {
      Object.assign(sheet.getCell(rowNo, i + 1), { value, border: BOX });
    });
    days.forEach((d, i) => {
      const cell = sheet.getCell(rowNo, firstDay + i);
      const raw = String(person[d.key] ?? '');
      cell.value = raw === '1' ? 1 : raw || null;
      cell.alignment = { horizontal: 'center' };
      cell.border = BOX;
      const isOff = (person.ngayVao && d.iso < String(person.ngayVao)) || (person.ngayNghi && d.iso > String(person.ngayNghi));
      if (isOff) cell.fill = fill(GREY);
      else if (d.isWeekend) cell.fill = fill(YELLOW);
      else if (raw && raw !== '1') cell.fill = fill(CODE_FILL[raw] ?? 'FFFFFFFF');
      const note = notes[`${person.id}:${d.key}`];
      if (note) cell.note = note;
    });
    TOTALS.forEach(([key, , argb], i) => {
      const cell = sheet.getCell(rowNo, firstTotal + i);
      cell.value = Number(person[key]) || 0;
      cell.numFmt = '#,##0.0#;-#,##0.0#;"-"';
      cell.fill = fill(argb);
      cell.border = BOX;
      if (key === 'huong') {
        cell.font = { bold: true, color: { argb: RED } };
        const adjustment = adjustmentNotes[person.id];
        if (adjustment) cell.note = adjustment;
      }
    });
  });

  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Bang-cham-cong-${isFreeRange ? `${args.from}-${args.to}` : `${month}-${year}`}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
