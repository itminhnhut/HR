import { BATCH_CODES, periodMonthOf, todayInVietnam, type AbsenceBatchDto, type AbsenceBatchSaveDto, type AbsenceKindDto } from '@careers/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Flag } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../../api';
import { ErrorState } from '../../../ui/feedback';
import { errorMessage } from '../parts';
import type { Counting } from './AbsenceKinds';
import { batchInput, emptyBatchForm, formOfBatch, NO_BATCH_FILTERS, type BatchFilters, type BatchForm } from './companyLeave';
import { CompanyLeaveForm } from './CompanyLeaveForm';
import { CompanyLeaveList } from './CompanyLeaveList';
import { ConfirmDialog } from './dialogs';
import { leaveApi } from './leaveApi';
import { useEmployees, useRegions } from './queries';
import { TabSkeleton } from './skeletons';

const show = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const canCount = (code: string): code is Counting => (BATCH_CODES as readonly string[]).includes(code);
const thisYear = () => Number(todayInVietnam().slice(0, 4));
/** Opens on the period running today; another year, or a batch a link points to, on the whole year. */
const filtersFor = (year: number, hasPick: boolean): BatchFilters => (year === thisYear() && !hasPick ? { ...NO_BATCH_FILTERS, period: periodMonthOf(todayInVietnam()).month } : NO_BATCH_FILTERS);

function HolidayHint() {
  return (
    <p className="m-0 flex items-start gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-600">
      <Flag className="mt-0.5 size-4 shrink-0 text-teal-600" />
      <span>
        Ngày lễ, Tết theo luật đã tự áp cho mọi người, không cần thêm ở đây. Xem ở{' '}
        <Link to="/hr/cham-cong/cau-hinh?muc=ngay-le" className="inline-flex min-h-6 items-center font-medium text-blue-700 underline-offset-2 hover:underline max-md:min-h-11">Cấu hình → Ngày lễ</Link>
      </span>
    </p>
  );
}

function SavedNote({ saved }: { saved: AbsenceBatchSaveDto | null }) {
  if (!saved) return null;
  const left = saved.skipped.map((s) => s.fullName).join(', ');
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
      <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0" />{`Đã lưu "${saved.name}" cho ${saved.employeeIds.length} người.`}</span>
      {left && <span className="text-green-800">{`Bỏ qua ${saved.skipped.length} người không có ngày làm việc trong khoảng này: ${left}.`}</span>}
    </div>
  );
}

function useBatchActions(onSaved: (saved: AbsenceBatchSaveDto) => void, onRemoved: () => void) {
  const qc = useQueryClient();
  const refresh = () => ['absence-batches', 'absences', 'timesheet'].forEach((key) => void qc.invalidateQueries({ queryKey: ['hr', key] }));
  const save = useMutation({
    mutationFn: ({ form, id }: { form: BatchForm; id: string | null }) => (id ? leaveApi.updateBatch(id, batchInput(form)) : leaveApi.createBatch(batchInput(form))),
    onSuccess: (saved) => { refresh(); onSaved(saved); },
  });
  const remove = useMutation({ mutationFn: (b: AbsenceBatchDto) => leaveApi.removeBatch(b.id), onSuccess: () => { refresh(); onRemoved(); } });
  return { save, remove };
}

/** "Nghỉ công ty": a day off for many people at once, beyond public holidays. One record, one absence each. */
export function CompanyLeaveTab() {
  const [params] = useSearchParams();
  const pickedId = params.get('dot');
  const [year, setYear] = useState(() => Number(params.get('nam')) || thisYear());
  const [filters, setFilters] = useState<BatchFilters>(() => filtersFor(year, !!pickedId));
  const [form, setForm] = useState<BatchForm>(() => emptyBatchForm(todayInVietnam()));
  const [editing, setEditing] = useState<AbsenceBatchDto | null>(null);
  const [removing, setRemoving] = useState<AbsenceBatchDto | null>(null);
  const [saved, setSaved] = useState<AbsenceBatchSaveDto | null>(null);
  const people = useEmployees();
  const regions = useRegions();
  const kinds = useQuery({ queryKey: ['hr', 'absence-kinds'], queryFn: () => api.hrAbsenceKinds() });
  const batches = useQuery({ queryKey: ['hr', 'absence-batches', year], queryFn: () => leaveApi.batches(year) });
  const startOver = () => { setForm(emptyBatchForm(todayInVietnam())); setEditing(null); };
  const { save, remove } = useBatchActions((done) => { setSaved(done); startOver(); }, () => setSaved(null));
  if (people.isPending || regions.isPending || kinds.isPending) return <TabSkeleton />;
  const failed = [people, regions, kinds].find((q) => q.isError);
  if (failed) return <div className="ts-site-tokens"><ErrorState onRetry={() => void failed.refetch()} message={errorMessage(failed.error)} /></div>;
  const usable: AbsenceKindDto[] = (kinds.data ?? []).filter((k) => canCount(k.code));
  const change = (patch: Partial<BatchForm>) => { setSaved(null); setForm({ ...form, ...patch }); };
  const pickReason = (key: string) => {
    const kind = usable.find((k) => k.key === key);
    change({ reason: key, ...(kind && canCount(kind.code) ? { code: kind.code } : {}) });
  };
  const edit = (b: AbsenceBatchDto) => { save.reset(); setSaved(null); setEditing(b); setForm(formOfBatch(b)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return (
    <div className="flex flex-col gap-3">
      <HolidayHint />
      <CompanyLeaveForm form={form} isEditing={!!editing} kinds={usable} people={people.data ?? []} regions={regions.data ?? []} isBusy={save.isPending} error={save.error}
        onChange={change} onReason={pickReason} onSave={() => save.mutate({ form, id: editing?.id ?? null })} onCancel={() => { save.reset(); startOver(); }} />
      <SavedNote saved={saved} />
      {batches.isError && <div className="ts-site-tokens"><ErrorState onRetry={() => void batches.refetch()} message={errorMessage(batches.error)} /></div>}
      <CompanyLeaveList year={year} batches={batches.data ?? []} filters={filters} kinds={usable} regions={regions.data ?? []} people={people.data ?? []} editingId={editing?.id ?? null} pickedId={pickedId}
        onYear={(y) => { setYear(y); setFilters({ ...filtersFor(y, false), query: filters.query }); }} onFilters={setFilters} onEdit={edit} onRemove={setRemoving} />
      {!!remove.error && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(remove.error)}</p>}
      <ConfirmDialog open={!!removing} title={`Xoá đợt "${removing?.name ?? ''}" (${removing ? show(removing.from) : ''}${removing && removing.to !== removing.from ? `–${show(removing.to)}` : ''})? Huỷ nghỉ của ${removing?.employeeIds.length ?? 0} người, bảng công về như cũ.`} confirmLabel="Xoá đợt này" isBusy={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) remove.mutate(removing); setRemoving(null); }} />
    </div>
  );
}
