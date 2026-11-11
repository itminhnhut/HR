import { contractTypeFor, payrollDates, type PayrollLineInput } from '../src/payroll/index.js';
import type { GoldenColumn, GoldenPerson } from './payroll-golden.js';

/** Engine inputs for the anonymous golden month (docs/test-cases-luong.md, K3), in each configuration. */

export const GOLDEN_MONTH = payrollDates(2026, 10);

export interface GoldenMode {
  /** The file's columns: (32) a refund, KPI % as typed, NV L's other income. */
  asHrFile: boolean;
}

export function goldenInput(p: GoldenPerson, mode: GoldenMode): PayrollLineInput {
  const kind = contractTypeFor([], p.contract, p.id, GOLDEN_MONTH.monthKey);
  const probation = p.contract === 'thu-viec';
  // Both configurations pay fuel and phone as one "Xăng xe + ĐT" (spec 17.3 K2); the catalogue lists them apart.
  const { xang = 0, 'dien-thoai': phone = 0, ...rest } = p.amounts;
  const amounts = { ...rest, 'xang-dt': xang + phone };
  return {
    employeeId: p.id,
    income: {
      norm: p.norm,
      segments: [{ days: p.days, probation, amounts }],
      kpiAmount: p.kpiAmount,
      kpiPercent: mode.asHrFile ? p.fileKpiPercent : p.kpiPercent,
      block: p.block,
      otherIncome: mode.asHrFile && p.fileOtherIncome > 0 ? [{ amount: p.fileOtherIncome, taxable: true }] : [],
    },
    insurance: {
      month: {
        month: GOLDEN_MONTH.insuranceMonth,
        codes: {},
        contracts: [{ from: '2020-01-01', insured: kind.insured }],
        joinedOn: p.joinedOn,
        leftOn: p.leftOn,
      },
      zone: 'I',
      unionMember: false,
    },
    person: { contract: kind, leftOn: p.leftOn, dependants: 0, hasCommitment: probation },
    cash: mode.asHrFile ? { refund: p.cash } : { support: p.cash },
  };
}

/** The golden columns of a computed row; (19) to the four decimals of a percentage the catalogue shows. */
export const goldenCellsOf = (
  line: { cells: Record<GoldenColumn, number> },
  columns: readonly GoldenColumn[],
): Partial<Record<GoldenColumn, number>> =>
  Object.fromEntries(
    columns.map((key) => [key, key === 'kpiPercent' ? Number(line.cells.kpiPercent.toFixed(6)) : line.cells[key]]),
  );
