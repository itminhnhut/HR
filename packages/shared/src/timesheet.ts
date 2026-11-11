import type { AbsenceFileDto } from './absence-files.js';
import { z } from 'zod';

/**
 * Chấm công (spec-cham-cong.md): the rules of HR's workbook "Bảng Chấm Công", checked against its October sheet.
 * A day is 1 by itself on Mon–Fri once it has passed; HR only enters what differs, and Saturdays and Sundays.
 */

export const ATTENDANCE_CODES = ['1', 'M', 'P', 'P/2', 'KL', 'KL/2', 'NL', 'KP', 'CL', 'TS', 'OM'] as const;
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
  CL: 'Nghỉ riêng có lương',
  TS: 'Nghỉ thai sản',
  OM: 'Nghỉ ốm hưởng BHXH',
};

/**
 * What HR picks when registering an absence. Days and articles: BLLĐ 2019 Điều 115 and 139. An engagement party is not
 * in the law, so it depends on the company: "other-paid" or "unpaid".
 */
export const ABSENCE_REASONS = [
  { key: 'annual', label: 'Nghỉ phép năm', code: 'P', days: null },
  { key: 'late', label: 'Đi muộn, về sớm', code: 'M', days: null },
  { key: 'wedding', label: 'Bản thân kết hôn', code: 'CL', days: 3 },
  { key: 'child-wedding', label: 'Con kết hôn', code: 'CL', days: 1 },
  { key: 'funeral-close', label: 'Tang cha mẹ, vợ chồng, con', code: 'CL', days: 3 },
  { key: 'other-paid', label: 'Nghỉ có lương khác', code: 'CL', days: null },
  { key: 'funeral-family', label: 'Tang ông bà, anh chị em', code: 'KL', days: 1 },
  { key: 'family-wedding', label: 'Cha mẹ, anh chị em kết hôn', code: 'KL', days: 1 },
  { key: 'unpaid', label: 'Nghỉ không lương', code: 'KL', days: null },
  { key: 'maternity', label: 'Thai sản', code: 'TS', days: null },
  { key: 'sick', label: 'Ốm có giấy BHXH', code: 'OM', days: null },
] as const satisfies readonly { key: string; label: string; code: AttendanceCode; days: number | null }[];
export type AbsenceReasonKey = (typeof ABSENCE_REASONS)[number]['key'];

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

const SUNDAY = 0;
const SATURDAY = 6;

/**
 * The holidays that fall on the same date every year: Đ.112 BLLĐ 2019 and NQ 28/2026/QH16. Tết and Giỗ Tổ follow the
 * lunar calendar and the day next to 2/9 is announced each year, so HR enters those from the official notice.
 */
export const FIXED_HOLIDAYS: readonly { monthDay: string; name: string }[] = [
  { monthDay: '01-01', name: 'Tết Dương lịch' },
  { monthDay: '04-30', name: 'Ngày Chiến thắng' },
  { monthDay: '05-01', name: 'Quốc tế Lao động' },
  { monthDay: '09-02', name: 'Quốc khánh' },
  { monthDay: '11-24', name: 'Ngày Văn hoá Việt Nam' },
];

