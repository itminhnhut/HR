import { holidaysInEffect, SHEET_APPROVER, todayInVietnam, workingDayCheck, type AbsenceInput, type AbsenceKindDto, type AbsenceRowDto, type EmployeeDto, type TimesheetAbsenceDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarPlus, Check, CheckCircle2, Clock, Pencil, Settings2, Users, X } from 'lucide-react';
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
import { justAdded, PapersButton, PapersDialog, paperTargetOf, usePaperTarget, type PaperTarget } from './AbsencePapers';
import { AbsenceTable } from './AbsenceTable';
import { DateField } from './DateField';
import { awayNotices, awayWords } from './departmentAway';
import { LeaveBalanceHint } from './LeaveBalanceHint';
import { Field } from './dialogs';
import { defaultEnd, lastOfWorkdays, typedDaysWithin, typedNotice, workdaysBetween, type IsWorked } from './leaveDates';
import { PersonField } from './PersonField';
import { sheetLineForm, type SheetLine } from './sheetLineForm';
import { useEmployees, useHolidays, useRegions } from './queries';
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
  /** "Sửa" on a line typed on the sheet: saving registers an absence that takes these days over. */
  replaces?: SheetLine;
}

/** Everything a reason suggests. HR can change any of it on the line. */
function withReason(form: Form, kind: AbsenceKindDto | undefined, isWorked: IsWorked): Form {
  const days = kind?.days ?? 1;
  const to = form.from ? defaultEnd(form.from, kind?.key, days, isWorked) : '';
  return {
    ...form,
    reason: kind?.key ?? form.reason,
    code: (kind?.code ?? form.code) as Counting,
    isHalf: false,
    to,
    days: form.from ? String(workdaysBetween(form.from, to, isWorked)) : String(days),
  };
}

const emptyForm = (kind: AbsenceKindDto | undefined, isWorked: IsWorked): Form =>
  // HR approves by default; cleared, the line waits for someone to approve it.
  withReason({ personId: '', reason: 'annual', code: 'P', from: todayInVietnam(), to: '', days: '1', isHalf: false, approvedBy: SHEET_APPROVER, handover: '', note: '' }, kind, isWorked);

const formOf = (a: AbsenceRowDto, isWorked: IsWorked): Form => ({
  personId: a.employeeId,
  reason: a.reason,
  code: a.code.replace('/2', '') as Counting,
  from: a.from,
  to: a.to,
  days: a.code.endsWith('/2') ? '1' : String(workdaysBetween(a.from, a.to, isWorked)),
  isHalf: a.code.endsWith('/2'),
  approvedBy: a.approvedBy ?? '',
  handover: a.handover,
  note: a.note,
});

/** Being late needs no approval: no approver goes with it, whatever the field held before. */
const inputOf = (f: Form): AbsenceInput => ({ reason: f.reason, code: f.code, from: f.from, to: f.to || f.from, isHalf: f.isHalf, approvedBy: f.code === 'M' ? '' : f.approvedBy, handover: f.handover, note: f.note, ...(f.replaces ? { replacesSheet: f.replaces } : {}) });

/** The form for "Sửa" on any line: a registered one as it is, a typed one read as the absence it stands for. */
function formFor(a: AbsenceRowDto, isWorked: IsWorked): Form | null {
  if (a.source !== 'sheet') return formOf(a, isWorked);
  const typed = sheetLineForm(a);
  return typed && { ...typed, days: typed.isHalf ? '1' : String(workdaysBetween(a.from, a.to, isWorked)) };
}

const CONFIG_PARAM = 'cau-hinh';

function StateHint({ code, approvedBy }: { code: string; approvedBy: string }) {
  if (code === 'M') return <span className="inline-flex items-center gap-1.5 text-sm text-amber-800"><Clock className="size-4" />Không cần duyệt, lưu là chấm M</span>;
  if (approvedBy.trim()) return <span className="inline-flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="size-4" />Đã duyệt, tự chấm vào bảng công</span>;
  return null;
}

