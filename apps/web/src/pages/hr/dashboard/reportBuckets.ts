import { formatDate } from '@careers/shared';

export type BucketUnit = 'ngày' | 'tuần' | 'tháng' | 'năm';

export interface ReportBucket {
  label: string;
  /** Places in the list of days, `to` included. */
  from: number;
  to: number;
}

/** Past these lengths a bar a day is too thin to read or to point at. */
const MAX_DAILY = 62;
const MAX_WEEKLY = 186;
const MAX_MONTHLY = 366;
const WEEK = 7;

const shortDay = (iso: string) => formatDate(iso).slice(0, 5);

export function unitOf(dayCount: number): BucketUnit {
  if (dayCount <= MAX_DAILY) return 'ngày';
  if (dayCount <= MAX_WEEKLY) return 'tuần';
  return dayCount <= MAX_MONTHLY ? 'tháng' : 'năm';
}

/** One group for each run of days with the same label. */
function byLabel(days: readonly string[], labelOf: (day: string) => string): ReportBucket[] {
  const buckets: ReportBucket[] = [];
  days.forEach((day, i) => {
    const label = labelOf(day);
    const last = buckets[buckets.length - 1];
    if (last?.label === label) last.to = i;
    else buckets.push({ label, from: i, to: i });
  });
  return buckets;
}

function byWeek(days: readonly string[]): ReportBucket[] {
  return Array.from({ length: Math.ceil(days.length / WEEK) }, (_, week) => {
    const from = week * WEEK;
    const to = Math.min(from + WEEK, days.length) - 1;
    return { label: `${shortDay(days[from] ?? '')}–${shortDay(days[to] ?? '')}`, from, to };
  });
}

/** The groups a chart of these days shows: by day for a short period, then by week, by month, and by year across years. */
export function bucketsOf(days: readonly string[]): ReportBucket[] {
  const unit = unitOf(days.length);
  if (unit === 'năm') return byLabel(days, (day) => day.slice(0, 4));
  if (unit === 'tháng') return byLabel(days, (day) => `T${Number(day.slice(5, 7))}/${day.slice(0, 4)}`);
  if (unit === 'tuần') return byWeek(days);
  return days.map((day, i) => ({ label: shortDay(day), from: i, to: i }));
}

/** The counts per day added up per group. */
export function sumBuckets(counts: readonly number[], buckets: readonly ReportBucket[]): number[] {
  return buckets.map(({ from, to }) => counts.slice(from, to + 1).reduce((sum, n) => sum + n, 0));
}
