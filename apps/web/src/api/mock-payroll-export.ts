import {
  PAYROLL_FORMULA_VERSION,
  roundDong,
  type PayrollLine,
  type PayrollLineSheetDto,
  type PayrollSettingDto,
} from '@careers/shared';
import type { MockPayrollProfile } from './mock-seed';
import { delay, fail, load } from './mock-store';
import type { PayrollExportDto, PayrollExportRequest, PayrollMonthDto } from './types';

/**
 * The demo's `POST /hr/payroll/export`: the months as the demo answers them, only the people asked for, the whole
 * account number in the payroll file alone. A month waiting for the close or without rows is refused, as the API does.
 */

const latestBank = (profile: MockPayrollProfile | undefined) =>
  [...(profile?.banks ?? [])].sort((a, b) => b.changedOn.localeCompare(a.changedOn))[0];

/** What the sheet and the payslip print of a person beyond the grid; the account masked, as the month answers it. */
export function mockSheet(line: PayrollLine, profile: MockPayrollProfile | undefined): PayrollLineSheetDto {
  const bank = latestBank(profile);
  return {
    title: 'Nhân viên',
    dependants: profile?.dependants.length ?? 0,
    taxMethod: line.tax.method,
    paid: Object.fromEntries(line.income.componentPaid.map((c) => [c.component.id, roundDong(c.paid)])),
    // The demo keeps no email with its made-up people.
    payslipEmail: null,
    bankName: bank?.bank ?? null,
    bankAccount: bank ? `••••${bank.last4}` : null,
  };
}

const monthName = (key: string) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

function withWholeAccounts(month: PayrollMonthDto): PayrollMonthDto {
  const profiles = load().payrollProfiles ?? {};
  const lines = month.lines.map((l) => {
    const account = latestBank(profiles[l.employeeId])?.accountNumber;
    return l.sheet && account ? { ...l, sheet: { ...l.sheet, bankAccount: account } } : l;
  });
  return { ...month, lines };
}

export const exportMockApi = (
  monthOf: (year: number, month: number) => Promise<PayrollMonthDto>,
  settingsOf: () => Promise<PayrollSettingDto[]>,
) => ({
  async hrPayrollExport(input: PayrollExportRequest): Promise<PayrollExportDto> {
    const settings = await settingsOf();
    const keys = [...input.months].sort();
    const months: PayrollExportDto['months'] = [];
    for (const key of keys) {
      const month = await monthOf(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
      if (month.status === 'waiting') return fail(409, `${monthName(key)} đang chờ chốt công, chưa có số để tải.`);
      const picked = input.employeeIds
        ? month.lines.filter((l) => input.employeeIds?.includes(l.employeeId))
        : month.lines;
      if (picked.length === 0) return fail(409, `${monthName(key)} chưa có dòng lương nào để tải.`);
      const chosen = { ...month, lines: picked };
      months.push({
        peopleTotal: month.lines.length,
        month: input.kind === 'payroll' ? withWholeAccounts(chosen) : chosen,
        closingNo: 1,
        formulaVersion: PAYROLL_FORMULA_VERSION,
        settings,
        notes: [],
      });
    }
    return delay({ kind: input.kind, months });
  },
});
