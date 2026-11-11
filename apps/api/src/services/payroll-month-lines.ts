import {
  computeLine,
  employmentOn,
  explainLine,
  payrollConfigFor,
  roundDong,
  toNumber,
  type PayrollCellKey,
  type EmployeeBlock,
  type PayrollConfig,
  type PayrollDates,
  type PayrollLine,
  type PayrollLineDto,
  type PayrollLineInput,
  type PayrollLineSheetDto,
  type PayrollMonthInputsDto,
  type PayrollOverrideDto,
  type PayrollProfileMonthDto,
  type PayrollYearPartDto,
  type ReviewRowInput,
  type SettingRow,
  type TimesheetClosingRowDto,
  type Zone,
} from '@careers/shared';
import { masked } from './payroll-bank.js';
import { leavePayoutDtoOf, type LeaveBase, type LeaveItem } from './payroll-leave-payout.js';
import {
  closingTotalsOf,
  computedDaysOf,
  defaultedContractOf,
  leaveItemFor,
  lineInputOf,
  profileGapOf,
  unknownContractOf,
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
  /** Email nhận phiếu lương typed in Chấm công › Nhân viên; null when none. */
  email: string | null;
  /** The account in force on the pay date, without its number: bank and last four digits. */
  bank: { bank: string; last4: string } | null;
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
  /** (42) of the person in the approval of the month before; null when it is not approved or has no row of them. */
  previousNet: number | null;
  /** The probation days of the person's level, while on probation in the period; null otherwise. */
  probation: { days: number; managesBusiness: boolean } | null;
}

export interface BuiltLine {
  dto: PayrollLineDto;
  /** Null for a zero row: it adds nothing to the totals. */
  line: PayrollLine | null;
  review: ReviewRowInput;
  regionId: string;
}

export const NO_PROFILE_NOTE = 'Chưa có hồ sơ lương';
const unknownContractNote = (id: string) => `Loại HĐ ${id} không còn trong cấu hình`;

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

/** What HR's sheet and the payslip print beyond the grid (spec 12.1, 11.7); the account is its last four digits. */
function sheetOf(row: TimesheetClosingRowDto, person: PersonFacts, line: PayrollLine | null): PayrollLineSheetDto {
  return {
    title: row.title,
    dependants: person.facts?.dependants ?? 0,
    taxMethod: line?.tax.method ?? null,
    paid: Object.fromEntries((line?.income.componentPaid ?? []).map((c) => [c.component.id, roundDong(c.paid)])),
    payslipEmail: person.email,
    bankName: person.bank?.bank ?? null,
    bankAccount: person.bank ? masked(person.bank.last4) : null,
  };
}

/** What the row computed, for Rà soát. */
interface Computed {
  line: PayrollLine | null;
  contractTypeId: string | null;
  /** False for the zero row of someone without a level in force. */
  hasProfile: boolean;
  defaultedContract?: string | null;
  leave?: LeaveItem | null;
  gap?: { from: string; to: string } | null;
  unknownContract?: string | null;
}

function closingFor(row: TimesheetClosingRowDto): ReviewRowInput['closing'] {
  const totals = closingTotalsOf(row);
  return {
    paid: totals.paid,
    norm: row.norm,
    overtime: totals.overtime,
    sundayWorked: totals.sundayWorked ?? 0,
    leaveClosing: totals.leaveClosing,
    leaveOverdrawn: totals.leaveOverdrawn,
  };
}

/** Câu 33: the probation days of the level against BLLĐ Đ.25 (180 days to manage a business, else 60 at most). */
function probationOf(person: PersonFacts, config: PayrollConfig): ReviewRowInput['employment']['probation'] {
  if (!person.probation) return null;
  const limits = config.law.probationLimits;
  return { days: person.probation.days, limit: person.probation.managesBusiness ? limits.manager : limits.college };
}

function employmentFor(
  row: TimesheetClosingRowDto,
  person: PersonFacts,
  config: PayrollConfig,
  computed: Computed,
): ReviewRowInput['employment'] {
  return {
    leftOn: row.leftOn,
    contractTypeId: computed.contractTypeId,
    defaultedContract: computed.defaultedContract ?? null,
    block: row.block,
    unconfirmedDates: person.unconfirmedDates,
    probation: probationOf(person, config),
    unknownContract: computed.unknownContract ?? null,
  };
}

