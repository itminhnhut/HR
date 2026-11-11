import {
  PAYROLL_INSURANCE_PAID,
  PAYROLL_RECURRING_KINDS,
  type PayrollCommitmentDto,
  type PayrollDependantDto,
  type PayrollProfileDto,
  type PayrollRecurringDto,
  type PayrollRecurringKind,
} from '@careers/shared';
import { FileSignature, HandCoins, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, type PayrollFactKind } from '../../../../api';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { DateField } from '../../timesheet/DateField';
import { ConfirmDialog } from '../../timesheet/dialogs';
import { TaxableChoice } from './BulkFacts';
import { commitmentDraft, dependantDraft, monthWords, recurringDraft, showDay } from './profileModel';
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
import { fieldErrorsOf, useProfileSave } from './profileQueries';

/** Người phụ thuộc (L-B18–L-B20), cam kết thuế (L-B21), khoản (32) định kỳ (câu 4): add, change, delete each. */

type Row = { id: string };
const range = (from: string, to: string | null) =>
  to ? `${monthWords(from)} – ${monthWords(to)}` : `Từ ${monthWords(from)}`;
const KIND_LABEL: Record<PayrollRecurringKind, string> = {
  support: 'Hỗ trợ',
  refund: 'Hoàn ứng',
  advance: 'Tạm ứng',
  'insurance-paid': 'Công ty trả thay BH',
};
const isPaidBack = (r: { kind: PayrollRecurringKind }) => r.kind === PAYROLL_INSURANCE_PAID;
/** What a (32) item pays: a typed amount, or the month's employee insurance, computed. */
const recurringText = (r: PayrollRecurringDto) =>
  isPaidBack(r) ? `${KIND_LABEL[r.kind]} · tự tính = (28) + (29) + (30)` : `${KIND_LABEL[r.kind]} ${money(r.amount)}`;
const recurringSub = (r: PayrollRecurringDto) =>
  [range(r.fromMonth, r.toMonth), isPaidBack(r) ? (r.taxable ? 'tính thuế' : 'chưa tính thuế') : '', r.note]
    .filter(Boolean)
    .join(' · ');
const SELECT = 'ts-field h-9 w-full min-w-0 rounded-md border bg-white px-2 text-sm font-normal';

/** Which row is open in the form ('new' for an added one) and which one waits for "Xoá?". */
function useRows<T extends Row>(employeeId: string, kind: PayrollFactKind, what: string, startAdding = false) {
  const [editing, setEditing] = useState<T | 'new' | null>(startAdding ? 'new' : null);
  const [removing, setRemoving] = useState<T | null>(null);
  const remove = useProfileSave(
    employeeId,
    (row: T) => api.hrPayrollDeleteFact(employeeId, kind, row.id),
    () => `Đã xoá ${what}.`,
  );
  const confirm = (title: string) => (
    <ConfirmDialog
      open={removing !== null}
      title={title}
      isBusy={remove.isPending}
      onCancel={() => setRemoving(null)}
      onConfirm={() => {
        if (removing)
          remove.mutate(removing, { onSettled: () => setRemoving(null), onError: (e) => toast.error(e.message) });
      }}
    />
  );
  return { editing, setEditing, removing, setRemoving, confirm, close: () => setEditing(null) };
}

