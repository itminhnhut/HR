import { z } from 'zod';

/**
 * Chấm công (spec-cham-cong.md): the rules of HR's workbook "Bảng Chấm Công", checked against its October sheet.
 * A day is 1 by itself on Mon–Fri once it has passed; HR only enters what differs, and Saturdays and Sundays.
 */

export const ATTENDANCE_CODES = ['1', 'M', 'P', 'P/2', 'KL', 'KL/2', 'NL', 'KP'] as const;
export type AttendanceCode = (typeof ATTENDANCE_CODES)[number];

export const ATTENDANCE_LABEL: Record<AttendanceCode, string> = {
  '1': '1 ngày công',
  M: 'Đi muộn về sớm',
  P: 'Nghỉ phép 1 ngày',
  'P/2': 'Nghỉ phép 0,5 ngày',
  KL: 'Nghỉ không lương',
  'KL/2': 'Nghỉ không lương 0,5 ngày',
  NL: 'Nghỉ lễ',
  KP: 'Nghỉ không phép',
};

export type StaffType = 'official' | 'probation';
export const STAFF_TYPE_LABEL: Record<StaffType, string> = { official: 'Chính thức', probation: 'Thử việc' };

/** A workbook sheet has 31 day columns. */
export const TIMESHEET_MAX_DAYS = 31;
export const LEAVE_THRESHOLD_DEFAULT = 14;
export const LEAVE_PER_PERIOD_DEFAULT = 1;

export interface TimesheetPeriodRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** "Tháng 11" is 26/10 to 25/11, as the workbook's own formula has it. */
export function standardPeriod(year: number, month: number): TimesheetPeriodRange {
  return { from: isoOf(year, month - 1, 26), to: isoOf(year, month, 25) };
}

