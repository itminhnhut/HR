import type { Workbook } from 'exceljs';
import { BOX, fill, headCell, PALE_YELLOW, RED, SERIF, text } from './excelStyle';
import { monthHeader, paramItemsOf, type ParamItem } from './paramItems';
import type { PayrollExportMonth } from './types';

/**
 * "Tham số áp dụng" (R8): one row per setting, one column per month of the file, each month by its own versions
 * (Q3). A month whose value differs from the month before is shaded, so a change of law shows at a glance (L-F08).
 */

const HEAD_ROW = 3;

interface Line {
  key: string;
  section: string;
  label: string;
}

/** The rows of every month in first-seen order: a setting only one month has still gets its row. */
function unionOf(perMonth: readonly ParamItem[][]): Line[] {
  const seen = new Map<string, Line>();
  for (const items of perMonth) {
    for (const { key, section, label } of items) if (!seen.has(key)) seen.set(key, { key, section, label });
  }
  return [...seen.values()];
}

export function addParamsSheet(book: Workbook, months: readonly PayrollExportMonth[]): void {
  const sheet = book.addWorksheet('Tham số', { views: [{ state: 'frozen', xSplit: 2, ySplit: HEAD_ROW }] });
  sheet.columns = [{ width: 18 }, { width: 44 }, ...months.map(() => ({ width: 46 }))];
  text(sheet, 'A1', 'THAM SỐ ÁP DỤNG', { bold: true, size: 14, color: { argb: RED } });
  text(sheet, 'A2', 'Mỗi tháng theo đúng phiên bản cấu hình của tháng đó; ô tô màu là giá trị khác tháng trước.', {
    italic: true,
  });
  ['Nhóm', 'Tham số', ...months.map(monthHeader)].forEach((label, i) =>
    headCell(sheet.getCell(HEAD_ROW, i + 1), label),
  );
  const perMonth = months.map((m) => paramItemsOf(m));
  const texts = perMonth.map((items) => new Map(items.map((item) => [item.key, item.text])));
  unionOf(perMonth).forEach((line, index) => {
    const row = HEAD_ROW + 1 + index;
    const cellStyle = { border: BOX, font: { name: SERIF }, alignment: { vertical: 'top' as const, wrapText: true } };
    Object.assign(sheet.getCell(row, 1), { ...cellStyle, value: line.section });
    Object.assign(sheet.getCell(row, 2), { ...cellStyle, value: line.label });
    texts.forEach((byKey, m) => {
      const value = byKey.get(line.key) ?? '—';
      const cell = sheet.getCell(row, 3 + m);
      Object.assign(cell, { ...cellStyle, value });
      const before = m > 0 ? texts[m - 1]?.get(line.key) : undefined;
      if (m > 0 && before !== byKey.get(line.key)) cell.fill = fill(PALE_YELLOW);
    });
  });
}
