import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { vi as VI_LOCALE } from 'react-day-picker/locale';
import { Calendar } from '../../../vendor/shadcn-grid/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { toDate, toIso, weekdayName } from './calendarFormat';

const YEARS_BACK = 15;
const YEARS_AHEAD = 2;

function PickList({ label, value, items, onChange }: { label: string; value: number; items: { value: string; label: string }[]; onChange: (next: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} items={items}>
      <SelectTrigger aria-label={label} className="bg-white font-medium"><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** Month and year lists: a start date can be years back. */
function MonthBar({ month, onMonth }: { month: Date; onMonth: (next: Date) => void }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => thisYear - YEARS_BACK + i);
  const monthItems = Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `Tháng ${i + 1}` }));
  const yearItems = years.map((y) => ({ value: String(y), label: String(y) }));
  const step = (by: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  return (
    <div className="flex items-center justify-between gap-1 px-2 pt-2">
      <button type="button" aria-label="Tháng trước" onClick={() => step(-1)} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-slate-100"><ChevronLeft className="size-4" /></button>
      <PickList label="Tháng" value={month.getMonth()} items={monthItems} onChange={(m) => onMonth(new Date(month.getFullYear(), m, 1))} />
      <PickList label="Năm" value={month.getFullYear()} items={yearItems} onChange={(y) => onMonth(new Date(y, month.getMonth(), 1))} />
      <button type="button" aria-label="Tháng sau" onClick={() => step(1)} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-slate-100"><ChevronRight className="size-4" /></button>
    </div>
  );
}

/** One date on the same calendar as the period picker. */
export function DateField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (iso: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(() => (value ? toDate(value) : new Date()));
  const open = (next: boolean) => {
    setIsOpen(next);
    if (next) setMonth(value ? toDate(value) : new Date());
  };
  return (
    <div data-invalid={error ? '' : undefined} className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <div className="relative">
        <Popover open={isOpen} onOpenChange={open}>
          <PopoverTrigger render={<button type="button" aria-label={label} className="ts-field flex w-full items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-normal hover:bg-slate-50" />}>
            <CalendarDays className="size-4 shrink-0 text-blue-600" />
            {value ? <span className="tabular-nums">{value.split('-').reverse().join('/')}</span> : <span className="text-slate-500">Chọn ngày</span>}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto gap-0 p-0">
            <MonthBar month={month} onMonth={setMonth} />
            <Calendar
              mode="single"
              locale={VI_LOCALE}
              showOutsideDays={false}
              hideNavigation
              month={month}
              onMonthChange={setMonth}
              classNames={{ month_caption: 'hidden' }}
              formatters={{ formatWeekdayName: weekdayName }}
              selected={value ? toDate(value) : undefined}
              onSelect={(date) => {
                if (date) onChange(toIso(date));
                setIsOpen(false);
              }}
              className="[--cell-size:2.5rem] max-sm:[--cell-size:2.75rem]"
            />
          </PopoverContent>
        </Popover>
        {value && (
          <button type="button" aria-label={`Xoá ${label}`} onClick={() => onChange('')} className="absolute top-1/2 right-1 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </div>
  );
}
