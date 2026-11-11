import {
  PAYROLL_COLUMNS,
  payrollConfigFor,
  payrollDates,
  type PayrollConfig,
  type SettingRow,
  type TaxMethod,
} from '@careers/shared';
import type { PayrollExportDto, PayrollExportMonthDto, PayrollLineDto, PayrollMonthDto } from '../../../../api';
import { hrNoteOf, printedNote } from '../payrollModel';
import { monthKeyText } from './format';
import { payslipOf, type Payslip } from './payslip';
import type {
  PayrollAdjustment,
  PayrollCash,
  PayrollExportLine,
  PayrollExportMonth,
  PayrollExportRow,
  PayrollSegmentNote,
  PayrollStamp,
  TypedOverride,
} from './types';

/**
 * The month as the web shows it (the API's month: the approval's snapshot, or the draft just computed) dressed for
 * the payroll file and the payslips. Every number is the month's own; nothing is computed again. What the sheet
 * prints beyond the grid comes from each row's `sheet` (job title, dependants, tax method, what was paid of each
 * component, split periods, email and bank); a row approved before the web kept it has none, and those stay empty.
 * A download maps the answer of `POST /hr/payroll/export` (`exportMonthsOf`), where every row has its sheet and the
 * payroll file alone carries the whole account number; the payslip on screen maps the month shown (`payslipOnScreen`).
 */

/** A month with numbers of its own: not one still waiting for the timesheet close, not one without rows. */
export const canExportDto = (month: PayrollMonthDto) => month.status !== 'waiting' && month.lines.length > 0;

/** Why "Tải Excel" cannot be used on this month; null when it can. */
export function exportBlockOf(month: PayrollMonthDto): string | null {
  if (month.status === 'waiting') return 'Chờ chốt công, chưa có số để tải';
  return month.lines.length === 0 ? 'Kỳ này chưa có dòng lương nào' : null;
}

/** An instant as Vietnam's clock reads it, `YYYY-MM-DDTHH:mm`, the form the stamps print. */
export function vietnamMinute(iso: string | Date): string {
  const at = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 16);
}

function stampOf(month: PayrollMonthDto, now: Date): PayrollStamp {
  const isApproved = month.status === 'approved' || month.status === 'paid';
  if (isApproved && month.approval)
    return {
      kind: 'approved',
      round: month.approval.no,
      approvedAt: vietnamMinute(month.approval.at),
      approvedBy: month.approval.by,
    };
  return { kind: 'draft', computedAt: vietnamMinute(month.computedAt ?? now) };
}

const TAX_REFS: Readonly<Record<string, TaxMethod>> = {
  'luat.bieu-thue': 'progressive',
  'luat.khau-tru-10': 'flat10',
  'tuy-chon.d09': 'none',
};

/** The tax method the row's sheet says; without a sheet, the setting its (40) names; null when it names none. */
function taxMethodOf(line: PayrollLineDto): TaxMethod | null {
  if (line.sheet) return line.sheet.taxMethod;
  const refs = line.explain.tax?.refs ?? [];
  return refs.map((r) => TAX_REFS[r.key]).find((m) => m !== undefined) ?? null;
}

const CASH_FORMULA = /Hỗ trợ ([\d.]+) \+ Hoàn ứng ([\d.]+) − Tạm ứng ([\d.]+)/;
const dongOf = (text: string | undefined) => Number((text ?? '').replace(/\./g, ''));

/**
 * (32) apart, as the row's own formula spells it ("Hỗ trợ 0 + Hoàn ứng 0 − Tạm ứng 500.000 + Công ty trả thay BH …"):
 * support, refund, advance, and what is left of the cell is the insurance the company pays back. The payslip then
 * names each amount (F22). Null when the row has no such formula; the payslip keeps its one line.
 */
export function cashPartsOf(line: PayrollLineDto): { cash: PayrollCash; insurancePaid: number } | null {
  const found = CASH_FORMULA.exec(line.explain.cash?.formula ?? '');
  if (!found) return null;
  const cash = { support: dongOf(found[1]), refund: dongOf(found[2]), advance: dongOf(found[3]) };
  const insurancePaid = line.cells.cash - cash.support - cash.refund + cash.advance;
  return insurancePaid < 0 ? null : { cash, insurancePaid };
}

function lineOf(line: PayrollLineDto, month: PayrollMonthDto): PayrollExportLine {
  const { cells } = line;
  const paidBack = cashPartsOf(line)?.insurancePaid ?? 0;
  return {
    cells,
    overtime: { weekdayHours: cells.overtimeHours, restDays: cells.restDays, holidayDays: cells.holidayDays },
    amounts: line.amounts,
    income: {
      leavePayout: line.leavePayout?.amount ?? 0,
      componentPaid: month.components.map((c) => ({
        component: { name: c.name },
        amount: line.amounts[c.id] ?? 0,
        paid: line.sheet ? (line.sheet.paid[c.id] ?? 0) : null,
      })),
    },
    insurance: { status: { note: printedNote(line.note) } },
    tax: { method: taxMethodOf(line) },
    insurancePaid: paidBack > 0 ? { amount: paidBack } : null,
  };
}

/** The person's truy lĩnh / truy thu paid in this month, oldest origin first; what HR left out (0) is not listed. */
function retroOf(employeeId: string, month: PayrollMonthDto): PayrollAdjustment[] {
  return (month.retro ?? [])
    .filter((r) => r.employeeId === employeeId && r.placed && r.amount !== 0)
    .sort((a, b) => a.origin.localeCompare(b.origin))
    .map((r) => ({
      originMonth: r.origin,
      reason: r.reason || 'tính lại sau khi tháng đó đã duyệt',
      amount: r.amount,
    }));
}