function reviewOf(
  row: TimesheetClosingRowDto,
  person: PersonFacts,
  config: PayrollConfig,
  computed: Computed,
): ReviewRowInput {
  const { leave } = computed;
  const { facts } = person;
  return {
    employeeId: row.employeeId,
    label: `${row.code} ${row.fullName}`,
    line: computed.line,
    config,
    closing: closingFor(row),
    employment: employmentFor(row, person, config, computed),
    profile: { exists: computed.hasProfile, gap: computed.gap ?? null },
    inputs: {
      restDaysTyped: person.inputs.restDays,
      paidDaysTyped: null,
      overtimeHoursBefore: facts ? yearBeforeOf(facts, person.yearMonths).overtimeHours : 0,
      leavePayoutTyped: leave && leave.typed !== null ? { computed: leave.computed, typed: leave.typed } : null,
    },
    person: {
      hasCommitment: facts?.hasCommitment ?? false,
      commitmentYear: facts?.lastCommitmentYear ?? null,
      hasBankAccount: person.hasBankAccount,
      hasPayslipEmail: Boolean(person.email),
    },
    previous: person.previousNet === null ? null : { netPay: person.previousNet, causes: [] },
  };
}

/**
 * A row paid nothing: someone without a level in force (`unknownContract` null), or whose level stands on a contract
 * type the month's config does not know; either way Rà soát says it in red.
 */
function zeroLine(
  row: TimesheetClosingRowDto,
  person: PersonFacts,
  config: PayrollConfig,
  unknownContract: string | null = null,
): BuiltLine {
  const dto: PayrollLineDto = {
    ...personOf(row, config),
    contractTypeId: '',
    amounts: {},
    kpiAmount: 0,
    cells: { ...ZERO_CELLS(), paidDays: closingTotalsOf(row).paid },
    explain: {},
    overrides: [],
    personSettings: [],
    note: unknownContract ? unknownContractNote(unknownContract) : NO_PROFILE_NOTE,
    inputs: person.inputs,
    sheet: sheetOf(row, person, null),
  };
  const computed = {
    line: null,
    contractTypeId: unknownContract,
    hasProfile: unknownContract !== null,
    unknownContract,
  };
  return { dto, line: null, review: reviewOf(row, person, config, computed), regionId: row.regionId };
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
function withBlock(
  row: TimesheetClosingRowDto,
  person: PersonFacts,
): { row: TimesheetClosingRowDto; fromPerson: boolean } {
  if (row.block || !person.currentBlock) return { row, fromPerson: false };
  return { row: { ...row, block: person.currentBlock }, fromPerson: true };
}

/** Said on the Khối cell and once in Rà soát, never in the row's note: the note is printed on Excel and payslips. */
const blockMark = (fromPerson: boolean) => (fromPerson ? { blockFromPerson: true } : {});

interface LineDtoArgs {
  row: TimesheetClosingRowDto;
  person: PersonFacts;
  config: PayrollConfig;
  input: PayrollLineInput;
  line: PayrollLine;
  leave: LeaveItem | null;
  yearBefore: PayrollYearPartDto;
  fromPerson: boolean;
}

/** The computed row as the grid shows it. */
function lineDtoOf({ row, person, config, input, line, leave, yearBefore, fromPerson }: LineDtoArgs): PayrollLineDto {
  const explain = explainLine(input, line, config);
  return {
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
    ...blockMark(fromPerson),
    note: explain.note,
    inputs: person.inputs,
    year: { before: yearBefore, month: yearPartOfLine(line) },
    leavePayout: leave ? leavePayoutDtoOf(leave, line, config) : null,
    sheet: sheetOf(row, person, line),
  };
}

/** One person of the close: the engine's row, its tooltips and what Rà soát reads. */
export function buildLine(
  closingRow: TimesheetClosingRowDto,
  person: PersonFacts,
  rows: readonly SettingRow[],
  dates: PayrollDates,
): BuiltLine {
  const { row, fromPerson } = withBlock(closingRow, person);
  const config = payrollConfigFor(rows, row.employeeId, dates);
  const { facts } = person;
  if (!facts) return zeroLine(row, person, config);
  const yearBefore = yearBeforeOf(facts, person.yearMonths);
  const { zone, inputs, leaveBase } = person;
  const args = { row, facts, config, zone, inputs, yearBefore, leaveBase };
  const input = lineInputOf(args);
  if (!input) return zeroLine(row, person, config, unknownContractOf(facts, config));
  const leave = leaveItemFor(args);
  const line = computeLine(input, config);
  const dto = lineDtoOf({ row, person, config, input, line, leave, yearBefore, fromPerson });
  const computed = {
    line,
    contractTypeId: input.person.contract.id,
    hasProfile: true,
    defaultedContract: defaultedContractOf(row, facts, config)?.name ?? null,
    leave,
    gap: profileGapOf(row, facts, config),
  };
  return { dto, line, review: reviewOf(row, person, config, computed), regionId: row.regionId };
}
