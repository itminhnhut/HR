import {
  computeLine,
  employmentOn,
  explainLine,
  payrollConfigFor,
  toNumber,
  type PayrollCellKey,
  type EmployeeBlock,
  type PayrollConfig,
  type PayrollDates,
  type PayrollLine,
  type PayrollLineDto,
  type PayrollMonthInputsDto,
  type PayrollOverrideDto,
  type PayrollProfileMonthDto,
  type PayrollYearPartDto,
  type ReviewRowInput,
  type SettingRow,
  type TimesheetClosingRowDto,
  type Zone,
} from '@careers/shared';
import { leavePayoutDtoOf, type LeaveBase, type LeaveItem } from './payroll-leave-payout.js';
import {
  closingTotalsOf,
  computedDaysOf,
  defaultedContractOf,
  leaveItemFor,
  lineInputOf,
} from './payroll-month-input.js';
import { yearBeforeOf, yearPartOfLine } from './payroll-year.js';

/**
 * One row of a payroll month as the grid shows it (spec 11.2) and what Rà soát reads of it (11.3). Someone in the close
 * without a profile (or on a contract type the month does not know) gets a zero row and a red warning, never a crash.
 */

/** What the month knows about a person apart from the close row. */
export interface PersonFacts {
  /** Null: no level in force during the period. */
  facts: PayrollProfileMonthDto | null;
  zone: Zone;
  hasBankAccount: boolean;
  /** "Ngày vào 07/10/2026" for each date of the row HR has not confirmed (spec 11.3). */
  unconfirmedDates: string[];
  /** What HR typed for the person this month. */
  inputs: PayrollMonthInputsDto;
  /** The person's block today, read when the close has none (a draft only); null to go by the close alone. */
  currentBlock: EmployeeBlock | null;
  /** Σ of the earlier pay months of the tax year on the web (`yearSoFarOf`), without the opening balance. */
  yearMonths: PayrollYearPartDto;
  /** What unused leave is paid on (`leaveBaseOf`); null for someone not leaving in the period. */
  leaveBase: LeaveBase | null;
}

export interface BuiltLine {
  dto: PayrollLineDto;
  /** Null for a zero row: it adds nothing to the totals. */
  line: PayrollLine | null;
  review: ReviewRowInput;
  regionId: string;
}

export const NO_PROFILE_NOTE = 'Chưa có hồ sơ lương';
/** Ghi chú of a line whose block is the person's of today: the close was made before HR gave one. */
export const BLOCK_FROM_PERSON_NOTE = 'Khối lấy từ hồ sơ nhân viên (lần chốt công chưa có khối)';

const ZERO_CELLS = (): Record<PayrollCellKey, number> => ({
  kpiBonus: 0,
  otherIncome: 0,
  overtimePay: 0,
  income: 0,
  socialBase: 0,
  social: 0,
  health: 0,
  unemployment: 0,
  unionFee: 0,
  cash: 0,
  exempt: 0,
  taxable: 0,
  personalDeduction: 0,
  dependantDeduction: 0,
  insuranceDeduction: 0,
  assessable: 0,
  tax: 0,
  totalDeductions: 0,
  netPay: 0,
  companySocial: 0,
  companyHealth: 0,
  companyUnemployment: 0,
  unionFund: 0,
  companyTotal: 0,
  totalCost: 0,
  gross: 0,
  paidDays: 0,
  dailyRate: 0,
  kpiPercent: 0,
  overtimeHours: 0,
  restDays: 0,
  holidayDays: 0,
});

function personOf(row: TimesheetClosingRowDto, config: PayrollConfig) {
  return {
    employeeId: row.employeeId,
    code: row.code,
    fullName: row.fullName,
    department: row.department,
    regionId: row.regionId,
    block: row.block,
    probation: employmentOn(row, config.dates.period.to) === 'probation',
    norm: row.norm,
  };
}

function reviewOf(
  row: TimesheetClosingRowDto,
  person: PersonFacts,
  config: PayrollConfig,
  computed: {
    line: PayrollLine | null;
    contractTypeId: string | null;
    defaultedContract?: string | null;
    leave?: LeaveItem | null;
  },
): ReviewRowInput {
  const leave = computed.leave;
  const totals = closingTotalsOf(row);
  const { facts } = person;
  const hasCommitment = facts?.hasCommitment ?? false;
  return {
    employeeId: row.employeeId,
    label: `${row.code} ${row.fullName}`,
    line: computed.line,
    config,
    closing: {
      paid: totals.paid,
      norm: row.norm,
      overtime: totals.overtime,
      sundayWorked: totals.sundayWorked ?? 0,
      leaveClosing: totals.leaveClosing,
      leaveOverdrawn: totals.leaveOverdrawn,
    },
    employment: {
      leftOn: row.leftOn,
      contractTypeId: computed.contractTypeId,
      defaultedContract: computed.defaultedContract ?? null,
      block: row.block,
      unconfirmedDates: person.unconfirmedDates,
    },
    profile: { exists: computed.line !== null, gap: null },
    inputs: {
      restDaysTyped: person.inputs.restDays,
      paidDaysTyped: null,
      overtimeHoursBefore: facts ? yearBeforeOf(facts, person.yearMonths).overtimeHours : 0,
      leavePayoutTyped: leave && leave.typed !== null ? { computed: leave.computed, typed: leave.typed } : null,
    },
    person: {
      hasCommitment,
      commitmentYear: facts?.lastCommitmentYear ?? null,
      hasBankAccount: person.hasBankAccount,
    },
    previous: null,
  };
}

