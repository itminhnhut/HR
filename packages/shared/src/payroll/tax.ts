import type { PayrollConfig } from './config.js';
import { contractCommitment, isShortTermContract, type ContractType } from './defaults-company.js';
import type { ComponentPaid, IncomeResult, OvertimeInput } from './income.js';
import type { InsuranceResult } from './insurance.js';
import type { LawParams, TaxBracket } from './params.js';
import {
  add,
  cmp,
  div,
  max,
  min,
  moneyCell,
  mul,
  rat,
  roundDong,
  roundedDong,
  sub,
  sum,
  ZERO,
  type Numeric,
  type Rational,
} from './rational.js';

/** Personal income tax, columns (33)–(40) (spec 5.3, 5.5). */

export interface TaxPersonInput {
  contract: ContractType;
  leftOn: string | null;
  dependants: number;
  /** A commitment valid for the tax year of the pay date (spec 5.5). */
  hasCommitment: boolean;
  /** The day that commitment was signed, for the reason shown on (40). */
  commitmentSignedOn?: string | null;
  /** The person asked for 10% to be withheld under the threshold (spec 5.5). */
  withholdBelowThreshold?: boolean;
  /** Overtime hours already paid this tax year, for the 200-hour limit (D05). */
  overtimeHoursBefore?: number;
  /** Clothing pay already exempted this tax year, against the yearly cap (spec 5.8). */
  clothingExemptBefore?: number;
  /** For the commitment check: months of income expected this year here, and taxable income already had. */
  commitmentEstimate?: { months: number; openingTaxable: number };
}

export type TaxMethod = 'progressive' | 'flat10' | 'none';

/** Where the commitment comes from: one signed and on file, or the person's contract ("Cam kết thuế kèm hợp đồng"). */
export type CommitmentSource = 'signed' | 'contract';

export interface CommitmentEstimate {
  annual: number;
  limit: number;
  exceeds: boolean;
}

export interface TaxResult {
  /** (33) */
  exempt: Rational;
  /** (34) */
  taxable: Rational;
  /** (35) (36) (37) */
  personalDeduction: Rational;
  dependantDeduction: Rational;
  insuranceDeduction: Rational;
  /** Personal + dependants + insurance. */
  deductions: Rational;
  /** (38), shown even when the method is 10% or none. */
  assessable: Rational;
  method: TaxMethod;
  methodReason: string;
  /** (40) */
  tax: Rational;
  overtimeHours: { total: number; exempt: number };
  /** Clothing pay exempted this month, and whether the yearly cap is now reached. */
  clothing: { exempt: number; capReached: boolean };
  commitment: CommitmentEstimate | null;
  /** The commitment the person counts on, whatever the method that applied; null without one. */
  commitmentSource: CommitmentSource | null;
}

/**
 * Spec 5.3 (33): the paid part of an exempt component up to its cap: the monthly meal cap; the level in the contract
 * or company rules (the person's own amount unless set); what is left of the yearly clothing cap.
 */
function exemptPart(entry: ComponentPaid, law: LawParams, clothingRoom: number): Rational {
  const { component, paid, amount } = entry;
  const { tax } = component;
  if (tax.kind === 'taxable') return ZERO;
  if (tax.kind === 'exempt') return paid;
  if (tax.cap === 'meal') return min(paid, law.mealCap);
  if (tax.cap === 'regulated') return min(paid, component.regulatedCap ?? amount);
  return min(paid, clothingRoom);
}

function componentsExempt(income: IncomeResult, person: TaxPersonInput, law: LawParams) {
  const room = Math.max(0, law.clothingCap - (person.clothingExemptBefore ?? 0));
  const isClothing = (e: ComponentPaid) => e.component.tax.kind === 'cap' && e.component.tax.cap === 'clothing-year';
  const clothingPaid = sum(income.componentPaid.filter(isClothing).map((e) => e.paid));
  const clothingExempt = min(clothingPaid, room);
  const others = sum(income.componentPaid.filter((e) => !isClothing(e)).map((e) => exemptPart(e, law, room)));
  const clothing = { exempt: roundDong(clothingExempt), capReached: room > 0 && cmp(clothingPaid, room) >= 0 };
  return { amount: add(others, clothingExempt), clothing };
}

/**
 * D05: overtime pay within 40 hours a month and 200 a year (NĐ 253 Đ.26 k1), the 100% of Sundays inside (17)
 * included; a rest-day or holiday day counts as the rule's hours (câu 21). The part beyond is taxable (Đ.26 k3).
 */
function overtimeExempt(income: IncomeResult, overtime: OvertimeInput, person: TaxPersonInput, config: PayrollConfig) {
  // A Sunday already in (17) is overtime too: its 100% there is exempt with the extra 100% in (25) (D12, câu 19).
  const sundayBase = mul(overtime.sundayInPaid ?? 0, income.overtimeDailyRate);
  const overtimePay = add(income.overtimePay, sundayBase);
  const days = overtime.restDays + (overtime.sundayInPaid ?? 0) + overtime.holidayDays;
  const hours = overtime.weekdayHours + days * config.rules.restDayHours;
  if (hours <= 0 || config.options.overtimeExempt === 'taxable')
    return { amount: ZERO, hours: { total: hours, exempt: 0 } };
  const limits = config.law.overtimeLimits;
  const room = Math.max(0, Math.min(limits.month, limits.year - (person.overtimeHoursBefore ?? 0)));
  const exemptHours = Math.min(hours, room);
  return { amount: mul(overtimePay, div(exemptHours, hours)), hours: { total: hours, exempt: exemptHours } };
}

