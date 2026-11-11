import type { PayrollConfig } from './config.js';
import type { Zone } from './defaults-law.js';
import {
  computeIncome,
  NO_OVERTIME,
  type IncomeInput,
  type IncomeResult,
  type KpiPercentSource,
  type OvertimeInput,
} from './income.js';
import {
  computeInsurance,
  insuranceStatus,
  insuredSalaryOf,
  type InsuranceMonthInput,
  type InsuranceResult,
} from './insurance.js';
import {
  add,
  moneyCell,
  neg,
  roundDong,
  sub,
  sum,
  toNumber,
  ZERO,
  type Rational,
  type RoundingMode,
} from './rational.js';
import { computeTax, type TaxPersonInput, type TaxResult } from './tax.js';

/** One payroll row: income, insurance, tax, then (41), (42), (47), (48) (spec 5.3). */

export interface PayrollLineInput {
  employeeId: string;
  income: IncomeInput;
  insurance: { month: InsuranceMonthInput; zone: Zone; unionMember: boolean };
  person: TaxPersonInput;
  /**
   * (32) typed as three cells: support (taxable, a cost), refund and advance (neither). `insurancePaid`: the company
   * pays the employee's own insurance back, (28) + (29) + (30) of the month, nothing typed; taxed and a cost like a
   * support only when `taxable` (HR's October file: neither).
   */
  cash?: { support?: number; refund?: number; advance?: number; insurancePaid?: { taxable: boolean } | null };
}

/** (32) as the row computes it: the typed cells, and the insurance paid back with the part of it that is taxed. */
interface CashParts {
  support: number;
  refund: number;
  advance: number;
  insurancePaid: Rational;
  insurancePaidTaxed: Rational;
}

/** The money cells of a row, by name; `PAYROLL_COLUMNS` gives HR's column number of each. */
export const PAYROLL_MONEY_CELLS = [
  'kpiBonus',
  'otherIncome',
  'overtimePay',
  'income',
  'socialBase',
  'social',
  'health',
  'unemployment',
  'unionFee',
  'cash',
  'exempt',
  'taxable',
  'personalDeduction',
  'dependantDeduction',
  'insuranceDeduction',
  'assessable',
  'tax',
  'totalDeductions',
  'netPay',
  'companySocial',
  'companyHealth',
  'companyUnemployment',
  'unionFund',
  'companyTotal',
  'totalCost',
] as const;
export type PayrollMoneyCell = (typeof PAYROLL_MONEY_CELLS)[number];

export const PAYROLL_COLUMNS: Record<PayrollMoneyCell | 'gross' | 'paidDays' | 'dailyRate' | 'kpiPercent', string> = {
  gross: '16',
  paidDays: '17',
  dailyRate: '18',
  kpiPercent: '19',
  kpiBonus: '20',
  otherIncome: '24',
  overtimePay: '25',
  income: '26',
  socialBase: '27',
  social: '28',
  health: '29',
  unemployment: '30',
  unionFee: '31',
  cash: '32',
  exempt: '33',
  taxable: '34',
  personalDeduction: '35',
  dependantDeduction: '36',
  insuranceDeduction: '37',
  assessable: '38',
  tax: '40',
  totalDeductions: '41',
  netPay: '42',
  companySocial: '43',
  companyHealth: '44',
  companyUnemployment: '45',
  unionFund: '46',
  companyTotal: '47',
  totalCost: '48',
};

export interface PayrollLine {
  employeeId: string;
  /** Every cell as shown: money to the dong, (18) to the dong, (19) as a fraction (0,8 for 80%). */
  cells: Record<PayrollMoneyCell, number> & { gross: number; paidDays: number; dailyRate: number; kpiPercent: number };
  /** Money cells before display: rounded already in the default mode, full numbers in the "as HR's file" mode. */
  exact: Record<PayrollMoneyCell, Rational>;
  kpiPercentSource: KpiPercentSource;
  overtime: OvertimeInput;
  /** Monthly amounts of the last segment: the profile the row ends on. */
  amounts: Readonly<Record<string, number>>;
  income: IncomeResult;
  insurance: InsuranceResult;
  tax: TaxResult;
  /** "Công ty trả thay BH" of (32): the amount in the cell and whether it is taxed; null when the person has none. */
  insurancePaid: { amount: number; taxable: boolean } | null;
}

