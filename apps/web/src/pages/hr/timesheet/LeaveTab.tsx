import { todayInVietnam, type AbsenceInput, type AbsenceKindDto, type AbsenceRowDto, type EmployeeDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Check, CheckCircle2, Clock, Pencil, Settings2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api, ApiError } from '../../../api';
import { Input } from '../../../vendor/shadcn-grid/components/ui/input';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import type { Counting } from './AbsenceKinds';
import { CountingSelect, KindSelect } from './KindSelect';
import { ApproverField } from './ApproverField';
import { LeaveConfigDrawer } from './LeaveConfigDrawer';
import { AbsenceTable } from './AbsenceTable';
import { DateField } from './DateField';
import { Field } from './dialogs';
import { defaultEnd, lastOfWeekdays, weekdaysBetween } from './leaveDates';
import { PersonField } from './PersonField';
import { useEmployees } from './queries';
import { TabSkeleton } from './skeletons';

interface Form {
  personId: string;
  reason: string;
  code: Counting;
  from: string;
  to: string;
  /** As typed: it stays empty while HR clears it to type another number. */
  days: string;
  isHalf: boolean;
  approvedBy: string;
  handover: string;
  note: string;
}

/** Everything a reason suggests. HR can change any of it on the line. */
function withReason(form: Form, kind: AbsenceKindDto | undefined): Form {
  const days = kind?.days ?? 1;
  const to = form.from ? defaultEnd(form.from, kind?.key, days) : '';
  return {
    ...form,
    reason: kind?.key ?? form.reason,
    code: (kind?.code ?? form.code) as Counting,
    isHalf: false,
    to,
    days: form.from ? String(weekdaysBetween(form.from, to)) : String(days),
  };
}

const emptyForm = (kind: AbsenceKindDto | undefined): Form =>
  withReason({ personId: '', reason: 'annual', code: 'P', from: todayInVietnam(), to: '', days: '1', isHalf: false, approvedBy: '', handover: '', note: '' }, kind);

const formOf = (a: AbsenceRowDto): Form => ({
  personId: a.employeeId,
  reason: a.reason,
  code: a.code.replace('/2', '') as Counting,
  from: a.from,
  to: a.to,
  days: a.code.endsWith('/2') ? '1' : String(weekdaysBetween(a.from, a.to)),
  isHalf: a.code.endsWith('/2'),
  approvedBy: a.approvedBy ?? '',
  handover: a.handover,
  note: a.note,
});

const inputOf = (f: Form): AbsenceInput => ({ reason: f.reason, code: f.code, from: f.from, to: f.to || f.from, isHalf: f.isHalf, approvedBy: f.approvedBy, handover: f.handover, note: f.note });

const CONFIG_PARAM = 'cau-hinh';

function StateHint({ code, approvedBy }: { code: string; approvedBy: string }) {
  if (code === 'M') return <span className="inline-flex items-center gap-1.5 text-sm text-amber-800"><Clock className="size-4" />Không cần duyệt, lưu là chấm M</span>;
  if (approvedBy.trim()) return <span className="inline-flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="size-4" />Đã duyệt, tự chấm vào bảng công</span>;
  return <span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><Clock className="size-4" />Chưa có người duyệt, lưu chờ duyệt</span>;
}

function useLeaveActions(onDone: () => void) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['hr', 'absences'] });
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    onDone();
  };
  const save = useMutation({
    mutationFn: ({ form, editingId }: { form: Form; editingId: string | null }) =>
      editingId ? api.hrUpdateAbsence(form.personId, editingId, inputOf(form)) : api.hrRegisterAbsence(form.personId, inputOf(form)),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: (a: AbsenceRowDto) => api.hrRemoveAbsence(a.employeeId, a.id), onSuccess: done });
  return { save, remove };
}

