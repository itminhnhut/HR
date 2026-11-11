import {
  DEFAULT_COMPONENTS,
  type PayrollProfileDto,
  type PayrollProfileVersionDto,
  type PayrollProfileVersionInput,
} from '@careers/shared';
import { Layers } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../../api';
import { DateField } from '../../timesheet/DateField';
import { ConfirmDialog } from '../../timesheet/dialogs';
import { effectiveHint, levelDraft, monthWords, periodStart, showDay, type LevelDraft } from './profileModel';
import {
  Empty,
  EntryForm,
  ItemRow,
  money,
  MoneyInput,
  MonthInput,
  NumberInput,
  ProfileField,
  Section,
} from './profileParts';
import { fieldErrorsOf, usePrefill, useProfileSave } from './profileQueries';

/** Mức từng khoản theo ngày hiệu lực (spec 11.5; L-B01, L-B04–L-B06, L-B11), with contract type, probation, union. */

export interface Catalogue {
  components: readonly { id: string; name: string }[];
  contractTypes: readonly { id: string; name: string; stopped?: boolean }[];
}

const SELECT = 'ts-field h-9 w-full min-w-0 rounded-md border bg-white px-2 text-sm font-normal';
const hasDefault = (id: string) => DEFAULT_COMPONENTS.some((c) => c.id === id && c.defaultAmount > 0);

function inputOf(d: LevelDraft): PayrollProfileVersionInput {
  const amounts = Object.fromEntries(Object.entries(d.amounts).filter(([, v]) => v > 0));
  const when = d.mode === 'day' ? { effectiveOn: d.effectiveOn } : { fromMonth: d.fromMonth };
  const { contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount } = d;
  return { ...when, contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount, amounts };
}

function draftOfLevel(v: PayrollProfileVersionDto): LevelDraft {
  const { contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount, amounts } = v;
  const base = { contractTypeId, probationDays, managesBusiness, unionMember, kpiAmount, amounts: { ...amounts } };
  return { ...base, mode: 'day', effectiveOn: v.effectiveOn, fromMonth: '' };
}

function WhenField({
  draft,
  set,
  error,
}: {
  draft: LevelDraft;
  set: (patch: Partial<LevelDraft>) => void;
  error?: string;
}) {
  const tab = (mode: LevelDraft['mode'], label: string) => (
    <button
      type="button"
      aria-pressed={draft.mode === mode}
      onClick={() => set({ mode })}
      className={`ts-field flex-1 rounded-md border px-3 text-sm font-medium ${draft.mode === mode ? 'border-blue-600 bg-blue-50 text-blue-700' : 'bg-white'}`}
    >
      {label}
    </button>
  );
  const hint = effectiveHint(draft.mode, draft.mode === 'day' ? draft.effectiveOn : draft.fromMonth);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <div role="group" aria-label="Áp dụng theo" className="flex gap-2">
        {tab('month', 'Từ tháng lương')}
        {tab('day', 'Từ ngày')}
      </div>
      {draft.mode === 'month' ? (
        <ProfileField label="Từ tháng" error={error} hint={hint}>
          <MonthInput label="Từ tháng" value={draft.fromMonth} onChange={(fromMonth) => set({ fromMonth })} />
        </ProfileField>
      ) : (
        <>
          <DateField
            label="Ngày hiệu lực"
            value={draft.effectiveOn}
            error={error}
            onChange={(effectiveOn) => set({ effectiveOn })}
          />
          {hint && <span className="text-xs text-amber-700">{hint}</span>}
        </>
      )}
    </div>
  );
}

