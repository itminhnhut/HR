import type { Workbook, Worksheet } from 'exceljs';
import { payrollColumns, type PayrollColumn } from './columns';
import { BOX, fill, headCell, NUMBER_FORMATS, RED, SERIF, text, WHITE } from './excelStyle';
import { monthText, versionText } from './format';
import { orderedRows } from './rows';
import type { PayrollExportMonth, PayrollExportRow } from './types';

/**
 * "Tổng hợp" across the months of one file (spec 12.1, L-F10, L-F11): one row per person, each column the sum of
 * that person's cells on the month sheets, never computed again. Name, block and region come from the latest month;
 * an earlier month that differs is noted. Months with other pay components add their columns.
 */

const HEAD_ROW = 5;
const FIRST_ROW = 7;
const INFO = ['Mã NV', 'Họ và tên', 'Bộ phận', 'Khu vực', 'Số tháng'];

/** Every month's totalled columns; a column a month adds goes before the next column the file already has. */
export function mergeColumns(perMonth: readonly PayrollColumn[][]): PayrollColumn[] {
  return perMonth.reduce<PayrollColumn[]>((merged, columns) => {
    const result = [...merged];
    columns.forEach((column, i) => {
      if (result.some((c) => c.key === column.key)) return;
      const next = columns.slice(i + 1).find((c) => result.some((r) => r.key === c.key));
      const at = next ? result.findIndex((r) => r.key === next.key) : result.length;
      result.splice(at, 0, column);
    });
    return result;
  }, []);
}

interface PersonMonths {
  code: string;
  rows: { month: PayrollExportMonth; row: PayrollExportRow; columns: Set<string> }[];
}

/** People in the latest month's order, then anyone only in earlier months. */
function peopleOf(months: readonly PayrollExportMonth[], keys: readonly Set<string>[]): PersonMonths[] {
  const byCode = new Map<string, PersonMonths>();
  [...months].reverse().forEach((month) => {
    const columns = keys[months.indexOf(month)] ?? new Set<string>();
    for (const row of orderedRows(month)) {
      const entry = byCode.get(row.person.code) ?? { code: row.person.code, rows: [] };
      byCode.set(row.person.code, { ...entry, rows: [...entry.rows, { month, row, columns }] });
    }
  });
  return [...byCode.values()];
}

/** "T8/2026: khu vực HCM" when an earlier month had another name, block or region. */
function differences(person: PersonMonths): string | null {
  const [latest, ...earlier] = person.rows;
  if (!latest) return null;
  const fields: [keyof PayrollExportRow['person'], string][] = [
    ['name', 'tên'],
    ['block', 'bộ phận'],
    ['region', 'khu vực'],
  ];
  const notes = earlier.flatMap(({ month, row }) =>
    fields
      .filter(([field]) => row.person[field] !== latest.row.person[field])
      .map(([field, word]) => `${monthText(month.dates)}: ${word} ${String(row.person[field] ?? '')}`),
  );
  return notes.length > 0 ? [...notes].reverse().join(' · ') : null;
}

function sumOf(person: PersonMonths, column: PayrollColumn): number | null {
  const having = person.rows.filter((r) => r.columns.has(column.key));
  if (having.length === 0) return null;
  return having.reduce((acc, { row }) => {
    const value = column.value(row);
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);
}

function writeTop(sheet: Worksheet, months: readonly PayrollExportMonth[]): void {
  const year = months[0]?.dates.year ?? '';
  text(sheet, 'A1', `TỔNG HỢP LƯƠNG NĂM ${year} · ${months.map((m) => `T${m.dates.month}`).join(', ')}`, {
    bold: true,
    size: 14,
    color: { argb: RED },
  });
  text(sheet, 'A2', months.map((m) => `${monthText(m.dates)}: ${versionText(m.stamp)}`).join(' | '), { italic: true });
  const drafts = months.filter((m) => m.stamp.kind === 'draft').map((m) => monthText(m.dates));
  if (drafts.length > 0) text(sheet, 'A3', `Gồm số nháp ${drafts.join(', ')}`, { bold: true, color: { argb: RED } });
}

function writePerson(sheet: Worksheet, person: PersonMonths, columns: readonly PayrollColumn[], row: number): void {
  const latest = person.rows[0]?.row.person;
  const values = [
    person.code,
    latest?.name ?? '',
    latest?.block ?? '',
    latest?.region ?? '',
    person.rows.length,
    ...columns.map((c) => sumOf(person, c)),
    differences(person),
  ];
  values.forEach((value, i) => {
    const column = columns[i - INFO.length];
    Object.assign(sheet.getCell(row, i + 1), {
      value,
      border: BOX,
      font: { name: SERIF },
      numFmt: column ? NUMBER_FORMATS[column.format] : undefined,
    });
  });
}

function writeTotal(sheet: Worksheet, people: readonly PersonMonths[], columns: readonly PayrollColumn[], row: number) {
  const last = INFO.length + columns.length + 1;
  for (let col = 1; col <= last; col += 1) {
    const column = columns[col - 1 - INFO.length];
    const sum = column ? people.reduce((acc, p) => acc + (sumOf(p, column) ?? 0), 0) : null;
    Object.assign(sheet.getCell(row, col), {
      value: col === 1 ? 'TỔNG CỘNG' : sum,
      fill: fill(RED),
      border: BOX,
      font: { name: SERIF, bold: true, color: { argb: WHITE } },
      numFmt: column ? NUMBER_FORMATS[column.format] : undefined,
    });
  }
}

export function addSummarySheet(book: Workbook, months: readonly PayrollExportMonth[]): void {
  const perMonth = months.map((m) => payrollColumns(m.config).filter((c) => c.isTotalled));
  const columns = mergeColumns(perMonth);
  const people = peopleOf(
    months,
    perMonth.map((list) => new Set(list.map((c) => c.key))),
  );
  const sheet = book.addWorksheet('Tổng hợp', { views: [{ state: 'frozen', xSplit: 2, ySplit: FIRST_ROW - 1 }] });
  sheet.columns = [
    { width: 9 },
    { width: 24 },
    { width: 8 },
    { width: 9 },
    { width: 8 },
    ...columns.map(() => ({ width: 13 })),
    { width: 30 },
  ];
  writeTop(sheet, months);
  [...INFO, ...columns.map((c) => c.header), 'Ghi chú'].forEach((label, i) =>
    headCell(sheet.getCell(HEAD_ROW, i + 1), label),
  );
  columns.forEach((c, i) => {
    Object.assign(sheet.getCell(HEAD_ROW + 1, INFO.length + i + 1), {
      value: `(${c.number})`,
      font: { name: SERIF, italic: true, size: 9 },
      alignment: { horizontal: 'center' },
    });
  });
  people.forEach((person, i) => writePerson(sheet, person, columns, FIRST_ROW + i));
  writeTotal(sheet, people, columns, FIRST_ROW + people.length);
}
