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
