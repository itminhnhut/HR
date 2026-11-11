import { isWorkingOn, weekdayOf, type AttendanceCode } from '../timesheet.js';
import type { PayrollConfig } from './config.js';
import type { Zone } from './defaults-law.js';
import { add, clamp, moneyCell, mul, sum, ZERO, type Rational } from './rational.js';

/**
 * Insurance by calendar month (spec 5.4): BH-1 for a month with a joining, a leaving or a change to or from an
 * insured contract; BH-2 for a whole month under one. Columns (27)–(31) and (43)–(47).
 */

export interface InsuranceMonthInput {
  /** Calendar month `YYYY-MM`: insurance month T of payroll month T. */
  month: string;
  /** Day codes of the month from the closings; days 26–31 come from the next period. */
  codes: Readonly<Record<string, AttendanceCode | null>>;
  /** Contract changes by date: whether the contract type in force from that day carries insurance. */
  contracts: readonly { from: string; insured: boolean }[];
  joinedOn: string | null;
  leftOn: string | null;
  /** First day back at work after a long absence, for the Đ.33 k6 exception. */
  returnedOn?: string | null;
  /** Working days of leave taken beyond the balance in this month: not worked, not paid. */
  leaveOverdrawn?: number;
  /** D07 "mon-fri-saturdays": the region's working Saturdays of the month. */
  workingSaturdays?: readonly string[];
  /** Days from here on come from a period not closed yet: the result is provisional ("tạm"). */
  provisionalFrom?: string;
}

export type InsuranceRule = 'BH-1' | 'BH-2' | 'none';
export type InsuranceStatusKind = 'full' | 'health-only' | 'social-only' | 'none';

/** Which funds are due this month on the payroll. */
export interface InsuranceFunds {
  social: boolean;
  unemployment: boolean;
  health: boolean;
}

export interface InsuranceStatus {
  rule: InsuranceRule;
  status: InsuranceStatusKind;
  funds: InsuranceFunds;
  /** Working days of the month (D07). */
  workingDays: number;
  /** Working days under an insured contract while employed. */
  insuredDays: number;
  /** Working days without pay, days outside an insured contract included (or, in the earlier reading of BH-1,
   * insured days less unpaid ones). */
  counted: number;
  provisional: boolean;
  /** For the Ghi chú column, e.g. "Chỉ BHYT · 15 ngày không hưởng lương". */
  note: string;
}

const THRESHOLD = 14;

/** A working day not paid by the company: KL, KP, sick (BHXH pays), maternity (spec 5.4). */
const UNPAID_WEIGHT: Partial<Record<AttendanceCode, number>> = { KL: 1, 'KL/2': 0.5, KP: 1, OM: 1, TS: 1 };

