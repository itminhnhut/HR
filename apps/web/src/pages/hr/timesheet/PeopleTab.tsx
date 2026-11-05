import { staffLabelOf, todayInVietnam, type EmployeeDto, type EmployeeInput, type StaffKindDto, type TimesheetRegionDto } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff, Check, Pencil, Trash2, UserPlus, Users, UserX, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../../../api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../vendor/shadcn-grid/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import { RegionBadge, StaffBadge } from './columns';
import { CopyValue } from './CopyValue';
import { DateField } from './DateField';
import { DepartmentField } from './DepartmentField';
import { ConfirmDialog, Field } from './dialogs';
import { LeaveJobDialog } from './LeaveJobDialog';
import { useDepartments, useEmployees, useRegions, useStaffKinds } from './queries';
import { TabSkeleton } from './skeletons';

type Form = { code: string; fullName: string; department: string; title: string; regionId: string; staffKindId: string; joinedOn: string; officialOn: string; leftOn: string; openingLeave: string };

const toForm = (e: EmployeeDto | null, regionId: string, kinds: readonly StaffKindDto[]): Form => ({
  code: e?.code ?? '',
  fullName: e?.fullName ?? '',
  department: e?.department ?? '',
  title: e?.title ?? '',
  regionId: e?.regionId ?? regionId,
  staffKindId: e?.staffKindId ?? kinds.find((k) => k.isDefault && k.rule === (e?.employment ?? 'probation'))?.id ?? '',
  joinedOn: e?.joinedOn ?? '',
  officialOn: e?.officialOn ?? '',
  leftOn: e?.leftOn ?? '',
  openingLeave: String(e?.openingLeave ?? 0).replace('.', ','),
});

