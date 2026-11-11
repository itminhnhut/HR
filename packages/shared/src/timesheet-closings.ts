import type { AttendanceCode, EmployeeBlock, StaffType, TimesheetHolidayDto, TimesheetTotals } from './timesheet.js';

/**
 * Lần chốt kỳ công (spec-luong.md 10.1): each close of a period, kept as it was. Closing again after a reopen adds the
 * next number; none is ever changed, so payroll can point at the one it paid from.
 */

/**
 * `web`: closed on the web. `backfill`: a close made before closings were kept, rebuilt from its snapshot; HR checks it
 * before the first payroll month (spec-luong.md 4.21, 17.2).
 */
export type TimesheetClosingSource = 'web' | 'backfill';

export interface TimesheetClosingRowDto {
  employeeId: string;
  code: string;
  fullName: string;
  department: string;
  title: string;
  block: EmployeeBlock | null;
  regionId: string;
  staffKindId: string | null;
  staffLabel: string | null;
  employment: StaffType;
  joinedOn: string | null;
  officialOn: string | null;
  leftOn: string | null;
  norm: number;
  totals: TimesheetTotals | null;
  /** The code of every day of the period ("YYYY-MM-DD" → code, null for a day not worked). Null when not rebuilt. */
  codes: Record<string, AttendanceCode | null> | null;
  /** A backfilled close whose cells no longer give its totals: its codes are left out, not guessed. */
  cannotRebuild: boolean;
}

/** One thing that differs for a person between a close and the one before it, in words HR reads. */
export interface TimesheetClosingChangeDto {
  employeeId: string;
  code: string;
  fullName: string;
  changes: { label: string; before: string; after: string }[];
}

export interface TimesheetClosingDto {
  id: string;
  periodId: string;
  closeNo: number;
  year: number;
  month: number;
  from: string;
  to: string;
  closedAt: string;
  closedBy: string;
  source: TimesheetClosingSource;
  holidays: TimesheetHolidayDto[];
  /** The norm of each region as it closed. */
  norms: Record<string, number>;
  rows: TimesheetClosingRowDto[];
  /** What changed since the close before it; null for the first. */
  changesFromPrevious: TimesheetClosingChangeDto[] | null;
}