function LevelForm(p: {
  employeeId: string;
  editing: PayrollProfileVersionDto | null;
  start: LevelDraft;
  catalogue: Catalogue;
  suggestedOfficialOn: string | null;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<LevelDraft>(p.start);
  const set = (patch: Partial<LevelDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = useProfileSave(
    p.employeeId,
    (input: PayrollProfileVersionInput) => api.hrPayrollSaveLevel(p.employeeId, p.editing?.id ?? null, input),
    (saved) => {
      if (saved.splitsMonth) toast.warning(`${monthWords(saved.splitsMonth)} sẽ tách 2 đoạn.`);
      saved.warnings.forEach((w) => toast.warning(w));
      if (saved.approvedMonthsTouched.length > 0)
        toast.warning(`Chạm tháng đã duyệt: ${saved.approvedMonthsTouched.map(monthWords).join(', ')}.`);
      p.onDone();
      return `Đã lưu mức từ ${showDay(saved.version.effectiveOn)}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  return (
    <EntryForm
      label={p.editing ? 'Sửa mức' : 'Thêm mức'}
      isBusy={save.isPending}
      error={save.error}
      onSave={() => save.mutate(inputOf(draft))}
      onCancel={p.onDone}
    >
      <WhenField draft={draft} set={set} error={errors.effectiveOn ?? errors.fromMonth} />
      <ProfileField label="Loại HĐ" source="auto" error={errors.contractTypeId}>
        <select
          aria-label="Loại HĐ"
          value={draft.contractTypeId}
          onChange={(e) => set({ contractTypeId: e.target.value })}
          className={SELECT}
        >
          {/* A type HR stopped using is offered no more; the one this level already has stays. */}
          {p.catalogue.contractTypes
            .filter((t) => !t.stopped || t.id === draft.contractTypeId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </ProfileField>
      <ProfileField
        label="Số ngày thử việc"
        source="auto"
        error={errors.probationDays}
        hint={
          p.suggestedOfficialOn
            ? `Gợi ý chính thức ${showDay(p.suggestedOfficialOn)}, xác nhận ở Chấm công.`
            : 'Để trống: theo loại HĐ.'
        }
      >
        <NumberInput
          label="Số ngày thử việc"
          value={draft.probationDays}
          onChange={(probationDays) => set({ probationDays })}
        />
      </ProfileField>
      <ProfileField label="KPI 100%" source="manual" error={errors.kpiAmount}>
        <MoneyInput label="KPI 100%" value={draft.kpiAmount} onChange={(kpiAmount) => set({ kpiAmount })} />
      </ProfileField>
      <div className="flex flex-col justify-end gap-1 text-sm">
        <label className="flex min-h-11 items-center gap-2 sm:min-h-9">
          <input
            type="checkbox"
            className="size-5"
            checked={draft.unionMember}
            onChange={(e) => set({ unionMember: e.target.checked })}
          />
          Đoàn viên công đoàn
        </label>
        <label className="flex min-h-11 items-center gap-2 sm:min-h-9">
          <input
            type="checkbox"
            className="size-5"
            checked={draft.managesBusiness}
            onChange={(e) => set({ managesBusiness: e.target.checked })}
          />
          Việc quản lý doanh nghiệp
        </label>
      </div>
      {p.catalogue.components.map((c) => (
        <ProfileField
          key={c.id}
          label={c.name}
          source={hasDefault(c.id) ? 'auto' : 'manual'}
          error={errors[`amounts.${c.id}`]}
        >
          <MoneyInput
            label={c.name}
            value={draft.amounts[c.id] ?? 0}
            onChange={(v) => set({ amounts: { ...draft.amounts, [c.id]: v } })}
          />
        </ProfileField>
      ))}
      {errors.amounts && <p className="m-0 text-xs text-red-600 sm:col-span-2">{errors.amounts}</p>}
    </EntryForm>
  );
}

function levelText(v: PayrollProfileVersionDto, catalogue: Catalogue) {
  const contract = catalogue.contractTypes.find((t) => t.id === v.contractTypeId)?.name ?? v.contractTypeId;
  const amounts = catalogue.components
    .filter((c) => (v.amounts[c.id] ?? 0) > 0)
    .map((c) => `${c.name} ${money(v.amounts[c.id] ?? 0)}`);
  const extra = [v.kpiAmount > 0 ? `KPI 100% ${money(v.kpiAmount)}` : null, v.unionMember ? 'Đoàn viên' : null];
  return {
    title: `Từ ${showDay(v.effectiveOn)} · ${contract}`,
    sub: [...amounts, ...extra].filter(Boolean).join(' · '),
  };
}

/** The level a pay month starts on: the latest one in force on the first day of its period. */
function levelOfMonth(versions: readonly PayrollProfileVersionDto[], month: string | null): string | null {
  if (!month) return null;
  const start = periodStart(month);
  const inForce = versions
    .filter((v) => v.effectiveOn <= start)
    .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn));
  return inForce[0]?.id ?? null;
}

export function LevelSection({
  profile,
  catalogue,
  focusMonth = null,
}: {
  profile: PayrollProfileDto;
  catalogue: Catalogue;
  focusMonth?: string | null;
}) {
  const employeeId = profile.person.employeeId;
  const [editing, setEditing] = useState<PayrollProfileVersionDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<PayrollProfileVersionDto | null>(null);
  const prefill = usePrefill(employeeId, profile.versions.length === 0);
  const remove = useProfileSave(
    employeeId,
    (v: PayrollProfileVersionDto) => api.hrPayrollDeleteLevel(employeeId, v.id),
    (_, v) => `Đã xoá mức từ ${showDay(v.effectiveOn)}.`,
  );
  const isFirst = profile.versions.length === 0;
  const currentId = levelOfMonth(profile.versions, focusMonth);
  const start = editing && editing !== 'new' ? draftOfLevel(editing) : levelDraft(profile, prefill.data);
  return (
    <Section
      id="ho-so-muc"
      icon={Layers}
      title="Mức lương theo ngày hiệu lực"
      hint={
        isFirst
          ? 'Tạo hồ sơ: mức điền sẵn từ Khoản lương và loại HĐ mặc định, từ ngày vào.'
          : 'Thêm mức mới: chép từ mức gần nhất, chỉ sửa khoản thay đổi.'
      }
      onAdd={editing ? undefined : () => setEditing('new')}
      addLabel={isFirst ? 'Tạo hồ sơ' : 'Thêm mức'}
    >
      {editing && (!isFirst || editing !== 'new' || !prefill.isPending) && (
        <LevelForm
          key={editing === 'new' ? 'new' : editing.id}
          employeeId={employeeId}
          editing={editing === 'new' ? null : editing}
          start={start}
          catalogue={catalogue}
          suggestedOfficialOn={prefill.data?.suggestedOfficialOn ?? null}
          onDone={() => setEditing(null)}
        />
      )}
      {isFirst && !editing && <Empty>Chưa có mức lương. Bảng lương tính 0 đồng cho người này tới khi có hồ sơ.</Empty>}
      <ul className="m-0 list-none p-0">
        {[...profile.versions].reverse().map((v) => {
          const t = levelText(v, catalogue);
          return (
            <ItemRow
              key={v.id}
              label={`mức từ ${showDay(v.effectiveOn)}`}
              text={t.title}
              sub={t.sub}
              isCurrent={v.id === currentId}
              extra={
                v.id === currentId && focusMonth ? (
                  <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">
                    {`Áp dụng cho ${monthWords(focusMonth)}`}
                  </span>
                ) : undefined
              }
              onEdit={() => setEditing(v)}
              onDelete={() => setRemoving(v)}
            />
          );
        })}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={`Xoá mức từ ${showDay(removing?.effectiveOn ?? null)}? Mức đã dùng ở tháng duyệt không xoá được.`}
        isBusy={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing)
            remove.mutate(removing, { onSettled: () => setRemoving(null), onError: (e) => toast.error(e.message) });
        }}
      />
    </Section>
  );
}
