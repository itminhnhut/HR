import { matchesQuery, type EmployeeDto } from '@careers/shared';
import { Check, ChevronDown, User } from 'lucide-react';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../vendor/shadcn-grid/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';

/** Find a person by name or code. */
export function PersonField({ people, value, isLocked, error, onChange }: { people: readonly EmployeeDto[]; value: string; isLocked: boolean; error?: string; onChange: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const picked = people.find((p) => p.id === value);
  const matches = people.filter((p) => matchesQuery(`${p.fullName} ${p.code}`, typed));
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <span>Nhân viên</span>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger render={<button type="button" aria-label="Nhân viên" disabled={isLocked} className="ts-field flex w-full items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-normal hover:bg-slate-50 disabled:bg-slate-50" />}>
          <User className="size-4 shrink-0 text-blue-600" />
          <span className={`min-w-0 flex-1 truncate text-left ${picked ? '' : 'text-slate-500'}`}>{picked ? `${picked.fullName} · ${picked.code}` : 'Chọn nhân viên'}</span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command shouldFilter={false} label="Chọn nhân viên">
            <CommandInput value={typed} onValueChange={setTyped} placeholder="Tìm tên, mã NV" />
            <CommandList>
              <CommandEmpty>Không có nhân viên phù hợp.</CommandEmpty>
              <CommandGroup>
                {matches.map((p) => (
                  <CommandItem key={p.id} value={p.id} onSelect={() => { onChange(p.id); setTyped(''); setIsOpen(false); }} className="[&>svg:last-child]:hidden">
                    <Check className={`size-4 ${p.id === value ? 'text-blue-600' : 'opacity-0'}`} />
                    <span className="truncate">{p.fullName}</span>
                    <span className="ml-auto text-xs text-slate-500">{p.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </div>
  );
}
