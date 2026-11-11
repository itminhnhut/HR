import { employmentOn, paidBySegment, type AttendanceCode, type StaffType } from '../timesheet.js';
import type { PaySegment } from './income.js';

/**
 * A period split on the day someone became official and on each new pay level (spec 5.6). The paid days of each part
 * come from the timesheet's `paidBySegment`: leave paid in date order, days above the norm cut at the end, an
 * adjustment on the later part. Every part keeps the period's norm. A part with no paid day is left out, except the
 * last one: it pays nothing by the day but sets the level and status the row ends on (insurance, gross, fixed pay).
 */

/** A pay level of one person from a date (`payroll_profile_amounts`). */
export interface ProfileVersion {
  from: string;
  amounts: Readonly<Record<string, number>>;
}

export interface SegmentArgs {
  /** The days of the period and their codes, from the closing. */
  days: readonly string[];
  codes: readonly (AttendanceCode | null)[];
  /** (17) of the closing, and the leave paid in it (leave taken less leave beyond the balance). */
  paid: number;
  leavePaid: number;
  employment: StaffType;
  officialOn: string | null;
  profiles: readonly ProfileVersion[];
}

const profileOn = (profiles: readonly ProfileVersion[], day: string) =>
  [...profiles].sort((a, b) => b.from.localeCompare(a.from)).find((p) => p.from <= day)?.amounts ?? {};

/** The days a part starts on: the first day, the official date, each new level, when inside the period. */
function startsOf(args: SegmentArgs): string[] {
  const first = args.days[0];
  const last = args.days[args.days.length - 1];
  if (!first || !last) return [];
  const inside = (day: string) => day > first && day <= last;
  const changes = [args.officialOn, ...args.profiles.map((p) => p.from)].filter((d): d is string => !!d && inside(d));
  return [first, ...new Set(changes)].sort();
}

/** Paid days before a date, as the timesheet splits them. */
function paidBefore(args: SegmentArgs, day: string): number {
  const { days, codes, leavePaid, paid } = args;
  return paidBySegment({ days, codes, splitOn: day, leavePaid, paid }).before;
}

export function paySegmentsFor(args: SegmentArgs): PaySegment[] {
  const starts = startsOf(args);
  const segments = starts.map((from, i) => {
    const next = starts[i + 1];
    const end = next === undefined ? args.paid : paidBefore(args, next);
    return {
      from,
      days: end - paidBefore(args, from),
      probation: employmentOn(args, from) === 'probation',
      amounts: profileOn(args.profiles, from),
    };
  });
  // The last part stays even without a paid day: its level and status are the ones in force at the period end.
  return segments.filter((s, i) => s.days > 0 || i === segments.length - 1);
}
