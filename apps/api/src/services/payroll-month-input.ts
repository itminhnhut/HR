import {
  employmentOn,
  kpiLevelFor,
  nextDay,
  paidBySegment,
  PAYROLL_DEFAULT_CONTRACT,
  PAYROLL_INSURANCE_PAID,
  paySegmentsFor,
  periodDays,
  restDayPrefill,
  type ContractType,
  type OvertimeInput,
  type PayrollConfig,
  type PayrollLineInput,
  type PayrollMonthInputsDto,
  type PayrollProfileMonthDto,
  type PayrollYearPartDto,
  type PaySegment,
  type TaxPersonInput,
  type TimesheetClosingRowDto,
  type TimesheetTotals,
  type Zone,
} from '@careers/shared';
import { leaveItemOf, type LeaveBase, type LeaveItem } from './payroll-leave-payout.js';

/**
 * What the engine reads for one person of a payroll month (spec-luong.md 5.1, R2): the days from the timesheet close,
 * the levels and facts from the profile on their own reference dates, every rule from the month's config. Pure, so the
 * month view and its tests feed the engine the same input.
 */

type Totals = Pick<
  TimesheetTotals,
  'paid' | 'leave' | 'leaveOverdrawn' | 'overtime' | 'sundayWorked' | 'holidayWorked' | 'leaveClosing'
>;

const NO_TOTALS: Totals = { paid: 0, leave: 0, leaveOverdrawn: 0, overtime: 0, leaveClosing: 0 };

/** The totals payroll reads from a close row; a backfilled row without totals counts as no day. */
export const closingTotalsOf = (row: Pick<TimesheetClosingRowDto, 'totals'>): Totals => row.totals ?? NO_TOTALS;

export interface LineInputArgs {
  row: TimesheetClosingRowDto;
  facts: PayrollProfileMonthDto;
  config: PayrollConfig;
  zone: Zone;
  /** What HR typed for the month (EMPTY_MONTH_INPUTS when nothing). */
  inputs: PayrollMonthInputsDto;
  /** The tax year before this pay: opening balance plus the earlier months on the web (`yearBeforeOf`). */
  yearBefore: PayrollYearPartDto;
  /** What unused leave is paid on; null for someone not leaving in the period. */
  leaveBase: LeaveBase | null;
}

/** Tiền phép chưa nghỉ of the row: computed from the close and the base, or as HR typed it; null without any. */
export const leaveItemFor = ({ row, config, inputs, leaveBase }: LineInputArgs): LeaveItem | null =>
  leaveItemOf({
    days: closingTotalsOf(row).leaveClosing,
    base: leaveBase,
    config,
    typed: inputs.leavePayout ?? null,
  });

/** A contract type from a date: a level's, or the default official one standing in for a probation contract. */
interface ContractStep {
  from: string;
  type: ContractType | undefined;
  defaulted: boolean;
}

/** A separate probation contract (spec 17.1 câu 9): the default probation type, or any short uninsured one. */
const isProbationType = (t: ContractType | undefined): boolean =>
  !!t && (t.id === PAYROLL_DEFAULT_CONTRACT.probation || (t.shortTerm && !t.insured));

/** Spec 17.2: Chính thức means an open-ended labour contract until HR picks one; else the first insured long type. */
const officialDefaultOf = (config: PayrollConfig): ContractType | undefined =>
  config.contractTypes.find((t) => t.id === PAYROLL_DEFAULT_CONTRACT.official) ??
  config.contractTypes.find((t) => t.insured && !t.shortTerm);

const byFrom = (a: { from: string }, b: { from: string }) => a.from.localeCompare(b.from);

/**
 * The contract of each level, in date order. From the official date (Chấm công) a probation contract no longer
 * applies: passing probation means carrying out the labour contract (BLLĐ Đ.27 k1), which is insured (Luật BHXH 2024
 * Đ.2 k1 a) and taxed by the brackets (NĐ 253 Đ.50 k2). So a probation level in force on or after that date stands
 * on the default official contract; a level HR gave an official contract type keeps it. Amounts stay the level's.
 */
