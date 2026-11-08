import { SHEET_APPROVER, matchesQuery, type ApproverDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../../vendor/shadcn-grid/components/ui/command';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import { errorMessage } from '../parts';
import { ConfirmDialog, Field } from './dialogs';

const KEY = ['hr', 'approvers'];
export const useApprovers = () => useQuery({ queryKey: KEY, queryFn: () => api.hrApprovers() });

/** Pick someone from the list, or type a new name: it is remembered once the line is saved. */
export function ApproverField({ value, error, onChange }: { value: string; error?: string; onChange: (name: string) => void }) {
  const approvers = useApprovers();
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const known = approvers.data ?? [];
  const text = typed.trim();
  const isNew = !!text && !known.some((a) => a.name.toLowerCase() === text.toLowerCase());
  const pick = (name: string) => {
    onChange(name);
    setTyped('');
    setIsOpen(false);
  };
  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium">
      <span>Người duyệt</span>
      <div className="relative">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger render={<button type="button" aria-label="Người duyệt" className="ts-field flex w-full items-center gap-2 rounded-md border bg-white px-2.5 text-sm font-normal hover:bg-slate-50" />}>
            <UserCheck className="size-4 shrink-0 text-green-600" />
            <span className={`min-w-0 flex-1 truncate text-left ${value ? '' : 'text-slate-500'}`}>{value || 'Chưa duyệt'}</span>
            {!value && <ChevronDown className="size-4 shrink-0 text-slate-400" />}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command shouldFilter={false} label="Chọn người duyệt">
              <CommandInput value={typed} onValueChange={setTyped} placeholder="Tìm hoặc gõ tên mới" />
              <CommandList>
                {!isNew && <CommandEmpty>Chưa có ai. Gõ tên để thêm.</CommandEmpty>}
                <CommandGroup>
                  {known.filter((a) => matchesQuery(a.name, typed)).map((a) => (
                    <CommandItem key={a.id} value={a.id} onSelect={() => pick(a.name)} className="[&>svg:last-child]:hidden">
                      <Check className={`size-4 ${a.name === value ? 'text-blue-600' : 'opacity-0'}`} />
                      <span className="truncate">{a.name}</span>
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
        {value && <button type="button" aria-label="Bỏ người duyệt" onClick={() => onChange('')} className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700"><X className="size-3.5" /></button>}
      </div>
      {error && <span className="text-xs font-normal text-red-600">{error}</span>}
    </div>
  );
}

/** The people HR offers as approvers: added ahead of time here, or typed on a line. */
export function ApproversPanel() {
  const qc = useQueryClient();
  const approvers = useApprovers();
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<ApproverDto | null>(null);
  const done = (list: ApproverDto[]) => {
    qc.setQueryData(KEY, list);
    setName('');
    setRemoving(null);
  };
  const add = useMutation({ mutationFn: () => api.hrAddApprover(name), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => api.hrDeleteApprover(id), onSuccess: done });
  const list = approvers.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Thêm người duyệt" className="grid items-end gap-2 rounded-lg border bg-slate-50 p-3 grid-cols-[1fr_auto]">
        <Field label="Tên người duyệt"><Input aria-label="Tên người duyệt" value={name} placeholder="vd: Anh Hùng" onChange={(e) => setName(e.target.value)} className="bg-white" /></Field>
        <button type="button" aria-label="Thêm người duyệt" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50"><Plus className="size-4" />Thêm</button>
      </section>
      {(add.isError || remove.isError) && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(add.error ?? remove.error)}</p>}
      {list.length === 0 && <p className="m-0 text-sm text-slate-500">Chưa có ai. Thêm trước ở đây, hoặc gõ tên khi nhập.</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((a) => (
          <li key={a.id} className="flex min-h-12 items-center gap-2.5 rounded-md border-b px-2 py-1.5 last:border-b-0 hover:bg-blue-100">
            <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-700"><UserCheck className="size-3.5" /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
            {/* HR approves what HR types on the sheet: it always stays (the API refuses too). */}
            {a.name.toLowerCase() === SHEET_APPROVER.toLowerCase() ? (
              <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-slate-100 px-2 text-xs font-medium text-slate-600">Mặc định</span>
            ) : (
              <button type="button" aria-label={`Xoá ${a.name}`} onClick={() => setRemoving(a)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-white hover:bg-red-50 max-md:size-11"><Trash2 className="size-3.5 text-red-600" /></button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog open={!!removing} title={`Xoá ${removing?.name ?? ''} khỏi danh sách? Các dòng đã duyệt vẫn giữ tên.`} isBusy={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}
