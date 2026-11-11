import type { HrMe, TimesheetClosingChangeDto, TimesheetDto } from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import { payrollPeriods, timesheetClosings, timesheetPeriods } from '../db/schema.js';
import { writePayrollLog } from './payroll-log.js';
import { closingChanges, readClosing, type Tx } from './timesheet-closings.js';
import { actorOf } from './timesheet-people.js';

/**
 * What Lương makes of a timesheet period reopened or closed again (spec-luong.md 10.1, R7), inside the same
 * transaction. The sheet is told in words without any figure, the same for everyone; the detail goes to the payroll
 * log, which only people with the payroll right read.
 */

type Period = typeof timesheetPeriods.$inferSelect;
type PayrollMonth = typeof payrollPeriods.$inferSelect;
type Closing = typeof timesheetClosings.$inferSelect;

export const PAYROLL_APPROVED_NOTICE = 'Kỳ này đã có bảng lương duyệt. Người phụ trách lương sẽ xử lý.';
export const PAYROLL_WAITING_NOTICE = 'Bảng lương tháng này về Chờ chốt công cho tới khi chốt lại kỳ công.';

const monthKey = (p: Pick<Period, 'year' | 'month'>) => `${p.year}-${String(p.month).padStart(2, '0')}`;
const isApproved = (m: PayrollMonth) => m.status === 'approved' || m.status === 'paid';
const approvedWords = (m: PayrollMonth) => (m.status === 'paid' ? 'Bảng lương đã chuyển khoản' : 'Bảng lương đã duyệt');

export const withPayrollNotice = (dto: TimesheetDto, notice: string | undefined): TimesheetDto =>
  notice ? { ...dto, payrollNotice: notice } : dto;

async function payrollMonthOf(tx: Tx, period: Period): Promise<PayrollMonth | undefined> {
  const [month] = await tx
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, period.year), eq(payrollPeriods.month, period.month)))
    .for('update');
  return month;
}

async function update(tx: Tx, month: PayrollMonth, now: Date, fields: Partial<typeof payrollPeriods.$inferInsert>) {
  await tx
    .update(payrollPeriods)
    .set({ ...fields, rowVersion: month.rowVersion + 1, updatedAt: now })
    .where(eq(payrollPeriods.id, month.id));
}

/** A draft waits for the close again, keeping what HR typed; an approved month stays as it is, with a label. */
async function reopenEffect(tx: Tx, month: PayrollMonth | undefined, reason: string, hr: HrMe, now: Date) {
  if (month?.status === 'draft') {
    await update(tx, month, now, { status: 'waiting' });
    return { words: 'Bảng lương Nháp → Chờ chốt công', notice: PAYROLL_WAITING_NOTICE };
  }
  if (month && isApproved(month)) {
    await update(tx, month, now, {
      timesheetReopenedAt: now,
      timesheetReopenedBy: actorOf(hr),
      timesheetReopenReason: reason,
    });
    return { words: `${approvedWords(month)} giữ nguyên, gắn nhãn kỳ công đã mở lại`, notice: PAYROLL_APPROVED_NOTICE };
  }
  return { words: '', notice: undefined };
}

export async function onTimesheetReopened(
  tx: Tx,
  period: Period,
  reason: string,
  hr: HrMe,
  now: Date,
): Promise<string | undefined> {
  const month = await payrollMonthOf(tx, period);
  const { words, notice } = await reopenEffect(tx, month, reason, hr, now);
  const head = `Tháng ${period.month}/${period.year}, lý do: ${reason}`;
  await writePayrollLog(tx, {
    area: 'cham-cong',
    actor: actorOf(hr),
    action: 'Kỳ công mở lại',
    detail: words ? `${head}. ${words}` : head,
    month: monthKey(period),
    at: now,
  });
  return notice;
}

const isDayChange = (c: { label: string }) => /^Ngày \d{2}\/\d{2}\/\d{4}$/.test(c.label);

/** "NV04 NV D: Công hưởng lương 22 → 21, 1 ngày đổi mã": days are counted, the sheet shows each. */
function changeSummary(changes: readonly TimesheetClosingChangeDto[]): string {
  return changes
    .map((person) => {
      const days = person.changes.filter(isDayChange).length;
      const others = person.changes
        .filter((c) => !isDayChange(c))
        .map((c) => `${c.label} ${c.before || 'trống'} → ${c.after || 'trống'}`);
      return `${person.code} ${person.fullName}: ${[...others, ...(days > 0 ? [`${days} ngày đổi mã`] : [])].join(', ')}`;
    })
    .join('; ');
}

/** An approved month keeps its close. The same figures take the label off; others wait for HR (R6). */
async function closedOnApproved(tx: Tx, month: PayrollMonth, closing: Closing, now: Date) {
  const previous = month.closingId ? await readClosing(tx, month.closingId) : undefined;
  const current = await readClosing(tx, closing.id);
  const changes = closingChanges(previous?.rows ?? [], current?.rows ?? [], closing.regions);
  const head = `Tháng ${closing.month}/${closing.year}, lần chốt ${closing.closeNo}`;
  if (changes.length === 0) {
    await update(tx, month, now, { timesheetReopenedAt: null, timesheetReopenedBy: null, timesheetReopenReason: null });
    return { detail: `${head}: không chênh với ${approvedWords(month).toLowerCase()}`, notice: undefined };
  }
  const against = `${approvedWords(month).toLowerCase()} (lần chốt ${previous?.closing.closeNo ?? '?'})`;
  return { detail: `${head} khác ${against}, chờ xử lý: ${changeSummary(changes)}`, notice: PAYROLL_APPROVED_NOTICE };
}

/** A waiting month or a draft reads the new close from now on. */
async function closedOnDraft(tx: Tx, month: PayrollMonth, closing: Closing, now: Date) {
  const previous = month.closingId ? await readClosing(tx, month.closingId) : undefined;
  await update(tx, month, now, { status: 'draft', closingId: closing.id });
  const head = `Tháng ${closing.month}/${closing.year}, lần chốt ${closing.closeNo}`;
  if (!previous) return { detail: `${head}. Bảng lương sang Nháp`, notice: undefined };
  const current = await readClosing(tx, closing.id);
  const changes = closingChanges(previous.rows, current?.rows ?? [], closing.regions);
  return {
    detail: changes.length === 0 ? `${head}: không chênh` : `${head}. Đổi: ${changeSummary(changes)}`,
    notice: undefined,
  };
}

export async function onTimesheetClosed(
  tx: Tx,
  period: Period,
  closing: Closing,
  hr: HrMe,
  now: Date,
): Promise<string | undefined> {
  const month = await payrollMonthOf(tx, period);
  if (!month) return undefined;
  const hadClose = month.closingId !== null;
  const { detail, notice } = isApproved(month)
    ? await closedOnApproved(tx, month, closing, now)
    : await closedOnDraft(tx, month, closing, now);
  await writePayrollLog(tx, {
    area: 'cham-cong',
    actor: actorOf(hr),
    action: hadClose ? 'Kỳ công chốt lại' : 'Kỳ công chốt',
    detail,
    month: monthKey(period),
    at: now,
  });
  return notice;
}
