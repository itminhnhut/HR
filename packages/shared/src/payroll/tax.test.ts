import { describe, expect, it } from 'vitest';
import { KPI_K, PROFILE_HIGH, PROFILE_K, splitFuelPhoneRows } from '../../test-fixtures/payroll-fixtures.js';
import {
  computeIncome,
  computeInsurance,
  computeTax,
  contractCommitment,
  contractTypeFor,
  flatWithholding,
  insuranceStatus,
  insuredSalaryOf,
  leavePayoutOf,
  payrollConfigFor,
  payrollDates,
  progressiveTax,
  roundDong,
  type IncomeInput,
  type SettingRow,
  type TaxPersonInput,
} from './index.js';

/**
 * Personal income tax, columns (33)–(40): exempt parts with caps, overtime, unused leave, deductions, the five
 * brackets, 10% withholding and the commitment. Cases: docs/test-cases-luong.md, L-K1-12–L-K1-17, L-D22–L-D31.
 */

const OCTOBER = payrollDates(2026, 10);
const config = (rows: SettingRow[] = []) => payrollConfigFor(rows, 'nv', OCTOBER);
const contract = (id: string) => contractTypeFor([], id, 'nv', OCTOBER.monthKey);

interface Case {
  income: Partial<IncomeInput> & Pick<IncomeInput, 'segments'>;
  person?: Partial<TaxPersonInput>;
  leftOn?: string | null;
  support?: number;
  rows?: SettingRow[];
}

/** One row through income, insurance and tax, as the line will run them. */
function run({ income, person = {}, leftOn = null, support = 0, rows = [] }: Case) {
  const cfg = config(rows);
  const input: IncomeInput = { norm: 22, kpiAmount: 0, ...income };
  const inc = computeIncome(input, cfg);
  const kind = person.contract ?? contract('khong-thoi-han');
  const amounts = input.segments[input.segments.length - 1]?.amounts ?? {};
  const status = insuranceStatus(
    { month: '2026-10', codes: {}, contracts: [{ from: '2020-01-01', insured: kind.insured }], joinedOn: null, leftOn },
    cfg,
  );
  const ins = computeInsurance(
    { status, insuredSalary: insuredSalaryOf(cfg.components, amounts), zone: 'I', unionMember: false },
    cfg,
  );
  const taxPerson: TaxPersonInput = { contract: kind, leftOn, dependants: 0, hasCommitment: false, ...person };
  const tax = computeTax({ income: inc, overtime: input.overtime, insurance: ins, support, person: taxPerson }, cfg);
  return { inc, ins, tax };
}

/** Neither a signed commitment nor the one of the contract: "Cam kết thuế kèm hợp đồng" turned off. */
const NO_COMMITMENT = { contract: { ...contract('thu-viec'), commitmentIncluded: false }, hasCommitment: false };

const official = (days: number, amounts = PROFILE_K) => ({ days, probation: false, amounts });
const probation = (days: number, amounts = PROFILE_K) => ({ days, probation: true, amounts });

