import { STAFF_TYPE_LABEL, todayInVietnam, type EmployeeDto, type EmployeeInput, type StaffType, type TimesheetRegionDto } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Pencil, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../../../api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { ErrorState, LoadingStatus } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { RegionBadge, StaffBadge } from './columns';
import { DateField } from './DateField';
import { Field } from './dialogs';
import { useEmployees, useRegions } from './queries';

type Form = { code: string; fullName: string; department: string; title: string; regionId: string; employment: StaffType; joinedOn: string; officialOn: string; leftOn: string; openingLeave: string };

const toForm = (e: EmployeeDto | null, regionId: string): Form => ({
  code: e?.code ?? '',
  fullName: e?.fullName ?? '',
  department: e?.department ?? '',
  title: e?.title ?? '',
  regionId: e?.regionId ?? regionId,
  employment: e?.employment ?? 'probation',
  joinedOn: e?.joinedOn ?? '',
  officialOn: e?.officialOn ?? '',
  leftOn: e?.leftOn ?? '',
  openingLeave: String(e?.openingLeave ?? 0).replace('.', ','),
});

const nextCode = (people: readonly EmployeeDto[]) => {
  const numbers = people.map((p) => /^TF(\d+)$/.exec(p.code)?.[1]).filter(Boolean).map(Number);
  return `TF${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
};

function PersonDialog({ open, editing, people, regions, onClose }: { open: boolean; editing: EmployeeDto | null; people: readonly EmployeeDto[]; regions: readonly TimesheetRegionDto[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(editing, regions[0]?.id ?? ''));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: (input: EmployeeInput) => (editing ? api.hrUpdateEmployee(editing.id, input) : api.hrCreateEmployee(input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
      void qc.invalidateQueries({ queryKey: ['hr', 'regions'] });
      onClose();
    },
  });
  const errors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const placeholder = nextCode(people);
  const submit = () => save.mutate({
    code: form.code.trim() || placeholder,
    fullName: form.fullName,
    department: form.department,
    title: form.title,
    regionId: form.regionId,
    employment: form.employment,
    joinedOn: form.joinedOn || null,
    officialOn: form.officialOn || null,
    leftOn: form.leftOn || null,
    openingLeave: Number(form.openingLeave.replace(',', '.')) || 0,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? `Sửa ${editing.fullName}` : 'Thêm nhân viên'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã nhân viên" error={errors.code}><Input aria-label="Mã nhân viên" value={form.code} placeholder={placeholder} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Họ và tên" error={errors.fullName}><Input aria-label="Họ và tên" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
          <Field label="Khu vực" error={errors.regionId}>
            <Select value={form.regionId} onValueChange={(v) => set('regionId', String(v))} items={regions.map((r) => ({ value: r.id, label: r.name }))}>
              <SelectTrigger aria-label="Khu vực" className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Bộ phận" error={errors.department}><Input aria-label="Bộ phận" list="ts-departments" value={form.department} onChange={(e) => set('department', e.target.value)} /></Field>
          <datalist id="ts-departments">{[...new Set(people.map((p) => p.department).filter(Boolean))].map((d) => <option key={d} value={d} />)}</datalist>
          <Field label="Chức danh" error={errors.title}><Input aria-label="Chức danh" value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Loại nhân viên">
            <Select value={form.employment} onValueChange={(v) => set('employment', v as StaffType)} items={(['probation', 'official'] as const).map((v) => ({ value: v, label: STAFF_TYPE_LABEL[v] }))}>
              <SelectTrigger aria-label="Loại nhân viên" className="w-full bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{(['probation', 'official'] as const).map((v) => <SelectItem key={v} value={v}>{STAFF_TYPE_LABEL[v]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <DateField label="Ngày vào" value={form.joinedOn} error={errors.joinedOn} onChange={(v) => set('joinedOn', v)} />
          <DateField label="Ngày chính thức" value={form.officialOn} error={errors.officialOn} onChange={(v) => set('officialOn', v)} />
          <DateField label="Ngày nghỉ việc" value={form.leftOn} error={errors.leftOn} onChange={(v) => set('leftOn', v)} />
          <Field label="Phép tồn ban đầu" error={errors.openingLeave}><Input aria-label="Phép tồn ban đầu" inputMode="decimal" value={form.openingLeave} onChange={(e) => set('openingLeave', e.target.value)} /></Field>
        </div>
        <p className="m-0 text-xs text-slate-500">Ngoài khoảng ngày vào và ngày nghỉ việc, bảng công tự xám và không tính công.</p>
        {save.isError && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className="h-9 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">Huỷ</button>
          <button type="button" disabled={save.isPending} onClick={submit} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="size-4" />Lưu nhân viên</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const show = (d: string | null) => (d ? d.split('-').reverse().join('/') : '-');

export function PeopleTab() {
  const people = useEmployees();
  const regions = useRegions();
  const [dialog, setDialog] = useState<{ editing: EmployeeDto | null; key: number } | null>(null);
  if (people.isPending || regions.isPending) return <LoadingStatus />;
  if (people.isError) return <ErrorState onRetry={() => people.refetch()} message={errorMessage(people.error)} />;
  if (regions.isError) return <ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} />;
  const today = todayInVietnam();
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-blue-600" />Nhân viên <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{people.data.length}</span></h2>
        <button type="button" onClick={() => setDialog({ editing: null, key: Date.now() })} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"><UserPlus className="size-4" />Thêm nhân viên</button>
      </div>
      {people.data.length === 0 ? (
        <p className="m-0 py-8 text-center text-sm text-slate-500">Chưa có nhân viên. Thêm người đầu tiên, kèm phép tồn hiện tại.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm whitespace-nowrap">
            <thead><tr className="border-b text-left">{['Mã NV', 'Họ và tên', 'Bộ phận', 'Chức danh', 'Khu vực', 'Trạng thái', 'Ngày vào', 'Ngày nghỉ', ''].map((h) => <th key={h} className="h-10 px-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {people.data.map((p) => (
                <tr key={p.id} className="border-b hover:bg-slate-50">
                  <td className="p-2 text-slate-600">{p.code}</td>
                  <td className="p-2 font-medium">{p.fullName}</td>
                  <td className="p-2">{p.department || '-'}</td>
                  <td className="p-2">{p.title || '-'}</td>
                  <td className="p-2"><RegionBadge regionId={p.regionId} regions={regions.data} /></td>
                  <td className="p-2">
                    {p.leftOn && p.leftOn <= today
                      ? <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700"><Ban className="size-3" />Đã nghỉ</span>
                      : <StaffBadge type={p.officialOn && p.officialOn <= today ? 'official' : p.employment} />}
                  </td>
                  <td className="p-2 tabular-nums">{show(p.joinedOn)}</td>
                  <td className="p-2 tabular-nums">{show(p.leftOn)}</td>
                  <td className="p-2 text-right"><button type="button" aria-label={`Sửa ${p.fullName}`} onClick={() => setDialog({ editing: p, key: Date.now() })} className="inline-flex size-8 items-center justify-center rounded-md border bg-white hover:bg-slate-50"><Pencil className="size-3.5 text-blue-600" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && <PersonDialog key={dialog.key} open editing={dialog.editing} people={people.data} regions={regions.data} onClose={() => setDialog(null)} />}
    </section>
  );
}
