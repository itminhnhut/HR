import { roundDong, type PayrollLine } from '@careers/shared';
import { dayText, monthKeyText, versionText } from './format';
import { orderedRows } from './rows';
import type { PayrollCash, PayrollExportMonth, PayrollExportRow } from './types';

export { payslipFileName } from './format';

/**
 * One person's payslip (spec 11.7, BLLĐ Đ.95 k3): days, overtime, income, deductions and net pay, read from the
 * month's own version, the account cut to its last four digits, a draft marked NHÁP. No signature block (Q4).
 */

export type PayslipFormat = 'money' | 'days' | 'hours' | 'percent';

export interface PayslipLine {
  label: string;
  /** The monthly level of a component, beside what was paid of it. */
  base?: number | null;
  amount: number;
  format: PayslipFormat;
  /** "of which" lines under another line. */
  isDetail?: boolean;
  isTotal?: boolean;
}

export interface PayslipSection {
  title: string;
  lines: PayslipLine[];
}

export interface Payslip {
  employeeId: string;
  code: string;
  name: string;
  monthLabel: string;
  title: string;
  isDraft: boolean;
  stamp: string;
  /** L-F20: "Thay phiếu bản lần 1". */
  replaces: string | null;
  info: [label: string, value: string][];
  sections: PayslipSection[];
  netPay: number;
  bank: string;
  notes: string[];
}

const moneyLine = (label: string, amount: number, extra: Partial<PayslipLine> = {}): PayslipLine => ({
  label,
  amount,
  format: 'money',
  ...extra,
});

function daysSection(line: PayrollLine, norm: number): PayslipSection {
  return {
    title: 'Ngày công',
    lines: [
      { label: 'Công chuẩn', amount: norm, format: 'days' },
      { label: 'Ngày công hưởng lương', amount: line.cells.paidDays, format: 'days' },
      moneyLine('Lương 1 ngày', line.cells.dailyRate),
      { label: '% đánh giá KPI', amount: line.cells.kpiPercent, format: 'percent' },
    ],
  };
}

function overtimeSection(line: PayrollLine): PayslipSection {
  const { weekdayHours, restDays, holidayDays } = line.overtime;
  return {
    title: 'Làm thêm',
    lines: [
      { label: 'Giờ làm thêm ngày thường', amount: weekdayHours, format: 'hours' },
      { label: 'Công làm thêm ngày nghỉ', amount: restDays, format: 'days' },
      { label: 'Công làm thêm ngày lễ', amount: holidayDays, format: 'days' },
    ],
  };
}

function incomeSection(row: PayrollExportRow): PayslipSection {
  const { line, person, adjustments = [] } = row;
  const leave = roundDong(line.income.leavePayout);
  // A component the person has no level of stays off the payslip.
  const components = line.income.componentPaid
    .filter((c) => c.amount !== 0 || roundDong(c.paid) !== 0)
    .map((c) => moneyLine(c.component.name, roundDong(c.paid), { base: c.amount }));
  const details = [
    ...(leave > 0 ? [moneyLine('Tiền phép chưa nghỉ', leave, { isDetail: true })] : []),
    ...adjustments.map((a) =>
      moneyLine(`${a.amount < 0 ? 'Truy thu' : 'Truy lĩnh'} ${monthKeyText(a.originMonth)} · ${a.reason}`, a.amount, {
        isDetail: true,
      }),
    ),
  ];
  return {
    title: 'Thu nhập',
    lines: [
      ...components,
      moneyLine('Thưởng hiệu suất', line.cells.kpiBonus, { base: person.kpiAmount }),
      moneyLine('Thu nhập khác', line.cells.otherIncome),
      ...details,
      moneyLine('Tiền làm thêm', line.cells.overtimePay),
      moneyLine('Tổng thu nhập', line.cells.income, { isTotal: true }),
    ],
  };
}

const TAX_LABEL: Record<PayrollLine['tax']['method'], string> = {
  progressive: 'Thuế TNCN (lũy tiến)',
  flat10: 'Thuế TNCN (khấu trừ 10%)',
  none: 'Thuế TNCN (có cam kết, không khấu trừ)',
};

function deductionSection(line: PayrollLine): PayslipSection {
  const c = line.cells;
  return {
    title: 'Khấu trừ',
    lines: [
      moneyLine('Lương đóng BH', c.socialBase, { isDetail: true }),
      moneyLine('BHXH', c.social),
      moneyLine('BHYT', c.health),
      moneyLine('BHTN', c.unemployment),
      moneyLine('Đoàn phí công đoàn', c.unionFee),
      moneyLine(TAX_LABEL[line.tax.method], c.tax),
      moneyLine('Tổng khấu trừ', c.totalDeductions, { isTotal: true }),
    ],
  };
}

/** (32) on its own lines when HR typed it apart (câu 4); an advance is taken off. */
function cashSection(line: PayrollLine, cash: PayrollCash | undefined): PayslipSection {
  const lines = cash
    ? [
        moneyLine('Hỗ trợ', cash.support),
        moneyLine('Hoàn ứng', cash.refund),
        moneyLine('Tạm ứng', cash.advance > 0 ? -cash.advance : 0),
        moneyLine('Công ty trả thay BH', line.insurancePaid?.amount ?? 0),
      ]
    : [moneyLine('Hỗ trợ / Hoàn ứng / Tạm ứng', line.cells.cash)];
  return { title: 'Khoản khác (32)', lines };
}

const lastFour = (account: string | null) => (account ? `****${account.replace(/\s/g, '').slice(-4)}` : 'Chưa có STK');

function headOf(month: PayrollExportMonth) {
  const { dates, stamp } = month;
  const round = stamp.kind === 'approved' ? stamp.round : 0;
  return {
    monthLabel: `T${dates.month}/${dates.year}`,
    title: `PHIẾU LƯƠNG THÁNG ${dates.month}/${dates.year}`,
    isDraft: stamp.kind === 'draft',
    stamp: versionText(stamp),
    replaces: round > 1 ? `Thay phiếu bản lần ${round - 1}` : null,
  };
}

export function payslipOf(month: PayrollExportMonth, row: PayrollExportRow): Payslip {
  const { person, line } = row;
  const norm = month.norms.find((n) => n.region === person.region)?.norm ?? 0;
  const { period, payDate } = month.dates;
  return {
    ...headOf(month),
    employeeId: person.employeeId,
    code: person.code,
    name: person.name,
    info: [
      ['Mã NV', person.code],
      ['Họ và tên', person.name],
      ['Chức danh', person.title],
      ['Bộ phận', person.block ?? ''],
      ['Khu vực', person.region],
      ['Loại hợp đồng', person.contractName],
      ['Kỳ công', `${dayText(period.from)}–${dayText(period.to)}`],
      ['Ngày chi trả', dayText(payDate)],
    ],
    sections: [
      daysSection(line, norm),
      overtimeSection(line),
      incomeSection(row),
      deductionSection(line),
      cashSection(line, row.cash),
    ],
    netPay: line.cells.netPay,
    bank: `${person.bankName ?? 'Chưa có ngân hàng'} · ${lastFour(person.bankAccount)}`,
    notes: [line.insurance.status.note].filter((n) => n.length > 0),
  };
}

/** The payslips of the chosen people (all when none is given), in the month's row order (D13). */
export function payslipsOf(month: PayrollExportMonth, employeeIds?: readonly string[]): Payslip[] {
  const chosen = employeeIds ? new Set(employeeIds) : null;
  return orderedRows(month)
    .filter((r) => !chosen || chosen.has(r.person.employeeId))
    .map((r) => payslipOf(month, r));
}
