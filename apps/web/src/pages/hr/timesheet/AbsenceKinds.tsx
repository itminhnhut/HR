import { ABSENCE_COUNTING, type AbsenceKindDto, type AbsenceKindInput } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { errorMessage } from '../parts';
import { ConfirmDialog, Field } from './dialogs';
import { CountingSelect, DaysChip, KindMark } from './KindSelect';

export type Counting = AbsenceKindInput['code'];
export const COUNTINGS: { value: Counting; label: string }[] = [
  { value: 'CL', label: 'Có lương, không trừ phép' },
  { value: 'P', label: 'Có lương, trừ phép năm' },
  { value: 'KL', label: 'Không lương' },
  { value: 'M', label: 'Vẫn 1 công, đếm đi muộn' },
  { value: 'TS', label: 'BHXH trả (thai sản)' },
  { value: 'OM', label: 'BHXH trả (ốm)' },
];

function KindRow({ kind, isEditing, onEdit, onRemove }: { kind: AbsenceKindDto; isEditing: boolean; onEdit: () => void; onRemove: () => void }) {
  return (
    <li className={`flex min-h-12 items-center gap-2.5 rounded-md border-b px-2 py-1.5 last:border-b-0 hover:bg-blue-100 ${isEditing ? 'bg-blue-50' : ''}`}>
      <KindMark code={kind.code} reason={kind.key} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{kind.name}</span>
        <span className="truncate text-xs text-slate-600">{ABSENCE_COUNTING[kind.code]}</span>
      </span>
      {kind.days ? <DaysChip days={kind.days} /> : null}
      {kind.isOwn && (
        <span className="inline-flex shrink-0 gap-1">
          <button type="button" aria-label={`Sửa ${kind.name}`} onClick={onEdit} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50 max-md:size-11"><Pencil className="size-3.5 text-blue-600" /></button>
          <button type="button" aria-label={`Xoá ${kind.name}`} onClick={onRemove} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-red-50 max-md:size-11"><Trash2 className="size-3.5 text-red-600" /></button>
        </span>
      )}
    </li>
  );
}

function useKindForm() {
  const qc = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState<Counting>('CL');
  const [days, setDays] = useState('');
  const reset = () => {
    setEditingKey(null);
    setName('');
    setCode('CL');
    setDays('');
  };
  const done = (list: AbsenceKindDto[]) => {
    qc.setQueryData(['hr', 'absence-kinds'], list);
    reset();
  };
  const save = useMutation({
    mutationFn: () => {
      const input = { name, code, days: Number(days) || null };
      return editingKey ? api.hrUpdateAbsenceKind(editingKey, input) : api.hrAddAbsenceKind(input);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (key: string) => api.hrDeleteAbsenceKind(key), onSuccess: done });
  const edit = (k: AbsenceKindDto) => {
    save.reset();
    setEditingKey(k.key);
    setName(k.name);
    setCode(k.code as Counting);
    setDays(k.days ? String(k.days) : '');
  };
  const cancel = () => {
    save.reset();
    reset();
  };
  return { editingKey, name, setName, code, setCode, days, setDays, save, remove, edit, cancel };
}

/** The reasons offered when entering someone: those in the law as they are, and HR's own to add, change or remove. */
export function KindsPanel({ kinds }: { kinds: readonly AbsenceKindDto[] }) {
  const form = useKindForm();
  const { save, remove, editingKey } = form;
  const [removing, setRemoving] = useState<AbsenceKindDto | null>(null);
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const own = kinds.filter((k) => k.isOwn);
  const law = kinds.filter((k) => !k.isOwn);
  return (
    <div className="flex flex-col gap-4">
      <section aria-label={editingKey ? 'Sửa lý do' : 'Thêm lý do'} className={`@container flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 ${editingKey ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3 @3xl:grid-cols-[2fr_2fr_1fr_auto]">
          <div className="col-span-2 @3xl:col-span-1"><Field label="Tên lý do" error={errors.name}><Input aria-label="Tên lý do" value={form.name} placeholder="vd: Nghỉ nhà có việc" onChange={(e) => form.setName(e.target.value)} className="bg-white" /></Field></div>
          <div className="col-span-2 @3xl:col-span-1"><Field label="Cách tính" error={errors.code}><CountingSelect value={form.code} label="Cách tính của lý do" onChange={form.setCode} /></Field></div>
          <Field label="Số ngày mặc định" error={errors.days}><Input aria-label="Số ngày mặc định" inputMode="numeric" value={form.days} placeholder="1" onChange={(e) => form.setDays(e.target.value)} className="bg-white" /></Field>
          <span className="flex gap-2">
            {editingKey && <button type="button" aria-label="Huỷ sửa lý do" onClick={form.cancel} className="ts-field inline-flex items-center justify-center rounded-md border bg-white px-3 hover:bg-slate-50"><X className="size-4" /></button>}
            <button type="button" aria-label={editingKey ? 'Lưu lý do' : 'Thêm lý do'} disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50">
              {editingKey ? <Check className="size-4" /> : <Plus className="size-4" />}
              {editingKey ? 'Lưu' : 'Thêm'}
            </button>
          </span>
        </div>
        {save.isError && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
      </section>
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <section aria-label="Lý do tự thêm" className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">Tự thêm <span className="font-medium text-slate-500">({own.length})</span></h3>
        {own.length === 0 && <p className="m-0 py-2 text-sm text-slate-500">Chưa có. vd: Đám hỏi, Nghỉ nhà có việc.</p>}
        <ul className="m-0 flex list-none flex-col p-0">{own.map((k) => <KindRow key={k.key} kind={k} isEditing={k.key === editingKey} onEdit={() => form.edit(k)} onRemove={() => setRemoving(k)} />)}</ul>
      </section>
      <section aria-label="Lý do có sẵn" className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-semibold">Có sẵn <span className="font-medium text-slate-500">({law.length})</span></h3>
        <ul className="m-0 flex list-none flex-col p-0">{law.map((k) => <KindRow key={k.key} kind={k} isEditing={false} onEdit={() => undefined} onRemove={() => undefined} />)}</ul>
      </section>
      <ConfirmDialog open={!!removing} title={`Xoá lý do ${removing?.name ?? ''}? Các dòng đã nhập vẫn giữ nguyên.`} isBusy={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) remove.mutate(removing.key); setRemoving(null); }} />
    </div>
  );
}