describe('exempt income (33)', () => {
  it('L-D22: should exempt meal pay up to the monthly cap, not reduced by the days, and tax the rest', () => {
    // Act: meal 1,5 tr on full days, cap 1,2 tr from 01/07/2026
    const { tax } = run({ income: { segments: [official(22, { luong: 10_000_000, com: 1_500_000 })] } });

    // Assert
    expect(roundDong(tax.exempt)).toBe(1_200_000);
    expect(roundDong(tax.taxable)).toBe(10_300_000);
  });

  it('K2: should put all of Xăng xe + ĐT into exempt income in the default configuration', () => {
    // Act: 2.000.000 of fuel and phone, full days
    const { tax } = run({ income: { segments: [official(22, { luong: 10_000_000, 'xang-dt': 2_000_000 })] } });

    // Assert
    expect(roundDong(tax.exempt)).toBe(2_000_000);
    expect(roundDong(tax.taxable)).toBe(10_000_000);
  });

  it("K2: should exempt Xăng xe + ĐT by the days paid, like HR's October file", () => {
    // Act: 11 of 22 days
    const { tax } = run({ income: { segments: [official(11, { luong: 10_000_000, 'xang-dt': 2_000_000 })] } });

    // Assert
    expect(roundDong(tax.exempt)).toBe(1_000_000);
    expect(roundDong(tax.taxable)).toBe(5_000_000);
  });

  it('K2: should tax Xăng xe + ĐT for the one person HR overrides it for', () => {
    // Arrange
    const rows: SettingRow[] = [
      { key: 'khoan.xang-dt.thue', employeeId: 'nv', from: '2026-10', value: { kind: 'taxable' } },
    ];

    // Act
    const { tax } = run({ income: { segments: [official(22, { luong: 10_000_000, 'xang-dt': 2_000_000 })] }, rows });

    // Assert
    expect(roundDong(tax.exempt)).toBe(0);
    expect(roundDong(tax.taxable)).toBe(12_000_000);
  });

  it('L-D23: should exempt phone pay up to the level set in the contract or rules and tax the rest', () => {
    // Arrange: a company paying fuel and phone apart; profile 500.000, rules set 300.000
    const rows: SettingRow[] = [
      ...splitFuelPhoneRows('2026-10'),
      { key: 'khoan.dien-thoai.muc-quy-che', employeeId: null, from: '2026-10', value: 300_000 },
    ];

    // Act
    const { tax } = run({ income: { segments: [official(22, { luong: 10_000_000, 'dien-thoai': 500_000 })] }, rows });

    // Assert: 300.000 exempt, 200.000 taxable
    expect(roundDong(tax.exempt)).toBe(300_000);
    expect(roundDong(tax.taxable)).toBe(10_200_000);
  });

  it('L-D23: should exempt phone pay up to the amount in the profile when no level is set', () => {
    // Act
    const { tax } = run({
      income: { segments: [official(22, { luong: 10_000_000, 'dien-thoai': 800_000 })] },
      rows: splitFuelPhoneRows('2026-10'),
    });

    // Assert
    expect(roundDong(tax.exempt)).toBe(800_000);
  });

  it('L-K1-22: should exempt clothing only up to what is left of 5.000.000 for the tax year', () => {
    // Act: profile K full month, 4.800.000 of clothing already exempted this year
    const { tax } = run({ income: { segments: [official(22)] }, person: { clothingExemptBefore: 4_800_000 } });

    // Assert: 200.000 exempt, 150.000 taxable: (33) = 3.450.000 − 150.000
    expect(roundDong(tax.exempt)).toBe(3_300_000);
    expect(tax.clothing).toEqual({ exempt: 200_000, capReached: true });
  });

  it('L-D24: should tax fuel pay in full for a company that pays fuel and phone apart', () => {
    // Act
    const { tax } = run({
      income: { segments: [official(22, { luong: 10_000_000, xang: 1_000_000 })] },
      rows: splitFuelPhoneRows('2026-10'),
    });

    // Assert
    expect(roundDong(tax.exempt)).toBe(0);
    expect(roundDong(tax.taxable)).toBe(11_000_000);
  });

  it('L-D25: should exempt overtime pay within the hour limits in full', () => {
    // Act: daily rate 800.000, 10 hours → 1.500.000
    const { inc, tax } = run({
      income: {
        segments: [official(22, { luong: 17_600_000 })],
        overtime: { weekdayHours: 10, restDays: 0, holidayDays: 0 },
      },
    });

    // Assert
    expect(roundDong(inc.overtimePay)).toBe(1_500_000);
    expect(roundDong(tax.exempt)).toBe(1_500_000);
  });

  it('L-D10: should tax the overtime pay beyond 40 hours a month', () => {
    // Act: 45 hours, 40 exempt
    const { inc, tax } = run({
      income: {
        segments: [official(22, { luong: 17_600_000 })],
        overtime: { weekdayHours: 45, restDays: 0, holidayDays: 0 },
      },
    });

    // Assert: 6.750.000 × 40 ÷ 45 = 6.000.000
    expect(roundDong(inc.overtimePay)).toBe(6_750_000);
    expect(roundDong(tax.exempt)).toBe(6_000_000);
    expect(tax.overtimeHours).toEqual({ total: 45, exempt: 40 });
  });

  it('L-D10: should tax the overtime beyond 200 hours a year, counting rest days as 8 hours each', () => {
    // Act: 190 hours before this month; 10 hours + 1 rest day = 18 hours, 10 exempt
    const { tax } = run({
      income: {
        segments: [official(22, { luong: 17_600_000 })],
        overtime: { weekdayHours: 10, restDays: 1, holidayDays: 0 },
      },
      person: { overtimeHoursBefore: 190 },
    });

    // Assert
    expect(tax.overtimeHours).toEqual({ total: 18, exempt: 10 });
  });

  it('L-K1-19: should exempt the 300% holiday pay with the exempt components', () => {
    // Act
    const { tax } = run({
      income: {
        segments: [official(22)],
        kpiAmount: KPI_K,
        kpiPercent: 0.8,
        overtime: { weekdayHours: 0, restDays: 0, holidayDays: 1 },
      },
    });

    // Assert: 3.450.000 + 3.061.364
    expect(roundDong(tax.exempt)).toBe(6_511_364);
  });

  it("L-K1-12, L-D30: should pay unused leave on last month's contract pay ÷ last norm, exempt and outside insurance", () => {
    // Arrange: profile K last month, norm 22, 3 days left
    const payout = leavePayoutOf({
      previousAmounts: PROFILE_K,
      previousNorm: 22,
      days: 3,
      components: config().components,
    });

    // Act
    const { inc, ins, tax } = run({ income: { segments: [official(22)], leavePayout: payout } });

    // Assert: (8.000.000 + 1.500.000 + 1.000.000) ÷ 22 × 3 = 1.431.818 in (24) and in (33); (27) without it, nor attendance
    expect(roundDong(inc.leavePayout)).toBe(1_431_818);
    expect(roundDong(inc.otherIncome)).toBe(1_431_818);
    expect(roundDong(tax.exempt)).toBe(3_450_000 + 1_431_818);
    expect(roundDong(ins.socialBase)).toBe(9_500_000);
  });

  it('L-K1-12: should tax the part of unused leave pay from a component HR added to the contract pay', () => {
    // Arrange: housing added to "lương theo HĐ"
    const rows: SettingRow[] = [{ key: 'khoan.nha-o.luong-theo-hd', employeeId: null, from: '2026-10', value: true }];
    const payout = leavePayoutOf({
      previousAmounts: PROFILE_K,
      previousNorm: 22,
      days: 3,
      components: config(rows).components,
    });

    // Act
    const { inc, tax } = run({ income: { segments: [official(22)], leavePayout: payout }, rows });

    // Assert: 19.000.000 ÷ 22 × 3 = 2.590.909 paid, 1.431.818 of it exempt
    expect(roundDong(inc.leavePayout)).toBe(2_590_909);
    expect(roundDong(tax.exempt)).toBe(3_450_000 + 1_431_818);
  });

  it('L-K1-13: should pay no unused leave when none is left, even after leave beyond the balance', () => {
    // Act
    const payout = leavePayoutOf({
      previousAmounts: PROFILE_K,
      previousNorm: 22,
      days: 0,
      components: config().components,
    });

    // Assert
    expect([roundDong(payout.amount), roundDong(payout.exempt)]).toEqual([0, 0]);
  });

  it('L-K1-20: should exempt the whole 200% of a Sunday already in (17), as overtime pay', () => {
    // Act: sundayWorked 1, OT 0
    const { tax } = run({
      income: {
        segments: [official(22)],
        kpiAmount: KPI_K,
        kpiPercent: 0.8,
        overtime: { weekdayHours: 0, restDays: 0, sundayInPaid: 1, holidayDays: 0 },
      },
    });

    // Assert: 3.450.000 + 1.020.455 + 1.020.454,55
    expect(roundDong(tax.exempt)).toBe(5_490_910);
  });

  it('should exempt other income HR marked exempt and tax the rest', () => {
    // Act
    const { tax } = run({
      income: {
        segments: [official(22, { luong: 10_000_000 })],
        otherIncome: [
          { amount: 250_000, taxable: false, reason: 'Hiếu hỉ' },
          { amount: 300_000, taxable: true, reason: 'Thưởng' },
        ],
      },
    });

    // Assert
    expect(roundDong(tax.exempt)).toBe(250_000);
    expect(roundDong(tax.taxable)).toBe(10_300_000);
  });
});

