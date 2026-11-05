import { isWeekend, nextDay } from '@careers/shared';

/** The last of `count` weekdays from a day: what the law's 3 days come to on the calendar. */
export function lastOfWeekdays(from: string, count: number): string {
  let day = from;
  let left = isWeekend(day) ? count : count - 1;
  while (left > 0 || isWeekend(day)) {
    day = nextDay(day);
    if (!isWeekend(day)) left -= 1;
  }
  return day;
}

export function weekdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let day = from; day <= to; day = nextDay(day)) if (!isWeekend(day)) n += 1;
  return n;
}

const MATERNITY_MONTHS = 6;

/** Where a reason's usual length ends: so many weekdays, or 6 months for maternity leave (Đ.139). */
export function defaultEnd(from: string, reason: string | undefined, days: number): string {
  if (reason !== 'maternity') return lastOfWeekdays(from, days);
  const [y = 2000, m = 1, d = 1] = from.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + MATERNITY_MONTHS, d - 1)).toISOString().slice(0, 10);
}
