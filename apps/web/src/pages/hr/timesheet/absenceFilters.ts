import { matchesQuery, periodMonthOf, standardPeriod, type AbsenceRowDto } from '@careers/shared';

export type Approval = 'all' | 'waiting' | 'approved';

export interface AbsenceFilters {
  /** A period of the year shown: 11 is 26/10–25/11, as on the sheet. */
  period: number | null;
  /** Who is away on that day. */
  day: string;
  employeeId: string;
  /** How it counts, half days with their whole: P, KL, KP, M, CL, TS, OM. */
  kind: string;
  approval: Approval;
  query: string;
}

export const NO_FILTERS: AbsenceFilters = { period: null, day: '', employeeId: '', kind: '', approval: 'all', query: '' };

/** Registered, not lateness, and nobody has approved it yet. Lines typed on the sheet are HR's own. */
export const isWaiting = (r: AbsenceRowDto) => r.source !== 'sheet' && !r.approvedBy && r.code !== 'M';

export const kindOf = (r: AbsenceRowDto) => r.code.replace('/2', '');

export function filterAbsences(rows: readonly AbsenceRowDto[], year: number, f: AbsenceFilters): AbsenceRowDto[] {
  const range = f.period ? standardPeriod(year, f.period) : null;
  return rows.filter(
    (r) =>
      (!range || (r.from <= range.to && r.to >= range.from)) &&
      (!f.day || (r.from <= f.day && f.day <= r.to)) &&
      (!f.employeeId || r.employeeId === f.employeeId) &&
      (!f.kind || kindOf(r) === f.kind) &&
      (f.approval === 'all' || (f.approval === 'waiting') === isWaiting(r)) &&
      matchesQuery(`${r.fullName} ${r.employeeCode} ${r.label} ${r.note} ${r.approvedBy ?? ''}`, f.query),
  );
}

/** The list opens on the period running today, as the sheet does; "Xoá lọc" comes back to it. */
export const startFilters = (today: string): AbsenceFilters => ({ ...NO_FILTERS, period: periodMonthOf(today).month });

/** How many filters are on beyond the start, for "Xoá lọc (2)". */
export const filtersOn = (f: AbsenceFilters, start: AbsenceFilters) =>
  [f.period !== start.period, !!f.day, !!f.employeeId, !!f.kind, f.approval !== 'all', !!f.query].filter(Boolean).length;

/** The kinds the list can be narrowed to (AbsenceFilterBar), what a link may ask for. */
export const FILTER_KINDS = ['P', 'KL', 'KP', 'M', 'CL', 'OM', 'TS'] as const;

const LEAVE_LIST = '/hr/cham-cong/nghi';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The sheet of the period a day is in (YYYY-MM), opened on that day, with that person's cell picked. */
export function sheetLink(day: string, employeeId?: string): string {
  const { year, month } = periodMonthOf(day);
  return `/hr/cham-cong?ky=${year}-${String(month).padStart(2, '0')}&ngay=${day}${employeeId ? `&nv=${employeeId}` : ''}`;
}

/** The leave list on one day (from the calendar), or on one person's year and maybe one kind (from the report). */
export function leaveListLink(to: { day: string } | { employeeId: string; year: number; kind?: string }): string {
  if ('day' in to) return `${LEAVE_LIST}?ngay=${to.day}`;
  const params = new URLSearchParams({ nguoi: to.employeeId, nam: String(to.year), ...(to.kind ? { loai: to.kind } : {}) });
  return `${LEAVE_LIST}?${params.toString()}`;
}

/** What such a link asks for, read once when the list opens; null for a plain link. */
export function filtersFromLink(params: URLSearchParams, today: string): { year: number; filters: AbsenceFilters } | null {
  const day = params.get('ngay') ?? '';
  if (ISO_DAY.test(day)) return { year: Number(day.slice(0, 4)), filters: { ...NO_FILTERS, day } };
  const employeeId = params.get('nguoi');
  if (!employeeId) return null;
  const year = Number(params.get('nam'));
  const kind = FILTER_KINDS.find((k) => k === params.get('loai')) ?? '';
  return { year: Number.isInteger(year) && year > 2000 ? year : Number(today.slice(0, 4)), filters: { ...NO_FILTERS, employeeId, kind } };
}
