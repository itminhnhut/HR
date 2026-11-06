import { nextDay } from '@careers/shared';

/** Whether a day is one an absence fills: from workingDayCheck, so the form counts what the sheet will get. */
export type IsWorked = (day: string) => boolean;

/** The last of `count` working days from a day: what the law's 3 days come to on the calendar. */
export function lastOfWorkdays(from: string, count: number, isWorked: IsWorked): string {
  let day = from;
  let left = isWorked(day) ? count - 1 : count;
  while (left > 0 || !isWorked(day)) {
    day = nextDay(day);
    if (isWorked(day)) left -= 1;
  }
  return day;
}

export function workdaysBetween(from: string, to: string, isWorked: IsWorked): number {
  let n = 0;
  for (let day = from; day <= to; day = nextDay(day)) if (isWorked(day)) n += 1;
  return n;
}

const MATERNITY_MONTHS = 6;

/** Where a reason's usual length ends: so many working days, or 6 months for maternity leave (Đ.139). */
export function defaultEnd(from: string, reason: string | undefined, days: number, isWorked: IsWorked): string {
  if (reason !== 'maternity') return lastOfWorkdays(from, days, isWorked);
  const [y = 2000, m = 1, d = 1] = from.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + MATERNITY_MONTHS, d - 1)).toISOString().slice(0, 10);
}
