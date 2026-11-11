import type { PayrollCashKind } from '@careers/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import type { PayrollCashItemDto, PayrollLineDto, PayrollMonthInputsInput, PayrollOtherIncomeDto } from '../../../api';
import { Popover, PopoverContent, PopoverTrigger } from '../../../vendor/shadcn-grid/components/ui/popover';
import type { PayrollMonthContext } from './PayrollCell';
import { cellSearch } from './cellSources';
import { cellLabel, INPUT_LOOK, InputValue, saveError } from './inputParts';
import { leavePayoutInput } from './leavePayoutModel';
import { cashSplit } from './monthInputsModel';
import { LeavePayoutBox } from './LeavePayoutParts';
import type { PayrollColumnSpec } from './payrollModel';
import { useSaveMonthInputs } from './queries';

/**
 * (24) Thu nhập khác and (32) Hỗ trợ / Hoàn ứng / Tạm ứng of one person this month: a short list, each line an amount,
 * its kind (or whether it is taxed) and a reason (L-D11–L-D13). Saving sends the whole list; an empty list clears it.
 */

type ListField = 'otherIncome' | 'cash';
type TaxChoice = '' | 'taxable' | 'exempt';

interface Draft {
  key: number;
  amount: string;
  kind: PayrollCashKind;
  tax: TaxChoice;
  reason: string;
}

const KINDS: { value: PayrollCashKind; label: string }[] = [
  { value: 'support', label: 'Hỗ trợ' },
  { value: 'refund', label: 'Hoàn ứng' },
  { value: 'advance', label: 'Tạm ứng' },
];

const moneyText = (n: number) => n.toLocaleString('vi-VN');
const moneyOf = (text: string) => Number(text.replace(/[.\s,đ]/g, ''));

function draftsOf(field: ListField, line: PayrollLineDto): Draft[] {
  if (field === 'cash') {
    return line.inputs.cash.map((c, i) => ({
      key: i,
      amount: moneyText(c.amount),
      kind: c.kind,
      tax: '',
      reason: c.reason,
    }));
  }
  return line.inputs.otherIncome.map((o, i) => ({
    key: i,
    amount: moneyText(o.amount),
    kind: 'support',
    tax: o.taxable ? 'taxable' : 'exempt',
    reason: o.reason,
  }));
}

/** The list to send, or the first thing to fix before sending it. */
function listOf(field: ListField, drafts: readonly Draft[]): { input: PayrollMonthInputsInput } | { error: string } {
  for (const d of drafts) {
    const amount = moneyOf(d.amount);
    if (!Number.isInteger(amount) || amount <= 0) return { error: 'Nhập số tiền lớn hơn 0, số đồng.' };
    if (field === 'otherIncome' && !d.tax) return { error: 'Chọn chịu thuế hay miễn thuế.' };
    if (field === 'otherIncome' && !d.reason.trim()) return { error: 'Nhập lý do.' };
  }
  if (field === 'cash') {
    const cash: PayrollCashItemDto[] = drafts.map((d) => ({
      kind: d.kind,
      amount: moneyOf(d.amount),
      reason: d.reason.trim(),
    }));
    return { input: { cash } };
  }
  const otherIncome: PayrollOtherIncomeDto[] = drafts.map((d) => ({
    amount: moneyOf(d.amount),
    taxable: d.tax === 'taxable',
    reason: d.reason.trim(),
  }));
  return { input: { otherIncome } };
}

/** What the lines in the form add to (32), an amount still being typed counted as far as it reads. */
const cashOf = (line: PayrollLineDto, drafts: readonly Draft[]) =>
  cashSplit(
    line,
    drafts.map((d) => ({ kind: d.kind, amount: Number.isFinite(moneyOf(d.amount)) ? moneyOf(d.amount) : 0 })),
  );

const FIELD = 'ts-field h-8 min-w-0 rounded-md border bg-white px-2 text-sm';
const BUTTON =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border bg-white px-2.5 text-xs font-medium whitespace-nowrap hover:bg-slate-50 disabled:opacity-50';

function DraftRow({
  field,
  draft,
  no,
  onChange,
  onRemove,
}: {
  field: ListField;
  draft: Draft;
  no: number;
  onChange: (next: Draft) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-1.5 rounded-md border border-slate-200 p-1.5">
      <input
        aria-label={`Số tiền dòng ${no}`}
        inputMode="numeric"
        value={draft.amount}
        onChange={(e) => onChange({ ...draft, amount: e.target.value })}
        className={`${FIELD} text-right tabular-nums`}
      />
      {field === 'cash' ? (
        <select
          aria-label={`Loại dòng ${no}`}
          value={draft.kind}
          onChange={(e) => onChange({ ...draft, kind: e.target.value as PayrollCashKind })}
          className={FIELD}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      ) : (
        <select
          aria-label={`Thuế dòng ${no}`}
          value={draft.tax}
          onChange={(e) => onChange({ ...draft, tax: e.target.value as TaxChoice })}
          className={FIELD}
        >
          <option value="">Thuế?</option>
          <option value="taxable">Chịu thuế</option>
          <option value="exempt">Miễn thuế</option>
        </select>
      )}
      <input
        aria-label={`Lý do dòng ${no}`}
        placeholder={field === 'cash' ? 'Lý do (không bắt buộc)' : 'Lý do'}
        value={draft.reason}
        onChange={(e) => onChange({ ...draft, reason: e.target.value })}
        className={FIELD}
      />
      <button type="button" aria-label={`Xoá dòng ${no}`} onClick={onRemove} className={BUTTON}>
        <Trash2 className="size-3.5 text-red-600" />
      </button>
    </li>
  );
}

