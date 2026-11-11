import {
  asHrFileSettings,
  computeLine,
  payrollConfigFor,
  payrollDates,
  type PayrollDates,
  type PayrollLineInput,
  type SettingRow,
} from '@careers/shared';
import { splitFuelPhoneRows } from '../../../../../../../packages/shared/test-fixtures/payroll-fixtures.js';
import { goldenInput } from '../../../../../../../packages/shared/test-fixtures/payroll-golden-inputs.js';
import {
  DEFAULT_ROWS,
  GOLDEN_PEOPLE,
  type GoldenPerson,
  type GoldenRow,
} from '../../../../../../../packages/shared/test-fixtures/payroll-golden.js';
import type { PayrollDownload, PayrollExportMonth, PayrollExportRow, PayrollStamp } from './types';

/**
 * The anonymous golden month of docs/test-cases-luong.md K3 (NV A…NV L), run through the engine and dressed as the
 * payroll API will hand it to the export. Names, codes, accounts and e-mails are made up.
 */

/** Khối of each golden person, as the K3 table has it. */
const BLOCKS: Readonly<Record<string, string>> = {
  'NV A': 'BO',
  'NV B': 'BO',
  'NV C': 'KD',
  'NV D': 'KD',
  'NV E': 'KD',
  'NV F': 'KD',
  'NV G': 'BO',
  'NV H': 'BO',
  'NV I': 'BO',
  'NV J': 'KD',
  'NV K': 'KD',
  'NV L': 'KD',
};

export const codeOf = (id: string) => id.replace(' ', '-');

/**
 * The expected cells of one golden person ('NV A'…'NV L') or of the 'Σ' row in the default configuration, read from
 * the catalogue table (L-K3-S01…S12) rather than typed again in each test.
 */
export function goldenCells(person: string): GoldenRow['cells'] {
  const found = DEFAULT_ROWS.find((r) => (person === 'Σ' ? r.id === 'Σ' : r.person === person));
  if (!found) throw new Error(`No golden row "${person}"`);
  return found.cells;
}

export const APPROVED: Extract<PayrollStamp, { kind: 'approved' }> = {
  kind: 'approved',
  round: 2,
  approvedAt: '2026-11-08T09:10',
  approvedBy: 'HR Lan',
};
export const DRAFT: PayrollStamp = { kind: 'draft', computedAt: '2026-12-02T10:15' };
export const DOWNLOAD: PayrollDownload = { at: '2026-12-20T14:03', by: 'HR Mai' };

export interface GoldenMonthOptions {
  year?: number;
  month?: number;
  asHrFile?: boolean;
  stamp?: PayrollStamp;
  settings?: SettingRow[];
  people?: readonly GoldenPerson[];
  /** Change one person's engine input, e.g. add unused leave or a back pay. */
  adjust?: (p: GoldenPerson, input: PayrollLineInput) => PayrollLineInput;
}

interface RowArgs {
  dates: PayrollDates;
  settings: SettingRow[];
  asHrFile: boolean;
  adjust: NonNullable<GoldenMonthOptions['adjust']>;
}

function rowOf(p: GoldenPerson, index: number, { dates, settings, asHrFile, adjust }: RowArgs) {
  const base = goldenInput(p, { asHrFile });
  const input = adjust(p, {
    ...base,
    insurance: { ...base.insurance, month: { ...base.insurance.month, month: dates.insuranceMonth } },
  });
  const config = payrollConfigFor(settings, p.id, dates);
  const code = codeOf(p.id);
  const row: PayrollExportRow = {
    person: {
      employeeId: p.id,
      code,
      name: p.id,
      title: 'Nhân viên',
      block: BLOCKS[p.id] ?? null,
      contractTypeId: p.contract,
      contractName: config.contractTypes.find((t) => t.id === p.contract)?.name ?? p.contract,
      region: p.region,
      regionOrder: p.region === 'HCM' ? 0 : 1,
      dependants: 0,
      kpiAmount: p.kpiAmount,
      email: `${code.toLowerCase()}@example.test`,
      bankAccount: `90000000${String(index + 10)}`,
      bankName: 'Ngân hàng Thử',
    },
    line: computeLine(input, config),
    cash: asHrFile ? { support: 0, refund: p.cash, advance: 0 } : { support: p.cash, refund: 0, advance: 0 },
  };
  return row;
}

export function goldenExportMonth(options: GoldenMonthOptions = {}): PayrollExportMonth {
  const dates = payrollDates(options.year ?? 2026, options.month ?? 10);
  const asHrFile = options.asHrFile ?? false;
  const settings = options.settings ?? (asHrFile ? asHrFileSettings('2026-01') : []);
  const people = options.people ?? GOLDEN_PEOPLE;
  const args: RowArgs = { dates, settings, asHrFile, adjust: options.adjust ?? ((_p, input) => input) };
  return {
    dates,
    config: payrollConfigFor(settings, null, dates),
    rows: people.map((p, i) => rowOf(p, i, args)),
    norms: [
      { region: 'HCM', norm: 22 },
      { region: 'HN', norm: 24 },
    ],
    stamp: options.stamp ?? APPROVED,
    closingNo: 1,
    formulaVersion: 'luong-2026.11',
  };
}

/**
 * The golden month for a company that pays fuel and phone apart (spec 5.9, câu 3): "Xăng xe" taxable and "Điện thoại"
 * exempt up to the profile, each person paid the two amounts the catalogue lists.
 */
export function goldenSplitMonth(options: GoldenMonthOptions = {}): PayrollExportMonth {
  return goldenExportMonth({
    ...options,
    settings: [...splitFuelPhoneRows('2026-01'), ...(options.settings ?? [])],
    adjust: (p, input) => ({
      ...input,
      income: { ...input.income, segments: input.income.segments.map((s) => ({ ...s, amounts: p.amounts })) },
    }),
  });
}
