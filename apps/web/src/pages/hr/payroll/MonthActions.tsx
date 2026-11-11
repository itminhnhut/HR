import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  LockOpen,
  Pencil,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, type PayrollMonthDto } from '../../../api';
import { OUTLINE, WithReason } from '../timesheet/gridParts';
import { BulkInputsButton } from './BulkInputs';
import { ApproveDialog, PaidDialog, ReopenDialog } from './monthDialogs';
import {
  dayMonthOf,
  monthActions,
  monthStatusLabel,
  payDateLink,
  reviewCounts,
  type MonthAction,
} from './monthActionsModel';
import { usePayrollAction } from './queries';
import { ReviewPanel } from './ReviewPanel';

/** The month in the header (spec 11.1, 11.2): status chip, pay date, Rà soát, and the buttons the state allows. */

export const PILL =
  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap';

export const STATUS_LOOK: Record<PayrollMonthDto['status'], { tone: string; icon: LucideIcon }> = {
  waiting: { tone: 'border-amber-300 bg-amber-50 text-amber-900', icon: Clock },
  draft: { tone: 'border-slate-300 bg-slate-50 text-slate-700', icon: Pencil },
  approved: { tone: 'border-green-300 bg-green-50 text-green-800', icon: Lock },
  paid: { tone: 'border-blue-300 bg-blue-50 text-blue-800', icon: Banknote },
};

const BUTTONS: Record<MonthAction, { label: string; icon: LucideIcon; isPrimary: boolean }> = {
  approve: { label: 'Duyệt', icon: ShieldCheck, isPrimary: true },
  reopen: { label: 'Mở lại', icon: LockOpen, isPrimary: false },
  markPaid: { label: 'Đã chuyển khoản', icon: Banknote, isPrimary: false },
};

const PRIMARY =
  'ts-field inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium whitespace-nowrap text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50';

export function MonthStatus({ month }: { month: PayrollMonthDto }) {
  const look = STATUS_LOOK[month.status];
  return (
    <>
      <span data-testid="month-status" className={`${PILL} ${look.tone}`}>
        <look.icon className="size-3.5" />
        {monthStatusLabel(month)}
      </span>
      <Link
        to={payDateLink(month.monthKey)}
        title="Ngày chi trả quyết định thuế tính theo tháng nào. Bấm để đổi ở Cấu hình › Quy tắc."
        className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-slate-600 no-underline hover:text-blue-700 hover:underline"
      >
        <CalendarDays className="size-3.5" />
        {`Chi trả ${dayMonthOf(month.payDate)}/${month.payDate.slice(0, 4)}`}
      </Link>
    </>
  );
}

/** A month button; one that cannot be used says why, on hover and to a screen reader. */
function ActionButton({
  action,
  reason,
  onClick,
}: {
  action: MonthAction;
  reason: string | null;
  onClick: () => void;
}) {
  const hint = useId();
  const look = BUTTONS[action];
  return (
    <>
      <WithReason reason={reason}>
        <button
          type="button"
          disabled={reason !== null}
          aria-describedby={reason ? hint : undefined}
          onClick={onClick}
          className={look.isPrimary ? PRIMARY : OUTLINE}
        >
          <look.icon className={`size-4 ${look.isPrimary ? '' : 'text-blue-600'}`} />
          {look.label}
        </button>
      </WithReason>
      {reason && (
        <span id={hint} className="sr-only">
          {reason}
        </span>
      )}
    </>
  );
}

function ReviewButton({ month, onClick }: { month: PayrollMonthDto; onClick: () => void }) {
  const counts = reviewCounts(month.review);
  const chip = 'rounded-full px-1.5 text-xs font-semibold';
  return (
    <button type="button" onClick={onClick} className={OUTLINE}>
      <CheckCircle2 className="size-4 text-blue-600" />
      Rà soát
      {counts.red > 0 && (
        <span
          title={`${counts.red} cảnh báo đỏ: phải tích "Đã xem" khi Duyệt`}
          className={`${chip} bg-red-100 text-red-800`}
        >
          {counts.red}
        </span>
      )}
      {counts.yellow > 0 && (
        <span
          title={`${counts.yellow} cảnh báo vàng: nên xem, không chặn`}
          className={`${chip} bg-amber-100 text-amber-900`}
        >
          {counts.yellow}
        </span>
      )}
    </button>
  );
}

type Open = 'review' | MonthAction | null;

function useMonthActions(month: PayrollMonthDto, onDone: () => void) {
  const choice = { year: month.year, month: month.month };
  const name = `T${month.month}/${month.year}`;
  const done = (text: string) => () => {
    toast.success(text);
    onDone();
  };
  const approve = usePayrollAction(choice, (acknowledgedRed: boolean) =>
    api.hrPayrollApprove(month.year, month.month, { acknowledgedRed }),
  );
  const reopen = usePayrollAction(choice, (reason: string) => api.hrPayrollReopen(month.year, month.month, { reason }));
  const markPaid = usePayrollAction(choice, (input: { paidOn: string; note?: string }) =>
    api.hrPayrollMarkPaid(month.year, month.month, input),
  );
  return {
    approve: (ack: boolean) => approve.mutate(ack, { onSuccess: done(`Đã duyệt bảng lương ${name}`) }),
    reopen: (reason: string) => reopen.mutate(reason, { onSuccess: done(`Đã mở lại ${name}, về Nháp`) }),
    markPaid: (input: { paidOn: string; note?: string }) =>
      markPaid.mutate(input, { onSuccess: done(`Đã đánh dấu ${name} đã chuyển khoản`) }),
    state: { approve, reopen, markPaid },
    reset: () => [approve, reopen, markPaid].forEach((m) => m.reset()),
  };
}

export interface MonthActionsProps {
  month: PayrollMonthDto;
  approver: string;
  canApprove: boolean;
  /** The address search, so a warning's link keeps the month and the filters. */
  search: string;
}

export function MonthActions({ month, approver, canApprove, search }: MonthActionsProps) {
  // Tổng quan links to the warnings: `rs=1` opens Rà soát over the grid; closing takes it off the address.
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<Open>(() => (params.get('rs') === '1' ? 'review' : null));
  const close = () => {
    setOpen(null);
    if (!params.has('rs')) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('rs');
        return next;
      },
      { replace: true },
    );
  };
  const actions = useMonthActions(month, close);
  const show = (next: Open) => {
    actions.reset();
    setOpen(next);
  };
  const { state } = actions;
  const common = { month, onClose: close };
  return (
    <>
      {month.status !== 'waiting' && <ReviewButton month={month} onClick={() => show('review')} />}
      <BulkInputsButton month={month} search={search} />
      {monthActions(month, canApprove).map(({ action, disabledReason }) => (
        <ActionButton key={action} action={action} reason={disabledReason} onClick={() => show(action)} />
      ))}
      <ReviewPanel open={open === 'review'} month={month} search={search} onClose={close} />
      {open === 'approve' && (
        <ApproveDialog
          open
          {...common}
          approver={approver}
          isBusy={state.approve.isPending}
          error={state.approve.error}
          onApprove={actions.approve}
          onReview={() => show('review')}
        />
      )}
      {open === 'reopen' && (
        <ReopenDialog
          open
          {...common}
          isBusy={state.reopen.isPending}
          error={state.reopen.error}
          onReopen={actions.reopen}
        />
      )}
      {open === 'markPaid' && (
        <PaidDialog
          open
          {...common}
          isBusy={state.markPaid.isPending}
          error={state.markPaid.error}
          onMarkPaid={actions.markPaid}
        />
      )}
    </>
  );
}