/** `onAdded` gets what the register call gives back: the person's absences, the new one among them. */
function useLeaveActions(onDone: () => void, onAdded: (list: TimesheetAbsenceDto[], form: Form) => void) {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['hr', 'absences'] });
    void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
    onDone();
  };
  const save = useMutation({
    mutationFn: ({ form, editingId }: { form: Form; editingId: string | null }) =>
      editingId && !form.replaces ? api.hrUpdateAbsence(form.personId, editingId, inputOf(form)) : api.hrRegisterAbsence(form.personId, inputOf(form)),
    // A new absence, or a typed line taken over, may ask for papers: their dialog opens for it.
    onSuccess: (list, { form, editingId }) => {
      if (!editingId || form.replaces) onAdded(list, form);
      done();
    },
  });
  const remove = useMutation({
    mutationFn: async (a: AbsenceRowDto): Promise<void> => {
      if (a.source === 'sheet') await api.hrRemoveSheetLeave(a.employeeId, { code: a.code, from: a.from, to: a.to });
      else await api.hrRemoveAbsence(a.employeeId, a.id);
    },
    onSuccess: done,
  });
  return { save, remove };
}

/** Others of the same department away on the chosen days: a warning only. */
function AwayList({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <div role="status" aria-label="Cùng bộ phận đang nghỉ" className="flex flex-col gap-1 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
      {lines.map((line) => <p key={line} className="m-0 flex items-start gap-2"><Users className="mt-0.5 size-4 shrink-0" />{line}</p>)}
    </div>
  );
}

const AWAY_SHOWN = 5;