export const nextDay = (day: string) => {
  const [y = 2000, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Sunday is the weekly day of rest (no sheet has anyone working one), so a holiday on it is taken on the next working
 * day, as Điều 111 khoản 3 BLLĐ 2019 says. Saturdays are worked here, so a holiday on one stays.
 */
export function holidaysInEffect<T extends { day: string; name: string }>(holidays: readonly T[]): { day: string; name: string }[] {
  const sorted = [...holidays].sort((a, b) => a.day.localeCompare(b.day));
  const taken = new Set(sorted.map((h) => h.day));
  const moved = sorted.flatMap((h) => {
    if (weekdayOf(h.day) !== SUNDAY) return [{ day: h.day, name: h.name }];
    let day = nextDay(h.day);
    while (taken.has(day) || weekdayOf(day) === SUNDAY) day = nextDay(day);
    taken.add(day);
    return [{ day, name: `Nghỉ bù ${h.name}` }];
  });
  return moved.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * The days of a long break such as Tết, typed as announced: the announced schedule already holds any day in lieu,
 * so the Sundays in it are left out and earn nothing more. One day on its own stays, Sunday or not, so that
 * holidaysInEffect moves it to the next working day (Điều 111 khoản 3).
 */
export function daysOfHolidayBreak(from: string, to: string): string[] {
  if (from === to) return [from];
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDay(day)) {
    if (weekdayOf(day) !== SUNDAY) days.push(day);
  }
  return days;
}

/** Days next to each other with the same name, across a Sunday, read as one line. */
export function groupHolidays(list: readonly { day: string; name: string }[]): { from: string; to: string; name: string; days: number }[] {
  const groups: { from: string; to: string; name: string; days: number }[] = [];
  for (const h of [...list].sort((a, b) => a.day.localeCompare(b.day))) {
    const last = groups.at(-1);
    const next = last && nextDay(last.to);
    const isNext = !!next && (next === h.day || (weekdayOf(next) === SUNDAY && nextDay(next) === h.day));
    if (last && isNext && last.name === h.name) {
      groups[groups.length - 1] = { ...last, to: h.day, days: last.days + 1 };
    } else {
      groups.push({ from: h.day, to: h.day, name: h.name, days: 1 });
    }
  }
  return groups;
}

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

/**
 * `law`: annual leave as NĐ 145/2020 Điều 65, 66 count it. `excel`: as HR's workbook did, which leaves holidays and
 * approved unpaid leave out of the count and gives nothing for, and keeps nothing through, a probation period.
 */
export const LEAVE_MODES = ['law', 'excel'] as const;
export type LeaveMode = (typeof LEAVE_MODES)[number];

export interface LeaveRule {
  threshold: number;
  perPeriod: number;
  mode?: LeaveMode;
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
  /** Days off on full pay for a family event, Điều 115 khoản 1. */
  personalPaid: number;
  /** Days on maternity or sick leave: insurance pays them, not this sheet. */
  insured: number;
  maternity: number;
  sick: number;
  /** Leave earned during probation, held until the person becomes official (Điều 65 khoản 2). */
  leavePendingClosing: number;
  /** Held probation leave added to the balance in this period. */
  leaveCredited: number;
  /** Approved unpaid days and sick days that counted toward leave here, for the yearly caps. */
  unpaidCounted: number;
  sickCounted: number;
  /** Stored when a period closes, for payroll: days worked on a Sunday and on a holiday. */
  sundayWorked?: number;
  holidayWorked?: number;
  /** Paid before an adjustment, so the screen can say "tính ra 21,5, điều chỉnh −0,5". */
  paidBeforeAdjustment: number;
}

export interface LeaveYearSoFar {
  /** Leave held from probation periods before this one. */
  leavePending?: number;
  /** Approved unpaid and sick days already counted toward leave earlier this year. */
  unpaidCountedBefore?: number;
  sickCountedBefore?: number;
}

/**
 * What counts as time worked for leave. Điều 65 khoản 4: approved unpaid leave up to one month a year; khoản 6: sickness
 * up to two months a year; khoản 7: maternity; Điều 66: public holidays. "A month" is taken as the period's norm.
 */
function leaveCount(count: (code: AttendanceCode) => number, norm: number, mode: LeaveMode, before: LeaveYearSoFar) {
  const base = count('1') + count('M') + count('P') + count('P/2') + 0.5 * count('KL/2') + count('CL') + count('TS');
  if (mode === 'excel') return { counted: base + count('OM'), unpaidCounted: 0, sickCounted: 0 };
  const room = (cap: number, used = 0) => Math.max(0, cap - used);
  const unpaidCounted = Math.min(count('KL') + 0.5 * count('KL/2'), room(norm, before.unpaidCountedBefore));
  const sickCounted = Math.min(count('OM'), room(2 * norm, before.sickCountedBefore));
  return { counted: base + count('NL') + unpaidCounted + sickCounted, unpaidCounted, sickCounted };
}

/** Days worked on a Sunday and on a public holiday: payroll pays them at their own rate (BLLĐ Điều 98). */
export function restDayWork(days: readonly string[], codes: readonly (AttendanceCode | null)[], holidays: ReadonlySet<string>) {
  let sundayWorked = 0;
  let holidayWorked = 0;
  days.forEach((day, i) => {
    if (codes[i] !== '1' && codes[i] !== 'M') return;
    if (holidays.has(day)) holidayWorked += 1;
    else if (weekdayOf(day) === SUNDAY) sundayWorked += 1;
  });
  return { sundayWorked, holidayWorked };
}

/** What one day brings to the paid total: days worked, holidays, family days, and the leave part still covered. */
function dayPaid(code: AttendanceCode | null, leaveLeft: number) {
  const leaveOf = (want: number) => Math.min(want, leaveLeft);
  if (code === '1' || code === 'M' || code === 'NL' || code === 'CL') return { paid: 1, leave: 0 };
  if (code === 'KL/2') return { paid: 0.5, leave: 0 };
  if (code === 'P/2') return { paid: 0.5 + leaveOf(0.5), leave: leaveOf(0.5) };
  if (code === 'P') return { paid: leaveOf(1), leave: leaveOf(1) };
  return { paid: 0, leave: 0 };
}

/**
 * Paid days before and from the day someone became official. Leave is paid in date order until what was paid runs
 * out, days past the paid total (above the norm) are not paid, and an adjustment falls on the later part.
 */
export function paidBySegment(args: { days: readonly string[]; codes: readonly (AttendanceCode | null)[]; splitOn: string; leavePaid: number; paid: number }) {
  let leaveLeft = args.leavePaid;
  let room = args.paid;
  let before = 0;
  let after = 0;
  args.days.forEach((day, i) => {
    const { paid, leave } = dayPaid(args.codes[i] ?? null, leaveLeft);
    leaveLeft -= leave;
    const counted = Math.max(0, Math.min(paid, room));
    room -= counted;
    if (day < args.splitOn) before += counted;
    else after += counted;
  });
  return { before, after: after + Math.max(0, room) };
}

/** How many days count toward the leave threshold, for a screen that has to predict it. */
export function leaveCountOf(codes: readonly (AttendanceCode | null)[], norm: number, rule: LeaveRule, before: LeaveYearSoFar = {}): number {
  const count = (code: AttendanceCode) => codes.filter((c) => c === code).length;
  return leaveCount(count, norm, rule.mode ?? 'excel', before).counted;
}

/** Leave the person may use this period, and leave held for later while on probation. */
function leaveBalance(args: { employment: StaffType; leaveOpening: number; leaveChange: number; earned: number; mode: LeaveMode; leavePending: number }) {
  const { employment, leaveOpening, leaveChange, earned, mode, leavePending } = args;
  if (employment === 'probation') {
    if (mode === 'excel') return { available: Math.max(0, leaveChange), pendingClosing: 0, credited: 0 };
    return { available: Math.max(0, leaveOpening + leaveChange), pendingClosing: leavePending + earned, credited: 0 };
  }
  const credited = mode === 'law' ? leavePending : 0;
  // Never below nothing: negative leave would otherwise come off the days worked.
  return { available: Math.max(0, leaveOpening + earned + credited + leaveChange), pendingClosing: 0, credited };
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
  /** Days HR added to or took off the balance by hand in this period. */
  leaveChange?: number;
  rule?: LeaveRule;
} & LeaveYearSoFar): TimesheetTotals {
  const { codes, norm, leaveOpening, employment, adjustment = 0, leaveChange = 0, rule = DEFAULT_LEAVE_RULE } = args;
  const mode = rule.mode ?? 'excel';
  const count = (code: AttendanceCode) => codes.filter((c) => c === code).length;
  const actual = count('1') + count('M') + 0.5 * (count('P/2') + count('KL/2'));
  const leave = count('P') + 0.5 * count('P/2');
  const holiday = count('NL');
  const personalPaid = count('CL');
  const { counted, unpaidCounted, sickCounted } = leaveCount(count, norm, mode, args);
  const earned = counted >= rule.threshold ? rule.perPeriod : 0;
  const { available, pendingClosing, credited } = leaveBalance({ employment, leaveOpening, leaveChange, earned, mode, leavePending: args.leavePending ?? 0 });
  const leavePaid = Math.min(leave, available);
  const total = actual + leavePaid + holiday + personalPaid;
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
    personalPaid,
    insured: count('TS') + count('OM'),
    maternity: count('TS'),
    sick: count('OM'),
    leavePendingClosing: pendingClosing,
    leaveCredited: credited,
    unpaidCounted,
    sickCounted,
  };
}

