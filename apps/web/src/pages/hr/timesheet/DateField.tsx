import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { vi as VI_LOCALE } from 'react-day-picker/locale';
import { Calendar } from '../../../vendor/shadcn-grid/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';

const toDate = (iso: string) => {
  const [y = 2026, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** One date on the same calendar as the period picker. Lists of months and years: a start date can be years back. */
export function DateField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (iso: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const year = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger render={<button type="button" aria-label={label} className="flex h-8 w-full items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-normal hover:bg-slate-50" />}>
            <CalendarDays className="size-4 shrink-0 text-blue-600" />
            {value ? <span className="tabular-nums">{value.split('-').reverse().join('/')}</span> : <span className="text-slate-400">Chọn ngày</span>}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto gap-0 p-0">
            <Calendar
              mode="single"
              locale={VI_LOCALE}
              showOutsideDays={false}
              captionLayout="dropdown"
              startMonth={new Date(year - 15, 0)}
              endMonth={new Date(year + 2, 11)}
              formatters={{ formatMonthDropdown: (d) => `Tháng ${d.getMonth() + 1}` }}
              defaultMonth={value ? toDate(value) : new Date()}
              selected={value ? toDate(value) : undefined}
              onSelect={(date) => {
                if (date) onChange(toIso(date));
                setIsOpen(false);
              }}
              className="[--cell-size:2.5rem]"
            />
          </PopoverContent>
        </Popover>
        {value && (
          <button type="button" aria-label={`Xoá ${label}`} onClick={() => onChange('')} className="absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </div>
  );
}