function AbsenceForm({ form, set, onReason, onConfig, kinds, people, isWorked, notice, away, editingId, papers, onSave, onCancel, isBusy, error }: {
  onConfig: () => void;
  /** Others of the same department already away on those days (departmentAway). */
  away: readonly string[];
  /** What saving will do with days HR typed on the sheet inside the dates (typedNotice). */
  notice: string | null;
  /** The Giấy tờ button of the line being edited. */
  papers: React.ReactNode;
  /** The working days of the chosen person's region, as the sheet will fill them. */
  isWorked: IsWorked;
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
  const isOver = !!kind?.days && form.code === kind.code && !!form.from && !form.isHalf && workdaysBetween(form.from, form.to || form.from, isWorked) > kind.days;
  const isLate = form.code === 'M';
  const lengthNow = Number(form.days) || 1;
  const pickFrom = (from: string) => set(from ? { from, to: defaultEnd(from, kind?.key, lengthNow, isWorked) } : { from, to: '' });
  const pickTo = (to: string) => set(to && form.from ? { to, days: String(workdaysBetween(form.from, to, isWorked)) } : { to });
  const typeDays = (days: string) => {
    const n = Number(days);
    set(Number.isInteger(n) && n >= 1 && form.from ? { days, to: lastOfWorkdays(form.from, n, isWorked) } : { days });
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
        <span className="ml-auto flex flex-wrap justify-end gap-2">
          {editingId && papers}
          {editingId && <button type="button" onClick={onCancel} className="ts-field inline-flex items-center gap-2 rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50"><X className="size-4" />Huỷ sửa</button>}
          <button type="button" disabled={!form.personId || !form.from || isBusy} onClick={onSave} className="ts-field inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50"><Check className="size-4" />{editingId ? 'Lưu thay đổi' : 'Lưu'}</button>
        </span>
      </div>
      {!editingId && <LeaveBalanceHint personId={form.personId} from={form.from} to={form.isHalf ? form.from : form.to || form.from} code={form.isHalf ? `${form.code}/2` : form.code} />}
      <AwayList lines={away} />
      {notice && <p role="status" className="m-0 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" />{notice}</p>}
      {isOver && <p role="status" className="m-0 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle className="size-4 shrink-0" />{kind?.isOwn ? `Quy định ${kind.days} ngày.` : `Luật cho ${kind?.days} ngày có chế độ này.`} Phần vượt do công ty quyết.</p>}
      {!!error && Object.keys(errors).length === 0 && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(error)}</p>}
    </section>
  );
}

/** One place for whoever is away or late: who, when, why, who approved, who took over the work. */
export function LeaveTab() {
  const people = useEmployees();
  const kinds = useQuery({ queryKey: ['hr', 'absence-kinds'], queryFn: () => api.hrAbsenceKinds() });
  const regions = useRegions();
  const holidays = useHolidays();
  const holidayDays = new Set(holidaysInEffect(holidays.data ?? []).map((h) => h.day));
  /** As the sheet fills it: maternity leave (TS) runs through holidays, everything else leaves them NL. */
  const isWorkedFor = (personId: string, code: string) =>
    workingDayCheck(regions.data?.find((r) => r.id === people.data?.find((p) => p.id === personId)?.regionId), code === 'TS' ? new Set() : holidayDays);
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<PaperTarget | null>(null);
  const editingId = editing?.absenceId ?? null;
  const [papers, setPapers] = usePaperTarget();
  const firstKind = kinds.data?.[0];
  const current = form ?? emptyForm(firstKind, isWorkedFor('', 'P'));
  // The typed lines of the years the dates touch, shared with the list below.
  const yearOf = (day: string) => Number(day.slice(0, 4)) || Number(todayInVietnam().slice(0, 4));
  const listFrom = useQuery({ queryKey: ['hr', 'absences', yearOf(current.from)], queryFn: () => api.hrAllAbsences(yearOf(current.from)) });
  const listTo = useQuery({ queryKey: ['hr', 'absences', yearOf(current.to || current.from)], queryFn: () => api.hrAllAbsences(yearOf(current.to || current.from)) });
  const reset = () => {
    setForm(null);
    setEditing(null);
  };
  /** Papers usually come with the request: a new line whose reason asks for them opens Giấy tờ at once. */
  const { save, remove } = useLeaveActions(reset, (list, saved) => {
    const added = justAdded(list, saved);
    if (added?.needsPaper) setPapers(paperTargetOf(added));
  });
  const wanted = params.get('nv');
  const [prefilled, setPrefilled] = useState('');
  useEffect(() => {
    if (!wanted) return;
    setPrefilled(wanted);
    setParams({}, { replace: true });
  }, [wanted, setParams]);
  if (people.isPending || kinds.isPending || regions.isPending || holidays.isPending) return <TabSkeleton />;
  if (regions.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => regions.refetch()} message={errorMessage(regions.error)} /></div>;
  if (holidays.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => holidays.refetch()} message={errorMessage(holidays.error)} /></div>;
  if (people.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => people.refetch()} message={errorMessage(people.error)} /></div>;
  if (kinds.isError) return <div className="ts-site-tokens"><ErrorState onRetry={() => kinds.refetch()} message={errorMessage(kinds.error)} /></div>;
  const shown = form ?? { ...current, personId: prefilled };
  const isWorked = isWorkedFor(shown.personId, shown.code);
  const lines = [...(listFrom.data ?? []), ...(listTo.data !== listFrom.data ? listTo.data ?? [] : [])];
  const end = shown.to || shown.from;
  const typed = shown.personId && shown.from ? typedDaysWithin(lines, shown.personId, shown.from, end, shown.replaces) : [];
  const notice = typedNotice(typed, shown.isHalf ? `${shown.code}/2` : shown.code, shown.isHalf ? 1 : workdaysBetween(shown.from, end, isWorked), isWorked);
  const away = shown.personId && shown.code !== 'M' ? awayNotices({ rows: lines, people: people.data, chosenIds: [shown.personId], from: shown.from, to: end, ignoreId: editingId }).map(awayWords) : [];
  const awayShown = away.length > AWAY_SHOWN ? [...away.slice(0, AWAY_SHOWN), `và ${away.length - AWAY_SHOWN} ngày khác`] : away;
  /** Another person may work other Saturdays: the same number of days can end on another date. */
  const pickPerson = (personId: string) => {
    const n = Number(shown.days);
    const keepsLength = !!shown.from && !shown.isHalf && Number.isInteger(n) && n >= 1 && shown.reason !== 'maternity';
    setForm({ ...shown, personId, ...(keepsLength ? { to: lastOfWorkdays(shown.from, n, isWorkedFor(personId, shown.code)) } : {}) });
  };
  return (
    <div className="flex flex-col gap-3">
      <AbsenceForm
        form={shown}
        set={(patch) => (patch.personId !== undefined && patch.personId !== shown.personId ? pickPerson(patch.personId) : setForm({ ...shown, ...patch }))}
        onReason={(key) => {
          const kind = kinds.data.find((k) => k.key === key);
          setForm(withReason(shown, kind, isWorkedFor(shown.personId, kind?.code ?? shown.code)));
        }}
        isWorked={isWorked}
        notice={notice}
        away={awayShown}
        onConfig={() => setParams({ [CONFIG_PARAM]: '1' })}
        kinds={kinds.data}
        people={people.data}
        editingId={editingId}
        papers={editing && !shown.replaces && <PapersButton target={editing} onOpen={() => setPapers(editing)} />}
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
        onPapers={setPapers}
        onEdit={(a) => {
          save.reset();
          setEditing(paperTargetOf(a));
          setForm(formFor(a, isWorkedFor(a.employeeId, a.code.replace('/2', ''))));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
      <PapersDialog target={papers} onClose={() => setPapers(null)} />
      <LeaveConfigDrawer open={params.has(CONFIG_PARAM)} kinds={kinds.data} onClose={() => setParams({}, { replace: true })} />
    </div>
  );
}