const nextCode = (people: readonly EmployeeDto[]) => {
  const numbers = people.map((p) => /^TF(\d+)$/.exec(p.code)?.[1]).filter(Boolean).map(Number);
  return `TF${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
};

function PersonFields({ form, set, errors, placeholder, departments, kinds, regions }: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  errors: Record<string, string>;
  placeholder: string;
  departments: readonly string[];
  kinds: readonly StaffKindDto[];
  regions: readonly TimesheetRegionDto[];
}) {
  const regionItems = regions.map((r) => ({ value: r.id, label: r.name }));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Mã NV" error={errors.code}><Input aria-label="Mã NV" value={form.code} placeholder={placeholder} onChange={(e) => set('code', e.target.value)} /></Field>
      <Field label="Họ và tên" isRequired error={errors.fullName}><Input aria-label="Họ và tên" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
      <Field label="Khu vực" error={errors.regionId}>
        <Select value={form.regionId} onValueChange={(v) => set('regionId', String(v))} items={regionItems}>
          <SelectTrigger aria-label="Khu vực" className="w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>{regionItems.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <DepartmentField value={form.department} known={departments} error={errors.department} onChange={(v) => set('department', v)} />
      <Field label="Chức danh" error={errors.title}><Input aria-label="Chức danh" value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
      <Field label="Loại NV">
        <Select value={form.staffKindId} onValueChange={(v) => set('staffKindId', String(v))} items={kinds.map((k) => ({ value: k.id, label: k.name }))}>
          <SelectTrigger aria-label="Loại NV" className="w-full bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>{kinds.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <DateField label="Ngày vào" value={form.joinedOn} error={errors.joinedOn} onChange={(v) => set('joinedOn', v)} />
      <DateField label="Ngày chính thức" value={form.officialOn} error={errors.officialOn} onChange={(v) => set('officialOn', v)} />
      <DateField label="Ngày nghỉ việc" value={form.leftOn} error={errors.leftOn} onChange={(v) => set('leftOn', v)} />
      <Field label="Phép tồn ban đầu" error={errors.openingLeave}><Input aria-label="Phép tồn ban đầu" inputMode="decimal" value={form.openingLeave} onChange={(e) => set('openingLeave', e.target.value)} /></Field>
    </div>
  );
}

function PersonDialog({ open, editing, people, regions, departments, kinds, onClose , onSaved }: { open: boolean; editing: EmployeeDto | null; people: readonly EmployeeDto[]; regions: readonly TimesheetRegionDto[]; departments: readonly string[]; kinds: readonly StaffKindDto[]; onClose: () => void; onSaved: (saved: EmployeeDto) => void;
}) {
  const qc = useQueryClient();
  const box = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Form>(() => toForm(editing, regions[0]?.id ?? '', kinds));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    void qc.invalidateQueries({ queryKey: ['hr', 'regions'] });
  };
  const save = useMutation({
    mutationFn: (input: EmployeeInput) => (editing ? api.hrUpdateEmployee(editing.id, input) : api.hrCreateEmployee(input)),
    onSuccess: (saved) => {
      refresh();
      onSaved(saved);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.hrDeleteEmployee(editing?.id ?? ''),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [needsStart, setNeedsStart] = useState(false);
  const serverErrors = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const errors = needsStart && !form.joinedOn ? { ...serverErrors, joinedOn: 'Chọn ngày vào, để bảng công biết tính từ đâu.' } : serverErrors;
  const placeholder = nextCode(people);
  useEffect(() => {
    if (save.isError) box.current?.querySelector<HTMLElement>('[data-invalid] input, [data-invalid] button')?.focus();
  }, [save.isError, save.error]);
  const submit = () => {
    if (!form.joinedOn) {
      setNeedsStart(true);
      return;
    }
    save.mutate(inputFromForm());
  };
  const inputFromForm = (): EmployeeInput => ({
    code: form.code.trim() || placeholder,
    fullName: form.fullName,
    department: form.department,
    title: form.title,
    regionId: form.regionId,
    employment: kinds.find((k) => k.id === form.staffKindId)?.rule ?? editing?.employment ?? 'probation',
    staffKindId: form.staffKindId || null,
    joinedOn: form.joinedOn || null,
    officialOn: form.officialOn || null,
    leftOn: form.leftOn || null,
    openingLeave: Number(form.openingLeave.replace(',', '.')) || 0,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? `Sửa ${editing.fullName}` : 'Thêm nhân viên'}</DialogTitle></DialogHeader>
        <div ref={box}><PersonFields form={form} set={set} errors={errors} placeholder={placeholder} departments={departments} kinds={kinds} regions={regions} /></div>
        <p className="m-0 text-xs text-slate-500">Ngoài khoảng ngày vào và ngày nghỉ việc, bảng công tự xám và không tính công.</p>
        {save.isError && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
        {remove.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
        <DialogFooter>
          {editing && <button type="button" onClick={() => setIsDeleting(true)} className="ts-field mr-auto inline-flex items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="size-4" />Xoá</button>}
          <button type="button" onClick={onClose} className="ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">Huỷ</button>
          <button type="button" disabled={save.isPending} onClick={submit} className="ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="size-4" />Lưu nhân viên</button>
        </DialogFooter>
        <ConfirmDialog open={isDeleting} title={`Xoá ${editing?.fullName ?? ''}? Chỉ xoá được khi chưa có ngày công.`} isBusy={remove.isPending} onCancel={() => setIsDeleting(false)} onConfirm={() => { setIsDeleting(false); remove.mutate(); }} />
      </DialogContent>
    </Dialog>
  );
}

const show = (d: string | null) => (d ? d.split('-').reverse().join('/') : '-');
const HEADS = ['Mã NV', 'Họ và tên', 'Bộ phận', 'Chức danh', 'Khu vực', 'Loại NV', 'Ngày vào', 'Ngày nghỉ việc'];

const ROW_ACTION = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-white px-2 text-xs font-medium whitespace-nowrap hover:bg-slate-50 max-2xl:size-8 max-2xl:px-0 max-md:size-11';

/** Icon only until the screen has room for the words, so the buttons never sit on a column. */
function RowAction({ label, render, children }: { label: string; render: ReactElement; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={render}>{children}<span className="max-2xl:sr-only">{label}</span></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function PersonRow({ person, regions, kinds, today, isPicked, onPick, onEdit, onLeaveJob }: { person: EmployeeDto; regions: readonly TimesheetRegionDto[]; kinds: readonly StaffKindDto[]; today: string; isPicked: boolean; onPick: () => void; onEdit: () => void; onLeaveJob: () => void }) {
  const hasLeft = !!person.leftOn && person.leftOn <= today;
  const now = person.officialOn && person.officialOn <= today ? 'official' : person.employment;
  return (
    <tr data-picked={isPicked ? '' : undefined} onClick={onPick} className="cursor-pointer border-b">
      <td className="p-2 text-slate-600"><CopyValue text={person.code} label="mã NV"><span className="pr-7">{person.code}</span></CopyValue></td>
      <td className="p-2 font-medium"><CopyValue text={person.fullName} label="họ tên"><span className="pr-7">{person.fullName}</span></CopyValue></td>
      <td className="p-2"><CopyValue text={person.department} label="bộ phận"><span className="pr-7">{person.department || '-'}</span></CopyValue></td>
      <td className="p-2"><CopyValue text={person.title} label="chức danh"><span className="pr-7">{person.title || '-'}</span></CopyValue></td>
      <td className="max-w-36 p-2"><RegionBadge regionId={person.regionId} regions={regions} /></td>
      <td className="p-2">
        {hasLeft
          ? <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-medium whitespace-nowrap text-slate-700"><UserX className="size-3" />Đã nghỉ</span>
          : <StaffBadge type={now} label={staffLabelOf(kinds, person.staffKindId, now)} />}
      </td>
      <td className="p-2 tabular-nums"><CopyValue text={person.joinedOn ? show(person.joinedOn) : ''} label="ngày vào"><span className="pr-7">{show(person.joinedOn)}</span></CopyValue></td>
      <td className="p-2 tabular-nums"><CopyValue text={person.leftOn ? show(person.leftOn) : ''} label="ngày nghỉ việc"><span className="pr-7">{show(person.leftOn)}</span></CopyValue></td>
      <td className="sticky right-0 bg-white p-2 text-right shadow-[-6px_0_6px_-6px_rgba(15,23,42,0.18)]">
        <span className="inline-flex gap-1">
          <RowAction label="Ghi nghỉ" render={<Link to={`/hr/cham-cong/nghi?nv=${person.id}`} aria-label={`Ghi nghỉ ${person.fullName}`} className={`${ROW_ACTION} text-slate-800 no-underline`} />}><CalendarOff className="size-3.5 text-blue-600" /></RowAction>
          <RowAction label="Cho nghỉ việc" render={<button type="button" aria-label={`Cho nghỉ việc ${person.fullName}`} onClick={onLeaveJob} className={ROW_ACTION} />}><UserX className="size-3.5 text-orange-600" /></RowAction>
          <RowAction label="Sửa" render={<button type="button" aria-label={`Sửa ${person.fullName}`} onClick={onEdit} className={ROW_ACTION} />}><Pencil className="size-3.5 text-blue-600" /></RowAction>
        </span>
      </td>
    </tr>
  );
}

export function PeopleTab() {
  const people = useEmployees();
  const regions = useRegions();
  const departments = useDepartments();
  const kinds = useStaffKinds();
  const [dialog, setDialog] = useState<{ editing: EmployeeDto | null; key: number } | null>(null);
  const [leavingJob, setLeavingJob] = useState<EmployeeDto | null>(null);
  const [warning, setWarning] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const afterSave = (saved: EmployeeDto) => {
    setDialog(null);
    setLeavingJob(null);
    setWarning(saved.warning ?? '');
  };
  if (people.isPending || regions.isPending || departments.isPending || kinds.isPending) return <TabSkeleton />;
  if (people.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => people.refetch()} message={errorMessage(people.error)} /></div>;
  if (regions.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} /></div>;
  if (departments.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => departments.refetch()} message={errorMessage(departments.error)} /></div>;
  if (kinds.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => kinds.refetch()} message={errorMessage(kinds.error)} /></div>;
  const today = todayInVietnam();
  return (
    <section className="ts-card flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg font-semibold"><Users className="size-5 text-blue-600" />Nhân viên <span className="rounded-full bg-slate-100 px-2 text-sm font-medium text-slate-600">{people.data.length}</span></h2>
        <button type="button" onClick={() => setDialog({ editing: null, key: Date.now() })} className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700"><UserPlus className="size-4" />Thêm nhân viên</button>
      </div>
      {warning && (
        <p role="alert" className="m-0 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">{warning}</span>
          <button type="button" aria-label="Đóng cảnh báo" onClick={() => setWarning('')} className="rounded p-1 hover:bg-amber-100"><X className="size-4" /></button>
        </p>
      )}
      {people.data.length === 0 ? (
        <p className="m-0 py-8 text-center text-sm text-slate-500">Chưa có nhân viên. Thêm người đầu tiên, kèm phép tồn tại kỳ bắt đầu dùng.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm whitespace-nowrap">
            <thead><tr className="border-b text-left">{HEADS.map((h) => <th key={h} className="h-10 px-2 font-medium">{h}</th>)}<th aria-label="Sửa" className="sticky right-0 bg-white" /></tr></thead>
            <tbody>
              {people.data.map((p) => <PersonRow key={p.id} person={p} regions={regions.data} kinds={kinds.data} today={today} isPicked={p.id === pickedId} onPick={() => setPickedId(p.id)} onEdit={() => setDialog({ editing: p, key: Date.now() })} onLeaveJob={() => setLeavingJob(p)} />)}
            </tbody>
          </table>
        </div>
      )}
      {dialog && <PersonDialog key={dialog.key} open editing={dialog.editing} people={people.data} regions={regions.data} departments={departments.data.map((d) => d.name)} kinds={kinds.data} onClose={() => setDialog(null)} onSaved={afterSave} />}
      {leavingJob && <LeaveJobDialog person={leavingJob} onClose={() => setLeavingJob(null)} onSaved={afterSave} />}
    </section>
  );
}