function ListForm({
  field,
  line,
  title,
  onDone,
  monthKey,
}: {
  field: ListField;
  line: PayrollLineDto;
  title: string;
  onDone: () => void;
  monthKey: string;
}) {
  const [drafts, setDrafts] = useState(() => draftsOf(field, line));
  const [error, setError] = useState<string | null>(null);
  // Tiền phép chưa nghỉ rides in (24): computed for someone leaving in the period, typed for anyone.
  const hasPayout = field === 'otherIncome';
  const payout = hasPayout ? (line.leavePayout ?? null) : null;
  const typedPayout = payout?.typed ?? null;
  const [payoutText, setPayoutText] = useState(typedPayout === null ? '' : moneyText(typedPayout));
  const save = useSaveMonthInputs(monthKey);
  const add = () => setDrafts((all) => [...all, { key: Date.now(), amount: '', kind: 'support', tax: '', reason: '' }]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const list = listOf(field, drafts);
    if ('error' in list) return setError(list.error);
    const typed = hasPayout ? leavePayoutInput(payoutText) : { value: typedPayout };
    if ('error' in typed) return setError(typed.error);
    setError(null);
    const input = typed.value === typedPayout ? list.input : { ...list.input, leavePayout: typed.value };
    save.mutate(
      { employeeId: line.employeeId, input },
      { onSuccess: onDone, onError: (e) => setError(saveError(e, field)) },
    );
  };
  return (
    <form onSubmit={submit} aria-label={title} className="flex flex-col gap-2">
      <p className="m-0 text-sm font-semibold text-slate-800">{title}</p>
      {field === 'cash' ? (
        <RecurringPart line={line} onOpen={onDone} />
      ) : (
        <p className="m-0 text-xs text-slate-500">Riêng tháng này, mỗi dòng có lý do.</p>
      )}
      {hasPayout && <LeavePayoutBox payout={payout} text={payoutText} onText={setPayoutText} />}
      {drafts.length === 0 && (
        <p className="m-0 text-xs text-slate-500">
          {field === 'cash' ? 'Chưa có dòng riêng tháng này.' : 'Chưa có dòng nào.'}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {drafts.map((d, i) => (
          <DraftRow
            key={d.key}
            field={field}
            draft={d}
            no={i + 1}
            onChange={(next) => setDrafts((all) => all.map((x) => (x.key === d.key ? next : x)))}
            onRemove={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
          />
        ))}
      </ul>
      {field === 'cash' && <CashTotal line={line} drafts={drafts} />}
      {error && (
        <p role="alert" className="m-0 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <span className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={add} disabled={drafts.length >= 20} className={BUTTON}>
          <Plus className="size-3.5 text-blue-600" />
          Thêm dòng
        </button>
        <span className="flex gap-2">
          <button type="button" onClick={onDone} className={BUTTON}>
            Huỷ
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex h-8 items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Lưu
          </button>
        </span>
      </span>
    </form>
  );
}

/**
 * (32), the part HR does not type here (F09): the recurring items of Hồ sơ lương, read only, with the way to them —
 * they open over the grid with the formula, to add, edit or stop. Then the heading of this month's own lines.
 */
function RecurringPart({ line, onOpen }: { line: PayrollLineDto; onOpen: () => void }) {
  const { pathname, search } = useLocation();
  const { recurring } = cashSplit(line, []);
  return (
    <>
      <p className="m-0 flex flex-wrap items-center justify-between gap-x-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-700">
        <span>
          Định kỳ từ Hồ sơ lương: <strong className="tabular-nums">{moneyText(recurring)}</strong>
        </span>
        <Link
          to={{ pathname, search: cellSearch(search, line.employeeId, 'cash') }}
          onClick={onOpen}
          className="inline-flex min-h-8 items-center font-medium text-blue-700 underline underline-offset-2 max-sm:min-h-11"
        >
          Sửa ở Hồ sơ lương ›
        </Link>
      </p>
      <p className="m-0 text-xs font-semibold text-slate-700">Riêng tháng này</p>
    </>
  );
}

function CashTotal({ line, drafts }: { line: PayrollLineDto; drafts: readonly Draft[] }) {
  const { recurring, typed, total } = cashOf(line, drafts);
  return (
    <p className="m-0 border-t pt-1.5 text-xs text-slate-700 tabular-nums">
      {`Tổng (32) = định kỳ ${moneyText(recurring)} + riêng tháng này ${moneyText(typed)} = `}
      <strong>{moneyText(total)}</strong>
    </p>
  );
}

export function PayrollListCell({
  line,
  column,
  month,
  field,
}: {
  line: PayrollLineDto;
  column: PayrollColumnSpec;
  month: PayrollMonthContext;
  field: ListField;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const label = cellLabel(column);
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        aria-label={`Sửa ${label} của ${line.fullName}`}
        className={`-my-1 flex h-full min-h-7 w-full cursor-pointer items-center justify-end rounded px-1 text-right text-sm tabular-nums ${INPUT_LOOK}`}
        render={<button type="button" />}
      >
        <InputValue line={line} column={column} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 max-w-[calc(100vw-32px)] bg-white p-3">
        {isOpen && (
          <ListForm
            field={field}
            line={line}
            title={`${label} · ${line.fullName}`}
            monthKey={month.monthKey}
            onDone={() => setIsOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