// Inputs

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');
const optionalDay = z.union([isoDay, z.literal('')]).nullish().transform((v) => v || null);
const halfSteps = z.number().finite().refine((n) => Number.isInteger(n * 2), 'Nhập theo bước 0,5.');

/** Khối of a person (spec-luong.md 10.1): back office or sales. Payroll groups by it, as of each close. */
export const EMPLOYEE_BLOCKS = ['BO', 'KD'] as const;
export type EmployeeBlock = (typeof EMPLOYEE_BLOCKS)[number];

export const employeeInputSchema = z
  .object({
    code: z.string().trim().min(1, 'Nhập mã nhân viên.').max(20),
    fullName: z.string().trim().min(1, 'Nhập họ và tên.').max(100),
    department: z.string().trim().max(80).default(''),
    title: z.string().trim().max(80).default(''),
    regionId: z.string().uuid('Chọn khu vực.'),
    employment: z.enum(['official', 'probation']),
    /** The kind HR chose; its rule decides `employment`. */
    staffKindId: z.string().uuid().nullish(),
    joinedOn: optionalDay,
    officialOn: optionalDay,
    leftOn: optionalDay,
    openingLeave: halfSteps.min(0, 'Phép không được âm.').max(365).default(0),
    /** Left out: kept as it is. Null: none yet. */
    block: z.enum(EMPLOYEE_BLOCKS, { message: 'Chọn khối BO hoặc KD.' }).nullish(),
    /** HR checked the date (spec-luong.md 4.20). Left out: kept while the date stays, dropped when it changes. */
    joinedOnConfirmed: z.boolean().optional(),
    officialOnConfirmed: z.boolean().optional(),
    leftOnConfirmed: z.boolean().optional(),
  })
  .refine((v) => !v.joinedOn || !v.leftOn || v.leftOn >= v.joinedOn, {
    path: ['leftOn'],
    message: 'Ngày nghỉ phải sau ngày vào.',
  });
