import type { DepartmentDto, StaffKindDto, StaffKindInput } from '@careers/shared';
import { useMutation } from '@tanstack/react-query';
import { Building2, Check, Hourglass, Pencil, Plus, ShieldCheck, Trash2, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { errorMessage } from '../parts';
import { ConfirmDialog, Field } from './dialogs';
import { useConfigRefresh } from './queries';

const ICON_BUTTON = 'inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-white max-md:size-11';

export function MasterRow({ icon: Icon, tone, name, detail, count, isEditing, lockedReason, onEdit, onRemove }: {
  icon: LucideIcon;
  tone: string;
  name: string;
  detail?: string;
  count: number;
  isEditing: boolean;
  /** Why it cannot be removed, when it cannot. */
  lockedReason: string | null;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={`flex min-h-12 items-center gap-2.5 rounded-md border-b px-2 py-1.5 last:border-b-0 hover:bg-blue-100 ${isEditing ? 'bg-blue-50' : ''}`}>
      <span aria-hidden="true" className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md border ${tone}`}><Icon className="size-3.5" /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        {detail && <span className="truncate text-xs text-slate-600">{detail}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700 tabular-nums">{count} nhân viên</span>
      <button type="button" aria-label={`Sửa ${name}`} onClick={onEdit} className={`${ICON_BUTTON} hover:bg-slate-50`}><Pencil className="size-3.5 text-blue-600" /></button>
      {lockedReason ? (
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="inline-flex" />}>
            <button type="button" disabled aria-label={`Xoá ${name}`} className={`${ICON_BUTTON} opacity-40`}><Trash2 className="size-3.5 text-red-600" /></button>
          </TooltipTrigger>
          <TooltipContent>{lockedReason}</TooltipContent>
        </Tooltip>
      ) : (
        <button type="button" aria-label={`Xoá ${name}`} onClick={onRemove} className={`${ICON_BUTTON} hover:bg-red-50`}><Trash2 className="size-3.5 text-red-600" /></button>
      )}
    </li>
  );
}

export function FormBox({ label, isEditing, canSave, isBusy, onSave, onCancel, error, children }: {
  label: string;
  isEditing: boolean;
  canSave: boolean;
  isBusy: boolean;
  onSave: () => void;
  onCancel: () => void;
  error: unknown;
  children: ReactNode;
}) {
  const hasFieldErrors = error instanceof ApiError && Object.keys(error.fieldErrors).length > 0;
  return (
    <section aria-label={label} className={`flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 ${isEditing ? 'ring-2 ring-blue-400' : ''}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid min-w-0 flex-1 basis-64 gap-3 md:auto-cols-fr md:grid-flow-col">{children}</div>
        <div className="flex flex-col gap-1.5 text-sm font-medium max-md:w-full">
          <span aria-hidden="true" className="max-md:hidden">&nbsp;</span>
          <span className="flex gap-2">
            {isEditing && <button type="button" aria-label="Huỷ sửa" onClick={onCancel} className="ts-field inline-flex items-center justify-center rounded-md border bg-white px-3 hover:bg-slate-50"><X className="size-4" /></button>}
            <button type="button" aria-label={label} disabled={!canSave || isBusy} onClick={onSave} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50 max-md:flex-1">
              {isEditing ? <Check className="size-4" /> : <Plus className="size-4" />}
              {isEditing ? 'Lưu' : 'Thêm'}
            </button>
          </span>
        </div>
      </div>
      {!!error && !hasFieldErrors && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
    </section>
  );
}

/** Rename one and everyone in it follows; closed periods keep the name they closed with. */
export function DepartmentsPanel({ departments }: { departments: readonly DepartmentDto[] }) {
  const refresh = useConfigRefresh();
  const [editing, setEditing] = useState<DepartmentDto | null>(null);
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<DepartmentDto | null>(null);
  const done = () => {
    refresh();
    setEditing(null);
    setName('');
    setRemoving(null);
  };
  const save = useMutation({ mutationFn: () => (editing ? api.hrUpdateDepartment(editing.id, { name }) : api.hrAddDepartment({ name })), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => api.hrDeleteDepartment(id), onSuccess: done });
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  return (
    <div className="flex flex-col gap-4">
      <FormBox label={editing ? 'Lưu bộ phận' : 'Thêm bộ phận'} isEditing={!!editing} canSave={!!name.trim()} isBusy={save.isPending} error={save.error} onSave={() => save.mutate()} onCancel={() => { save.reset(); setEditing(null); setName(''); }}>
        <Field label="Tên bộ phận" error={errors.name}><Input aria-label="Tên bộ phận" value={name} placeholder="vd: Kế toán" onChange={(e) => setName(e.target.value)} className="bg-white" /></Field>
      </FormBox>
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      {departments.length === 0 && <p className="m-0 text-sm text-slate-500">Chưa có bộ phận nào.</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {departments.map((d) => (
          <MasterRow key={d.id} icon={Building2} tone="border-blue-200 bg-blue-50 text-blue-700" name={d.name} count={d.employees} isEditing={editing?.id === d.id} lockedReason={d.employees > 0 ? `Đang có ${d.employees} nhân viên` : null} onEdit={() => { save.reset(); setEditing(d); setName(d.name); }} onRemove={() => setRemoving(d)} />
        ))}
      </ul>
      <ConfirmDialog open={!!removing} title={`Xoá bộ phận ${removing?.name ?? ''}?`} isBusy={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}

type Rule = StaffKindInput['rule'];
const RULES: { value: Rule; label: string }[] = [
  { value: 'official', label: 'Cộng phép, như chính thức' },
  { value: 'probation', label: 'Không cộng phép, như thử việc' },
];
const ruleWord = (rule: Rule) => RULES.find((r) => r.value === rule)?.label ?? '';

/** HR names the kinds; each counts for leave one of two ways, the two the sheet has. */
export function StaffKindsPanel({ kinds }: { kinds: readonly StaffKindDto[] }) {
  const refresh = useConfigRefresh();
  const [editing, setEditing] = useState<StaffKindDto | null>(null);
  const [name, setName] = useState('');
  const [rule, setRule] = useState<Rule>('official');
  const [removing, setRemoving] = useState<StaffKindDto | null>(null);
  const reset = () => {
    setEditing(null);
    setName('');
    setRule('official');
  };
  const done = () => {
    refresh();
    reset();
    setRemoving(null);
  };
  const save = useMutation({ mutationFn: () => (editing ? api.hrUpdateStaffKind(editing.id, { name, rule }) : api.hrAddStaffKind({ name, rule })), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => api.hrDeleteStaffKind(id), onSuccess: done });
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const edit = (k: StaffKindDto) => {
    save.reset();
    setEditing(k);
    setName(k.name);
    setRule(k.rule);
  };
  return (
    <div className="flex flex-col gap-4">
      <FormBox label={editing ? 'Lưu loại nhân viên' : 'Thêm loại nhân viên'} isEditing={!!editing} canSave={!!name.trim()} isBusy={save.isPending} error={save.error} onSave={() => save.mutate()} onCancel={() => { save.reset(); reset(); }}>
        <Field label="Tên loại" error={errors.name}><Input aria-label="Tên loại" value={name} placeholder="vd: Thực tập, Bán thời gian" onChange={(e) => setName(e.target.value)} className="bg-white" /></Field>
        <Field label="Cách tính phép" error={errors.rule}>
          <Select value={rule} disabled={!!editing?.isDefault} onValueChange={(v) => setRule(v as Rule)} items={RULES}>
            <SelectTrigger aria-label="Cách tính phép" className="w-full bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>{RULES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </FormBox>
      {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {kinds.map((k) => (
          <MasterRow
            key={k.id}
            icon={k.rule === 'probation' ? Hourglass : ShieldCheck}
            tone={k.rule === 'probation' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-green-300 bg-green-50 text-green-800'}
            name={k.name}
            detail={ruleWord(k.rule)}
            count={k.employees}
            isEditing={editing?.id === k.id}
            lockedReason={k.isDefault ? 'Loại mặc định, chỉ đổi được tên' : k.employees > 0 ? `Đang có ${k.employees} nhân viên` : null}
            onEdit={() => edit(k)}
            onRemove={() => setRemoving(k)}
          />
        ))}
      </ul>
      <ConfirmDialog open={!!removing} title={`Xoá loại ${removing?.name ?? ''}?`} isBusy={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) remove.mutate(removing.id); }} />
    </div>
  );
}
