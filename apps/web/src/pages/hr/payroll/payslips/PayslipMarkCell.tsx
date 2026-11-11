import type { PayslipPersonDto, PayslipSendDto } from '@careers/shared';
import { Check, CircleAlert, Clock, RefreshCw, type LucideIcon } from 'lucide-react';
import { WithReason } from '../../timesheet/gridParts';
import { markAction, statusWords, type StatusWords } from './payslipsModel';

/**
 * The send status of one person, the same on the list and in the drawer: a short chip ("Chưa gửi", "Đã gửi", "Cần gửi
 * lại", "Lỗi") over one small line of detail. On the list the cell also holds the one-click mark, to the right of
 * the chip: "Đánh dấu đã gửi", "Đánh dấu đã gửi lại" or "Bỏ đánh dấu". No drawer needed. A row that needs sending
 * again opens "Thay đổi từ lần gửi" from its chip, its detail line or "Xem thay đổi".
 */

const CHIP = 'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap';
const TONES: Record<StatusWords['tone'], { chip: string; icon: LucideIcon }> = {
  grey: { chip: 'border-slate-300 bg-slate-50 text-slate-700', icon: Clock },
  green: { chip: 'border-green-300 bg-green-50 text-green-800', icon: Check },
  amber: { chip: 'border-amber-300 bg-amber-50 text-amber-900', icon: RefreshCw },
  red: { chip: 'border-red-300 bg-red-50 text-red-700', icon: CircleAlert },
};

/** Why a mark is off; null when HR can mark. */
export const markHeldReason = (canSend: boolean): string | null =>
  canSend ? null : 'Tháng chưa duyệt — duyệt bảng lương rồi mới gửi phiếu';

/** The chip and its line of detail. */
export function PayslipStatus({ send }: { send: PayslipSendDto }) {
  const status = statusWords(send);
  const tone = TONES[status.tone];
  const Icon = tone.icon;
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <span data-tone={status.tone} className={`${CHIP} ${tone.chip}`}>
        <Icon className="size-3.5" aria-hidden />
        {status.chip}
      </span>
      {status.detail && (
        <span className="text-xs font-normal text-slate-500 sm:whitespace-nowrap">{status.detail}</span>
      )}
    </span>
  );
}

const BUTTON =
  'ts-field inline-flex items-center justify-center rounded-md border px-2.5 text-xs font-medium whitespace-nowrap max-sm:w-full ' +
  'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:no-underline disabled:shadow-none';
/** Marking is a secondary button; taking a mark back reads as a link, so it does not compete with it. */
const MARK = 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
const UNDO = 'border-transparent bg-transparent text-slate-600 underline shadow-none! hover:text-slate-900';

export function PayslipMarkCell({
  person,
  canSend,
  isBusy,
  onMark,
  onChanges,
}: {
  person: PayslipPersonDto;
  canSend: boolean;
  isBusy: boolean;
  onMark: (isSent: boolean) => void;
  /** "Xem thay đổi" of a row whose numbers moved after the payslip went out. */
  onChanges: () => void;
}) {
  const action = markAction(person.send);
  const reason = markHeldReason(canSend);
  return (
    <td className="p-2 sm:min-w-88" onClick={(e) => e.stopPropagation()}>
      <span className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5">
        {person.send.state === 'stale' ? (
          <button
            type="button"
            aria-label={`Xem thay đổi từ lần gửi của ${person.fullName}`}
            title="Xem số nào đã đổi từ lần gửi"
            onClick={onChanges}
            className="flex min-w-0 cursor-pointer flex-col items-start gap-0.5 rounded-md border-0 bg-transparent p-0 text-left hover:bg-amber-50 max-sm:min-h-11"
          >
            <PayslipStatus send={person.send} />
            <span className="text-xs font-medium text-blue-700 underline">Xem thay đổi</span>
          </button>
        ) : (
          <PayslipStatus send={person.send} />
        )}
        <WithReason reason={reason}>
          <span title={reason ?? undefined} className="inline-flex max-sm:w-full">
            <button
              type="button"
              aria-label={`${action.name} ${person.fullName}`}
              disabled={!canSend || isBusy}
              onClick={() => onMark(action.isSent)}
              className={`${BUTTON} ${action.isSent ? MARK : UNDO}`}
            >
              {action.label}
            </button>
          </span>
        </WithReason>
      </span>
    </td>
  );
}