function monthDays(month: string): string[] {
  const [y = 2000, m = 1] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

function workingDaysOf(input: InsuranceMonthInput, config: PayrollConfig): string[] {
  const saturdays = new Set(config.options.workingDays === 'mon-fri-saturdays' ? (input.workingSaturdays ?? []) : []);
  return monthDays(input.month).filter((day) => {
    const weekday = weekdayOf(day);
    return (weekday >= 1 && weekday <= 5) || saturdays.has(day);
  });
}

function insuredOn(input: InsuranceMonthInput, day: string): boolean {
  if (!isWorkingOn(input, day)) return false;
  const inForce = input.contracts.filter((c) => c.from <= day).sort((a, b) => b.from.localeCompare(a.from));
  return inForce[0]?.insured ?? false;
}

interface DayCounts {
  working: number;
  insured: number;
  /** Working days without pay from the company: unpaid codes and leave beyond the balance (spec 5.4). */
  unpaid: number;
  /** Working days on sick or maternity leave. */
  sick: number;
}

function dayCounts(input: InsuranceMonthInput, config: PayrollConfig) {
  const working = workingDaysOf(input, config);
  const insured = working.filter((day) => insuredOn(input, day));
  const codeOf = (day: string) => input.codes[day] ?? '1';
  const unpaid = insured.reduce((acc, day) => acc + (UNPAID_WEIGHT[codeOf(day)] ?? 0), 0) + (input.leaveOverdrawn ?? 0);
  const sick = insured.filter((day) => codeOf(day) === 'OM' || codeOf(day) === 'TS').length;
  const counts: DayCounts = { working: working.length, insured: insured.length, unpaid, sick };
  return { counts, insuredDays: insured };
}

const inMonth = (day: string | null | undefined, month: string) => !!day && day.startsWith(month);

/**
 * Which funds are due. Default (Luật BHXH 2024 Đ.33 k5, Luật Việc làm 2025 Đ.33 k4): working days without pay, days
 * outside an insured contract included, under 14. "insured-days" keeps the earlier reading of BH-1: insured days less
 * unpaid ones from 14. Đ.33 k6: the first month at work, or back at work, with 14 sick days still pays BHXH (BHTN has
 * no such exception). D15: both sides agreed to pay. D04: BHYT in a month without them; with 14 sick or maternity
 * days the insurance fund pays it (Luật BHYT Đ.12 k2 b), so 0 here.
 */
function fundsOf(input: InsuranceMonthInput, counts: DayCounts, rule: InsuranceRule, config: PayrollConfig) {
  const oldReading = rule === 'BH-1' && config.rules.insuranceCount === 'insured-days';
  const counted = oldReading ? counts.insured - counts.unpaid : counts.working - counts.insured + counts.unpaid;
  const byDays =
    (oldReading ? counted >= THRESHOLD : counted < THRESHOLD) || config.options.insuranceAgreed === 'agreed';
  const firstMonth = inMonth(input.joinedOn, input.month) || inMonth(input.returnedOn, input.month);
  const sickStart = firstMonth && counts.sick >= THRESHOLD;
  const option = config.options.healthWhenNotSocial;
  const fundPaysHealth = option === 'pay-except-sick' && counts.sick >= THRESHOLD;
  const health = byDays || (option !== 'skip' && !fundPaysHealth);
  return { counted, funds: { social: byDays || sickStart, unemployment: byDays, health } };
}

function kindOf(funds: InsuranceFunds): InsuranceStatusKind {
  if (funds.social && funds.unemployment) return 'full';
  if (funds.social) return 'social-only';
  return funds.health ? 'health-only' : 'none';
}

/** Why the month falls short of the 14-day rule, e.g. "15 ngày không hưởng lương". */
function reasonOf(counted: number, counts: DayCounts, config: PayrollConfig): string {
  const days = String(counted).replace('.', ',');
  return config.rules.insuranceCount === 'insured-days' && counts.insured < counts.working
    ? `làm ${days}/${counts.working} ngày`
    : `${days} ngày không hưởng lương`;
}

const NO_INSURANCE = 'Không đóng BH trên bảng lương';

function noteOf(funds: InsuranceFunds, counted: number, counts: DayCounts, config: PayrollConfig): string {
  if (funds.social && funds.unemployment) return '';
  const health = funds.health ? '' : ` · BHXH đóng BHYT (${counts.sick} ngày ốm, thai sản)`;
  if (funds.social) return `Đóng BHXH tháng đầu có ốm (Đ.33 k6), không BHTN${health}`;
  const head = funds.health ? 'Chỉ BHYT' : NO_INSURANCE;
  return `${head} · ${reasonOf(counted, counts, config)}${health}`;
}

const NO_FUNDS: InsuranceFunds = { social: false, unemployment: false, health: false };

/**
 * A month the insured contract starts in (a joining, or a labour contract after a separate probation one) that the
 * 14-day rule leaves without BHXH: the person enters the employee group only from the next month (Luật BHXH 2024 Đ.2
 * k1 a, Đ.33 k5; Luật BHYT Đ.12 k1 a, Đ.13 k1 a; NĐ 188/2025 Đ.6 k1 a: BHYT is 4,5% of the salary BHXH is paid
 * on). So no BHYT and no (27) either; D04 only keeps BHYT for someone already in the group when the month began.
 */
const notYetInsured = (input: InsuranceMonthInput, funds: InsuranceFunds) =>
  !funds.social && !insuredOn(input, `${input.month}-01`);

export function insuranceStatus(input: InsuranceMonthInput, config: PayrollConfig): InsuranceStatus {
  const { counts, insuredDays } = dayCounts(input, config);
  const provisional = !!input.provisionalFrom && insuredDays.some((day) => day >= (input.provisionalFrom ?? day));
  const base = { workingDays: counts.working, insuredDays: counts.insured, provisional };
  if (counts.insured === 0) return { ...base, rule: 'none', status: 'none', funds: NO_FUNDS, counted: 0, note: '' };
  const rule: InsuranceRule = counts.insured === counts.working ? 'BH-2' : 'BH-1';
  const { counted, funds } = fundsOf(input, counts, rule, config);
  if (notYetInsured(input, funds)) {
    const note = `${NO_INSURANCE} · ${reasonOf(counted, counts, config)} · tăng mới từ tháng sau`;
    // Days outside the insured contract alone reaching 14 are final: days of the open period cannot change that.
    const open = provisional && counts.working - counts.insured < THRESHOLD;
    return { ...base, provisional: open, rule: 'none', status: 'none', funds: NO_FUNDS, counted, note };
  }
  return { ...base, rule, status: kindOf(funds), funds, counted, note: noteOf(funds, counted, counts, config) };
}

export interface InsuranceResult {
  status: InsuranceStatus;
  /** Σ insured components before the floor and cap, for the "below the floor" review (spec 5.3). */
  insuredSalary: number;
  /** The zone minimum used as the floor. */
  floor: number;
  belowFloor: boolean;
  /** (27) */
  socialBase: Rational;
  unemploymentBase: Rational;
  /** (28) (29) (30) (31) */
  employee: { social: Rational; health: Rational; unemployment: Rational; unionFee: Rational };
  /** (43) (44) (45) (46) */
  company: { social: Rational; health: Rational; unemployment: Rational; unionFund: Rational };
  /** (37) = (28) + (29) + (30) */
  employeeTotal: Rational;
  /** (47) */
  companyTotal: Rational;
}

/** (27)–(31), (43)–(47) on the full insurance salary when the month qualifies: insurance is not paid by the day. */
export function computeInsurance(
  args: { status: InsuranceStatus; insuredSalary: number; zone: Zone; unionMember: boolean },
  config: PayrollConfig,
): InsuranceResult {
  const cell = moneyCell(config.options.rounding);
  const { law } = config;
  const { status, insuredSalary } = args;
  const floor = law.zoneMinimums[args.zone];
  const shown = status.rule !== 'none';
  const socialBase = shown ? clamp(insuredSalary, floor, law.socialCap) : ZERO;
  const unemploymentBase = shown ? clamp(insuredSalary, floor, law.unemploymentCapMultiplier * floor) : ZERO;
  const { social, unemployment, health } = status.funds;
  const pay = (on: boolean, rate: number, base: Rational) => (on ? cell(mul(rate, base)) : ZERO);
  const employee = {
    social: pay(social, law.employeeRates.social, socialBase),
    health: pay(health, law.employeeRates.health, socialBase),
    unemployment: pay(unemployment, law.employeeRates.unemployment, unemploymentBase),
    unionFee: pay(social && args.unionMember, law.unionFee, socialBase),
  };
  const company = {
    social: pay(social, law.companyRates.social, socialBase),
    health: pay(health, law.companyRates.health, socialBase),
    unemployment: pay(unemployment, law.companyRates.unemployment, unemploymentBase),
    unionFund: pay(social && config.options.unionFund === 'when-social', law.unionFund, socialBase),
  };
  return {
    status,
    insuredSalary,
    floor,
    belowFloor: shown && insuredSalary < floor,
    socialBase,
    unemploymentBase,
    employee,
    company,
    employeeTotal: sum([employee.social, employee.health, employee.unemployment]),
    companyTotal: add(sum([company.social, company.health, company.unemployment]), company.unionFund),
  };
}

/** Σ of the components flagged "tính BH", at their full monthly amounts. */
export function insuredSalaryOf(
  components: PayrollConfig['components'],
  amounts: Readonly<Record<string, number>>,
): number {
  return components.filter((c) => c.insured).reduce((acc, c) => acc + (amounts[c.id] ?? 0), 0);
}