export type EmployeeInput = z.input<typeof employeeInputSchema>;

export const departmentInputSchema = z.object({ name: z.string().trim().min(1, 'Nhập tên bộ phận.').max(80) });
export type DepartmentInput = z.input<typeof departmentInputSchema>;

export interface DepartmentDto {
  id: string;
  name: string;
  /** People in it now. */
  employees: number;
}

export const staffKindInputSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên loại.').max(40),
  rule: z.enum(['official', 'probation'], { message: 'Chọn cách tính phép.' }),
});
export type StaffKindInput = z.input<typeof staffKindInputSchema>;

export interface StaffKindDto {
  id: string;
  name: string;
  /** Counts for leave as official staff, or as someone on probation. */
  rule: StaffType;
  /** One of the two kinds of the sheet: it can be renamed, not removed. */
  isDefault: boolean;
  employees: number;
}

/** Someone who became official by that day counts as official. */
export function employmentOn(person: { employment: StaffType; officialOn: string | null }, day: string): StaffType {
  if (!person.officialOn) return person.employment;
  return person.officialOn <= day ? 'official' : 'probation';
}

/** The kind someone shows as: the one HR gave them while it fits how they count now, else the usual one for that. */
export function staffKindOf<K extends Pick<StaffKindDto, 'id' | 'rule' | 'isDefault'>>(kinds: readonly K[], kindId: string | null | undefined, employment: StaffType): K | undefined {
  const kind = kinds.find((k) => k.id === kindId);
  if (kind?.rule === employment) return kind;
  return kinds.find((k) => k.isDefault && k.rule === employment);
}

