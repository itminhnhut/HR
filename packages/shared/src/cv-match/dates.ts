/**
 * Date ranges in CV text (folded form). Months are counted as an absolute index: year * 12 + (month - 1).
 * An interval is [start, end) in months, so "03/2021 - 05/2021" lasts 3 months.
 */
import type { Span } from './text-match.js';

export interface DateToken extends Span {
  year: number;
  /** null for a bare year ("2019"). */
  month: number | null;
}

export interface MonthInterval extends Span {
  startMonth: number;
  endMonth: number;
  /** Ends with "nay" / "hiện tại" / "present". */
  ongoing: boolean;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const YEAR = '((?:19|20)\\d{2})';
const DATE_RE = new RegExp(
  [
    `(?<!\\d)(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-]${YEAR}`, // 15/03/2021
    `(?<![a-z])(?:thang|th|t)\\.?\\s*(\\d{1,2})\\s*(?:[/.\\-,]|\\s+nam)?\\s*${YEAR}`, // T6/2020, tháng 3 năm 2020
    `(?<!\\d)(\\d{1,2})(?:\\s*[/.]\\s*|-)${YEAR}`, // 03/2021, 06.2018, 6-2020
    `(?<![a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*,?\\s*${YEAR}`, // Jan 2020
    `(?<![\\d/.])${YEAR}`, // 2019
  ]
    .map((p) => `(?:${p})`)
    .join('|') + '(?!\\d)',
  'g',
);

const PRESENT_RE =
  /^(?:den\s+)?(?:nay|hien tai|hien nay|bay gio|present|now|current|currently|today|to date|ongoing)\b/;
const SEPARATOR_RE = /^\s*(?:-{1,2}|~|->|=>|>|→|den|toi|to|until|till)\s*(?:thang\s+)?$/;

function validMonth(m: number): number | null {
  return m >= 1 && m <= 12 ? m : null;
}

function tokenFromMatch(m: RegExpExecArray): DateToken | null {
  const span = { start: m.index, end: m.index + m[0].length };
  if (m[3]) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const month = validMonth(b) ?? (b > 12 && a <= 12 ? a : null);
    return month === null ? null : { ...span, year: Number(m[3]), month };
  }
  const pairs: [string | undefined, string | undefined][] = [
    [m[4], m[5]],
    [m[6], m[7]],
  ];
  for (const [mm, yy] of pairs) {
    if (mm && yy) {
      const month = validMonth(Number(mm));
      return month === null ? null : { ...span, year: Number(yy), month };
    }
  }
  if (m[8] && m[9]) return { ...span, year: Number(m[9]), month: MONTH_NAMES[m[8]] ?? null };
  return m[10] ? { ...span, year: Number(m[10]), month: null } : null;
}

/** All dates in a folded line, left to right. */
export function findDates(folded: string): DateToken[] {
  const out: DateToken[] = [];
  DATE_RE.lastIndex = 0;
  for (let m = DATE_RE.exec(folded); m; m = DATE_RE.exec(folded)) {
    const token = tokenFromMatch(m);
    if (token) out.push(token);
  }
  return out;
}

export function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/** "2026-10-25" → month index of October 2026; null when malformed. */
export function parseToday(today: string): number | null {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  if (!m) return null;
  const month = validMonth(Number(m[2]));
  return month === null ? null : monthIndex(Number(m[1]), month);
}

function startOf(t: DateToken): number {
  return monthIndex(t.year, t.month ?? 1);
}

function endOf(t: DateToken, start: number): number {
  if (t.month !== null) return monthIndex(t.year, t.month) + 1;
  const end = monthIndex(t.year, 1);
  // "2020 - 2020": same bare year, assume half a year rather than nothing.
  return t.year === Math.floor(start / 12) ? start + 6 : end;
}

function closeRange(a: DateToken, end: number, ongoing: boolean, spanEnd: number, todayMonth: number | null) {
  const startMonth = startOf(a);
  const cap = todayMonth === null ? Number.POSITIVE_INFINITY : todayMonth + 1;
  const endMonth = Math.min(end, cap);
  if (endMonth <= startMonth || endMonth - startMonth > 45 * 12) return null;
  return { start: a.start, end: spanEnd, startMonth, endMonth, ongoing };
}

/** Date ranges ("03/2021 – nay", "2019 - 2022", "Tháng 3/2020 đến tháng 5/2022") in a folded line. */
export function findRanges(folded: string, todayMonth: number | null): MonthInterval[] {
  const dates = findDates(folded);
  const out: MonthInterval[] = [];
  for (let i = 0; i < dates.length; i += 1) {
    const a = dates[i];
    const next = dates[i + 1];
    if (next && SEPARATOR_RE.test(folded.slice(a.end, next.start))) {
      const r = closeRange(a, endOf(next, startOf(a)), false, next.end, todayMonth);
      if (r) out.push(r);
      i += 1;
      continue;
    }
    const rest = folded.slice(a.end);
    const sep = /^\s*(?:-{1,2}|~|->|=>|>|→|den|toi|to|until|till)?\s*/.exec(rest);
    const after = rest.slice(sep ? sep[0].length : 0);
    const present = PRESENT_RE.exec(after);
    if (present && sep && sep[0].trim().length > 0 && todayMonth !== null) {
      const r = closeRange(a, todayMonth + 1, true, a.end + (sep[0].length + present[0].length), todayMonth);
      if (r) out.push(r);
    }
  }
  return out;
}

/** Merges overlapping/adjacent intervals and returns the total number of months covered. */
export function totalMonths(intervals: readonly { startMonth: number; endMonth: number }[]): number {
  const sorted = [...intervals].sort((a, b) => a.startMonth - b.startMonth);
  let total = 0;
  let curStart = Number.NEGATIVE_INFINITY;
  let curEnd = Number.NEGATIVE_INFINITY;
  for (const iv of sorted) {
    if (iv.startMonth > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = iv.startMonth;
      curEnd = iv.endMonth;
    } else {
      curEnd = Math.max(curEnd, iv.endMonth);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/** "2 năm 3 tháng", "8 tháng", "3 năm". */
export function formatMonths(months: number): string {
  const m = Math.round(months);
  const years = Math.floor(m / 12);
  const rest = m % 12;
  if (years === 0) return `${rest} tháng`;
  return rest === 0 ? `${years} năm` : `${years} năm ${rest} tháng`;
}
