import { Check, ChevronDown, Keyboard, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../vendor/shadcn-grid/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { CODES, OFF_CODE } from '../../../vendor/shadcn-grid/lib/codes';
import type { DayColumn, GridRow } from './timesheetModel';

/** What each code means, how many so far in this period, and its key. */
export function CodeLegend({ rows, days }: { rows: readonly GridRow[]; days: readonly DayColumn[] }) {
  return (
    <section aria-label="Ký hiệu" className="flex flex-wrap items-center gap-1.5 rounded-md border bg-white px-3 py-2">
      {CODES.map((code) => {
        const Mark = code.icon;
        const used = rows.reduce((n, r) => n + days.filter((d) => r[d.key] === code.value).length, 0);
        return (
          <Tooltip key={code.value}>
            <TooltipTrigger render={<span tabIndex={0} className={`inline-flex h-7 cursor-default items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap ${code.tone}`} />}>
              <Mark className="size-3.5" />
              <span className="font-semibold">{code.value}</span>
              <span>{code.name}</span>
              {used > 0 && <span className="rounded-full bg-white/70 px-1.5 text-[11px] font-semibold text-slate-800 tabular-nums">{used}</span>}
            </TooltipTrigger>
            <TooltipContent>{code.hint}{code.key ? ` · Phím ${code.key}` : ' · Chọn trong danh sách'}</TooltipContent>
          </Tooltip>
        );
      })}
      <Tooltip>
        <TooltipTrigger render={<span tabIndex={0} className="inline-flex h-7 cursor-default items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-600" />}>
          <OFF_CODE.icon className="size-3.5" />
          {OFF_CODE.name}
        </TooltipTrigger>
        <TooltipContent>{OFF_CODE.hint}</TooltipContent>
      </Tooltip>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium whitespace-nowrap text-blue-800">
        <span aria-hidden="true" className="size-2 rounded-full bg-blue-600" />
        Ghi chú
      </span>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 text-xs font-medium whitespace-nowrap text-red-700">
        <span aria-hidden="true" className="size-2.5 bg-red-600 [clip-path:polygon(0_0,100%_0,100%_100%)]" />
        Điều chỉnh
      </span>
    </section>
  );
}

/** shadcn's faceted filter: nothing picked means everyone. */
export function MultiFilter({ label, icon: Icon, items, picked, onChange, mark, isSearchable = false }: {
  label: string;
  icon: LucideIcon;
  items: readonly { value: string; label: string }[];
  picked: readonly string[];
  onChange: (next: string[]) => void;
  mark?: (value: string) => ReactNode;
  isSearchable?: boolean;
}) {
  const toggle = (value: string) => onChange(picked.includes(value) ? picked.filter((x) => x !== value) : [...picked, value]);
  const only = picked.length === 1 ? items.find((i) => i.value === picked[0])?.label : null;
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" aria-label={`Lọc ${label}`} className={`inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50 ${picked.length ? 'border-blue-400' : 'border-dashed'}`} />}>
        <Icon className="size-4 text-slate-500" />
        {label}
        {picked.length > 0 && <span aria-hidden="true" className="h-4 w-px bg-slate-200" />}
        {only && <span className="max-w-32 truncate rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">{only}</span>}
        {picked.length > 1 && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800">{picked.length} đã chọn</span>}
        <ChevronDown className="size-4 text-slate-400" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          {isSearchable && <CommandInput placeholder={`Tìm ${label.toLowerCase()}`} />}
          <CommandList>
            <CommandEmpty>Không có kết quả.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const isOn = picked.includes(item.value);
                return (
                  <CommandItem key={item.value} value={item.label} onSelect={() => toggle(item.value)} className="[&>svg:last-child]:hidden">
                    <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded border ${isOn ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {isOn && <Check className="size-3" />}
                    </span>
                    {mark ? mark(item.value) : <span className="truncate">{item.label}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {picked.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="h-9 w-full border-t text-center text-sm font-medium text-slate-600 hover:bg-slate-50">Bỏ chọn</button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const SHORTCUTS: [string, string][] = [
  ['1 P H M K L X', 'Chấm ô đang chọn'],
  ['Shift + mũi tên', 'Chọn nhiều ô'],
  ['Enter', 'Mở danh sách và ghi chú'],
  ['Delete', 'Xoá, T2–T6 về lại 1'],
  ['Ctrl + Z', 'Hoàn tác'],
  ['Ctrl + V', 'Dán từ Excel'],
];

export function ShortcutHelp() {
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" aria-label="Phím tắt" className="hidden h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50 md:inline-flex" />}>
        <Keyboard className="size-4 text-slate-500" />
        Phím tắt
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto">
        <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, what]) => (
            <Fragment key={keys}>
              <dt><kbd className="rounded border bg-slate-50 px-1.5 py-0.5 font-sans text-xs font-semibold whitespace-nowrap">{keys}</kbd></dt>
              <dd className="m-0 whitespace-nowrap text-slate-700">{what}</dd>
            </Fragment>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
