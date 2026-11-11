import { describe, expect, it } from 'vitest';
import { KPI_K, PROFILE_HIGH, PROFILE_K } from '../../test-fixtures/payroll-fixtures.js';
import { MATRIX_PATHS, type MatrixPath } from '../../test-fixtures/payroll-matrix.js';
import {
  computeLine,
  contractTypeFor,
  payrollConfigFor,
  payrollDates,
  payrollTotals,
  type PayrollLine,
  type PayrollLineInput,
  type SettingRow,
} from './index.js';

/** Net pay, cost, the total row and the 64-path matrix. Cases: docs/test-cases-luong.md, L-D37, L-K2, L-K1-14–21. */

const OCTOBER = payrollDates(2026, 10);
const config = (rows: SettingRow[] = []) => payrollConfigFor(rows, 'nv', OCTOBER);
const contract = (id: string) => contractTypeFor([], id, 'nv', OCTOBER.monthKey);

interface Path {
  probation: boolean;
  days: number;
  norm?: number;
  leftOn?: string | null;
  amounts?: Readonly<Record<string, number>>;
  kpiAmount?: number;
  kpiPercent?: number | null;
  block?: 'BO' | 'KD';
  overtime?: boolean;
  support?: number;
  refund?: number;
  advance?: number;
  member?: boolean;
  commitment?: boolean;
  insurancePaid?: { taxable: boolean };
}

function lineInput(p: Path): PayrollLineInput {
  const base = contract(p.probation ? 'thu-viec' : 'khong-thoi-han');
  // `commitment: false` is a person with neither a signed commitment nor the one of the contract.
  const kind = p.commitment === false ? { ...base, commitmentIncluded: false } : base;
  const leftOn = p.leftOn ?? null;
  return {
    employeeId: 'nv',
    income: {
      norm: p.norm ?? 22,
      segments: [{ days: p.days, probation: p.probation, amounts: p.amounts ?? PROFILE_K }],
      kpiAmount: p.kpiAmount ?? 0,
      kpiPercent: p.kpiPercent ?? null,
      block: p.block ?? 'BO',
      overtime: p.overtime ? { weekdayHours: 10, restDays: 1, holidayDays: 0 } : undefined,
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
      unionMember: p.member ?? false,
    },
    person: { contract: kind, leftOn, dependants: 0, hasCommitment: p.commitment ?? p.probation },
    cash: {
      support: p.support ?? 0,
      refund: p.refund ?? 0,
      advance: p.advance ?? 0,
      insurancePaid: p.insurancePaid ?? null,
    },
  };
}

const line = (p: Path, rows: SettingRow[] = []) => computeLine(lineInput(p), config(rows));