/** Progressive tax on (38), bracket by bracket: only the part above a boundary pays the higher rate. */
export function progressiveTax(assessable: Numeric, brackets: readonly TaxBracket[]): Rational {
  const amount = rat(assessable);
  const start = { floor: ZERO, total: ZERO };
  return brackets.reduce<{ floor: Rational; total: Rational }>((acc, { upTo, rate }) => {
    if (cmp(amount, acc.floor) <= 0) return acc;
    const top = upTo === null ? amount : min(amount, upTo);
    return { floor: upTo === null ? amount : rat(upTo), total: add(acc.total, mul(sub(top, acc.floor), rate)) };
  }, start).total;
}

/** 10% of one payment from the threshold (NĐ 253 Đ.50 k2); under it nothing, unless the person asked. */
export function flatWithholding(base: Numeric, law: LawParams, requested = false): Rational {
  return requested || cmp(base, law.flatThreshold) >= 0 ? mul(base, law.flatRate) : ZERO;
}

/** A signed commitment on file first; without one, the commitment the contract carries. */
export const commitmentSourceOf = (person: TaxPersonInput): CommitmentSource | null => {
  if (person.hasCommitment) return 'signed';
  return contractCommitment(person.contract) ? 'contract' : null;
};

function commitmentWords(source: CommitmentSource, person: TaxPersonInput): string {
  if (source === 'contract') return 'Cam kết theo hợp đồng';
  const day = person.commitmentSignedOn;
  return day ? `Cam kết ký ngày ${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : 'Có cam kết (D09)';
}

/** Spec 5.5, D09, D10: who is withheld 10%, who goes by the brackets, who is not withheld. */
export function taxMethodOf(person: TaxPersonInput, config: PayrollConfig): { method: TaxMethod; reason: string } {
  const { afterLeaving, commitment } = config.options;
  const paidAfterLeaving = !!person.leftOn && config.dates.payDate > person.leftOn;
  const shortTerm = isShortTermContract(person.contract);
  const leavingRule = afterLeaving === 'flat10-all' || (afterLeaving === 'flat10-short-only' && shortTerm);
  if (paidAfterLeaving && leavingRule) return { method: 'flat10', reason: 'Chi sau ngày nghỉ việc (D10)' };
  if (!shortTerm) return { method: 'progressive', reason: 'HĐ từ 3 tháng: lũy tiến' };
  const source = commitmentSourceOf(person);
  if (source && commitment === 'no-withholding') return { method: 'none', reason: commitmentWords(source, person) };
  return { method: 'flat10', reason: 'HĐ dưới 3 tháng: khấu trừ 10%' };
}

/** Spec 5.5: valid while the estimated taxable income of the year, after family deductions, owes nothing. */
export function commitmentEstimateOf(
  taxable: Rational,
  person: TaxPersonInput,
  law: LawParams,
): CommitmentEstimate | null {
  if (!commitmentSourceOf(person) || !person.commitmentEstimate) return null;
  const { months, openingTaxable } = person.commitmentEstimate;
  const annual = roundDong(add(openingTaxable, mul(taxable, months)));
  const limit = 12 * (law.deductions.personal + person.dependants * law.deductions.dependant);
  return { annual, limit, exceeds: annual > limit };
}

/** (40) before rounding: the brackets on (38), 10% of the D02 base, or nothing. */
function taxDue(
  args: {
    method: TaxMethod;
    assessable: Rational;
    taxable: Rational;
    income: Rational;
    support: Numeric;
    person: TaxPersonInput;
  },
  config: PayrollConfig,
): Rational {
  const { method, assessable, taxable, income, support, person } = args;
  const { law, options } = config;
  if (method === 'progressive') return progressiveTax(assessable, law.brackets);
  if (method === 'none') return ZERO;
  const base =
    options.flatBase === 'income-plus-support'
      ? add(income, support)
      : options.flatBase === 'taxable'
        ? taxable
        : income;
  return flatWithholding(base, law, person.withholdBelowThreshold);
}

export function computeTax(
  args: {
    income: IncomeResult;
    overtime?: OvertimeInput;
    insurance: InsuranceResult;
    /** Taxable (32): support, and the insurance the company pays back when it is taxed. */
    support: Numeric;
    person: TaxPersonInput;
  },
  config: PayrollConfig,
): TaxResult {
  const { income, insurance, support, person } = args;
  const { law, options } = config;
  const cell = moneyCell(options.rounding);
  const overtime = overtimeExempt(
    income,
    args.overtime ?? { weekdayHours: 0, restDays: 0, holidayDays: 0 },
    person,
    config,
  );
  const components = componentsExempt(income, person, law);
  const leave = options.leavePayout === 'exempt' ? income.leavePayoutExempt : ZERO;
  // (33) is rounded in both modes: HR's file rounds it inside its formula (spec 5.7).
  const exempt = roundedDong(sum([components.amount, overtime.amount, income.otherExempt, leave]));
  const taxable = cell(sub(add(income.income, support), exempt));
  const personalDeduction = rat(law.deductions.personal);
  const dependantDeduction = rat(person.dependants * law.deductions.dependant);
  const deductions = sum([personalDeduction, dependantDeduction, insurance.employeeTotal]);
  const assessable = cell(max(0, sub(taxable, deductions)));
  const { method, reason } = taxMethodOf(person, config);
  const raw = taxDue({ method, assessable, taxable, income: income.income, support, person }, config);
  return {
    exempt,
    taxable,
    personalDeduction,
    dependantDeduction,
    insuranceDeduction: insurance.employeeTotal,
    deductions,
    assessable,
    method,
    methodReason: reason,
    tax: cell(raw),
    overtimeHours: overtime.hours,
    clothing: components.clothing,
    commitment: commitmentEstimateOf(taxable, person, law),
    commitmentSource: commitmentSourceOf(person),
  };
}