export function staffLabelOf(kinds: readonly StaffKindDto[], kindId: string | null | undefined, employment: StaffType): string {
  return staffKindOf(kinds, kindId, employment)?.name ?? STAFF_TYPE_LABEL[employment];
}

export const REGION_TONES = ['blue', 'rose', 'emerald', 'amber', 'cyan', 'orange'] as const;
export type RegionTone = (typeof REGION_TONES)[number];

export const regionInputSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên khu vực.').max(40),
  saturdays: z.number().int().min(0).max(5),
  tone: z.enum(REGION_TONES),
  /** YYYY-MM: the month the new number of Saturdays starts from. Without it the number is the region's starting one. */
  saturdaysFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Chọn tháng áp dụng.').optional(),
});
export type RegionInput = z.input<typeof regionInputSchema>;

const ABSENCE_MAX_DAYS = 366;

const COUNTABLE_CODES = ['CL', 'P', 'KL', 'M', 'TS', 'OM'] as const;
/** Who approved leave HR typed straight into the sheet: HR itself. Migration 0033 puts it in the approvers list. */
export const SHEET_APPROVER = 'HR';

/** Codes typed on the sheet that the leave list shows as a line of their own. */
export const SHEET_LEAVE_CODES = ['P', 'P/2', 'KL', 'KL/2', 'KP', 'M', 'CL', 'TS', 'OM'] as const;