function contractStepsOf(facts: PayrollProfileMonthDto, officialOn: string | null, config: PayrollConfig) {
  const typeOf = (id: string) => config.contractTypes.find((t) => t.id === id);
  const levels: ContractStep[] = facts.versions
    .map((v) => ({ from: v.from, type: typeOf(v.contractTypeId), defaulted: false }))
    .sort(byFrom);
  const fallback = officialDefaultOf(config);
  if (!officialOn || !fallback) return levels;
  const inForce = levels.filter((s) => s.from <= officialOn).pop();
  const split = inForce && inForce.from !== officialOn ? [{ ...inForce, from: officialOn }] : [];
  return [...levels, ...split]
    .sort(byFrom)
    .map((s) => (s.from >= officialOn && isProbationType(s.type) ? { ...s, type: fallback, defaulted: true } : s));
}

/** The contract type the period ends on, as the month's config has it; undefined when not configured. */
function contractOf(steps: readonly ContractStep[], config: PayrollConfig): ContractType | undefined {
  return steps.filter((s) => s.from <= config.dates.period.to).pop()?.type;
}

/**
 * The default official contract this month stands on for want of a level HR typed (Rà soát asks HR to pick one),
 * when it reaches the period or the insurance month; null when HR's levels say it all. The insurance month is the
 * pay month, so its last day is always after the period's (26 → 25).
 */
export function defaultedContractOf(
  row: Pick<TimesheetClosingRowDto, 'officialOn'>,
  facts: PayrollProfileMonthDto,
  config: PayrollConfig,
): ContractType | null {
  const last = `${config.dates.insuranceMonth}-31`;
  const step = contractStepsOf(facts, row.officialOn, config).find((s) => s.defaulted && s.from <= last);
  return step?.type ?? null;
}

/** The days of the period with their codes, (17) and the leave paid in it; null for a backfilled row without codes. */
function dayCodesOf(row: TimesheetClosingRowDto, config: PayrollConfig) {
  const { codes } = row;
  if (!codes) return null;
  const totals = closingTotalsOf(row);
  const days = periodDays(config.dates.period);
  const dayCodes = days.map((d) => codes[d] ?? null);
  return { days, codes: dayCodes, paid: totals.paid, leavePaid: Math.max(0, totals.leave - totals.leaveOverdrawn) };
}

/**
 * The days of the period paid before the person's first level starts (spec 11.3 "có công nhưng chưa có mức"): from
 * the first of them to the day before the level. Those days are paid nothing; null when there are none.
 */
export function profileGapOf(
  row: TimesheetClosingRowDto,
  facts: PayrollProfileMonthDto,
  config: PayrollConfig,
): { from: string; to: string } | null {
  const first = [...facts.versions].sort(byFrom)[0];
  const base = dayCodesOf(row, config);
  if (!first || !base || first.from <= config.dates.period.from) return null;
  const paidBefore = (day: string) => paidBySegment({ ...base, splitOn: day }).before;
  const before = base.days.filter((d) => d < first.from);
  const from = before.find((d) => paidBefore(nextDay(d)) > 0);
  const to = before[before.length - 1];
  return from && to ? { from, to } : null;
}

/**
 * The contract type id of the level the period ends on when the month's config does not know it (spec 11.3): the
 * row cannot be computed. Null when it is known.
 */
export function unknownContractOf(facts: PayrollProfileMonthDto, config: PayrollConfig): string | null {
  const last = [...facts.versions]
    .sort(byFrom)
    .filter((v) => v.from <= config.dates.period.to)
    .pop();
  if (!last || config.contractTypes.some((t) => t.id === last.contractTypeId)) return null;
  return last.contractTypeId;
}

/** Spec 5.6: split by the codes of each day; a backfilled row without codes is one part at the last level. */
function segmentsOf({ row, facts, config }: LineInputArgs): PaySegment[] {
  const { period } = config.dates;
  const totals = closingTotalsOf(row);
  const base = dayCodesOf(row, config);
  if (base) {
    return paySegmentsFor({
      ...base,
      employment: row.employment,
      officialOn: row.officialOn,
      profiles: facts.versions,
    });
  }
  const last = facts.versions[facts.versions.length - 1];
  const probation = employmentOn(row, period.to) === 'probation';
  return [{ from: period.from, days: totals.paid, probation, amounts: last?.amounts ?? {} }];
}

/** (22), (23) as the engine reads them when HR has typed nothing: the D12 prefill and the close (spec 5.3). */
export function computedDaysOf(row: TimesheetClosingRowDto, config: PayrollConfig) {
  const totals = closingTotalsOf(row);
  const { restDays, sundayInPaid } = restDayPrefill(totals, config.options.sundayWork);
  return { restDays, sundayInPaid, holidayDays: totals.holidayWorked ?? 0, sundays: totals.sundayWorked ?? 0 };
}

