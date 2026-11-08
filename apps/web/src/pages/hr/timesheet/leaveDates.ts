import { isWeekend, nextDay } from '@careers/shared';

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

/** A line of the leave list: typed lines (source "sheet") tell which days HR marked by hand. */
export interface ListedLine {
  source?: 'absence' | 'sheet';
  employeeId: string;
  code: string;
  from: string;
  to: string;
}

export interface TypedDay {
  day: string;
  code: string;
}

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);

/**
 * Days HR typed by hand inside the dates, read off the person's typed lines (but the one the form takes over). A line holds
 * every weekday between its ends; a weekend day inside it may be empty, so only its ends count there.
 */
export function typedDaysWithin(lines: readonly ListedLine[], personId: string, from: string, to: string, except?: Omit<ListedLine, 'employeeId'>): TypedDay[] {
  const isExcept = (l: ListedLine) => !!except && l.code === except.code && l.from === except.from && l.to === except.to;
  const own = lines.filter((l) => l.source === 'sheet' && l.employeeId === personId && !isExcept(l));
  const days: TypedDay[] = [];
  for (const line of own) {
    for (let day = later(line.from, from); day <= earlier(line.to, to); day = nextDay(day)) {
      if (!isWeekend(day) || day === line.from || day === line.to) days.push({ day, code: line.code });
    }
  }
  return days.sort((a, b) => a.day.localeCompare(b.day));
}

const dayWords = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * What the API will do with typed days in the way, said before saving: one with the same code is refused (the absence would
 * read it as its own), another code is filled around and not counted. `length` is the form's number of days.
 */
export function typedNotice(typed: readonly TypedDay[], code: string, length: number, isWorked: IsWorked): string | null {
  const clash = typed.filter((t) => t.code === code);
  if (clash.length > 0) return `${clash.map((t) => dayWords(t.day)).join(', ')} đã chấm ${code} trên bảng công: lưu sẽ bị từ chối. Bấm "Sửa" trên dòng đó để gộp vào, hoặc chọn ngày khác.`;
  const skipped = typed.filter((t) => isWorked(t.day));
  if (skipped.length === 0) return null;
  const codes = [...new Set(skipped.map((t) => t.code))].join(', ');
  const left = length - skipped.length;
  const outcome = left > 0 ? `Lưu sẽ tính ${left} ngày.` : 'Không còn ngày nào trống để lưu.';
  return `${skipped.map((t) => dayWords(t.day)).join(', ')} đã chấm trên bảng công (${codes}): giữ nguyên, không tính. ${outcome}`;
}
