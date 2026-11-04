import { addDays, DEFAULT_REPORT_DAYS, formatDate, todayInVietnam, type ReportPeriod } from '@careers/shared';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '../shadcn/Calendar';
import { useDismiss } from './useDismiss';
import { Button } from '../../../ui/Button';
import { SelectField } from '../shadcn/Select';
import { Icon } from '../../../ui/icons';

/** How far back the calendar's year list goes. */
const YEARS_BACK = 5;
/** The first year on the list of years. */
const FIRST_YEAR = 2020;

const toDate = (iso: string) => {
  const [y = 2000, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The last `days` days, today included. */
export function lastDaysPeriod(days: number, today = todayInVietnam()): ReportPeriod {
  return { from: addDays(today, 1 - days), to: today };
}

export const defaultReportPeriod = () => lastDaysPeriod(DEFAULT_REPORT_DAYS);

/** "04/11/2026" for one day, "05/10/2026 – 04/11/2026" for more. */
export function periodLabel({ from, to }: ReportPeriod): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}

/** The ready-made choices, as of `today`. */
export function quickPeriods(today: string): { label: string; period: ReportPeriod }[] {
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const endOfLastMonth = addDays(firstOfMonth, -1);
  const year = Number(today.slice(0, 4));
  return [
    { label: 'Hôm nay', period: { from: today, to: today } },
    { label: 'Hôm qua', period: { from: addDays(today, -1), to: addDays(today, -1) } },
    { label: '3 ngày qua', period: lastDaysPeriod(3, today) },
    { label: '7 ngày qua', period: lastDaysPeriod(7, today) },
    { label: '30 ngày qua', period: lastDaysPeriod(30, today) },
    { label: '90 ngày qua', period: lastDaysPeriod(90, today) },
    { label: 'Tháng này', period: { from: firstOfMonth, to: today } },
    { label: 'Tháng trước', period: { from: `${endOfLastMonth.slice(0, 8)}01`, to: endOfLastMonth } },
    { label: 'Năm nay', period: { from: `${year}-01-01`, to: today } },
    { label: 'Năm trước', period: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` } },
  ];
}

const isSame = (a: ReportPeriod, b: ReportPeriod) => a.from === b.from && a.to === b.to;

function QuickList({
  value,
  today,
  onPick,
}: {
  value: ReportPeriod;
  today: string;
  onPick: (period: ReportPeriod) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chọn nhanh"
      className="flex shrink-0 flex-col gap-0.5 border-line p-2 max-md:flex-row max-md:flex-wrap max-md:border-b md:w-40 md:border-r"
    >
      {quickPeriods(today).map(({ label, period }) => {
        const isOn = isSame(period, value);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isOn}
            onClick={() => onPick(period)}
            className={`min-h-9 rounded-control border-0 px-3 text-left text-sm font-medium transition-colors ${isOn ? 'bg-primary text-white' : 'bg-transparent text-navy hover:bg-hover'}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Whole years, no months: "2020" to "2022". The current year runs up to today. */
export function yearsPeriod(fromYear: number, toYear: number, today: string): ReportPeriod {
  const [first, last] = fromYear <= toYear ? [fromYear, toYear] : [toYear, fromYear];
  const lastDay = `${last}-12-31`;
  return { from: `${first}-01-01`, to: lastDay < today ? lastDay : today };
}

function YearSelect({
  label,
  value,
  years,
  onChange,
}: {
  label: string;
  value: number;
  years: readonly number[];
  onChange: (year: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate">
      {label}
      <SelectField
        label={label}
        hideLabel
        className="w-24"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </SelectField>
    </span>
  );
}

/** "Từ năm 2020 đến năm 2022": for a report over the years, where months only get in the way. */
function YearRange({
  value,
  today,
  onPick,
}: {
  value: ReportPeriod;
  today: string;
  onPick: (period: ReportPeriod) => void;
}) {
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const clamp = (year: number) => Math.min(thisYear, Math.max(FIRST_YEAR, year));
  const [fromYear, setFromYear] = useState(clamp(Number(value.from.slice(0, 4))));
  const [toYear, setToYear] = useState(clamp(Number(value.to.slice(0, 4))));
  return (
    <div
      role="group"
      aria-label="Chọn theo năm"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5"
    >
      <YearSelect label="Từ năm" value={fromYear} years={years} onChange={setFromYear} />
      <YearSelect label="Đến năm" value={toYear} years={years} onChange={setToYear} />
      <Button size="sm" variant="outline" onClick={() => onPick(yearsPeriod(fromYear, toYear, today))}>
        Xem theo năm
      </Button>
    </div>
  );
}

/** Any days: two presses choose the start and the end, and nothing changes before "Áp dụng". */
function RangeCalendar({
  value,
  today,
  onApply,
  onCancel,
}: {
  value: ReportPeriod;
  today: string;
  onApply: (period: ReportPeriod) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState<Date | undefined>(toDate(value.from));
  const [to, setTo] = useState<Date | undefined>(toDate(value.to));
  // By hand: the calendar calls a single press a whole one-day range.
  const press = (day: Date) => {
    if (!from || to) {
      setFrom(day);
      setTo(undefined);
      return;
    }
    setFrom(from <= day ? from : day);
    setTo(from <= day ? day : from);
  };
  const selected: DateRange | undefined = from ? { from, to } : undefined;
  // One month on a narrow screen: the one the period ends in, not the one before it.
  const isNarrow = window.innerWidth < 900;
  return (
    <div className="flex min-w-0 flex-col">
      <div className="overflow-x-auto p-3">
        <Calendar
          mode="range"
          captionLayout="dropdown"
          startMonth={toDate(`${Number(today.slice(0, 4)) - YEARS_BACK}-01-01`)}
          endMonth={toDate(today)}
          numberOfMonths={isNarrow ? 1 : 2}
          defaultMonth={toDate(`${(isNarrow ? value.to : addDays(value.to, -31)).slice(0, 8)}01`)}
          selected={selected}
          onSelect={(_, day) => press(day)}
          disabled={{ after: toDate(today) }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-3 py-2.5">
        <span className="mr-auto text-[13px] text-slate">
          {from && to ? periodLabel({ from: toIso(from), to: toIso(to) }) : 'Chọn ngày kết thúc'}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
        <Button
          size="sm"
          disabled={!from || !to}
          onClick={() => from && to && onApply({ from: toIso(from), to: toIso(to) })}
        >
          Áp dụng
        </Button>
      </div>
    </div>
  );
}

/** A button with the days in use; it opens the ready-made choices beside a two-month calendar. */
export function PeriodPicker({ value, onChange }: { value: ReportPeriod; onChange: (period: ReportPeriod) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const box = useDismiss(isOpen, close);
  const today = todayInVietnam();
  const choose = (period: ReportPeriod) => {
    onChange(period);
    close();
  };
  return (
    <div ref={box} className="relative max-sm:w-full">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Chọn khoảng thời gian: ${periodLabel(value)}`}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-silver bg-white px-3.5 text-sm font-medium text-navy transition-colors hover:bg-hover max-sm:w-full"
      >
        <Icon name="calendar" size={16} className="shrink-0 text-blue-700" />
        <span className="tabular-nums">{periodLabel(value)}</span>
        <Icon name="chevronDown" size={15} className="ml-auto shrink-0 text-slate" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Chọn khoảng thời gian"
          className="absolute right-0 top-full z-30 mt-1.5 flex w-max max-w-[calc(100vw-32px)] animate-fade flex-col rounded-card border border-line bg-white shadow-[0_10px_30px_rgba(11,31,58,0.14)] max-sm:left-0 max-sm:right-auto md:flex-row"
        >
          <QuickList value={value} today={today} onPick={choose} />
          <div className="flex min-w-0 flex-col">
            <YearRange value={value} today={today} onPick={choose} />
            <RangeCalendar value={value} today={today} onApply={choose} onCancel={close} />
          </div>
        </div>
      )}
    </div>
  );
}
