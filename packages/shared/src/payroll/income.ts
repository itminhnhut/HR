import type { PayrollConfig } from './config.js';
import type { KpiRule, PayComponent } from './defaults-company.js';
import { add, div, moneyCell, mul, rat, sum, ZERO, type Numeric, type Rational } from './rational.js';

/** Income, columns (16)–(26) of HR's file (spec 5.3). */

/** Part of the period at one pay level and one probation status (spec 5.6); a month without a change has one. */
export interface PaySegment {
  /** First day of the segment, for the tooltip; not used in the arithmetic. */
  from?: string;
  days: number;
  probation: boolean;
  /** Monthly amount of each component, by component id, from the profile in force. */
  amounts: Readonly<Record<string, number>>;
}

export interface OvertimeInput {
  weekdayHours: number;
  /** Rest-day work outside (17), paid 200% (D12 prefill `restDayPrefill`, or as HR typed it). */
  restDays: number;
  /** Sunday work already counted in (17): D12 adds 100%, for 200% in all (spec 5.3). */
  sundayInPaid?: number;
  /** `holidayWorked` of the closing: the day is already in (17), this adds 300% (spec 5.3). */
  holidayDays: number;
}

/** Unused leave paid on leaving (`leavePayoutOf`): the amount, and the part within the law's base, exempt (D08). */
export interface LeavePayout {
  amount: Numeric;
  exempt: Numeric;
  /** For the tooltip of (24): days left × contract pay ÷ norm; absent when HR typed the amount. */
  basis?: { days: number; base: number; norm: number };
  /** HR typed the amount over the computed one. */
  typed?: boolean;
}

export interface OtherIncome {
  amount: number;
  taxable: boolean;
  reason?: string;
}

export interface IncomeInput {
  norm: number;
  segments: readonly PaySegment[];
  /** KPI 100%: the level of the last day of the period or the leaving day (`kpiLevelFor`). */
  kpiAmount: number;
  /** (19) as HR typed it, 0,8 for 80%; null or absent when not typed. */
  kpiPercent?: number | null;
  /** The person's block in the closing ('BO' | 'KD'); null or absent goes by KD: HR types (19). */
  block?: string | null;
  overtime?: OvertimeInput;
  otherIncome?: readonly OtherIncome[];
  /** Unused leave paid on leaving, its own line in (24); a bare number is exempt in full. */
  leavePayout?: LeavePayout | Numeric;
}

export type KpiPercentSource = 'typed' | 'formula' | 'suggested' | 'missing';

export interface ComponentPaid {
  component: PayComponent;
  /** The monthly amount of the last segment, the level a `regulated` exemption defaults to. */
  amount: number;
  /** What was paid of it this month, exact: amount × rate × days ÷ norm, or amount × rate if paid in full. */
  paid: Rational;
}

export interface IncomeResult {
  paidDays: number;
  /** (16), for display only. */
  gross: number;
  /** (18) of the last segment, kept whole; `dailyRates` has one per segment. */
  dailyRate: Rational;
  dailyRates: Rational[];
  kpiPercent: Rational;
  kpiPercentSource: KpiPercentSource;
  /** KPI 100% of the row, so a review can tell "no KPI" from "% not typed". */
  kpiAmount: number;
  /** (19) as the web works it out, for "gõ đè khác số tính". */
  kpiPercentComputed: Rational;
  /** (20) */
  kpiBonus: Rational;
  /** (24): other income plus unused leave pay. */
  otherIncome: Rational;
  /** The part of other income HR marked exempt. */
  otherExempt: Rational;
  leavePayout: Rational;
  leavePayoutExempt: Rational;
  /** (25) */
  overtimePay: Rational;
  /** The daily rate overtime is paid on: components "vào lương làm thêm" only. */
  overtimeDailyRate: Rational;
  /** Tròn((18) × days + components paid in full). */
  dayPay: Rational;
  /** (26) */
  income: Rational;
  componentPaid: ComponentPaid[];
}

const NO_OVERTIME: OvertimeInput = { weekdayHours: 0, restDays: 0, holidayDays: 0 };

const lastOf = <T>(list: readonly T[]): T => {
  const last = list[list.length - 1];
  if (last === undefined) throw new Error('Payroll: a row needs at least one pay segment');
  return last;
};

function rateOf(component: PayComponent, segment: PaySegment, probationRate: number): Rational {
  return segment.probation && component.probationRate ? rat(probationRate) : rat(1);
}

/** What one component paid over the segments: by the day on the period's norm, or in full (D11). */
function paidOf(component: PayComponent, segments: readonly PaySegment[], norm: number, probationRate: number) {
  if (!component.perDay) {
    const last = lastOf(segments);
    return mul(last.amounts[component.id] ?? 0, rateOf(component, last, probationRate));
  }
  return sum(
    segments.map((s) => div(mul(s.amounts[component.id] ?? 0, rateOf(component, s, probationRate), s.days), norm)),
  );
}

/** (18) of one segment: Σ(per-day component × its rate) ÷ norm; `only` narrows it, as overtime's base does. */
function dailyRateOf(
  components: readonly PayComponent[],
  segment: PaySegment,
  norm: number,
  probationRate: number,
  only: (c: PayComponent) => boolean = () => true,
) {
  const perDay = components.filter((c) => c.perDay && only(c));
  return div(sum(perDay.map((c) => mul(segment.amounts[c.id] ?? 0, rateOf(c, segment, probationRate)))), norm);
}

