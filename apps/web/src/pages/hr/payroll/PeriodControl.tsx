import { standardPeriod } from '@careers/shared';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { YearNav } from '../timesheet/months';

/** The payroll month: a step back, a step forward, or a pick among twelve (the period of month T is 26/(T−1)–25/T). */

const STEP = 'ts-field inline-flex items-center rounded-md border bg-white px-1.5 hover:bg-slate-50';

const shifted = (year: number, month: number, by: number) => {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function MonthPicker({ year, month, onPick }: { year: number; month: number; onPick: (year: number, month: number) => void }) {
  const [shownYear, setShownYear] = useState(year);
  return (
    <div className="flex flex-col gap-2">
      <YearNav year={shownYear} onChange={setShownYear} />
      <div role="group" aria-label="Chọn tháng" className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const isOn = shownYear === year && m === month;
          return (
            <button key={m} type="button" aria-pressed={isOn} onClick={() => onPick(shownYear, m)} className={`h-10 rounded-md border text-sm font-medium max-md:h-11 ${isOn ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}>
              T{m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodControl({ year, month, onPeriod }: { year: number; month: number; onPeriod: (year: number, month: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const { from, to } = standardPeriod(year, month);
  const go = (by: number) => {
    const next = shifted(year, month, by);
    onPeriod(next.year, next.month);
  };
  return (
    <span className="flex items-center gap-1">
      <button type="button" aria-label="Tháng trước" onClick={() => go(-1)} className={STEP}><ChevronLeft className="size-4" /></button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger ref={trigger} render={<button type="button" aria-label={`Kỳ lương T${month}/${year}, ${dayMonth(from)} – ${dayMonth(to)}`} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-3 text-sm font-semibold whitespace-nowrap hover:bg-slate-50" />}>
          <CalendarDays className="size-4 text-blue-600" />
          T{month}/{year}
          <span className="text-xs font-normal text-slate-500 max-sm:hidden">{dayMonth(from)} – {dayMonth(to)}</span>
          <ChevronDown className="size-4 text-slate-400" />
        </PopoverTrigger>
        <PopoverContent align="start" finalFocus={trigger} className="w-64 p-3">
          <MonthPicker year={year} month={month} onPick={(y, m) => { setIsOpen(false); onPeriod(y, m); }} />
        </PopoverContent>
      </Popover>
      <button type="button" aria-label="Tháng sau" onClick={() => go(1)} className={STEP}><ChevronRight className="size-4" /></button>
    </span>
  );
}
