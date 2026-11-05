import { daysBetweenInclusive, periodMonthOf, standardPeriod, TIMESHEET_MAX_DAYS, type TimesheetPeriodRange } from '@careers/shared';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import { vi as VI_LOCALE } from 'react-day-picker/locale';
import { Calendar } from '../../../vendor/shadcn-grid/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { toDate, weekdayName } from './calendarFormat';
import { MonthGrid, useTimesheetYear, YearNav } from './months';
import { dayMonth } from './timesheetModel';

/** The range being picked: first day, then last day by a second click or by dragging. */
function usePeriodDraft(value: TimesheetPeriodRange) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState<string | null>(value.to);
  const [hover, setHover] = useState<string | null>(null);
  const [shownMonth, setShownMonth] = useState(() => toDate(value.from));
  const isDragging = useRef(false);
  const end = to ?? hover ?? from;
  const [start, stop] = from <= end ? [from, end] : [end, from];
  const dayOf = (e: MouseEvent) => (e.target as HTMLElement).closest('td[data-day]')?.getAttribute('data-day') ?? null;
  const finish = (iso: string) => {
    const [a, b] = from <= iso ? [from, iso] : [iso, from];
    setFrom(a);
    setTo(b);
    setHover(null);
  };
  const setRange = (range: TimesheetPeriodRange) => {
    setFrom(range.from);
    setTo(range.to);
    setHover(null);
    setShownMonth(toDate(range.from));
  };
  const mouse = {
    onMouseDown: (e: MouseEvent) => {
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
    },
    onMouseOver: (e: MouseEvent) => {
      if (to !== null) return;
      const iso = dayOf(e);
      if (iso) setHover(iso);
    },
    onMouseUp: (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const iso = dayOf(e);
      if (iso && iso !== from) finish(iso);
    },
  };
  return { to, start, stop, shownMonth, setShownMonth, setRange, mouse };
}

/** The twelve months of a year: one press picks a whole period, and shows which are closed or still waiting. */
function MonthPanel({ today, start, stop, onPick }: { today: string; start: string; stop: string; onPick: (range: TimesheetPeriodRange) => void }) {
  const [year, setYear] = useState(() => periodMonthOf(stop).year);
  const months = useTimesheetYear(year);
  const current = periodMonthOf(today);
  return (
    <div className="flex w-56 flex-col gap-2 border-r p-2 max-sm:w-full max-sm:border-r-0 max-sm:border-b">
      <YearNav year={year} onChange={setYear} />
      <MonthGrid months={months.data ?? []} isOn={(m) => m.from === start && m.to === stop} onPick={(m) => onPick({ from: m.from, to: m.to })} />
      <button type="button" onClick={() => { setYear(current.year); onPick(standardPeriod(current.year, current.month)); }} className="h-8 rounded-md border bg-white text-sm font-medium hover:bg-slate-50 max-md:h-11">Về kỳ này</button>
    </div>
  );
}

function PickerFooter({ text, isTooLong, canApply, onCancel, onApply }: { text: string; isTooLong: boolean; canApply: boolean; onCancel: () => void; onApply: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
      <span data-testid="period-draft" className={`mr-auto text-sm ${isTooLong ? 'font-medium text-red-600' : 'text-slate-600'}`}>{text}</span>
      <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-sm font-medium hover:bg-slate-100">Huỷ</button>
      <button type="button" disabled={!canApply} onClick={onApply} className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50">Áp dụng</button>
    </div>
  );
}

/** Từ ngày → đến ngày: bấm hai lần, hoặc giữ chuột quét. Kỳ 26→25 dùng để chấm và chốt, khoảng khác chỉ để xem. */
export function PeriodPicker({ value, today, onApply }: { value: TimesheetPeriodRange; today: string; onApply: (p: TimesheetPeriodRange) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const draft = usePeriodDraft(value);
  const { to, start, stop } = draft;
  const days = daysBetweenInclusive(start, stop);
  const isTooLong = days > TIMESHEET_MAX_DAYS;
  const open = (next: boolean) => {
    setIsOpen(next);
    if (next) draft.setRange(value);
  };
  return (
    <Popover open={isOpen} onOpenChange={open}>
      <PopoverTrigger render={<button type="button" aria-label="Chọn kỳ công" className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-semibold whitespace-nowrap hover:bg-slate-50" />}>
        <CalendarDays className="size-4 text-blue-600" />
        {dayMonth(value.from)} – {dayMonth(value.to)}
        <ChevronDown className="size-4 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-16px)] gap-0 p-0">
        <div className="flex max-sm:flex-col">
          <MonthPanel today={today} start={start} stop={stop} onPick={draft.setRange} />
          <div role="presentation" className="select-none" {...draft.mouse}>
            <Calendar
              mode="range"
              locale={VI_LOCALE}
              showOutsideDays={false}
              className="[--cell-size:2.5rem]"
              formatters={{ formatCaption: (d) => `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`, formatWeekdayName: weekdayName }}
              numberOfMonths={window.innerWidth < 760 ? 1 : 2}
              month={draft.shownMonth}
              onMonthChange={draft.setShownMonth}
              selected={{ from: toDate(start), to: toDate(stop) }}
              onSelect={() => undefined}
            />
          </div>
        </div>
        <PickerFooter text={to === null ? 'Chọn ngày kết thúc' : `${dayMonth(start)} – ${dayMonth(stop)} · ${days} ngày${isTooLong ? ` · Tối đa ${TIMESHEET_MAX_DAYS} ngày` : ''}`} isTooLong={isTooLong} canApply={to !== null && !isTooLong} onCancel={() => setIsOpen(false)} onApply={() => { onApply({ from: start, to: stop }); setIsOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