describe('deductions and the five brackets', () => {
  it('L-D26: should deduct 15,5 tr, 6,2 tr per dependant and insurance, never below zero', () => {
    // Act: profile K, 2 dependants
    const { tax } = run({ income: { segments: [official(22)] }, person: { dependants: 2 } });

    // Assert: 20.500.000 − 15.500.000 − 12.400.000 − 997.500 < 0
    expect(roundDong(tax.deductions)).toBe(15_500_000 + 12_400_000 + 997_500);
    expect(roundDong(tax.assessable)).toBe(0);
    expect(roundDong(tax.tax)).toBe(0);
  });

  it('L-D27: should tax only the part above each bracket boundary at the higher rate', () => {
    // Arrange
    const brackets = config().law.brackets;
    const taxOf = (amount: number) => roundDong(progressiveTax(amount, brackets));

    // Act / Assert: 5%, 10%, 20%, 30%, 35%
    expect(taxOf(10_000_000)).toBe(500_000);
    expect(taxOf(10_000_001)).toBe(500_000);
    expect(taxOf(10_000_010)).toBe(500_001);
    expect(taxOf(30_000_000)).toBe(2_500_000);
    expect(taxOf(60_000_000)).toBe(8_500_000);
    expect(taxOf(100_000_000)).toBe(20_500_000);
    expect(taxOf(100_000_100)).toBe(20_500_035);
  });
});