/** A line typed on the sheet: its code and days. */
export const sheetLeaveSchema = z
  .object({ code: z.enum(SHEET_LEAVE_CODES, { message: 'Mã không hợp lệ.' }), from: isoDay, to: isoDay })
  .refine((a) => a.from <= a.to, { path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' })
  .refine((a) => a.from > a.to || daysBetweenInclusive(a.from, a.to) <= ABSENCE_MAX_DAYS, { path: ['to'], message: 'Tối đa 1 năm.' });

export const absenceInputSchema = z
  .object({
    reason: z.string().trim().min(1, 'Chọn lý do nghỉ.'),
    from: isoDay,
    to: isoDay,
    note: z.string().trim().max(200).optional(),
    /** How this one counts, when HR changes the default of the reason. */
    code: z.enum(COUNTABLE_CODES, { message: 'Chọn cách tính.' }).optional(),
    /** Empty means it still waits: the sheet does not move until someone has approved. */
    approvedBy: z.string().trim().max(80).optional(),
    handover: z.string().trim().max(300).optional(),
    isHalf: z.boolean().optional(),
    /** A line typed on the sheet this absence takes over: its days of that code become the absence's. */
    replacesSheet: sheetLeaveSchema.optional(),
  })
  .refine((a) => !a.isHalf || a.from === a.to, { path: ['to'], message: 'Nửa ngày thì chọn một ngày.' })
  .refine((a) => a.from <= a.to, { path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' })
  .refine((a) => a.from > a.to || daysBetweenInclusive(a.from, a.to) <= ABSENCE_MAX_DAYS, { path: ['to'], message: 'Tối đa 1 năm.' });
export type AbsenceInput = z.input<typeof absenceInputSchema>;

export const leaveChangeSchema = z.object({
  employeeId: z.string().uuid(),
  amount: halfSteps.refine((n) => n !== 0, 'Nhập số ngày khác 0.'),
  reason: z.string().trim().min(1, 'Nhập lý do.').max(200),
});
export type LeaveChangeInput = z.input<typeof leaveChangeSchema>;

/** How a kind of absence counts. HR names the kind; these are the ways it can be counted. */
export const ABSENCE_COUNTING: Partial<Record<AttendanceCode, string>> = {
  CL: 'Có lương, không trừ phép',
  P: 'Có lương, trừ phép năm',
  'P/2': 'Nửa ngày, trừ phép năm',
  M: 'Vẫn 1 công, đếm 1 lần',
  KL: 'Không lương',
  'KL/2': 'Nửa ngày không lương',
  TS: 'BHXH trả, không tính công',
  OM: 'BHXH trả, không tính công',
};

export const approverSchema = z.object({ name: z.string().trim().min(1, 'Nhập tên người duyệt.').max(80) });

export interface ApproverDto {
  id: string;
  name: string;
}

export const absenceKindSchema = z.object({
  name: z.string().trim().min(1, 'Nhập tên loại nghỉ.').max(80),
  code: z.enum(COUNTABLE_CODES, { message: 'Chọn cách tính.' }),
  days: z.number().int().min(1).max(366).nullable(),
});
export type AbsenceKindInput = z.input<typeof absenceKindSchema>;

export const holidayRangeSchema = z
  .object({
    from: isoDay,
    to: isoDay,
    name: z.string().trim().min(1, 'Nhập tên đợt nghỉ.').max(80),
  })
  .refine((r) => r.from <= r.to, { path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu.' })
  .refine((r) => r.from > r.to || daysBetweenInclusive(r.from, r.to) <= TIMESHEET_MAX_DAYS, { path: ['to'], message: `Tối đa ${TIMESHEET_MAX_DAYS} ngày.` });
export type HolidayRangeInput = z.input<typeof holidayRangeSchema>;

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

export interface TimesheetAbsenceDto {
  id: string;
  reason: string;
  code: string;
  from: string;
  to: string;
  /** Days it comes to: 0,5 for half a day. */
  days: number;
  note: string;
  label: string;
  /** Null while it waits for approval. */
  approvedBy: string | null;
  handover: string;
  createdBy: string;
  /** Papers kept with it, oldest first; none for a line typed on the sheet. */
  files: AbsenceFileDto[];
  /** Its reason asks for papers (Cấu hình); with no files that reads "Thiếu giấy". */
  needsPaper: boolean;
}

export interface AbsenceRowDto extends TimesheetAbsenceDto {
  /** `sheet`: typed straight into the sheet, not registered; read here, changed in the sheet. */
  source?: 'absence' | 'sheet';
  employeeId: string;
  employeeCode: string;
  fullName: string;
  /** Registered by a company day off (tab Nghỉ công ty): changed there, not line by line. */
  batch?: { id: string; name: string } | null;
}

export interface AbsenceKindDto {
  key: string;
  name: string;
  code: AttendanceCode;
  days: number | null;
  /** Added by HR, so HR can remove it; the ones in the law stay. */
  isOwn: boolean;
  /** Whether an absence for this reason should have papers kept with it. */
  needsPaper: boolean;
}

export interface SaturdayChange {
  from: string;
  saturdays: number;
}

/** A region's Saturdays in a month: the last change that has started, else what it began with. */
export function saturdaysFor(region: { saturdays: number; saturdayChanges?: readonly SaturdayChange[] }, monthKey: string): number {
  const started = (region.saturdayChanges ?? []).filter((c) => c.from <= monthKey);
  return started.at(-1)?.saturdays ?? region.saturdays;
}

/**
 * The days an absence fills for someone in a region: Mon–Fri; a Saturday only when the region works every Saturday
 * of that period, since otherwise the sheet cannot tell which ones it works; never Sunday, nor a day in `holidays`.
 */
export function workingDayCheck(region: { saturdays: number; saturdayChanges?: readonly SaturdayChange[] } | undefined, holidays: ReadonlySet<string> = new Set()) {
  return (day: string): boolean => {
    if (holidays.has(day) || weekdayOf(day) === SUNDAY) return false;
    if (!isWeekend(day)) return true;
    if (!region) return false;
    const { year, month } = periodMonthOf(day);
    const saturdays = periodDays(standardPeriod(year, month)).filter((d) => weekdayOf(d) === SATURDAY).length;
    return saturdaysFor(region, `${year}-${String(month).padStart(2, '0')}`) >= saturdays;
  };
}

export interface TimesheetRegionDto {
  id: string;
  name: string;
  saturdays: number;
  saturdayChanges: SaturdayChange[];
  tone: RegionTone;
  hidden: boolean;
  employees: number;
}

export interface EmployeeDto {
  staffKindId: string | null;
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
  block: EmployeeBlock | null;
  /** Whether HR confirmed each date; dates typed in from the old sheets are not (spec-luong.md 4.20). */
  joinedOnConfirmed: boolean;
  officialOnConfirmed: boolean;
  leftOnConfirmed: boolean;
  /** Something HR must act on after this save, such as days already paid after a last day. */
  warning?: string;
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

export interface TimesheetLeaveChangeDto {
  id: string;
  amount: number;
  reason: string;
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
  /** What HR calls their kind of staff in this period. */
  staffLabel?: string;
  joinedOn: string | null;
  /** Set while the date can still matter: a period with this date inside it has days at each pay level. */
  officialOn?: string | null;
  leftOn: string | null;
  leaveOpening: number;
  /** Held probation leave and the yearly counts so far, which the leave count of this period starts from. */
  leaveSoFar?: LeaveYearSoFar;
  norm: number;
  cells: Record<string, TimesheetCellDto>;
  adjustments: TimesheetAdjustmentDto[];
  leaveChanges: TimesheetLeaveChangeDto[];
  /** The totals as the period closed: what was paid stays, whatever the arithmetic becomes later. */
  frozenTotals: TimesheetTotals | null;
}

/**
 * Where a month stands. "empty" means past or running with nothing to go on: its T2–T6 would all read 1 only because
 * nobody entered anything, so it is not offered as a payroll sheet.
 */
export type TimesheetMonthStatus = 'closed' | 'running' | 'waiting' | 'empty' | 'future';

export interface TimesheetMonthDto {
  year: number;
  month: number;
  from: string;
  to: string;
  status: TimesheetMonthStatus;
  closedBy: string | null;
}

export function monthStatus(args: { isClosed: boolean; hasEntries: boolean; range: TimesheetPeriodRange; today: string }): TimesheetMonthStatus {
  const { isClosed, hasEntries, range, today } = args;
  if (isClosed) return 'closed';
  if (today < range.from) return 'future';
  if (today <= range.to) return 'running';
  return hasEntries ? 'waiting' : 'empty';
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
  /** After a reopen or a close, what Lương makes of it, in words without any figure (spec-luong.md 10.1). */
  payrollNotice?: string;
}

/** The tab a line of the log came from. */
export type TimesheetLogArea = 'bang-cong' | 'nghi' | 'nhan-vien' | 'cau-hinh';

export interface TimesheetLogDto {
  id: string;
  actor: string;
  action: string;
  detail: string;
  at: string;
}

export interface TimesheetLogLineDto extends TimesheetLogDto {
  area: TimesheetLogArea;
  /** YYYY-MM, for a change on the sheet. */
  periodMonth: string | null;
}

export interface TimesheetLogPageDto {
  lines: TimesheetLogLineDto[];
  hasMore: boolean;
}
