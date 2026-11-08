import {
  dayCode,
  paidBySegment,
  restDayWork,
  leaveCountOf,
  FIXED_HOLIDAYS,
  isWeekend,
  periodDays,
  saturdaysFor,
  STAFF_TYPE_LABEL,
  timesheetTotals,
  WEEKDAY_LABELS,
  weekdayOf,
  type AbsenceRowDto,
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

/** Days worked on a holiday or a Sunday: they pay at a different rate, which the sheet leaves to payroll (Đ.98). */
function restDayWorkOf(dto: TimesheetDto, row: TimesheetRowDto, days: readonly DayColumn[]) {
  // A closed period shows what its close kept; otherwise the same day codes the close would use.
  const kept = row.frozenTotals;
  if (kept?.sundayWorked !== undefined && kept.holidayWorked !== undefined) return { lamLe: kept.holidayWorked, lamCN: kept.sundayWorked };
  const codes = days.map((d) => codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null));
  const { sundayWorked, holidayWorked } = restDayWork(days.map((d) => d.iso), codes, new Set(dto.holidays.map((h) => h.day)));
  return { lamLe: holidayWorked, lamCN: sundayWorked };
}

/**
 * Halfway through a period the new leave day is not earned yet, so leave can read as over the balance when it will not
 * be. Telling HR so would suggest unpaid leave for someone who is about to be paid: wait while the day is still within reach.
 */
function mayStillCoverLeave(dto: TimesheetDto, row: TimesheetRowDto, days: readonly DayColumn[], totals: TimesheetTotals): boolean {
  if (dto.today >= dto.to || row.employment === 'probation' || totals.leaveOverdrawn > dto.rule.perPeriod) return false;
  const codeOf = (d: DayColumn) => codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null);
  const counted = leaveCountOf(days.map(codeOf), row.norm, dto.rule, row.leaveSoFar);
  // Already earned: the balance includes it and the leave is still over, so no day ahead can help.
  if (counted >= dto.rule.threshold) return false;
  const ahead = days.filter((d) => codeOf(d) === null && d.iso > dto.today && !d.isWeekend && (!row.joinedOn || d.iso >= row.joinedOn) && (!row.leftOn || d.iso <= row.leftOn)).length;
  return counted + ahead >= dto.rule.threshold;
}

