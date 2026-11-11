import { needsAcknowledgement, type ReviewItem } from '@careers/shared';
import type { PayrollMonthDto } from '../../../api';

/** What a payroll month lets HR do and how it is named (spec 11.1, 11.2, 11.4, R7). Pure, no React. */

export type MonthAction = 'approve' | 'reopen' | 'markPaid';

export interface MonthActionState {
  action: MonthAction;
  /** Why the button cannot be used; null when it can. */
  disabledReason: string | null;
}

type MonthState = Pick<PayrollMonthDto, 'status' | 'lines' | 'computedAt' | 'approval' | 'paidOn'>;

const NO_RIGHT = 'Cần quyền Duyệt lương';

/** The buttons of the month, in order. A paid month keeps none (spec 11.2: hidden once they cannot be used). */
export function monthActions(month: MonthState, canApprove: boolean): MonthActionState[] {
  const right = canApprove ? null : NO_RIGHT;
  if (month.status === 'waiting') return [{ action: 'approve', disabledReason: 'Chờ chốt công, chưa duyệt được' }];
  if (month.status === 'draft') {
    return [{ action: 'approve', disabledReason: month.lines.length === 0 ? 'Chưa có dòng lương nào' : right }];
  }
  if (month.status === 'approved') {
    return [
      { action: 'reopen', disabledReason: right },
      { action: 'markPaid', disabledReason: null },
    ];
  }
  return [];
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  hourCycle: 'h23',
});

/** ISO time → "16:20 05/11" in Vietnam time. */
export function timeAndDay(iso: string): string {
  const parts = Object.fromEntries(TIME.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
}

/** "YYYY-MM-DD" → "dd/mm". */
export const dayMonthOf = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

export function monthStatusLabel(month: MonthState): string {
  if (month.status === 'waiting') return 'Chờ chốt công';
  if (month.status === 'draft') return month.computedAt ? `Nháp · tính lúc ${timeAndDay(month.computedAt)}` : 'Nháp';
  if (month.status === 'paid') return month.paidOn ? `Đã chuyển khoản ${dayMonthOf(month.paidOn)}` : 'Đã chuyển khoản';
  const a = month.approval;
  return a ? `Đã duyệt lần ${a.no} · ${timeAndDay(a.at)} · bởi ${a.by}` : 'Đã duyệt';
}

export function reviewCounts(items: readonly ReviewItem[]): { red: number; yellow: number } {
  const red = items.filter((i) => i.level === 'red').length;
  return { red, yellow: items.length - red };
}

/** Red warnings block Duyệt until HR marks them "Đã xem" (spec 4.8, 11.3); yellow ones never do. */
export const canApproveNow = (items: readonly ReviewItem[], hasSeenRed: boolean): boolean =>
  hasSeenRed || !needsAcknowledgement(items);