describe('net pay (42) and total cost (48)', () => {
  it('L-D37: should pay income − insurance − union fee − tax + support + refund − advance', () => {
    // Act: profile K official, member, support 700.000, refund 500.000, advance 2.000.000
    const r = line({ probation: false, days: 22, member: true, support: 700_000, refund: 500_000, advance: 2_000_000 });
    const c = r.cells;

    // Assert
    expect(c.cash).toBe(700_000 + 500_000 - 2_000_000);
    expect(c.totalDeductions).toBe(c.social + c.health + c.unemployment + c.unionFee + c.tax);
    expect(c.netPay).toBe(
      c.income - c.social - c.health - c.unemployment - c.unionFee - c.tax + 700_000 + 500_000 - 2_000_000,
    );
    expect(c.unionFee).toBe(47_500);
  });

  it('L-D13: should leave a refund out of taxable income and out of the cost', () => {
    // Act
    const withRefund = line({ probation: false, days: 22, refund: 500_000 });
    const without = line({ probation: false, days: 22 });

    // Assert
    expect(withRefund.cells.taxable).toBe(without.cells.taxable);
    expect(withRefund.cells.totalCost).toBe(without.cells.totalCost);
    expect(withRefund.cells.netPay - without.cells.netPay).toBe(500_000);
  });

  it('L-D13: should leave a refund out of the 10% base', () => {
    // Act: a leaver withheld 10%
    const withRefund = line({ probation: false, days: 14, leftOn: '2026-10-15', refund: 500_000 });
    const without = line({ probation: false, days: 14, leftOn: '2026-10-15' });

    // Assert
    expect(withRefund.cells.tax).toBe(without.cells.tax);
  });

  it('should add the employee insurance the company pays back to (32) and net pay, outside tax and cost, as the sheet', () => {
    // Act
    const paid = line({ probation: false, days: 22, insurancePaid: { taxable: false } });
    const without = line({ probation: false, days: 22 });
    const c = paid.cells;

    // Assert: (32) = (28) + (29) + (30), nothing typed
    expect(c.cash).toBeGreaterThan(0);
    expect(c.cash).toBe(c.social + c.health + c.unemployment);
    expect(c.netPay - without.cells.netPay).toBe(c.cash);
    expect([c.taxable, c.tax, c.totalCost]).toEqual([
      without.cells.taxable,
      without.cells.tax,
      without.cells.totalCost,
    ]);
    expect(paid.insurancePaid).toEqual({ amount: c.cash, taxable: false });
  });

  it('should tax the insurance the company pays back and count it in the cost once "Tính thuế" is on', () => {
    // Act
    const paid = line({ probation: false, days: 22, insurancePaid: { taxable: true } });
    const support = line({ probation: false, days: 22, support: paid.cells.cash });

    // Assert: the same row as a support of that amount
    expect(paid.cells.cash).toBe(paid.cells.insuranceDeduction);
    expect(paid.cells).toEqual(support.cells);
  });

  it('should pay nothing back to a person who pays no insurance, and add it to the other (32) items', () => {
    // Act
    const probation = line({ probation: true, days: 22, insurancePaid: { taxable: false } });
    const mixed = line({
      probation: false,
      days: 22,
      support: 700_000,
      advance: 200_000,
      insurancePaid: { taxable: false },
    });

    // Assert
    expect(probation.cells.cash).toBe(0);
    expect(mixed.cells.cash).toBe(500_000 + mixed.cells.insuranceDeduction);
  });

  it('should keep (32) equal to the unrounded insurance in the "as HR\'s file" mode', () => {
    // Act
    const rows: SettingRow[] = [{ key: 'tuy-chon.d01', employeeId: null, from: '2026-01', value: 'as-hr' }];
    const r = line({ probation: false, days: 22, insurancePaid: { taxable: false } }, rows);

    // Assert
    expect(r.exact.cash).toEqual(r.exact.insuranceDeduction);
  });

  it('L-K1-14: should pay 11.860.228 net and cost 16.328.864, without KPCĐ, for the official leaver on 14/22 days', () => {
    // Act
    const c = line({ probation: false, days: 14, leftOn: '2026-10-15', kpiAmount: KPI_K, kpiPercent: 0 }).cells;

    // Assert
    expect([c.tax, c.netPay, c.unionFund, c.totalCost]).toEqual([1_428_636, 11_860_228, 0, 16_328_864]);
  });

  it('L-K1-15: should pay 3.939.318 net for the leaver of 01/10 on 4/22 days, BHYT only', () => {
    expect(
      line({ probation: false, days: 4, leftOn: '2026-10-01', kpiAmount: KPI_K, kpiPercent: 0 }).cells.netPay,
    ).toBe(3_939_318);
  });

  it('L-K1-16: should pay 29.655.000 net with the commitment and 26.689.500 without it', () => {
    // Act
    const withIt = line({ probation: true, days: 22, kpiAmount: KPI_K });
    const without = line({ probation: true, days: 22, kpiAmount: KPI_K, commitment: false });

    // Assert
    expect([withIt.cells.netPay, without.cells.netPay]).toEqual([29_655_000, 26_689_500]);
  });

  it('L-K1-17: should pay 32.076.000 net once HR turns the commitment off', () => {
    expect(
      line({ probation: true, days: 22, amounts: PROFILE_HIGH, kpiAmount: 4_200_000, commitment: false }).cells.netPay,
    ).toBe(32_076_000);
  });
});

describe('insurance salary (27) of the default catalogue (spec 17.3 K3)', () => {
  const FULL_MONTH: Path = { probation: false, days: 22 };
  const attendanceInsured = (employeeId: string | null): SettingRow[] => [
    { key: 'khoan.chuyen-can.tinh-bh', employeeId, from: '2026-10', value: true },
  ];

  it('should insure the time salary and the position allowance, but not the attendance allowance, by default', () => {
    // Act: Hồ sơ K, salary 8.000.000 + position 1.500.000 + attendance 1.000.000
    const c = line(FULL_MONTH).cells;

    // Assert: 8.000.000 + 1.500.000
    expect(c.socialBase).toBe(9_500_000);
  });

  it('should put the attendance allowance back into (27) when HR turns "tính BH" on for everyone', () => {
    // Act
    const c = line(FULL_MONTH, attendanceInsured(null)).cells;

    // Assert: 8.000.000 + 1.500.000 + 1.000.000
    expect(c.socialBase).toBe(10_500_000);
  });

  it('should put the attendance allowance back into (27) for the one person HR turns "tính BH" on for', () => {
    // Act
    const forThem = line(FULL_MONTH, attendanceInsured('nv')).cells;
    const forSomeoneElse = line(FULL_MONTH, attendanceInsured('nv-khac')).cells;

    // Assert
    expect([forThem.socialBase, forSomeoneElse.socialBase]).toEqual([10_500_000, 9_500_000]);
  });
});