/** The rule of the person's block; without a block, KD's: HR types (the row also gets "Thiếu khối"). */
export const kpiRuleOf = (block: string | null | undefined, config: PayrollConfig): KpiRule =>
  block === 'BO' ? config.rules.kpiByBlock.BO : config.rules.kpiByBlock.KD;

/**
 * (19). Typed wins. Otherwise by the block's rule (file T10): `typed` (KD) is HR's evaluation, missing until typed;
 * `formula` (BO) is Σ(days × rate) ÷ norm, 90% on probation days and 100% on official ones, a D06 suggestion in a
 * month with both parts.
 */
function kpiPercentOf(input: IncomeInput, config: PayrollConfig): { value: Rational; source: KpiPercentSource } {
  if (input.kpiPercent !== undefined && input.kpiPercent !== null)
    return { value: rat(input.kpiPercent), source: 'typed' };
  if (kpiRuleOf(input.block, config) === 'typed') return missing();
  const { segments, norm } = input;
  const formula = div(sum(segments.map((s) => mul(s.days, s.probation ? config.rules.probationRate : 1))), norm);
  const mixed = segments.some((s) => s.probation) && segments.some((s) => !s.probation);
  if (mixed) return config.options.kpiSplit === 'suggest' ? { value: formula, source: 'suggested' } : missing();
  return { value: formula, source: 'formula' };
}

const missing = () => ({ value: ZERO, source: 'missing' as const });

/**
 * (25): weekday hours × (18) ÷ hours a day × 150% + rest days outside (17) × (18) × 200% + Sundays inside (17) ×
 * (18) × 100% + holidays × (18) × 300%, on the daily rate of the components "vào lương làm thêm".
 */
function overtimePayOf(daily: Rational, overtime: OvertimeInput, config: PayrollConfig): Rational {
  const { hoursPerDay, overtimeRates } = config.rules;
  const sundayExtra = config.options.sundayWork === 'total-200' ? overtimeRates.restDay - 1 : 0;
  return sum([
    mul(div(mul(overtime.weekdayHours, daily), hoursPerDay), overtimeRates.weekday),
    mul(overtime.restDays, daily, overtimeRates.restDay),
    mul(overtime.sundayInPaid ?? 0, daily, sundayExtra),
    mul(overtime.holidayDays, daily, overtimeRates.holiday),
  ]);
}

/**
 * (20): KPI × (19); an official person's typed % is not reduced by the days unless the rule says so (câu 6). A %
 * from the formula already is days ÷ norm.
 */
function kpiBonusOf(input: IncomeInput, kpi: { value: Rational; source: KpiPercentSource }, config: PayrollConfig) {
  const percent = kpi.value;
  const official = input.segments.every((s) => !s.probation);
  const byDays = official && kpi.source === 'typed' && config.rules.kpiOfficialByDays;
  const days = input.segments.reduce((acc, s) => acc + s.days, 0);
  return mul(input.kpiAmount, percent, byDays ? div(days, input.norm) : 1);
}

const isLeavePayout = (x: LeavePayout | Numeric): x is LeavePayout => typeof x === 'object' && 'amount' in x;

export function computeIncome(input: IncomeInput, config: PayrollConfig): IncomeResult {
  const cell = moneyCell(config.options.rounding);
  const { components, rules } = config;
  const { segments, norm } = input;
  const last = lastOf(segments);
  const dailyRates = segments.map((s) => dailyRateOf(components, s, norm, rules.probationRate));
  const dailyRate = lastOf(dailyRates);
  const fixed = sum(components.filter((c) => !c.perDay).map((c) => paidOf(c, segments, norm, rules.probationRate)));
  const dayPay = cell(add(sum(segments.map((s, i) => mul(dailyRates[i] ?? ZERO, s.days))), fixed));
  const kpi = kpiPercentOf(input, config);
  const kpiBonus = cell(kpiBonusOf(input, kpi, config));
  const payout = input.leavePayout ?? 0;
  const leavePayout = cell(isLeavePayout(payout) ? payout.amount : payout);
  const otherIncome = add(cell(sum((input.otherIncome ?? []).map((o) => o.amount))), leavePayout);
  const overtimeDaily = dailyRateOf(components, last, norm, rules.probationRate, (c) => c.overtimeBase);
  const overtimePay = cell(overtimePayOf(overtimeDaily, input.overtime ?? NO_OVERTIME, config));
  return {
    paidDays: segments.reduce((acc, s) => acc + s.days, 0),
    gross:
      components.reduce((acc, c) => acc + (last.amounts[c.id] ?? 0), 0) + (rules.grossWithKpi ? input.kpiAmount : 0),
    dailyRate,
    dailyRates,
    kpiPercent: kpi.value,
    kpiPercentSource: kpi.source,
    kpiAmount: input.kpiAmount,
    kpiPercentComputed: kpiPercentOf({ ...input, kpiPercent: null }, config).value,
    kpiBonus,
    otherIncome,
    otherExempt: sum((input.otherIncome ?? []).filter((o) => !o.taxable).map((o) => o.amount)),
    leavePayout,
    leavePayoutExempt: isLeavePayout(payout) ? rat(payout.exempt) : leavePayout,
    overtimePay,
    overtimeDailyRate: overtimeDaily,
    dayPay,
    income: sum([dayPay, kpiBonus, otherIncome, overtimePay]),
    componentPaid: components.map((component) => ({
      component,
      amount: last.amounts[component.id] ?? 0,
      paid: paidOf(component, segments, norm, rules.probationRate),
    })),
  };
}