export function rowTotals(dto: TimesheetDto, row: TimesheetRowDto, days: readonly DayColumn[]): TimesheetTotals {
  if (row.frozenTotals) return row.frozenTotals;
  return timesheetTotals({
    codes: days.map((d) => codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null)),
    norm: row.norm,
    leaveOpening: row.leaveOpening,
    employment: row.employment,
    adjustment: adjustmentOf(row),
    leaveChange: row.leaveChanges.reduce((sum, c) => sum + c.amount, 0),
    rule: dto.rule,
    ...row.leaveSoFar,
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
      loaiTen: row.staffLabel ?? STAFF_TYPE_LABEL[row.employment],
      ngayVao: row.joinedOn ?? '',
      ngayNghi: row.leftOn ?? '',
      adjust: adjustmentOf(row),
      thucTe: totals.actual,
      diTre: totals.lateCount,
      nghiPhep: totals.leave,
      khongLuong: totals.unpaidLeave,
      khongPhep: totals.absent,
      le: totals.holiday,
      coLuong: totals.personalPaid,
      bhxh: totals.insured,
      ...restDayWorkOf(dto, row, days),
      doiPhep: row.leaveChanges.reduce((sum, c) => sum + c.amount, 0),
      chuan: totals.norm,
      huong: totals.paid,
      huongTinhRa: totals.paidBeforeAdjustment,
      ot: totals.overtime,
      tonDau: totals.leaveOpening,
      tonCuoi: totals.leaveClosing,
      phepVuot: mayStillCoverLeave(dto, row, days, totals) ? 0 : totals.leaveOverdrawn,
      phepCho: totals.leavePendingClosing ?? 0,
      phepCong: totals.leaveCredited ?? 0,
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
/** What each person's adjustments say, for the mark on "Công hưởng lương" and the note in Excel. */
export function adjustmentNotesOf(dto: TimesheetDto): Record<string, string> {
  const words: Record<string, string> = {};
  for (const row of dto.rows) {
    if (row.adjustments.length === 0) continue;
    const list = row.adjustments.map((a) => `${String(a.amount).replace('.', ',')} công: ${a.reason}`).join('; ');
    words[row.employeeId] = `Điều chỉnh ${list}`;
  }
  return words;
}

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
  kind: 'saturday' | 'leave' | 'left' | 'adjustment' | 'missingHoliday' | 'holidayWork' | 'probationLeave' | 'sundayWork' | 'holidayOvertime' | 'becameOfficial' | 'paper';
  employeeId: string;
  columnId: string;
  text: string;
  /** For a problem that lives on the Nghỉ tab: the absence to open there, and the year of the list that holds it. */
  absence?: { absenceId: string; year: number };
}

export const asNumber = (v: unknown) => (v === 0 ? '-' : String(v).replace('.', ','));
const balance = (v: unknown) => String(v).replace('.', ',');

const AWAY: readonly (AttendanceCode | null)[] = ['TS', 'OM', 'KL'];

/** A fixed holiday nobody entered would read as an ordinary working day: leave taken on it would be charged. */
function missingHolidays(dto: TimesheetDto, days: readonly DayColumn[]): TimesheetProblem[] {
  const [first] = dto.rows;
  if (!first) return [];
  return days.flatMap((d) => {
    const fixed = FIXED_HOLIDAYS.find((h) => d.iso.endsWith(`-${h.monthDay}`));
    if (!fixed || dto.holidays.some((h) => h.day === d.iso || h.name.endsWith(fixed.name))) return [];
    return [{ id: `f${d.iso}`, group: 'Cần xử lý' as const, kind: 'missingHoliday' as const, employeeId: first.employeeId, columnId: d.key, text: `Chưa nhập ngày lễ ${d.label}: ${fixed.name}` }];
  });
}

function restDayProblems(name: string, employeeId: string, grid: GridRow): TimesheetProblem[] {
  const out: TimesheetProblem[] = [];
  const base = { employeeId, group: 'Cần xem' as const };
  if (Number(grid.lamLe) > 0) {
    out.push({ ...base, id: `h${employeeId}`, kind: 'holidayWork', columnId: 'lamLe', text: `${name}: đi làm ${balance(grid.lamLe)} ngày lễ, lương làm lễ tính riêng` });
  }
  if (Number(grid.phepCong) > 0) {
    out.push({ ...base, id: `t${employeeId}`, kind: 'probationLeave', columnId: 'tonCuoi', text: `${name}: lên chính thức, cộng ${balance(grid.phepCong)} ngày phép của thời gian thử việc` });
  }
  if (Number(grid.lamCN) > 0) {
    out.push({ ...base, id: `c${employeeId}`, kind: 'sundayWork', columnId: 'lamCN', text: `${name}: làm ${balance(grid.lamCN)} ngày Chủ nhật, lương tính riêng` });
  }
  if (Number(grid.ot) > 0 && Number(grid.le) >= Number(grid.ot)) {
    out.push({ ...base, id: `v${employeeId}`, kind: 'holidayOvertime', columnId: 'ot', text: `${name}: OT ${balance(grid.ot)} có thể chỉ do ngày lễ, không phải làm thêm` });
  }
  return out;
}

/** Absences in the period whose reason asks for papers and that have none: a reminder only, closing goes ahead. */
function missingPapers(dto: TimesheetDto, days: readonly DayColumn[], absences: readonly AbsenceRowDto[]): TimesheetProblem[] {
  const onSheet = new Set(dto.rows.map((r) => r.employeeId));
  const seen = new Set<string>();
  return absences.flatMap((a) => {
    const isMissing = a.source !== 'sheet' && a.needsPaper && a.files.length === 0;
    if (!isMissing || seen.has(a.id) || !onSheet.has(a.employeeId) || a.to < dto.from || a.from > dto.to) return [];
    seen.add(a.id);
    const start = a.from < dto.from ? dto.from : a.from;
    const span = a.to !== a.from ? `${dayMonth(a.from)}–${dayMonth(a.to)}` : dayMonth(a.from);
    return [{ id: `g${a.id}`, group: 'Cần xem' as const, kind: 'paper' as const, employeeId: a.employeeId, columnId: days.find((d) => d.iso === start)?.key ?? days[0]?.key ?? '', text: `${a.fullName}: ${a.label} ${span}`, absence: { absenceId: a.id, year: Number(a.from.slice(0, 4)) } }];
  });
}

/** What needs a look before closing. A Saturday only counts once the remaining ones can no longer make the norm. */
export function findProblems(dto: TimesheetDto, days: readonly DayColumn[], rows: readonly GridRow[], absences: readonly AbsenceRowDto[] = []): TimesheetProblem[] {
  const out: TimesheetProblem[] = [];
  const saturdays = days.filter((d) => d.weekday === 'T7');
  out.push(...missingHolidays(dto, days));
  for (const row of dto.rows) {
    const grid = rows.find((r) => r.id === row.employeeId);
    if (!grid) continue;
    const region = dto.regions.find((r) => r.id === row.regionId);
    const need = region ? saturdaysFor(region, `${dto.year}-${String(dto.month).padStart(2, '0')}`) : 0;
    const usable = saturdays.filter((d) => (!row.joinedOn || d.iso >= row.joinedOn) && (!row.leftOn || d.iso <= row.leftOn));
    const done = usable.filter((d) => grid[d.key]).length;
    const left = usable.filter((d) => d.iso > dto.today && !grid[d.key]).length;
    const base = { employeeId: row.employeeId };
    const isFullPeriod = usable.length === saturdays.length;
    const isAwayAllPeriod = days.filter((d) => !d.isWeekend).every((d) => AWAY.includes(row.cells[d.iso]?.entered ?? null));
    if (isFullPeriod && !isAwayAllPeriod && done + left < need) {
      out.push({ ...base, id: `t${row.employeeId}`, group: 'Cần xử lý', kind: 'saturday', columnId: usable.filter((d) => d.iso <= dto.today).at(-1)?.key ?? days[0]?.key ?? '', text: `${row.fullName}: ${done}/${need} thứ Bảy, không còn đủ ngày để đạt định mức` });
    }
    if (Number(grid.phepVuot) > 0) {
      out.push({ ...base, id: `p${row.employeeId}`, group: 'Cần xử lý', kind: 'leave', columnId: 'nghiPhep', text: `${row.fullName}: nghỉ ${balance(grid.nghiPhep)} ngày phép, vượt ${balance(grid.phepVuot)} ngày, phần vượt không được trả lương` });
    }
    if (row.leftOn && row.leftOn <= dto.to && Number(grid.tonCuoi) > 0) {
      out.push({ ...base, id: `n${row.employeeId}`, group: 'Cần xử lý', kind: 'left', columnId: 'tonCuoi', text: `${row.fullName}: nghỉ việc ${dayMonth(row.leftOn)}, còn ${balance(grid.tonCuoi)} ngày phép cần thanh toán` });
    }
    out.push(...restDayProblems(row.fullName, row.employeeId, grid));
    if (row.officialOn && row.officialOn > dto.from && row.officialOn <= dto.to) {
      const totals = rowTotals(dto, row, days);
      const codes = days.map((d) => codeOn(dto, row, d.iso, row.cells[d.iso]?.entered ?? null));
      const leavePaid = totals.leave - totals.leaveOverdrawn;
      const { before, after } = paidBySegment({ days: days.map((d) => d.iso), codes, splitOn: row.officialOn, leavePaid, paid: totals.paid });
      out.push({ ...base, id: `o${row.employeeId}`, group: 'Cần xem', kind: 'becameOfficial', columnId: 'loai', text: `${row.fullName}: lên chính thức ${dayMonth(row.officialOn)}, ${before} công thử việc, ${after} công chính thức` });
    }
    for (const a of row.adjustments) {
      out.push({ ...base, id: `a${a.id}`, group: 'Cần xem', kind: 'adjustment', columnId: 'huong', text: `${row.fullName}: điều chỉnh ${balance(a.amount)} công (${a.reason})` });
    }
  }
  out.push(...missingPapers(dto, days, absences));
  return out;
}