/** The period a day falls in: 26/10 belongs to November. */
export function periodMonthOf(day: string): { year: number; month: number } {
  const [y = 2000, m = 1, d = 1] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + (d >= 26 ? 1 : 0), 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

/** 0 is Sunday, whatever time zone this runs in. */
export function weekdayOf(day: string): number {
  const [y = 2000, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const isWeekend = (day: string) => [0, 6].includes(weekdayOf(day));

export function daysBetweenInclusive(from: string, to: string): number {
  const [fy = 2000, fm = 1, fd = 1] = from.split('-').map(Number);
  const [ty = 2000, tm = 1, td = 1] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
}

export function periodDays({ from, to }: TimesheetPeriodRange): string[] {
  const [y = 2000, m = 1, d = 1] = from.split('-').map(Number);
  return Array.from({ length: Math.max(0, daysBetweenInclusive(from, to)) }, (_, i) => isoOf(y, m, d + i));
}

/** Mon–Fri of the period plus the Saturdays a region counts: HCM 2, HN 4 in both sheets so far. HR can change it. */
export function suggestedNorm(range: TimesheetPeriodRange, saturdays: number): number {
  return periodDays(range).filter((day) => !isWeekend(day)).length + saturdays;
}

export interface WorkingDates {
  joinedOn: string | null;
  leftOn: string | null;
}

export const isWorkingOn = ({ joinedOn, leftOn }: WorkingDates, day: string) =>
  (!joinedOn || day >= joinedOn) && (!leftOn || day <= leftOn);

/**
 * What a day counts as: what HR entered; a holiday; else 1 for a Mon–Fri already reached. A day outside the working
 * dates counts for nothing, even if something was entered before those dates changed.
 */
export function dayCode(
  args: WorkingDates & { day: string; entered: AttendanceCode | null; isHoliday: boolean; today: string },
): AttendanceCode | null {
  const { day, entered, isHoliday, today } = args;
  if (!isWorkingOn(args, day)) return null;
  if (entered) return entered;
  if (isHoliday) return 'NL';
  return !isWeekend(day) && day <= today ? '1' : null;
}

export interface LeaveRule {
  threshold: number;
  perPeriod: number;
}

export const DEFAULT_LEAVE_RULE: LeaveRule = { threshold: LEAVE_THRESHOLD_DEFAULT, perPeriod: LEAVE_PER_PERIOD_DEFAULT };

export interface TimesheetTotals {
  actual: number;
  lateCount: number;
  leave: number;
  unpaidLeave: number;
  absent: number;
  holiday: number;
  norm: number;
  paid: number;
  overtime: number;
  leaveOpening: number;
  leaveClosing: number;
  /** Leave taken beyond what the person had: not paid. */
  leaveOverdrawn: number;
  /** Paid before an adjustment, so the screen can say "tính ra 21,5, điều chỉnh −0,5". */
  paidBeforeAdjustment: number;
}

/**
 * The workbook's columns. One change from sheet "Tháng 11": leave is paid from what the person has including this
 * period's new day, as sheet "Tháng 10" did, so a day taken from the balance is never left unpaid.
 */
export function timesheetTotals(args: {
  codes: readonly (AttendanceCode | null)[];
  norm: number;
  leaveOpening: number;
  employment: StaffType;
  adjustment?: number;
  rule?: LeaveRule;
}): TimesheetTotals {
  const { codes, norm, leaveOpening, employment, adjustment = 0, rule = DEFAULT_LEAVE_RULE } = args;
  const count = (code: AttendanceCode) => codes.filter((c) => c === code).length;
  const actual = count('1') + count('M') + 0.5 * (count('P/2') + count('KL/2'));
  const leave = count('P') + 0.5 * count('P/2');
  const holiday = count('NL');
  const leaveCounted = count('1') + count('M') + count('P') + count('P/2') + 0.5 * count('KL/2');
  const available =
    employment === 'probation' ? 0 : leaveOpening + (leaveCounted >= rule.threshold ? rule.perPeriod : 0);
  const leavePaid = Math.min(leave, available);
  const total = actual + leavePaid + holiday;
  const capped = Math.min(total, norm);
  return {
    actual,
    lateCount: count('M'),
    leave,
    unpaidLeave: count('KL') + 0.5 * count('KL/2'),
    absent: count('KP'),
    holiday,
    norm,
    paid: Math.max(0, capped + adjustment),
    paidBeforeAdjustment: capped,
    overtime: Math.max(0, total - norm),
    leaveOpening,
    leaveClosing: available - leavePaid,
    leaveOverdrawn: Math.max(0, leave - available),
  };
}

// Inputs

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');
const optionalDay = z.union([isoDay, z.literal('')]).nullish().transform((v) => v || null);
const halfSteps = z.number().finite().refine((n) => Number.isInteger(n * 2), 'Nhập theo bước 0,5.');

export const employeeInputSchema = z
  .object({
    code: z.string().trim().min(1, 'Nhập mã nhân viên.').max(20),
    fullName: z.string().trim().min(1, 'Nhập họ và tên.').max(100),
    department: z.string().trim().max(80).default(''),
    title: z.string().trim().max(80).default(''),
    regionId: z.string().uuid('Chọn khu vực.'),
    employment: z.enum(['official', 'probation']),
    joinedOn: optionalDay,
    officialOn: optionalDay,
    leftOn: optionalDay,
    openingLeave: halfSteps.min(0, 'Phép không được âm.').max(365).default(0),
  })
  .refine((v) => !v.joinedOn || !v.leftOn || v.leftOn >= v.joinedOn, {
    path: ['leftOn'],
    message: 'Ngày nghỉ phải sau ngày vào.',
  });
export type EmployeeInput = z.input<typeof employeeInputSchema>;

export const REGION_TONES = ['blue', 'rose', 'emerald', 'amber', 'cyan', 'orange'] as const;
export type RegionTone = (typeof REGION_TONES)[number];

export const regionInputSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên khu vực.').max(40),
  saturdays: z.number().int().min(0).max(5),
  tone: z.enum(REGION_TONES),
});
export type RegionInput = z.input<typeof regionInputSchema>;

export const holidayInputSchema = z.object({
  day: isoDay,
  name: z.string().trim().min(1, 'Nhập tên ngày lễ.').max(80),
});
export type HolidayInput = z.input<typeof holidayInputSchema>;

export const timesheetCellsSchema = z.object({
  cells: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        day: isoDay,
        /** Absent: leave the code alone. null: back to automatic. */
        code: z.enum(ATTENDANCE_CODES).nullable().optional(),
        note: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .min(1)
    .max(2000),
});
export type TimesheetCellsInput = z.input<typeof timesheetCellsSchema>;

export const timesheetNormsSchema = z.object({
  norms: z.record(z.string().uuid(), z.number().min(0).max(31)),
});

export const timesheetAdjustmentSchema = z.object({
  employeeId: z.string().uuid(),
  amount: halfSteps.min(-31).max(31).refine((n) => n !== 0, 'Nhập số công khác 0.'),
  reason: z.string().trim().min(1, 'Nhập lý do.').max(200),
  isRecurring: z.boolean(),
});
export type TimesheetAdjustmentInput = z.input<typeof timesheetAdjustmentSchema>;

export const timesheetReopenSchema = z.object({ reason: z.string().trim().min(1, 'Nhập lý do mở lại.').max(200) });

// Responses

export interface TimesheetRegionDto {
  id: string;
  name: string;
  saturdays: number;
  tone: RegionTone;
  hidden: boolean;
  employees: number;
}

export interface EmployeeDto {
  id: string;
  code: string;
  fullName: string;
  department: string;
  title: string;
  regionId: string;
  employment: StaffType;
  joinedOn: string | null;
  officialOn: string | null;
  leftOn: string | null;
  openingLeave: number;
}

export interface TimesheetCellDto {
  /** What HR entered; null when the day is automatic. */
  entered: AttendanceCode | null;
  note: string | null;
}

export interface TimesheetAdjustmentDto {
  id: string;
  amount: number;
  reason: string;
  isRecurring: boolean;
  createdBy: string;
}

export interface TimesheetRowDto {
  employeeId: string;
  code: string;
  fullName: string;
  department: string;
  title: string;
  regionId: string;
  employment: StaffType;
  joinedOn: string | null;
  leftOn: string | null;
  leaveOpening: number;
  norm: number;
  cells: Record<string, TimesheetCellDto>;
  adjustments: TimesheetAdjustmentDto[];
}

export interface TimesheetHolidayDto {
  day: string;
  name: string;
}

export interface TimesheetDto {
  /** null for a free range of days: it can be read and downloaded, not entered or closed. */
  periodId: string | null;
  year: number;
  month: number;
  from: string;
  to: string;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedBy: string | null;
  /** Reopening is only for the latest closed period: earlier ones would change the balances after them. */
  canReopen: boolean;
  norms: Record<string, number>;
  rule: LeaveRule;
  today: string;
  regions: TimesheetRegionDto[];
  holidays: TimesheetHolidayDto[];
  rows: TimesheetRowDto[];
}

export interface TimesheetLogDto {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}