describe('10% withholding, leaving and the commitment (NĐ 253 Đ.50 k2)', () => {
  it('L-D28: should withhold 10% of income from 5.000.000 on a short contract without commitment', () => {
    // Arrange
    const params = config().law;

    // Act / Assert
    expect(roundDong(flatWithholding(5_000_000, params))).toBe(500_000);
    expect(roundDong(flatWithholding(4_999_999, params))).toBe(0);
    expect(roundDong(flatWithholding(4_999_999, params, true))).toBe(500_000);
  });

  it('L-D28: should withhold nothing on a short contract with a commitment', () => {
    // Act
    const { tax } = run({
      income: { segments: [probation(22)], kpiAmount: KPI_K },
      person: { contract: contract('thu-viec'), hasCommitment: true },
    });

    // Assert
    expect([tax.method, roundDong(tax.tax)]).toEqual(['none', 0]);
  });

  describe('the commitment that comes with the contract', () => {
    const paid = { segments: [probation(22)], kpiAmount: KPI_K };
    const OFF_FOR_ONE: SettingRow = {
      key: 'loai-hd.thu-viec.cam-ket-kem-hd',
      employeeId: 'nv',
      from: '2026-10',
      value: false,
    };

    it('should be on for the probation contract and off for the long ones by default', () => {
      // Act
      const included = ['thu-viec', 'khong-thoi-han', '12-thang'].map((id) => contractCommitment(contract(id)));

      // Assert
      expect(included).toEqual([true, false, false]);
    });

    it('should withhold nothing from a probation person without HR typing a commitment, as the sheet', () => {
      // Act
      const { tax } = run({ income: paid, person: { contract: contract('thu-viec') } });

      // Assert
      expect([tax.method, roundDong(tax.tax), tax.commitmentSource]).toEqual(['none', 0, 'contract']);
      expect(tax.methodReason).toBe('Cam kết theo hợp đồng');
    });

    it('should withhold 10% once HR turns it off for the person, unless a signed commitment is on file', () => {
      // Arrange
      const off = contractTypeFor([OFF_FOR_ONE], 'thu-viec', 'nv', OCTOBER.monthKey);
      const other = contractTypeFor([OFF_FOR_ONE], 'thu-viec', 'nv-2', OCTOBER.monthKey);

      // Act
      const withheld = run({ income: paid, person: { contract: off } }).tax;
      const signed = run({
        income: paid,
        person: { contract: off, hasCommitment: true, commitmentSignedOn: '2026-10-01' },
      }).tax;

      // Assert
      expect(contractCommitment(other)).toBe(true);
      expect([withheld.method, withheld.commitmentSource]).toEqual(['flat10', null]);
      expect(withheld.methodReason).toBe('HĐ dưới 3 tháng: khấu trừ 10%');
      expect([signed.method, signed.commitmentSource]).toEqual(['none', 'signed']);
      expect(signed.methodReason).toBe('Cam kết ký ngày 01/10/2026');
    });

    it('should estimate the year for a contract commitment as for a signed one', () => {
      // Act
      const { tax } = run({
        income: { segments: [probation(22, PROFILE_HIGH)], kpiAmount: 4_200_000, block: 'BO' },
        person: { contract: contract('thu-viec'), commitmentEstimate: { months: 2, openingTaxable: 150_000_000 } },
      });

      // Assert
      expect(tax.commitment).toMatchObject({ annual: 215_700_000, exceeds: true });
    });

    it('should still withhold 10% from a payment after leaving', () => {
      // Act
      const { tax } = run({ income: paid, person: { contract: contract('thu-viec') }, leftOn: '2026-10-15' });

      // Assert
      expect(tax.method).toBe('flat10');
    });
  });

  it('L-D29: should withhold 10% from someone paid after leaving, whatever the contract', () => {
    // Act: official, left 15/10, paid 05/11, income 7,9 tr
    const { tax } = run({ income: { segments: [official(22, { luong: 7_900_000 })] }, leftOn: '2026-10-15' });

    // Assert
    expect(tax.method).toBe('flat10');
    expect(tax.methodReason).toMatch(/nghỉ việc/);
    expect(roundDong(tax.tax)).toBe(790_000);
  });

  it('L-D12, D02: should withhold 10% of (26) + support from someone paid after leaving', () => {
    // Act: (26) 7,9 tr + support 700.000
    const { tax } = run({
      income: { segments: [official(22, { luong: 7_900_000 })] },
      leftOn: '2026-10-15',
      support: 700_000,
    });

    // Assert
    expect(roundDong(tax.tax)).toBe(860_000);
  });

  it('L-D31: should judge the 5.000.000 threshold on each payment, not on their sum', () => {
    // Arrange: two payments of 4 tr in a month
    const params = config().law;

    // Act
    const each = [4_000_000, 4_000_000].map((p) => roundDong(flatWithholding(p, params)));

    // Assert
    expect(each).toEqual([0, 0]);
  });

  it('L-K1-14: should withhold 10% of income from an official person leaving on 15/10, on 14/22 days, fully insured', () => {
    // Act
    const { inc, ins, tax } = run({
      income: { segments: [official(14)], kpiAmount: KPI_K, kpiPercent: 0 },
      leftOn: '2026-10-15',
    });

    // Assert
    expect(roundDong(inc.dailyRate)).toBe(1_020_455);
    expect(roundDong(inc.income)).toBe(14_286_364);
    expect(roundDong(ins.employee.health)).toBe(142_500);
    expect(roundDong(ins.employee.social) + roundDong(ins.employee.unemployment)).toBe(855_000);
    expect(roundDong(tax.exempt)).toBe(2_195_455);
    expect(roundDong(tax.taxable)).toBe(12_090_909);
    expect(roundDong(tax.tax)).toBe(1_428_636);
  });

  it('L-K1-15: should withhold nothing when the payment after leaving is under 5.000.000', () => {
    // Act: left 01/10, 4/22 days
    const { inc, ins, tax } = run({
      income: { segments: [official(4)], kpiAmount: KPI_K, kpiPercent: 0 },
      leftOn: '2026-10-01',
    });

    // Assert: 21 days without pay, BHYT only
    expect(roundDong(inc.income)).toBe(4_081_818);
    expect(roundDong(ins.employee.health)).toBe(142_500);
    expect(roundDong(tax.tax)).toBe(0);
  });

  it('L-K1-16: should accept a commitment while the yearly estimate stays under the deductions, and withhold 10% without it', () => {
    // Arrange: probation contract of 2 months, profile K, 22/22, KPI by the BO formula
    const base: Case = {
      income: { segments: [probation(22)], kpiAmount: KPI_K, block: 'BO' },
      person: {
        contract: contract('thu-viec'),
        hasCommitment: true,
        commitmentEstimate: { months: 2, openingTaxable: 0 },
      },
    };

    // Act
    const withCommitment = run(base);
    const without = run({ ...base, person: { ...base.person, ...NO_COMMITMENT } });

    // Assert
    expect(roundDong(withCommitment.inc.dailyRate)).toBe(918_409);
    expect(roundDong(withCommitment.inc.kpiBonus)).toBe(9_450_000);
    expect(roundDong(withCommitment.inc.income)).toBe(29_655_000);
    expect(roundDong(withCommitment.tax.taxable)).toBe(26_550_000);
    expect(withCommitment.tax.commitment).toEqual({ annual: 53_100_000, limit: 186_000_000, exceeds: false });
    expect(roundDong(withCommitment.tax.tax)).toBe(0);
    expect(roundDong(without.tax.tax)).toBe(2_965_500);
  });

  it('L-K1-17: should flag a commitment whose yearly estimate passes the deductions but keep it until HR turns it off', () => {
    // Arrange: high income, 2-month probation contract
    const person = { contract: contract('thu-viec'), hasCommitment: true };
    const income = { segments: [probation(22, PROFILE_HIGH)], kpiAmount: 4_200_000, block: 'BO' };

    // Act
    const alone = run({ income, person: { ...person, commitmentEstimate: { months: 2, openingTaxable: 0 } } });
    const opening = run({
      income,
      person: { ...person, commitmentEstimate: { months: 2, openingTaxable: 150_000_000 } },
    });
    const off = run({ income, person: { ...person, ...NO_COMMITMENT } });

    // Assert
    expect(roundDong(alone.inc.dailyRate)).toBe(1_448_182);
    expect(roundDong(alone.inc.kpiBonus)).toBe(3_780_000);
    expect(roundDong(alone.inc.income)).toBe(35_640_000);
    expect(roundDong(alone.tax.taxable)).toBe(32_850_000);
    expect(alone.tax.commitment).toMatchObject({ annual: 65_700_000, exceeds: false });
    expect(opening.tax.commitment).toMatchObject({ annual: 215_700_000, exceeds: true });
    expect([roundDong(alone.tax.tax), roundDong(opening.tax.tax), roundDong(off.tax.tax)]).toEqual([0, 0, 3_564_000]);
  });

  it('D10: should keep a long contract on the brackets after leaving when the option is "short contracts only"', () => {
    // Arrange
    const rows: SettingRow[] = [{ key: 'tuy-chon.d10', employeeId: null, from: '2026-10', value: 'flat10-short-only' }];

    // Act
    const { tax } = run({ income: { segments: [official(22, { luong: 7_900_000 })] }, leftOn: '2026-10-15', rows });

    // Assert
    expect(tax.method).toBe('progressive');
  });
});
