import { PROFILE_K } from './payroll-fixtures.js';
import {
  computeLine,
  contractTypeFor,
  payrollConfigFor,
  payrollDates,
  type PayrollLineInput,
  type ReviewItem,
  type ReviewMonthInput,
  type ReviewRowInput,
  type SettingRow,
} from '../src/payroll/index.js';

/** Inputs for the Rà soát tests (docs/test-cases-luong.md): one computed row and what the review reads besides it. */

const OCTOBER = payrollDates(2026, 10);

/** KPCĐ on, so a row has nothing to say by default; off (the company default) adds a yellow notice for the month. */
export const UNION_FUND_ON: SettingRow = {
  key: 'tuy-chon.d03',
  employeeId: null,
  from: '2026-01',
  value: 'when-social',
};

export const NO_CONTRACT_COMMITMENT: SettingRow = {
  key: 'loai-hd.thu-viec.cam-ket-kem-hd',
  employeeId: null,
  from: '2026-01',
  value: false,
};

export interface RowOver {
  probation?: boolean;
  days?: number;
  amounts?: Readonly<Record<string, number>>;
  kpiPercent?: number | null;
  kpiAmount?: number;
  leftOn?: string | null;
  advance?: number;
  commitment?: boolean;
  /** False: "Cam kết thuế kèm hợp đồng" turned off for everyone. */
  contractCommitment?: boolean;
  insurancePaid?: { taxable: boolean };
  overtime?: { weekdayHours: number; restDays: number; holidayDays: number };
  rows?: SettingRow[];
  block?: 'BO' | 'KD';
}

export function rowInput(over: RowOver = {}, extra: Partial<ReviewRowInput> = {}): ReviewRowInput {
  const probation = over.probation ?? false;
  const rows = [
    ...(over.rows ?? [UNION_FUND_ON]),
    ...(over.contractCommitment === false ? [NO_CONTRACT_COMMITMENT] : []),
  ];
  const kind = contractTypeFor(rows, probation ? 'thu-viec' : 'khong-thoi-han', 'nv-a', OCTOBER.monthKey);
  const leftOn = over.leftOn ?? null;
  const amounts = over.amounts ?? PROFILE_K;
  const config = payrollConfigFor(rows, 'nv-a', OCTOBER);
  const input: PayrollLineInput = {
    employeeId: 'nv-a',
    income: {
      norm: 22,
      segments: [{ days: over.days ?? 22, probation, amounts }],
      kpiAmount: over.kpiAmount ?? 0,
      kpiPercent: over.kpiPercent ?? null,
      block: over.block ?? 'BO',
      overtime: over.overtime,
    },
    insurance: {
      month: {
        month: '2026-10',
        codes: {},
        contracts: [{ from: '2020-01-01', insured: kind.insured }],
        joinedOn: null,
        leftOn,
      },
      zone: 'I',
      unionMember: false,
    },
    person: { contract: kind, leftOn, dependants: 0, hasCommitment: over.commitment ?? probation },
    cash: { advance: over.advance ?? 0, insurancePaid: over.insurancePaid ?? null },
  };
  return {
    employeeId: 'nv-a',
    label: 'NV A',
    line: computeLine(input, config),
    config,
    closing: { paid: over.days ?? 22, norm: 22, overtime: 0, sundayWorked: 0, leaveClosing: 0, leaveOverdrawn: 0 },
    employment: { leftOn, contractTypeId: kind.id, block: over.block ?? 'BO', unconfirmedDates: [] },
    profile: { exists: true, gap: null },
    inputs: { restDaysTyped: null, paidDaysTyped: null, overtimeHoursBefore: 0 },
    person: { hasCommitment: over.commitment ?? probation, commitmentYear: null, hasBankAccount: true },
    previous: null,
    ...extra,
  };
}

export const reviewMonth = (rows: ReviewRowInput[], over: Partial<ReviewMonthInput> = {}): ReviewMonthInput => ({
  rows,
  previousMonthDraft: false,
  retroPending: 0,
  firstWebMonth: false,
  closingConfirmed: true,
  ...over,
});

export const codes = (items: readonly ReviewItem[]) => items.map((i) => `${i.level}:${i.code}`);
export const find = (items: readonly ReviewItem[], code: string) => items.find((i) => i.code === code);
