import {
  dayCode,
  isWeekend,
  periodDays,
  timesheetTotals,
  WEEKDAY_LABELS,
  weekdayOf,
  type AttendanceCode,
  type TimesheetCellsInput,
  type TimesheetDto,
  type TimesheetRowDto,
  type TimesheetTotals,
} from '@careers/shared';

/** From the server's timesheet to the grid's flat rows, and from an edit in the grid back to what to save. */

export interface DayColumn {
  key: string;
  iso: string;
  label: string;
  weekday: string;
  isWeekend: boolean;
}

export type GridRow = Record<string, string | number> & { id: string };

export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function dayColumns(dto: Pick<TimesheetDto, 'from' | 'to'>): DayColumn[] {
  return periodDays({ from: dto.from, to: dto.to }).map((iso, i) => ({
    key: `d${i}`,
    iso,
    label: dayMonth(iso),
    weekday: WEEKDAY_LABELS[weekdayOf(iso)] ?? '',
    isWeekend: isWeekend(iso),
  }));
}

const adjustmentOf = (row: TimesheetRowDto) => row.adjustments.reduce((sum, a) => sum + a.amount, 0);

function codeOn(dto: TimesheetDto, row: TimesheetRowDto, day: string, entered: AttendanceCode | null) {
  return dayCode({ day, entered, isHoliday: dto.holidays.some((h) => h.day === day), today: dto.today, joinedOn: row.joinedOn, leftOn: row.leftOn });
}

export function rowTotals(dto: TimesheetDto, row: TimesheetRowDto, days: readonly DayColumn[]): TimesheetTotals {
  return timesheetTotals({
    codes: days.map((d) => codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null)),
    norm: row.norm,
    leaveOpening: row.leaveOpening,
    employment: row.employment,
    adjustment: adjustmentOf(row),
    rule: dto.rule,
  });
}

export function gridRows(dto: TimesheetDto, days: readonly DayColumn[]): GridRow[] {
  return dto.rows.map((row, index) => {
    const totals = rowTotals(dto, row, days);
    const grid: GridRow = {
      id: row.employeeId,
      stt: index + 1,
      ma: row.code,
      ten: row.fullName,
      bp: row.department,
      chucDanh: row.title,
      regionId: row.regionId,
      loai: row.employment,
      ngayVao: row.joinedOn ?? '',
      ngayNghi: row.leftOn ?? '',
      adjust: adjustmentOf(row),
      thucTe: totals.actual,
      diTre: totals.lateCount,
      nghiPhep: totals.leave,
      khongLuong: totals.unpaidLeave,
      khongPhep: totals.absent,
      le: totals.holiday,
      chuan: totals.norm,
      huong: totals.paid,
      huongTinhRa: totals.paidBeforeAdjustment,
      ot: totals.overtime,
      tonDau: totals.leaveOpening,
      tonCuoi: totals.leaveClosing,
      phepVuot: totals.leaveOverdrawn,
    };
    for (const d of days) grid[d.key] = codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null) ?? '';
    return grid;
  });
}

export const notesOf = (dto: TimesheetDto, days: readonly DayColumn[]): Record<string, string> => {
  const notes: Record<string, string> = {};
  for (const row of dto.rows) {
    for (const d of days) {
      const note = row.cells[d.iso]?.note;
      if (note) notes[`${row.employeeId}:${d.key}`] = note;
    }
  }
  return notes;
};

/**
 * What changed between two versions of the grid. A value equal to what the rules give is not an entry: pressing 1
 * on a passed Monday, or deleting it, both leave the day automatic.
 */
export function changedCells(
  dto: TimesheetDto,
  days: readonly DayColumn[],
  before: readonly GridRow[],
  after: readonly GridRow[],
): TimesheetCellsInput['cells'] {
  const previous = new Map(before.map((r) => [r.id, r]));
  const rows = new Map(dto.rows.map((r) => [r.employeeId, r]));
  const cells: TimesheetCellsInput['cells'] = [];
  for (const next of after) {
    const old = previous.get(next.id);
    const row = rows.get(next.id);
    if (!old || !row) continue;
    for (const d of days) {
      if (next[d.key] === old[d.key]) continue;
      const value = String(next[d.key] ?? '');
      const automatic = codeOn(dto, row, d.iso, null) ?? '';
      cells.push({ employeeId: row.employeeId, day: d.iso, code: value === '' || value === automatic ? null : (value as AttendanceCode) });
    }
  }
  return cells;
}