/**
 * (21) typed by HR; (22), (23) prefilled, typed over when HR set them. Sunday work HR moves out of (17) into (22)
 * no longer gets the D12 extra 100% inside (17), so a Sunday is never paid twice.
 */
function overtimeOf(row: TimesheetClosingRowDto, config: PayrollConfig, inputs: PayrollMonthInputsDto): OvertimeInput {
  const computed = computedDaysOf(row, config);
  const restDays = inputs.restDays ?? computed.restDays;
  const sundayInPaid =
    inputs.restDays === null || config.options.sundayWork !== 'total-200'
      ? computed.sundayInPaid
      : Math.max(0, computed.sundays - restDays);
  return {
    weekdayHours: inputs.overtimeHours,
    restDays,
    sundayInPaid,
    holidayDays: inputs.holidayDays ?? computed.holidayDays,
  };
}

/** (32): the recurring items of the month plus the one-off ones HR typed, by kind (câu 4). */
function cashOf(facts: PayrollProfileMonthDto, inputs: PayrollMonthInputsDto): NonNullable<PayrollLineInput['cash']> {
  const items = [...facts.recurring, ...inputs.cash];
  const total = (kind: string) => items.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0);
  const paidBack = facts.recurring.filter((r) => r.kind === PAYROLL_INSURANCE_PAID);
  return {
    support: total('support'),
    refund: total('refund'),
    advance: total('advance'),
    insurancePaid: paidBack.length > 0 ? { taxable: paidBack.some((r) => r.taxable) } : null,
  };
}

/**
 * For the yearly check of a commitment (NĐ 253 Đ.50 k2): the taxable income of the tax year so far (opening balance
 * plus the months on the web), and the pays left in the year from this one on, each taken as this month's.
 */
function commitmentEstimateOf(
  facts: PayrollProfileMonthDto,
  yearBefore: PayrollYearPartDto,
): NonNullable<TaxPersonInput['commitmentEstimate']> {
  const payMonth = Number(facts.payDate.slice(5, 7));
  return { months: 12 - payMonth + 1, openingTaxable: yearBefore.taxable };
}

/** Engine input of one person, or undefined when the level's contract type is not in the month's config. */
export function lineInputOf(args: LineInputArgs): PayrollLineInput | undefined {
  const { row, facts, config, zone, inputs, yearBefore } = args;
  // A month that turns official goes by the contract it ends on, as every contract change does (spec 5.5, 5.6):
  // the brackets once official; insurance counts the days outside the insured contract (BH-1, 14-day rule).
  const steps = contractStepsOf(facts, row.officialOn, config);
  const contract = contractOf(steps, config);
  if (!contract) return undefined;
  const totals = closingTotalsOf(row);
  return {
    employeeId: row.employeeId,
    income: {
      norm: row.norm,
      segments: segmentsOf(args),
      kpiAmount: kpiLevelFor(facts.kpiLevels, config.dates.period, row.leftOn),
      kpiPercent: inputs.kpiPercent,
      block: row.block,
      overtime: overtimeOf(row, config, inputs),
      otherIncome: inputs.otherIncome,
      leavePayout: leaveItemFor(args)?.input,
    },
    insurance: {
      month: {
        month: config.dates.insuranceMonth,
        codes: row.codes ?? {},
        contracts: steps.map((s) => ({ from: s.from, insured: s.type?.insured ?? false })),
        joinedOn: row.joinedOn,
        leftOn: row.leftOn,
        leaveOverdrawn: totals.leaveOverdrawn,
        // Days 26–31 of the calendar month belong to the next period, not closed yet.
        provisionalFrom: `${config.dates.insuranceMonth}-26`,
      },
      zone,
      unionMember: facts.unionMember,
    },
    person: {
      contract,
      leftOn: row.leftOn,
      dependants: facts.dependants,
      hasCommitment: facts.hasCommitment,
      commitmentSignedOn: facts.commitmentSignedOn,
      commitmentEstimate: commitmentEstimateOf(facts, yearBefore),
      overtimeHoursBefore: yearBefore.overtimeHours,
      clothingExemptBefore: yearBefore.clothingExempt,
    },
    cash: cashOf(facts, inputs),
  };
}