function zeroLine(row: TimesheetClosingRowDto, person: PersonFacts, config: PayrollConfig): BuiltLine {
  const dto: PayrollLineDto = {
    ...personOf(row, config),
    contractTypeId: '',
    amounts: {},
    kpiAmount: 0,
    cells: { ...ZERO_CELLS(), paidDays: closingTotalsOf(row).paid },
    explain: {},
    overrides: [],
    personSettings: [],
    note: NO_PROFILE_NOTE,
    inputs: person.inputs,
  };
  const review = reviewOf(row, person, config, { line: null, contractTypeId: null });
  return { dto, line: null, review, regionId: row.regionId };
}

/**
 * The cells HR typed over a number the engine computes (spec 6.3): (19) over the probation formula or the D06
 * suggestion (an official person's % has nothing computed to type over), (22) over the D12 prefill, (23) over the
 * close. The reason is HR's note for the person this month.
 */
function overridesOf(
  inputs: PayrollMonthInputsDto,
  line: PayrollLine,
  computedDays: { restDays: number; holidayDays: number },
  leave: LeaveItem | null,
): PayrollOverrideDto[] {
  const { updatedBy, updatedAt } = inputs;
  if (!updatedBy || !updatedAt) return [];
  const typedOver: [PayrollCellKey, number | null, number][] = [
    [
      'kpiPercent',
      line.income.kpiPercentComputed.n === 0n ? null : inputs.kpiPercent,
      toNumber(line.income.kpiPercentComputed),
    ],
    ['restDays', inputs.restDays, computedDays.restDays],
    ['holidayDays', inputs.holidayDays, computedDays.holidayDays],
    // (24) holds the leave payout: the cell is typed over when HR set its amount.
    ['otherIncome', leave?.typed ?? null, leave?.computed ?? 0],
  ];
  return typedOver.flatMap(([cell, typed, computed]) =>
    typed === null ? [] : [{ cell, computed, typed, reason: inputs.note, by: updatedBy, at: updatedAt }],
  );
}

/**
 * Spec 10.1: the block is the close's. A close made before HR gave the person a block has none; the month then reads
 * the person's block of today instead of making HR reopen the timesheet. A block the close has always wins.
 */
function withBlock(row: TimesheetClosingRowDto, person: PersonFacts): { row: TimesheetClosingRowDto; note: string } {
  if (row.block || !person.currentBlock) return { row, note: '' };
  return { row: { ...row, block: person.currentBlock }, note: BLOCK_FROM_PERSON_NOTE };
}

const joinNotes = (...notes: string[]) => notes.filter(Boolean).join('; ');

/** One person of the close: the engine's row, its tooltips and what Rà soát reads. */
export function buildLine(
  closingRow: TimesheetClosingRowDto,
  person: PersonFacts,
  rows: readonly SettingRow[],
  dates: PayrollDates,
): BuiltLine {
  const { row, note: blockNote } = withBlock(closingRow, person);
  const config = payrollConfigFor(rows, row.employeeId, dates);
  const { facts } = person;
  if (!facts) return zeroLine(row, person, config);
  const yearBefore = yearBeforeOf(facts, person.yearMonths);
  const args = {
    row,
    facts,
    config,
    zone: person.zone,
    inputs: person.inputs,
    yearBefore,
    leaveBase: person.leaveBase,
  };
  const input = lineInputOf(args);
  if (!input) return zeroLine(row, person, config);
  const leave = leaveItemFor(args);
  const line = computeLine(input, config);
  const explain = explainLine(input, line, config);
  const dto: PayrollLineDto = {
    ...personOf(row, config),
    contractTypeId: input.person.contract.id,
    amounts: { ...line.amounts },
    kpiAmount: input.income.kpiAmount,
    cells: {
      ...line.cells,
      overtimeHours: line.overtime.weekdayHours,
      restDays: line.overtime.restDays,
      holidayDays: line.overtime.holidayDays,
    },
    explain: explain.cells,
    overrides: overridesOf(person.inputs, line, computedDaysOf(row, config), leave),
    personSettings: explain.personSettings,
    note: joinNotes(explain.note, blockNote),
    inputs: person.inputs,
    year: { before: yearBefore, month: yearPartOfLine(line) },
    leavePayout: leave ? leavePayoutDtoOf(leave, line, config) : null,
  };
  const computed = {
    line,
    contractTypeId: input.person.contract.id,
    defaultedContract: defaultedContractOf(row, facts, config)?.name ?? null,
    leave,
  };
  return { dto, line, review: reviewOf(row, person, config, computed), regionId: row.regionId };
}
