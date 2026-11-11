import type { PayrollBankAccountDto, PayrollBankInput, PayrollOpeningDto, PayrollProfileDto } from '@careers/shared';
import { Eye, EyeOff, Landmark, PiggyBank } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, type PayrollOpeningInput } from '../../../../api';
import { Input } from '../../../../vendor/shadcn-grid/components/ui/input';
import { DateField } from '../../timesheet/DateField';
import { ConfirmDialog } from '../../timesheet/dialogs';
import { errorMessage } from '../../parts';
import { showDay } from './profileModel';
import {
  Empty,
  EntryForm,
  ItemRow,
  money,
  MoneyInput,
  NumberInput,
  OUTLINE_BUTTON,
  ProfileField,
  Section,
} from './profileParts';
import { fieldErrorsOf, useProfileSave } from './profileQueries';

/** Số dư đầu năm thuế (câu 34, L-E07) and the bank account (L-B24): last four digits, "Hiện đủ" is logged. */

const ZERO: PayrollOpeningInput = {
  taxableIncome: 0,
  taxWithheld: 0,
  overtimeHours: 0,
  clothingPaid: 0,
  monthsPaid: 0,
};

function OpeningForm({
  employeeId,
  start,
  isNew,
  onDone,
}: {
  employeeId: string;
  start: PayrollOpeningDto;
  isNew: boolean;
  onDone: () => void;
}) {
  const [d, setD] = useState<PayrollOpeningDto>(start);
  const set = (patch: Partial<PayrollOpeningDto>) => setD((x) => ({ ...x, ...patch }));
  const save = useProfileSave(
    employeeId,
    ({ taxYear, ...input }: PayrollOpeningDto) => api.hrPayrollSaveOpening(employeeId, taxYear, input),
    (saved) => {
      onDone();
      return `Đã lưu số dư đầu năm ${saved.taxYear}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  return (
    <EntryForm
      label={isNew ? 'Thêm số dư đầu năm' : 'Sửa số dư đầu năm'}
      isBusy={save.isPending}
      error={save.error}
      onSave={() => save.mutate(d)}
      onCancel={onDone}
    >
      <ProfileField label="Năm thuế" error={errors.taxYear} source="auto">
        {isNew ? (
          <NumberInput label="Năm thuế" value={d.taxYear} onChange={(taxYear) => set({ taxYear: taxYear ?? 0 })} />
        ) : (
          <span className="ts-field flex items-center px-1 font-normal">{d.taxYear}</span>
        )}
      </ProfileField>
      <ProfileField label="Thu nhập chịu thuế" error={errors.taxableIncome} source="manual">
        <MoneyInput
          label="Thu nhập chịu thuế"
          value={d.taxableIncome}
          onChange={(taxableIncome) => set({ taxableIncome })}
        />
      </ProfileField>
      <ProfileField label="Thuế đã khấu trừ" error={errors.taxWithheld} source="manual">
        <MoneyInput label="Thuế đã khấu trừ" value={d.taxWithheld} onChange={(taxWithheld) => set({ taxWithheld })} />
      </ProfileField>
      <ProfileField label="Trang phục đã trả" error={errors.clothingPaid} source="manual">
        <MoneyInput
          label="Trang phục đã trả"
          value={d.clothingPaid}
          onChange={(clothingPaid) => set({ clothingPaid })}
        />
      </ProfileField>
      <ProfileField label="Giờ làm thêm trong năm" error={errors.overtimeHours} source="manual">
        <NumberInput
          label="Giờ làm thêm trong năm"
          step={0.5}
          value={d.overtimeHours}
          onChange={(v) => set({ overtimeHours: v ?? 0 })}
        />
      </ProfileField>
      <ProfileField label="Số tháng đã trả" error={errors.monthsPaid} source="manual">
        <NumberInput label="Số tháng đã trả" value={d.monthsPaid} onChange={(v) => set({ monthsPaid: v ?? 0 })} />
      </ProfileField>
    </EntryForm>
  );
}

const openingText = (o: PayrollOpeningDto) =>
  [
    `Thu nhập chịu thuế ${money(o.taxableIncome)}`,
    `thuế ${money(o.taxWithheld)}`,
    `trang phục ${money(o.clothingPaid)}`,
    `${o.overtimeHours} giờ làm thêm`,
    `${o.monthsPaid} tháng`,
  ].join(' · ');

export function OpeningSection({ profile, today }: { profile: PayrollProfileDto; today: string }) {
  const id = profile.person.employeeId;
  const [editing, setEditing] = useState<PayrollOpeningDto | 'new' | null>(null);
  const [removing, setRemoving] = useState<PayrollOpeningDto | null>(null);
  const remove = useProfileSave(
    id,
    (o: PayrollOpeningDto) => api.hrPayrollDeleteOpening(id, o.taxYear),
    (_, o) => `Đã xoá số dư đầu năm ${o.taxYear}.`,
  );
  const rows = [...profile.openings].sort((a, b) => b.taxYear - a.taxYear);
  const year = Number(today.slice(0, 4));
  const newYear = rows.some((r) => r.taxYear === year) ? Math.max(...rows.map((r) => r.taxYear)) + 1 : year;
  return (
    <Section
      id="ho-so-so-du"
      icon={PiggyBank}
      title="Số dư đầu năm thuế"
      hint="Các lần chi trong năm thuế trước lần đầu trên web, theo ngày chi."
      onAdd={editing ? undefined : () => setEditing('new')}
    >
      {editing && (
        <OpeningForm
          key={editing === 'new' ? 'new' : editing.taxYear}
          employeeId={id}
          isNew={editing === 'new'}
          start={editing === 'new' ? { taxYear: newYear, ...ZERO } : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {rows.length === 0 && !editing && <Empty>Chưa nhập: tính như 0.</Empty>}
      <ul className="m-0 list-none p-0">
        {rows.map((o) => (
          <ItemRow
            key={o.taxYear}
            label={`số dư năm ${o.taxYear}`}
            text={`Năm ${o.taxYear}`}
            sub={openingText(o)}
            onEdit={() => setEditing(o)}
            onDelete={() => setRemoving(o)}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={`Xoá số dư đầu năm ${removing?.taxYear ?? ''}?`}
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

type BankDraft = { bank: string; accountNumber: string; payslipEmail: string; changedOn: string };

function BankForm({ employeeId, start, onDone }: { employeeId: string; start: BankDraft; onDone: () => void }) {
  const [d, setD] = useState<BankDraft>(start);
  const set = (patch: Partial<BankDraft>) => setD((x) => ({ ...x, ...patch }));
  const save = useProfileSave(
    employeeId,
    (input: PayrollBankInput) => api.hrPayrollAddBank(employeeId, input),
    (saved) => {
      onDone();
      return `Đã lưu tài khoản ••••${saved.last4}.`;
    },
  );
  const errors = fieldErrorsOf(save.error);
  const submit = () => save.mutate({ ...d, payslipEmail: d.payslipEmail.trim() || null });
  return (
    <EntryForm label="Thêm tài khoản" isBusy={save.isPending} error={save.error} onSave={submit} onCancel={onDone}>
      <ProfileField label="Ngân hàng" error={errors.bank} source="manual">
        <Input
          aria-label="Ngân hàng"
          value={d.bank}
          onChange={(e) => set({ bank: e.target.value })}
          className="bg-white"
        />
      </ProfileField>
      <ProfileField
        label="Số tài khoản"
        error={errors.accountNumber}
        source="manual"
        hint="Lưu mã hoá; sau khi lưu chỉ hiện 4 số cuối."
      >
        <Input
          aria-label="Số tài khoản"
          inputMode="numeric"
          autoComplete="off"
          value={d.accountNumber}
          onChange={(e) => set({ accountNumber: e.target.value })}
          className="bg-white tabular-nums"
        />
      </ProfileField>
      <ProfileField label="Email nhận phiếu lương" error={errors.payslipEmail}>
        <Input
          aria-label="Email nhận phiếu lương"
          type="email"
          value={d.payslipEmail}
          onChange={(e) => set({ payslipEmail: e.target.value })}
          className="bg-white"
        />
      </ProfileField>
      <DateField
        label="Từ ngày"
        value={d.changedOn}
        error={errors.changedOn}
        onChange={(changedOn) => set({ changedOn })}
      />
    </EntryForm>
  );
}

function RevealButton({
  employeeId,
  account,
  shown,
  onShown,
}: {
  employeeId: string;
  account: PayrollBankAccountDto;
  shown: string | null;
  onShown: (number: string | null) => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const reveal = async () => {
    setIsBusy(true);
    try {
      const { accountNumber } = await api.hrPayrollRevealBank(employeeId, account.id);
      onShown(accountNumber);
      toast.success('Đã hiện đủ số tài khoản. Lần xem đã ghi vào nhật ký.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };
  return shown ? (
    <button type="button" onClick={() => onShown(null)} className={OUTLINE_BUTTON}>
      <EyeOff className="size-4" />
      Ẩn
    </button>
  ) : (
    <button type="button" disabled={isBusy} onClick={() => void reveal()} className={OUTLINE_BUTTON}>
      <Eye className="size-4 text-blue-600" />
      Hiện đủ
    </button>
  );
}

export function BankSection({ profile, today }: { profile: PayrollProfileDto; today: string }) {
  const id = profile.person.employeeId;
  const [isAdding, setIsAdding] = useState(false);
  const [shown, setShown] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<PayrollBankAccountDto | null>(null);
  const remove = useProfileSave(
    id,
    (a: PayrollBankAccountDto) => api.hrPayrollDeleteBank(id, a.id),
    (_, a) => `Đã xoá tài khoản ••••${a.last4}.`,
  );
  const rows = profile.bankAccounts;
  const latest = rows[0];
  const start: BankDraft = {
    bank: latest?.bank ?? '',
    accountNumber: '',
    payslipEmail: latest?.payslipEmail ?? '',
    changedOn: today,
  };
  const show = (accountId: string, number: string | null) =>
    setShown(({ [accountId]: _, ...rest }) => (number ? { ...rest, [accountId]: number } : rest));
  return (
    <Section
      id="ho-so-ngan-hang"
      icon={Landmark}
      title="Ngân hàng"
      hint="Đổi tài khoản: thêm tài khoản mới từ ngày đổi; tài khoản cũ giữ cho các tháng trước."
      onAdd={isAdding ? undefined : () => setIsAdding(true)}
      addLabel="Thêm tài khoản"
    >
      {isAdding && <BankForm employeeId={id} start={start} onDone={() => setIsAdding(false)} />}
      {rows.length === 0 && !isAdding && <Empty>Chưa có số tài khoản: Rà soát sẽ báo thiếu STK.</Empty>}
      <ul className="m-0 list-none p-0">
        {rows.map((a) => (
          <ItemRow
            key={a.id}
            label={`tài khoản ••••${a.last4}`}
            text={
              <>
                {a.bank} <span className="tabular-nums">{shown[a.id] ?? `••••${a.last4}`}</span>
              </>
            }
            sub={[`Từ ${showDay(a.changedOn)}`, a.payslipEmail].filter(Boolean).join(' · ')}
            extra={
              <RevealButton employeeId={id} account={a} shown={shown[a.id] ?? null} onShown={(n) => show(a.id, n)} />
            }
            onDelete={() => setRemoving(a)}
          />
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={`Xoá tài khoản ••••${removing?.last4 ?? ''}?`}
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
