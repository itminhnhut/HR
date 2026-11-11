import { usePayrollAddress } from '../usePayrollAddress';
import { notSentCount } from './payslipsModel';
import { usePayslips } from './PayslipsTab';

/** On the "Phiếu lương" tab: how many people of an approved month still wait for their payslip. */
export function PayslipTabCount() {
  const { choice } = usePayrollAddress();
  const monthKey = choice.ok ? `${choice.year}-${String(choice.month).padStart(2, '0')}` : null;
  const list = usePayslips(monthKey).data;
  const count = list?.canSend ? notSentCount(list) : 0;
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} người chưa gửi phiếu lương`}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900"
    >
      {count}
    </span>
  );
}
