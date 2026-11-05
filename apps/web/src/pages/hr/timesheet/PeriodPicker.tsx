import { daysBetweenInclusive, periodMonthOf, standardPeriod, TIMESHEET_MAX_DAYS, type TimesheetPeriodRange } from '@careers/shared';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import { vi as VI_LOCALE } from 'react-day-picker/locale';
import { Calendar } from '../../../vendor/shadcn-grid/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { dayMonth } from './timesheetModel';

const toDate = (iso: string) => {
  const [y = 2026, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Từ ngày → đến ngày: bấm hai lần, hoặc giữ chuột quét. Kỳ 26→25 dùng để chấm và chốt, khoảng khác chỉ để xem. */
export function PeriodPicker({ value, today, onApply }: { value: TimesheetPeriodRange; today: string; onApply: (p: TimesheetPeriodRange) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState<string | null>(value.to);
  const [hover, setHover] = useState<string | null>(null);
  const [shownMonth, setShownMonth] = useState(() => toDate(value.from));
  const { year, month } = periodMonthOf(today);
  const isDragging = useRef(false);
  const end = to ?? hover ?? from;
  const [start, stop] = from <= end ? [from, end] : [end, from];
  const days = daysBetweenInclusive(start, stop);
  const isTooLong = days > TIMESHEET_MAX_DAYS;
  const open = (next: boolean) => {
    setIsOpen(next);
    if (next) {
      setFrom(value.from);
      setTo(value.to);
      setHover(null);
      setShownMonth(toDate(value.from));
    }
  };
  const dayOf = (e: MouseEvent) => (e.target as HTMLElement).closest('td[data-day]')?.getAttribute('data-day') ?? null;
  const finish = (iso: string) => {
    const [a, b] = from <= iso ? [from, iso] : [iso, from];
    setFrom(a);
    setTo(b);
    setHover(null);
  };
  const presets = [
    ['Kỳ này', standardPeriod(year, month)],
    ['Kỳ trước', standardPeriod(year, month - 1)],
    ['Kỳ sau', standardPeriod(year, month + 1)],
  ] as const;
  return (
    <Popover open={isOpen} onOpenChange={open}>
      <PopoverTrigger render={<button type="button" aria-label="Chọn kỳ công" className="inline-flex h-8 items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-semibold hover:bg-slate-50" />}>
        <CalendarDays className="size-4 text-blue-600" />
        {dayMonth(value.from)} – {dayMonth(value.to)}
        <ChevronDown className="size-4 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-16px)] gap-0 p-0">
        <div className="flex max-sm:flex-col">
          <div className="flex flex-col gap-0.5 border-r p-2 max-sm:flex-row max-sm:border-r-0 max-sm:border-b">
            {presets.map(([label, preset]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFrom(preset.from);
                  setTo(preset.to);
                  setHover(null);
                  setShownMonth(toDate(preset.from));
                }}
                className={`h-9 rounded-md px-3 text-left text-sm font-medium whitespace-nowrap ${preset.from === start && preset.to === stop ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="presentation"
            className="select-none"
            onMouseDown={(e) => {
              const iso = dayOf(e);
              if (!iso) return;
              e.preventDefault();
              if (to === null) {
                finish(iso);
                return;
              }
              setFrom(iso);
              setTo(null);
              setHover(iso);
              isDragging.current = true;
            }}
            onMouseOver={(e) => {
              if (to !== null) return;
              const iso = dayOf(e);
              if (iso) setHover(iso);
            }}
            onMouseUp={(e) => {
              if (!isDragging.current) return;
              isDragging.current = false;
              const iso = dayOf(e);
              if (iso && iso !== from) finish(iso);
            }}
          >
            <Calendar
              mode="range"
              locale={VI_LOCALE}
              showOutsideDays={false}
              className="[--cell-size:2.5rem]"
              formatters={{ formatCaption: (d) => `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}` }}
              numberOfMonths={window.innerWidth < 760 ? 1 : 2}
              month={shownMonth}
              onMonthChange={setShownMonth}
              selected={{ from: toDate(start), to: toDate(stop) }}
              onSelect={() => undefined}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <span data-testid="period-draft" className={`mr-auto text-sm ${isTooLong ? 'font-medium text-red-600' : 'text-slate-600'}`}>
            {to === null ? 'Chọn ngày kết thúc' : `${dayMonth(start)} – ${dayMonth(stop)} · ${days} ngày${isTooLong ? ` · Tối đa ${TIMESHEET_MAX_DAYS} ngày` : ''}`}
          </span>
          <button type="button" onClick={() => setIsOpen(false)} className="h-8 rounded-md px-3 text-sm font-medium hover:bg-slate-100">Huỷ</button>
          <button
            type="button"
            disabled={to === null || isTooLong}
            onClick={() => {
              onApply({ from: start, to: stop });
              setIsOpen(false);
            }}
            className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Áp dụng
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
