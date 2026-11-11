import type { PayslipListDto, PayslipMarkInput, PayslipSendDto, PayslipSendResultDto } from '@careers/shared';
import { delay, fail } from './mock-store';
import type { PayrollMonthDto } from './types';

/**
 * The demo's Phiếu lương: the people of the demo month, no mailbox on a server (the demo has none), and marks of
 * "Đánh dấu đã gửi" kept until the page reloads.
 */

const NEVER: PayslipSendDto = { state: 'never', at: null, by: null, channel: null, error: null };

export const payslipsMockApi = (monthOf: (year: number, month: number) => Promise<PayrollMonthDto>) => {
  let marks: Readonly<Record<string, PayslipSendDto>> = {};
  const list = async (monthKey: string): Promise<PayslipListDto> => {
    const month = await monthOf(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)));
    return {
      monthKey,
      status: month.status,
      approvalNo: month.approval?.no ?? null,
      payDate: month.payDate,
      canSend: month.status === 'approved' || month.status === 'paid',
      mail: { isConfigured: false, redirectTo: null, blocked: null },
      people: month.lines.map((l) => ({
        employeeId: l.employeeId,
        code: l.code,
        fullName: l.fullName,
        department: l.department,
        block: l.block,
        email: l.sheet?.payslipEmail ?? null,
        netPay: l.cells.netPay,
        send: marks[`${monthKey}:${l.employeeId}`] ?? NEVER,
      })),
    };
  };
  return {
    hrPayrollPayslips: (monthKey: string) => list(monthKey).then(delay),
    async hrPayrollPayslipsMark(monthKey: string, input: PayslipMarkInput): Promise<PayslipListDto> {
      const before = await list(monthKey);
      if (!before.canSend) return fail(409, 'Tháng lương chưa duyệt nên chưa gửi phiếu lương được.');
      const sent: PayslipSendDto = {
        state: 'sent',
        at: new Date().toISOString(),
        by: 'Demo',
        channel: 'manual',
        error: null,
      };
      const changed = Object.fromEntries(
        input.employeeIds.map((id) => [`${monthKey}:${id}`, input.sent === false ? NEVER : sent]),
      );
      marks = { ...marks, ...changed };
      return delay(await list(monthKey));
    },
    hrPayrollPayslipSend: (): Promise<PayslipSendResultDto> => fail(409, 'Chưa cấu hình hộp thư gửi'),
  };
};
