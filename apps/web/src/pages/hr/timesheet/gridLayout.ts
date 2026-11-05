import { matchesQuery, type TimesheetCellsInput, type TimesheetRowDto } from '@careers/shared';
import { dayMonth, type GridRow } from './timesheetModel';

const WIDE_PINS = ['stt', 'ma', 'ten', 'bp', 'regionId'];
const COMPACT_PINS = ['ma', 'ten'];
const PHONE_PINS = ['ten'];

/** Like Excel's frozen panes, but a narrow screen keeps room for the days. */
export function pinnedColumns(viewportWidth: number): string[] {
  if (viewportWidth < 640) return PHONE_PINS;
  return viewportWidth < 1280 ? COMPACT_PINS : WIDE_PINS;
}

/** The scroll position that puts a column in the middle of the part the frozen columns leave free. */
export function centeredScrollLeft(input: { columnStart: number; columnSize: number; viewport: number; pinnedWidth: number }): number {
  const { columnStart, columnSize, viewport, pinnedWidth } = input;
  return Math.max(0, columnStart - (viewport - pinnedWidth - columnSize) / 2);
}

/** The scrollbar timesheet.css fixes at 10px, and the grid's two borders: the rows must end above them. */
const BELOW_ROWS = 12;

/** Tall enough for everyone, but never past the bottom of the window: no scrolling inside scrolling. */
export function fitGridHeight(input: { rowCount: number; rowHeight: number; top: number; viewportHeight: number }): number {
  const { rowCount, rowHeight, top, viewportHeight } = input;
  const needed = 104 + rowCount * rowHeight + BELOW_ROWS;
  return Math.min(needed, Math.max(320, viewportHeight - top - 12));
}

/** The cell's padding and border, and the copy button that shows over the end of the text. */
export const COLUMN_ROOM = 48;

/** As wide as the longest value, so it reads in full; a very long one stops here and its cell gives it on hover. */
export function fitColumnWidth(texts: readonly string[], input: { min: number; max: number; measure: (text: string) => number }): number {
  const { min, max, measure } = input;
  const longest = texts.reduce((widest, text) => Math.max(widest, measure(text)), 0);
  return Math.min(max, Math.max(min, Math.ceil(longest) + COLUMN_ROOM));
}

const AVERAGE_LETTER = 7.8;

/** Text width in the grid's own font; a browser without a canvas gets a fair estimate. */
export function textMeasurer(font: string): (text: string) => number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return (text) => text.length * AVERAGE_LETTER;
  context.font = font;
  return (text) => context.measureText(text).width;
}

/** What the filter offers: the departments set up in Cấu hình, and any name only an older period still shows. */
export function offeredDepartments(known: readonly string[], rows: readonly GridRow[]): string[] {
  const listed = rows.map((r) => String(r.bp ?? '')).filter(Boolean);
  return [...new Set([...known, ...listed])].sort((a, b) => a.localeCompare(b));
}

/** A choice that was renamed or removed falls away, rather than filtering everyone out with no way to see why. */
export const stillOffered = (picked: readonly string[], offered: readonly string[]) => picked.filter((p) => offered.includes(p));

export interface SheetFilter {
  query: string;
  regions: readonly string[];
  depts: readonly string[];
}

export function filterRows(rows: readonly GridRow[], { query, regions, depts }: SheetFilter): GridRow[] {
  return rows.filter((r) =>
    matchesQuery(`${String(r.ten)} ${String(r.ma)}`, query) &&
    (regions.length === 0 || regions.includes(String(r.regionId))) &&
    (depts.length === 0 || depts.includes(String(r.bp))));
}

type SavedCell = TimesheetCellsInput['cells'][number];

const oneCell = (cell: SavedCell, people: readonly TimesheetRowDto[]) => {
  const name = people.find((p) => p.employeeId === cell.employeeId)?.fullName ?? '';
  return `${name} ${dayMonth(cell.day)}`.trim();
};

/** Which entry did not reach the server, in the words HR used. */
export function describeFailedCells(cells: readonly SavedCell[], people: readonly TimesheetRowDto[]): string {
  const [first] = cells;
  if (!first) return '';
  const place = oneCell(first, people);
  if (cells.length > 1) return `${cells.length} ô, từ ${place}`;
  return first.code ? `${place} → ${first.code}` : place;
}