function rowOf(line: PayrollLineDto, month: PayrollMonthDto): PayrollExportRow {
  const cash = cashPartsOf(line);
  const retro = retroOf(line.employeeId, month);
  const regionOrder = month.regions.findIndex((r) => r.id === line.regionId);
  const hrNote = hrNoteOf(line);
  return {
    person: {
      employeeId: line.employeeId,
      code: line.code,
      name: line.fullName,
      title: line.sheet?.title ?? null,
      block: line.block,
      contractTypeId: line.contractTypeId,
      contractName: month.contractTypes.find((t) => t.id === line.contractTypeId)?.name ?? '',
      region: month.regions[regionOrder]?.name ?? line.regionId,
      regionOrder: regionOrder < 0 ? month.regions.length : regionOrder,
      dependants: line.sheet?.dependants ?? null,
      kpiAmount: line.kpiAmount,
      email: line.sheet?.payslipEmail ?? null,
      bankAccount: line.sheet?.bankAccount ?? null,
      bankName: line.sheet?.bankName ?? null,
      ...(hrNote ? { note: hrNote } : {}),
    },
    line: lineOf(line, month),
    ...(cash ? { cash: cash.cash } : {}),
    ...(retro.length > 0 ? { retro } : {}),
  };
}

const OVERTIME_COLUMNS: Readonly<Record<string, string>> = { overtimeHours: '21', restDays: '22', holidayDays: '23' };
const NUMBERS: Readonly<Record<string, string>> = { ...PAYROLL_COLUMNS, ...OVERTIME_COLUMNS };

const typedOf = (month: PayrollMonthDto): TypedOverride[] =>
  month.lines.flatMap((l) =>
    l.overrides.map((o) => ({
      employeeId: l.employeeId,
      column: NUMBERS[o.cell] ?? o.cell,
      computed: o.computed,
      typed: o.typed,
      reason: o.reason,
    })),
  );

/** The pay components of the month, in the month's own order and names, with the settings' attributes. */
function configOf(month: PayrollMonthDto, settings: readonly SettingRow[]): PayrollConfig {
  const config = payrollConfigFor(settings, null, payrollDates(month.year, month.month, month.payDate));
  const components = month.components.map((c) => {
    const found = config.components.find((x) => x.id === c.id);
    if (!found)
      throw new Error(`Khoản lương "${c.name}" của ${monthKeyText(month.monthKey)} không còn trong Cấu hình.`);
    return { ...found, name: c.name };
  });
  return { ...config, components };
}

const segmentsOf = (month: PayrollMonthDto): PayrollSegmentNote[] =>
  month.lines.flatMap((l) => (l.sheet?.segments ? [{ employeeId: l.employeeId, parts: l.sheet.segments }] : []));

/** Everything of the month but its configuration: what a payslip reads. */
function shellOf(month: PayrollMonthDto, now: Date): Omit<PayrollExportMonth, 'config' | 'dates'> {
  const norms = month.regions.flatMap((r) => {
    const line = month.lines.find((l) => l.regionId === r.id);
    return line ? [{ region: r.name, norm: line.norm }] : [];
  });
  return {
    rows: month.lines.map((l) => rowOf(l, month)),
    norms,
    stamp: stampOf(month, now),
    closingNo: month.closingNo ?? null,
    formulaVersion: month.formulaVersion ?? null,
    labels: month.retroOut ? [`Có thay đổi sau duyệt, xử lý ở ${monthKeyText(month.retroOut.month)}`] : [],
    typed: typedOf(month),
    segments: segmentsOf(month),
    totals: month.totals,
    isBankUnknown: !month.lines.some((l) => l.sheet),
  };
}

export function exportMonthOf(
  month: PayrollMonthDto,
  settings: readonly SettingRow[],
  now: Date = new Date(),
): PayrollExportMonth {
  const config = configOf(month, settings);
  return { ...shellOf(month, now), dates: config.dates, config };
}

export const partialWords = (p: { shown: number; total: number }) => `Đã lọc: ${p.shown}/${p.total} người`;

/** One month of a download: the server's closing number and formula version, its notes among the month's labels. */
function exportMonthOfAnswer(answer: PayrollExportMonthDto, now: Date): PayrollExportMonth {
  const mapped = exportMonthOf(answer.month, answer.settings, now);
  const shown = answer.month.lines.length;
  const isPartial = answer.peopleTotal > shown;
  const partial = { shown, total: answer.peopleTotal };
  return {
    ...mapped,
    closingNo: answer.closingNo,
    formulaVersion: answer.formulaVersion,
    // A filtered file says so under the title and adds up its own rows, not the whole month's total row (F29).
    labels: [...(isPartial ? [partialWords(partial)] : []), ...(mapped.labels ?? []), ...answer.notes],
    ...(isPartial ? { partial, totals: undefined } : {}),
  };
}

/** The answer of `POST /hr/payroll/export` as the file builders take it, oldest month first. */
export const exportMonthsOf = (answer: PayrollExportDto, now: Date = new Date()): PayrollExportMonth[] =>
  [...answer.months]
    .sort((a, b) => a.month.monthKey.localeCompare(b.month.monthKey))
    .map((m) => exportMonthOfAnswer(m, now));

/**
 * The payslip of one person of the month on screen; null when the person has no row in it. The month on screen has
 * the account masked, so nothing more than its last digits can show.
 */
export function payslipOnScreen(month: PayrollMonthDto, employeeId: string, now: Date = new Date()): Payslip | null {
  const shell = { ...shellOf(month, now), dates: payrollDates(month.year, month.month, month.payDate) };
  const row = shell.rows.find((r) => r.person.employeeId === employeeId);
  return row ? payslipOf(shell, row) : null;
}
