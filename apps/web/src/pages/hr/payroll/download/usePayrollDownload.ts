import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../../api';
import { useHrMe } from '../../../../api/queries';
import { errorMessage } from '../../parts';
import { monthKeyText } from '../excel/format';
import { exportMonthsOf, vietnamMinute } from '../excel/fromMonth';
import { exportPayroll } from '../excel/payrollBook';
import { payslipsOf } from '../excel/payslip';
import { exportPayslips } from '../excel/payslipBook';

/**
 * A download (spec 12.1, 11.7): the server answers the months (and writes the log line), the browser makes the file.
 * A short toast confirms it; a refusal shows the server's own words, also kept in `error` for the dialog that asked.
 */

const FAILED = 'Chưa tải được file, thử lại sau ít phút.';

/** `employeeIds`: only the people the grid shows (a filtered download); absent: everyone of each month. */
async function payrollFile(
  months: readonly string[],
  by: string,
  employeeIds: readonly string[] | undefined,
): Promise<string> {
  const answer = await api.hrPayrollExport({
    months: [...months],
    kind: 'payroll',
    ...(employeeIds ? { employeeIds: [...employeeIds] } : {}),
  });
  const mapped = exportMonthsOf(answer);
  await exportPayroll(mapped, { at: vietnamMinute(new Date()), by });
  const people = new Set(answer.months.flatMap((m) => m.month.lines.map((l) => l.employeeId))).size;
  const [only] = months;
  const what = months.length === 1 && only ? monthKeyText(only) : `${months.length} tháng`;
  return `Đã tải bảng lương ${what} · ${people} người${employeeIds ? ' (đang lọc)' : ''}`;
}

async function payslipFile(monthKey: string, employeeIds: readonly string[] | undefined): Promise<string> {
  const answer = await api.hrPayrollExport({
    months: [monthKey],
    kind: 'payslips',
    ...(employeeIds ? { employeeIds: [...employeeIds] } : {}),
  });
  const [month] = exportMonthsOf(answer);
  if (!month) throw new Error('The export answered no month');
  const slips = payslipsOf(month);
  await exportPayslips(month, slips);
  return `Đã tải ${slips.length} phiếu lương ${monthKeyText(monthKey)}`;
}

export function usePayrollDownload() {
  const me = useHrMe();
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<string>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      toast.success(await work());
      return true;
    } catch (failure) {
      const words = errorMessage(failure, FAILED);
      setError(words);
      toast.error(words);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const by = me.data?.name ?? me.data?.email ?? '';
  return {
    isBusy,
    error,
    /** The payroll workbook of these months (`YYYY-MM`) with the whole account numbers: everyone, or the people given. */
    payroll: (months: readonly string[], employeeIds?: readonly string[]) =>
      run(() => payrollFile(months, by, employeeIds)),
    /** Payslips of one month: the people given, or everyone. */
    payslips: (monthKey: string, employeeIds?: readonly string[]) => run(() => payslipFile(monthKey, employeeIds)),
  };
}
