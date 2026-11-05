import { matchesQuery } from '@careers/shared';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../vendor/shadcn-grid/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';

/** Pick a department already in use, or type a new one. */
export function DepartmentField({ value, known, error, onChange }: { value: string; known: readonly string[]; error?: string; onChange: (next: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const text = typed.trim();
  const matches = known.filter((d) => matchesQuery(d, typed));
  const isNew = !!text && !known.some((d) => d.toLowerCase() === text.toLowerCase());
  const pick = (next: string) => {
    onChange(next);
    setIsOpen(false);
  };
  return (
    <div data-invalid={error ? '' : undefined} className="flex flex-col gap-1.5 text-sm font-medium">
      <span>Bộ phận</span>
      <Popover open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (o) setTyped(''); }}>
        <PopoverTrigger render={<button type="button" aria-label="Bộ phận" className="ts-field flex w-full items-center gap-2 rounded-md border bg-white px-2.5 text-left text-sm font-normal hover:bg-slate-50" />}>
          <Building2 className="size-4 shrink-0 text-slate-500" />
          <span className={`min-w-0 flex-1 truncate ${value ? '' : 'text-slate-500'}`}>{value || 'Chọn hoặc gõ mới'}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command shouldFilter={false} label="Chọn bộ phận">
            <CommandInput value={typed} onValueChange={setTyped} placeholder="Tìm hoặc gõ mới" />
            <CommandList>
              {!isNew && <CommandEmpty>Chưa có bộ phận nào.</CommandEmpty>}
              <CommandGroup>
                {matches.map((d) => (
                  <CommandItem key={d} value={d} onSelect={() => pick(d)} className="[&>svg:last-child]:hidden">
                    <Check className={`size-4 ${d === value ? 'text-blue-600' : 'opacity-0'}`} />
                    <span className="truncate">{d}</span>
                  </CommandItem>
                ))}
                {isNew && (
                  <CommandItem value={`new:${text}`} onSelect={() => pick(text)} className="[&>svg:last-child]:hidden">
                    <Plus className="size-4 text-blue-600" />
                    <span className="truncate">Thêm “{text}”</span>
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </div>
  );
}
