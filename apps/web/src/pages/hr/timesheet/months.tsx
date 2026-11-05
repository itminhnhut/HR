import type { TimesheetMonthDto, TimesheetMonthStatus } from '@careers/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CalendarX, ChevronLeft, ChevronRight, Clock, Lock, Play, type LucideIcon } from 'lucide-react';
import { api } from '../../../api';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { dayMonth } from './timesheetModel';

export const useTimesheetYear = (year: number) =>
  useQuery({ queryKey: ['hr', 'timesheet', 'year', year], queryFn: () => api.hrTimesheetYear(year), refetchOnWindowFocus: false });

export const MONTH_LOOK: Record<TimesheetMonthStatus, { word: string; icon: LucideIcon; tone: string }> = {
  closed: { word: 'Đã chốt', icon: Lock, tone: 'text-red-600' },
  running: { word: 'Đang chạy', icon: Play, tone: 'text-green-600' },
  waiting: { word: 'Chờ chốt', icon: Clock, tone: 'text-amber-600' },
  empty: { word: 'Chưa có dữ liệu', icon: CalendarX, tone: 'text-slate-400' },
  future: { word: 'Chưa đến kỳ', icon: CalendarClock, tone: 'text-slate-400' },
};

export function YearNav({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" aria-label="Năm trước" onClick={() => onChange(year - 1)} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100 max-md:size-11"><ChevronLeft className="size-4" /></button>
      <span data-testid="year" className="text-sm font-semibold whitespace-nowrap tabular-nums">Năm {year}</span>
      <button type="button" aria-label="Năm sau" onClick={() => onChange(year + 1)} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100 max-md:size-11"><ChevronRight className="size-4" /></button>
    </div>
  );
}

/** Twelve months at a glance: which are closed, which still wait, which nobody has used. */
export function MonthGrid({ months, isOn, isDisabled, onPick }: {
  months: readonly TimesheetMonthDto[];
  isOn: (m: TimesheetMonthDto) => boolean;
  isDisabled?: (m: TimesheetMonthDto) => boolean;
  onPick: (m: TimesheetMonthDto) => void;
}) {
  return (
    <div role="group" aria-label="Chọn tháng" className="grid grid-cols-3 gap-1">
      {months.map((m) => {
        const look = MONTH_LOOK[m.status];
        const on = isOn(m);
        return (
          <Tooltip key={m.month}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`Tháng ${m.month}, ${look.word}`}
                  disabled={isDisabled?.(m)}
                  onClick={() => onPick(m)}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 ${on ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}
                />
              }
            >
              <look.icon className={`size-3.5 ${on ? 'text-white' : look.tone}`} />
              T{m.month}
            </TooltipTrigger>
            <TooltipContent>{look.word} · {dayMonth(m.from)} – {dayMonth(m.to)}{m.closedBy ? ` · ${m.closedBy}` : ''}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