function DependantForm({
  employeeId,
  row,
  start,
  onDone,
}: {
  employeeId: string;
  row: PayrollDependantDto | null;
  start: ReturnType<typeof dependantDraft>;
  onDone: () => void;
}) {
  const [d, setD] = useState(start);
  const save = useProfileSave(
    employeeId,
    () => api.hrPayrollSaveDependant(employeeId, row?.id ?? null, { ...d, toMonth: d.toMonth || null }),
    (saved) => {
      onDone();
      return `Đã lưu ${saved.count} người phụ thuộc ${range(saved.fromMonth, saved.toMonth).toLowerCase()}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  return (
    <EntryForm
      label={row ? 'Sửa người phụ thuộc' : 'Thêm người phụ thuộc'}
      isBusy={save.isPending}
      error={save.error}
      onSave={() => save.mutate(undefined)}
      onCancel={onDone}
    >
      <ProfileField label="Từ tháng" error={errors.fromMonth} source="manual">
        <MonthInput label="Từ tháng" value={d.fromMonth} onChange={(fromMonth) => setD({ ...d, fromMonth })} />
      </ProfileField>
      <ProfileField label="Đến tháng" error={errors.toMonth} hint="Để trống: còn tiếp, tự chuyển sang tháng sau.">
        <MonthInput label="Đến tháng" value={d.toMonth} onChange={(toMonth) => setD({ ...d, toMonth })} />
      </ProfileField>
      <ProfileField label="Số người" error={errors.count} source="manual">
        <NumberInput label="Số người" value={d.count} onChange={(count) => setD({ ...d, count: count ?? 0 })} />
      </ProfileField>
    </EntryForm>
  );
}

export function DependantsSection({
  profile,
  month,
  startAdding = false,
}: {
  profile: PayrollProfileDto;
  month: string;
  /** Opened from a "–" in the list: the add form is already there. */
  startAdding?: boolean;
}) {
  const id = profile.person.employeeId;
  const s = useRows<PayrollDependantDto>(id, 'dependants', 'người phụ thuộc', startAdding);
  const rows = profile.dependants;
  return (
    <Section
      id="ho-so-npt"
      icon={Users}
      title="Người phụ thuộc"
      hint="Trừ theo tháng có ngày chi trả."
      onAdd={s.editing ? undefined : () => s.setEditing('new')}
    >
      {s.editing && (
        <DependantForm
          key={s.editing === 'new' ? 'new' : s.editing.id}
          employeeId={id}
          row={s.editing === 'new' ? null : s.editing}
          start={s.editing === 'new' ? dependantDraft(rows, month) : { ...s.editing, toMonth: s.editing.toMonth ?? '' }}
          onDone={s.close}
        />
      )}
      {rows.length === 0 && !s.editing && <Empty>Không có người phụ thuộc.</Empty>}
      <ul className="m-0 list-none p-0">
        {rows.map((r) => (
          <ItemRow
            key={r.id}
            label={`người phụ thuộc ${range(r.fromMonth, r.toMonth)}`}
            text={`${r.count} người`}
            sub={range(r.fromMonth, r.toMonth)}
            onEdit={() => s.setEditing(r)}
            onDelete={() => s.setRemoving(r)}
          />
        ))}
      </ul>
      {s.confirm('Xoá dòng người phụ thuộc này?')}
    </Section>
  );
}

function CommitmentForm({
  employeeId,
  row,
  start,
  onDone,
}: {
  employeeId: string;
  row: PayrollCommitmentDto | null;
  start: { year: number; signedOn: string };
  onDone: () => void;
}) {
  const [d, setD] = useState(start);
  const save = useProfileSave(
    employeeId,
    () => api.hrPayrollSaveCommitment(employeeId, row?.id ?? null, d),
    (saved) => {
      onDone();
      return `Đã lưu cam kết năm ${saved.year}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  return (
    <EntryForm
      label={row ? 'Sửa cam kết' : 'Thêm cam kết'}
      isBusy={save.isPending}
      error={save.error}
      onSave={() => save.mutate(undefined)}
      onCancel={onDone}
    >
      <ProfileField label="Năm thuế" error={errors.year} source="auto">
        <NumberInput label="Năm thuế" value={d.year} onChange={(year) => setD({ ...d, year: year ?? 0 })} />
      </ProfileField>
      <DateField
        label="Ngày ký (HR nhập)"
        value={d.signedOn}
        error={errors.signedOn}
        onChange={(signedOn) => setD({ ...d, signedOn })}
      />
    </EntryForm>
  );
}

export function CommitmentsSection({
  profile,
  today,
  startAdding = false,
}: {
  profile: PayrollProfileDto;
  today: string;
  startAdding?: boolean;
}) {
  const id = profile.person.employeeId;
  const s = useRows<PayrollCommitmentDto>(id, 'commitments', 'cam kết', startAdding);
  const rows = [...profile.commitments].sort((a, b) => b.year - a.year);
  return (
    <Section
      id="ho-so-cam-ket"
      icon={FileSignature}
      title="Cam kết thuế (mẫu 08)"
      hint="Cam kết ký riêng: áp từ lần chi sau ngày ký, hết hạn cuối năm. HĐ thử việc đã kèm cam kết trong hợp đồng."
      onAdd={s.editing ? undefined : () => s.setEditing('new')}
    >
      {s.editing && (
        <CommitmentForm
          key={s.editing === 'new' ? 'new' : s.editing.id}
          employeeId={id}
          row={s.editing === 'new' ? null : s.editing}
          start={s.editing === 'new' ? commitmentDraft(rows, today) : s.editing}
          onDone={s.close}
        />
      )}
      {rows.length === 0 && !s.editing && (
        <Empty>
          Chưa có cam kết ký riêng. HĐ thử việc mặc định kèm cam kết trong hợp đồng nên không khấu trừ 10%; tắt mục "Cam
          kết thuế kèm hợp đồng" (Cấu hình, Loại HĐ) cho ai thì người đó cần cam kết ở đây.
        </Empty>
      )}
      <ul className="m-0 list-none p-0">
        {rows.map((r) => (
          <ItemRow
            key={r.id}
            label={`cam kết năm ${r.year}`}
            text={`Năm ${r.year}`}
            sub={`Ký ${showDay(r.signedOn)}`}
            onEdit={() => s.setEditing(r)}
            onDelete={() => s.setRemoving(r)}
          />
        ))}
      </ul>
      {s.confirm('Xoá cam kết này?')}
    </Section>
  );
}

type RecurringDraft = ReturnType<typeof recurringDraft>;

function RecurringForm({
  employeeId,
  row,
  start,
  onDone,
}: {
  employeeId: string;
  row: PayrollRecurringDto | null;
  start: RecurringDraft;
  onDone: () => void;
}) {
  const [d, setD] = useState<RecurringDraft>(start);
  const save = useProfileSave(
    employeeId,
    () => api.hrPayrollSaveRecurring(employeeId, row?.id ?? null, { ...d, toMonth: d.toMonth || null }),
    (saved) => {
      onDone();
      return `Đã lưu ${recurringText(saved).toLowerCase()}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  return (
    <EntryForm
      label={row ? 'Sửa khoản (32)' : 'Thêm khoản (32)'}
      isBusy={save.isPending}
      error={save.error}
      onSave={() => save.mutate(undefined)}
      onCancel={onDone}
    >
      <ProfileField label="Loại" error={errors.kind}>
        <select
          aria-label="Loại"
          value={d.kind}
          onChange={(e) => setD({ ...d, kind: PAYROLL_RECURRING_KINDS.find((k) => k === e.target.value) ?? 'support' })}
          className={SELECT}
        >
          {PAYROLL_RECURRING_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </ProfileField>
      {isPaidBack(d) ? (
        <ProfileField label="Số tiền mỗi tháng" source="auto" hint="= (28) + (29) + (30) của tháng, không gõ.">
          <span className="ts-field flex items-center rounded-md border bg-slate-100 px-2.5 text-sm font-normal">
            BH người lao động đóng
          </span>
        </ProfileField>
      ) : (
        <ProfileField label="Số tiền mỗi tháng" error={errors.amount} source="manual">
          <MoneyInput label="Số tiền mỗi tháng" value={d.amount} onChange={(amount) => setD({ ...d, amount })} />
        </ProfileField>
      )}
      <ProfileField label="Từ tháng" error={errors.fromMonth}>
        <MonthInput label="Từ tháng" value={d.fromMonth} onChange={(fromMonth) => setD({ ...d, fromMonth })} />
      </ProfileField>
      <ProfileField label="Đến tháng" error={errors.toMonth} hint="Để trống: hằng tháng tới khi dừng.">
        <MonthInput label="Đến tháng" value={d.toMonth} onChange={(toMonth) => setD({ ...d, toMonth })} />
      </ProfileField>
      {isPaidBack(d) && <TaxableChoice isTaxable={d.taxable} onChange={(taxable) => setD({ ...d, taxable })} />}
      <ProfileField label="Ghi chú" error={errors.note} isWide>
        <Input
          aria-label="Ghi chú"
          value={d.note}
          onChange={(e) => setD({ ...d, note: e.target.value })}
          className="bg-white"
        />
      </ProfileField>
    </EntryForm>
  );
}

export function RecurringSection({
  profile,
  month,
  startAdding = false,
}: {
  profile: PayrollProfileDto;
  month: string;
  startAdding?: boolean;
}) {
  const id = profile.person.employeeId;
  const s = useRows<PayrollRecurringDto>(id, 'recurring', 'khoản (32)', startAdding);
  const rows = profile.recurring;
  return (
    <Section
      id="ho-so-khoan-32"
      icon={HandCoins}
      title="Khoản (32) định kỳ"
      hint="Hỗ trợ chịu thuế; hoàn ứng, tạm ứng thì không. Công ty trả thay BH: tự tính, chọn có tính thuế hay không."
      onAdd={s.editing ? undefined : () => s.setEditing('new')}
    >
      {s.editing && (
        <RecurringForm
          key={s.editing === 'new' ? 'new' : s.editing.id}
          employeeId={id}
          row={s.editing === 'new' ? null : s.editing}
          start={s.editing === 'new' ? recurringDraft(rows, month) : { ...s.editing, toMonth: s.editing.toMonth ?? '' }}
          onDone={s.close}
        />
      )}
      {rows.length === 0 && !s.editing && <Empty>Không có khoản định kỳ.</Empty>}
      <ul className="m-0 list-none p-0">
        {rows.map((r) => (
          <ItemRow
            key={r.id}
            label={`${KIND_LABEL[r.kind].toLowerCase()} ${range(r.fromMonth, r.toMonth)}`}
            text={recurringText(r)}
            sub={recurringSub(r)}
            onEdit={() => s.setEditing(r)}
            onDelete={() => s.setRemoving(r)}
          />
        ))}
      </ul>
      {s.confirm('Xoá khoản định kỳ này?')}
    </Section>
  );
}