/** The server's answer applied ahead of time, so the numbers move as soon as a key is pressed. */
export function withCells(dto: TimesheetDto, cells: TimesheetCellsInput['cells']): TimesheetDto {
  return {
    ...dto,
    rows: dto.rows.map((row) => {
      const mine = cells.filter((c) => c.employeeId === row.employeeId);
      if (mine.length === 0) return row;
      const next = { ...row.cells };
      for (const cell of mine) {
        const current = next[cell.day] ?? { entered: null, note: null };
        const merged = {
          entered: cell.code === undefined ? current.entered : cell.code,
          note: cell.note === undefined ? current.note : cell.note || null,
        };
        if (merged.entered === null && merged.note === null) delete next[cell.day];
        else next[cell.day] = merged;
      }
      return { ...row, cells: next };
    }),
  };
}

export interface TimesheetProblem {
  id: string;
  group: 'Cần xử lý' | 'Cần xem';
  kind: 'saturday' | 'leave' | 'left' | 'adjustment';
  employeeId: string;
  columnId: string;
  text: string;
}

export const asNumber = (v: unknown) => (v === 0 ? '-' : String(v).replace('.', ','));
const balance = (v: unknown) => String(v).replace('.', ',');

/** What needs a look before closing. A Saturday only counts once the remaining ones can no longer make the norm. */
export function findProblems(dto: TimesheetDto, days: readonly DayColumn[], rows: readonly GridRow[]): TimesheetProblem[] {
  const out: TimesheetProblem[] = [];
  const saturdays = days.filter((d) => d.weekday === 'T7');
  for (const row of dto.rows) {
    const grid = rows.find((r) => r.id === row.employeeId);
    if (!grid) continue;
    const need = dto.regions.find((r) => r.id === row.regionId)?.saturdays ?? 0;
    const usable = saturdays.filter((d) => (!row.joinedOn || d.iso >= row.joinedOn) && (!row.leftOn || d.iso <= row.leftOn));
    const done = usable.filter((d) => grid[d.key]).length;
    const left = usable.filter((d) => d.iso > dto.today && !grid[d.key]).length;
    const base = { employeeId: row.employeeId };
    const isFullPeriod = usable.length === saturdays.length;
    if (isFullPeriod && done + left < need) {
      out.push({ ...base, id: `t${row.employeeId}`, group: 'Cần xử lý', kind: 'saturday', columnId: usable.filter((d) => d.iso <= dto.today).at(-1)?.key ?? days[0]?.key ?? '', text: `${row.fullName}: ${done}/${need} thứ Bảy, không còn đủ ngày để đạt định mức` });
    }
    if (Number(grid.phepVuot) > 0) {
      out.push({ ...base, id: `p${row.employeeId}`, group: 'Cần xử lý', kind: 'leave', columnId: 'nghiPhep', text: `${row.fullName}: nghỉ ${balance(grid.nghiPhep)} ngày phép, vượt ${balance(grid.phepVuot)} ngày, phần vượt không được trả lương` });
    }
    if (row.leftOn && row.leftOn <= dto.to && Number(grid.tonCuoi) > 0) {
      out.push({ ...base, id: `n${row.employeeId}`, group: 'Cần xử lý', kind: 'left', columnId: 'tonCuoi', text: `${row.fullName}: nghỉ việc ${dayMonth(row.leftOn)}, còn ${balance(grid.tonCuoi)} ngày phép cần thanh toán` });
    }
    for (const a of row.adjustments) {
      out.push({ ...base, id: `a${a.id}`, group: 'Cần xem', kind: 'adjustment', columnId: 'huong', text: `${row.fullName}: điều chỉnh ${balance(a.amount)} công (${a.reason})` });
    }
  }
  return out;
}