function AbsenceForm({ form, set, onReason, onConfig, kinds, people, editingId, onSave, onCancel, isBusy, error }: {
  onConfig: () => void;
  form: Form;
  set: (patch: Partial<Form>) => void;
  onReason: (key: string) => void;
  kinds: readonly AbsenceKindDto[];
  people: readonly EmployeeDto[];
  editingId: string | null;
  onSave: () => void;
  onCancel: () => void;
  isBusy: boolean;
  error: unknown;
}) {
  const kind = kinds.find((k) => k.key === form.reason);
  const errors = error instanceof ApiError ? error.fieldErrors : {};
  const canHalve = form.code === 'P' || form.code === 'KL';
  const isOver = !!kind?.days && form.code === kind.code && !!form.from && !form.isHalf && weekdaysBetween(form.from, form.to || form.from) > kind.days;
  const isLate = form.code === 'M';
  const lengthNow = Number(form.days) || 1;
  const pickFrom = (from: string) => set(from ? { from, to: defaultEnd(from, kind?.key, lengthNow) } : { from, to: '' });
  const pickTo = (to: string) => set(to && form.from ? { to, days: String(weekdaysBetween(form.from, to)) } : { to });
  const typeDays = (days: string) => {
    const n = Number(days);
    set(Number.isInteger(n) && n >= 1 && form.from ? { days, to: lastOfWeekdays(form.from, n) } : { days });
  };
  return (
    <section aria-label={editingId ? 'Sửa' : 'Thêm mới'} className={`ts-card flex flex-col gap-3 p-4 ${editingId ? 'ring-2 ring-blue-400' : ''}`}>
      <h2 className="m-0 flex items-center gap-2 text-lg font-semibold">
        {editingId ? <Pencil className="size-5 text-blue-600" /> : <CalendarPlus className="size-5 text-blue-600" />}
        <span className="flex-1">{editingId ? 'Sửa' : 'Thêm người nghỉ, đi muộn'}</span>
        <button type="button" onClick={onConfig} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium hover:bg-slate-50"><Settings2 className="size-4 text-slate-500" />Cấu hình</button>
      </h2>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PersonField people={people} value={form.personId} isLocked={!!editingId} error={errors.employeeId} onChange={(personId) => set({ personId })} />
        <Field label="Lý do" error={errors.reason}><KindSelect kinds={kinds} value={form.reason} onChange={onReason} /></Field>
        <Field label="Cách tính" error={errors.code}><CountingSelect value={form.code} onChange={(code) => set({ code, isHalf: false })} /></Field>
        <div className={`grid items-start gap-2 ${canHalve ? 'grid-cols-[1fr_auto]' : ''}`}>
          <Field label="Số ngày"><Input aria-label="Số ngày" inputMode="numeric" disabled={form.isHalf} value={form.isHalf ? '0,5' : form.days} onChange={(e) => typeDays(e.target.value)} /></Field>
          {canHalve && (
            <label className="flex flex-col gap-1.5 text-sm font-medium whitespace-nowrap">
              Nửa ngày
              <span className="ts-field flex items-center justify-center"><input type="checkbox" aria-label="Nửa ngày" checked={form.isHalf} onChange={(e) => set({ isHalf: e.target.checked, to: e.target.checked ? form.from : form.to })} className="size-4 accent-blue-600" /></span>
            </label>
          )}
        </div>
        <DateField label="Từ ngày" value={form.from} error={errors.from} onChange={pickFrom} />
        <DateField label="Đến ngày" value={form.to} error={errors.to} onChange={pickTo} />
        {!isLate && <ApproverField value={form.approvedBy} error={errors.approvedBy} onChange={(approvedBy) => set({ approvedBy })} />}
        {!isLate && <Field label="Bàn giao" error={errors.handover}><Input aria-label="Bàn giao" value={form.handover} placeholder="vd: Bình nhận việc khách A" onChange={(e) => set({ handover: e.target.value })} /></Field>}
        <div className={isLate ? 'md:col-span-2 xl:col-span-2' : 'md:col-span-2 xl:col-span-4'}>
          <Field label="Ghi chú" error={errors.note}><Input aria-label="Ghi chú" value={form.note} placeholder={isLate ? 'vd: Muộn 1 tiếng, kẹt xe' : 'vd: Nhà có việc'} onChange={(e) => set({ note: e.target.value })} /></Field>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StateHint code={form.code} approvedBy={form.approvedBy} />
        <span className="ml-auto flex gap-2">
          {editingId && <button type="button" onClick={onCancel} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50"><X className="size-4" />Huỷ sửa</button>}
          <button type="button" disabled={!form.personId || !form.from || isBusy} onClick={onSave} className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="size-4" />{editingId ? 'Lưu thay đổi' : 'Lưu'}</button>
        </span>
      </div>
      {isOver && <p role="status" className="m-0 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" />{kind?.isOwn ? `Quy định ${kind.days} ngày.` : `Luật cho ${kind?.days} ngày có chế độ này.`} Phần vượt do công ty quyết.</p>}
      {!!error && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
    </section>
  );
}

/** One place for whoever is away or late: who, when, why, who approved, who took over the work. */
export function LeaveTab() {
  const people = useEmployees();
  const kinds = useQuery({ queryKey: ['hr', 'absence-kinds'], queryFn: () => api.hrAbsenceKinds() });
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const firstKind = kinds.data?.[0];
  const current = form ?? emptyForm(firstKind);
  const reset = () => {
    setForm(null);
    setEditingId(null);
  };
  const { save, remove } = useLeaveActions(reset);
  const wanted = params.get('nv');
  const [prefilled, setPrefilled] = useState('');
  useEffect(() => {
    if (!wanted) return;
    setPrefilled(wanted);
    setParams({}, { replace: true });
  }, [wanted, setParams]);
  if (people.isPending || kinds.isPending) return <TabSkeleton />;
  if (people.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => people.refetch()} message={errorMessage(people.error)} /></div>;
  if (kinds.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => kinds.refetch()} message={errorMessage(kinds.error)} /></div>;
  const shown = form ?? { ...current, personId: prefilled };
  return (
    <div className="flex flex-col gap-3">
      <AbsenceForm
        form={shown}
        set={(patch) => setForm({ ...shown, ...patch })}
        onReason={(key) => setForm(withReason(shown, kinds.data.find((k) => k.key === key)))}
        onConfig={() => setParams({ [CONFIG_PARAM]: '1' })}
        kinds={kinds.data}
        people={people.data}
        editingId={editingId}
        isBusy={save.isPending}
        error={save.error}
        onSave={() => save.mutate({ form: shown, editingId })}
        onCancel={() => { save.reset(); reset(); }}
      />
      <AbsenceTable
        editingId={editingId}
        isRemoving={remove.isPending}
        removeError={remove.error}
        onRemove={(a) => remove.mutate(a)}
        onEdit={(a) => {
          save.reset();
          setEditingId(a.id);
          setForm(formOf(a));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
      <LeaveConfigDrawer open={params.has(CONFIG_PARAM)} kinds={kinds.data} onClose={() => setParams({}, { replace: true })} />
    </div>
  );
}
