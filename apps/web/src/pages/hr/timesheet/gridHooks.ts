import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { centeredScrollLeft, filterRows, fitGridHeight } from './gridLayout';
import type { DayColumn, GridRow } from './timesheetModel';

const QUICK_KEYS: Record<string, string> = { '1': '1', p: 'P', h: 'P/2', m: 'M', k: 'KL', l: 'NL', x: 'KP' };

interface GridColumn {
  getStart(position: 'center'): number;
  getSize(): number;
}

export interface GridTable {
  setFocusedCell(rowId: string, columnId: string): void;
  getSelectedCells(): { rowId: string; columnId: string }[];
  atoms: { cellSelection: { get(): { focusRowId: string; focusColumnId: string }[] } };
  updateCells(cells: { rowId: string; columnId: string; value: string }[]): void;
  stopEditing(): void;
  getColumn(id: string): GridColumn | undefined;
  getStartVisibleLeafColumns(): { getSize(): number }[];
}

export function useSheetFilters(rows: readonly GridRow[]) {
  const [query, setQuery] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
  const visible = useMemo(() => filterRows(rows, { query, regions, depts }), [rows, query, regions, depts]);
  const deptItems = useMemo(() => [...new Set(rows.map((r) => String(r.bp)).filter(Boolean))].map((d) => ({ value: d, label: d })), [rows]);
  const clear = useCallback(() => {
    setQuery('');
    setRegions([]);
    setDepts([]);
  }, []);
  const isFiltered = !!query.trim() || regions.length > 0 || depts.length > 0;
  return { query, setQuery, regions, setRegions, depts, setDepts, visible, deptItems, clear, isFiltered };
}

/** One warning at a time, for the person who just went over, and gone as soon as they no longer are. */
export function useOverLeaveWarning(rows: readonly GridRow[]) {
  const seen = useRef(new Set(rows.filter((r) => Number(r.phepVuot) > 0).map((r) => r.id)));
  const [warnedId, setWarnedId] = useState<string | null>(null);
  useEffect(() => {
    const now = rows.filter((r) => Number(r.phepVuot) > 0);
    const fresh = now.find((r) => !seen.current.has(r.id));
    seen.current = new Set(now.map((r) => r.id));
    if (fresh) setWarnedId(fresh.id);
  }, [rows]);
  const person = rows.find((r) => r.id === warnedId && Number(r.phepVuot) > 0);
  const warning = person ? `${String(person.ten)}: vượt ${String(person.phepVuot).replace('.', ',')} ngày phép, phần vượt không trả lương. Đúng là không lương thì đổi sang KL.` : '';
  return { warning, dismiss: () => setWarnedId(null) };
}

/** Moves the sheet sideways: a column to the middle of the free part, or to right after the frozen columns. */
export function scrollGridTo(table: GridTable, box: HTMLElement | null | undefined, columnId: string, side: 'center' | 'start' = 'center') {
  const column = table.getColumn(columnId);
  if (!column || !box) return;
  const columnStart = column.getStart('center');
  const pinnedWidth = table.getStartVisibleLeafColumns().reduce((sum, c) => sum + c.getSize(), 0);
  box.scrollLeft = side === 'start' ? columnStart : centeredScrollLeft({ columnStart, columnSize: column.getSize(), viewport: box.clientWidth, pinnedWidth });
}

/** The sheet's height follows the window, so the page itself does not have to scroll as well. */
export function useGridHeight(host: RefObject<HTMLElement | null>, rowCount: number, rowHeight: number) {
  const [height, setHeight] = useState(560);
  const measure = useCallback(() => {
    const top = host.current?.getBoundingClientRect().top;
    if (top === undefined) return;
    setHeight(fitGridHeight({ rowCount, rowHeight, top: top + window.scrollY, viewportHeight: window.innerHeight }));
  }, [host, rowCount, rowHeight]);
  // Every render: banners above the sheet come and go.
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return height;
}

/** A letter marks every selected day at once, like typing into a selection in Excel. */
export function useQuickCodes(input: { table: GridTable; days: readonly DayColumn[]; rows: readonly GridRow[]; canEdit: boolean }) {
  const { table, days, rows, canEdit } = input;
  return (event: KeyboardEvent<HTMLDivElement>) => {
    const code = QUICK_KEYS[event.key.toLowerCase()];
    if (!code || !canEdit || event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement).closest('textarea, input')) return;
    const selected = table.getSelectedCells();
    const ranges = table.atoms.cellSelection.get();
    const focus = ranges[ranges.length - 1];
    const cells = selected.length > 0 ? selected : focus ? [{ rowId: focus.focusRowId, columnId: focus.focusColumnId }] : [];
    const dayCells = cells.filter((c) => {
      const day = days.find((d) => d.key === c.columnId);
      const person = rows.find((r) => r.id === c.rowId);
      return !!day && !!person && (!person.ngayVao || day.iso >= String(person.ngayVao)) && (!person.ngayNghi || day.iso <= String(person.ngayNghi));
    });
    if (dayCells.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    table.updateCells(dayCells.map((c) => ({ ...c, value: code })));
    table.stopEditing();
  };
}