describe('rounding modes on a whole row (D01)', () => {
  const PATH_49: Path = { probation: true, days: 14, leftOn: '2026-10-15', kpiAmount: KPI_K };
  const AS_HR: SettingRow[] = [{ key: 'tuy-chon.d01', employeeId: null, from: '2026-10', value: 'as-hr' }];

  it('L-K1-21: should round each cell when computed, so (42) = (26) − (41) to the dong', () => {
    // Act
    const c = line(PATH_49).cells;

    // Assert
    expect([c.income, c.tax, c.netPay]).toEqual([18_871_363, 1_887_136, 16_984_227]);
    expect(c.netPay).toBe(c.income - c.totalDeductions + c.cash);
  });

  it('L-K1-21: should show the rounded full numbers in the "as HR\'s file" mode, one dong off (26) − (41)', () => {
    // Act
    const c = line(PATH_49, AS_HR).cells;

    // Assert: Tròn(18.871.363,64) = 18.871.364, Tròn(16.984.227,27) = 16.984.227
    expect([c.income, c.tax, c.netPay]).toEqual([18_871_364, 1_887_136, 16_984_227]);
    expect(c.income - c.totalDeductions + c.cash - c.netPay).toBe(1);
  });

  it('L-D15: should total the cells in the default mode, and round the full sum in the "as HR\'s file" mode', () => {
    // Arrange: path 49 three times, its (26) is 18.871.363,64
    const cellRows = [line(PATH_49), line(PATH_49), line(PATH_49)];
    const asHrRows = [line(PATH_49, AS_HR), line(PATH_49, AS_HR), line(PATH_49, AS_HR)];

    // Act
    const cellTotal = payrollTotals(cellRows, 'cell');
    const asHrTotal = payrollTotals(asHrRows, 'as-hr');

    // Assert: 3 × 18.871.363 and Tròn(3 × 18.871.363,636…) = 56.614.091
    expect(cellTotal.income).toBe(3 * 18_871_363);
    expect(cellTotal.netPay).toBe(cellRows.reduce((acc, r) => acc + r.cells.netPay, 0));
    expect(asHrTotal.income).toBe(56_614_091);
  });
});

function matrixInput(p: MatrixPath): Path {
  const norm = p.region === 'HN' ? 24 : 22;
  return {
    probation: p.probation,
    norm,
    days: p.leaves ? 14 : norm,
    leftOn: p.leaves ? '2026-10-15' : null,
    kpiAmount: p.kpi ? KPI_K : 0,
    kpiPercent: p.probation ? null : 0.8,
    overtime: p.overtime,
    support: p.support ? 700_000 : 0,
  };
}

const matrixCells = (r: PayrollLine): MatrixPath['expected'] => ({
  paidDays: r.cells.paidDays,
  dailyRate: r.cells.dailyRate,
  kpiBonus: r.cells.kpiBonus,
  overtimePay: r.cells.overtimePay,
  income: r.cells.income,
  health: r.cells.health,
  socialAndUnemployment: r.cells.social + r.cells.unemployment,
  exempt: r.cells.exempt,
  taxable: r.cells.taxable,
  assessable: r.cells.assessable,
  tax: r.cells.tax,
  netPay: r.cells.netPay,
  unionFund: r.cells.unionFund,
  totalCost: r.cells.totalCost,
});

describe('the 64-path matrix (K2)', () => {
  it('should have the 64 paths of the catalogue', () => {
    expect(MATRIX_PATHS).toHaveLength(64);
  });

  it.each(MATRIX_PATHS.map((p) => [p.id, p] as const))('%s: should give every money cell of the path', (_id, path) => {
    // Act
    const r = line(matrixInput(path));

    // Assert
    expect(matrixCells(r)).toEqual(path.expected);
    expect(r.cells.netPay).toBe(r.cells.income - r.cells.totalDeductions + r.cells.cash);
  });
});