function moneyOf(
  income: IncomeResult,
  insurance: InsuranceResult,
  tax: TaxResult,
  cash: CashParts,
  cell: (x: Rational) => Rational,
): Record<PayrollMoneyCell, Rational> {
  const { employee, company } = insurance;
  const totalDeductions = sum([employee.social, employee.health, employee.unemployment, employee.unionFee, tax.tax]);
  const cashCell = sum([cash.support, cash.refund, neg(cash.advance), cash.insurancePaid]);
  return {
    kpiBonus: income.kpiBonus,
    otherIncome: income.otherIncome,
    overtimePay: income.overtimePay,
    income: income.income,
    socialBase: insurance.socialBase,
    social: employee.social,
    health: employee.health,
    unemployment: employee.unemployment,
    unionFee: employee.unionFee,
    cash: cashCell,
    exempt: tax.exempt,
    taxable: tax.taxable,
    personalDeduction: tax.personalDeduction,
    dependantDeduction: tax.dependantDeduction,
    insuranceDeduction: insurance.employeeTotal,
    assessable: tax.assessable,
    tax: tax.tax,
    totalDeductions,
    netPay: cell(add(sub(income.income, totalDeductions), cashCell)),
    companySocial: company.social,
    companyHealth: company.health,
    companyUnemployment: company.unemployment,
    unionFund: company.unionFund,
    companyTotal: insurance.companyTotal,
    totalCost: cell(sum([income.income, cash.support, cash.insurancePaidTaxed, insurance.companyTotal])),
  };
}

const roundAll = (exact: Record<PayrollMoneyCell, Rational>) =>
  Object.fromEntries(PAYROLL_MONEY_CELLS.map((key) => [key, roundDong(exact[key])])) as Record<
    PayrollMoneyCell,
    number
  >;

export function computeLine(input: PayrollLineInput, config: PayrollConfig): PayrollLine {
  const typed = { support: 0, refund: 0, advance: 0, ...input.cash };
  const paidBack = input.cash?.insurancePaid ?? null;
  const income = computeIncome(input.income, config);
  const segments = input.income.segments;
  const amounts = segments[segments.length - 1]?.amounts ?? {};
  const status = insuranceStatus(input.insurance.month, config);
  const insuredSalary = insuredSalaryOf(config.components, amounts);
  const insurance = computeInsurance({ ...input.insurance, status, insuredSalary }, config);
  const insurancePaid = paidBack ? insurance.employeeTotal : ZERO;
  const cash: CashParts = { ...typed, insurancePaid, insurancePaidTaxed: paidBack?.taxable ? insurancePaid : ZERO };
  const support = add(cash.support, cash.insurancePaidTaxed);
  const tax = computeTax({ income, overtime: input.income.overtime, insurance, support, person: input.person }, config);
  const exact = moneyOf(income, insurance, tax, cash, moneyCell(config.options.rounding));
  return {
    employeeId: input.employeeId,
    cells: {
      ...roundAll(exact),
      gross: income.gross,
      paidDays: income.paidDays,
      dailyRate: roundDong(income.dailyRate),
      kpiPercent: toNumber(income.kpiPercent),
    },
    exact,
    kpiPercentSource: income.kpiPercentSource,
    overtime: input.income.overtime ?? NO_OVERTIME,
    amounts,
    income,
    insurance,
    tax,
    insurancePaid: paidBack ? { amount: roundDong(insurancePaid), taxable: paidBack.taxable } : null,
  };
}

/**
 * The row with some money cells moved by whole dong (truy lĩnh / truy thu carried from an approved month, spec R6):
 * the cells shown and the full numbers move together, so the total row still adds up in both rounding modes.
 */
export function adjustLine(line: PayrollLine, deltas: Partial<Record<PayrollMoneyCell, number>>): PayrollLine {
  const moved = PAYROLL_MONEY_CELLS.filter((key) => (deltas[key] ?? 0) !== 0);
  if (moved.length === 0) return line;
  const cells = { ...line.cells };
  const exact = { ...line.exact };
  for (const key of moved) {
    const delta = deltas[key] ?? 0;
    cells[key] = line.cells[key] + delta;
    exact[key] = add(line.exact[key], delta);
  }
  return { ...line, cells, exact };
}

/**
 * The total row (D01). Default: Σ of the cells, so the total net pay is the total transferred. "As HR's file":
 * Tròn(Σ of the full numbers), which can be a dong off the sum of the cells shown.
 */
export function payrollTotals(
  lines: readonly PayrollLine[],
  mode: RoundingMode,
): Record<PayrollMoneyCell, number> & { gross: number } {
  const money = Object.fromEntries(
    PAYROLL_MONEY_CELLS.map((key) => {
      const total =
        mode === 'cell'
          ? lines.reduce((acc, l) => acc + l.cells[key], 0)
          : roundDong(sum(lines.map((l) => l.exact[key])));
      return [key, total];
    }),
  ) as Record<PayrollMoneyCell, number>;
  return { ...money, gross: lines.reduce((acc, l) => acc + l.cells.gross, 0) };
}
