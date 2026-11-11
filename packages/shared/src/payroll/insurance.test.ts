import { describe, expect, it } from 'vitest';
import type { AttendanceCode } from '../timesheet.js';
import {
  computeInsurance,
  insuranceStatus,
  payrollConfigFor,
  payrollDates,
  roundDong,
  type InsuranceMonthInput,
  type InsuranceResult,
  type SettingRow,
} from './index.js';

/**
 * Insurance by calendar month, columns (27)–(31) and (43)–(47); rules BH-1 and BH-2 (spec 5.4).
 * Cases: docs/test-cases-luong.md, L-K1-01–L-K1-11, L-D16–L-D21.
 */

const OCTOBER = payrollDates(2026, 10);
/** KPCĐ switched on for the company: the default leaves it off, as HR's October file does (chốt 09/11/2026). */
const UNION_FUND_ON: SettingRow = { key: 'tuy-chon.d03', employeeId: null, from: '2026-01', value: 'when-social' };
const config = (rows: SettingRow[] = [UNION_FUND_ON]) => payrollConfigFor(rows, 'nv', OCTOBER);
const INSURED = [{ from: '2020-01-01', insured: true }];

/** Mon–Fri of October 2026: 1, 2, 5–9, 12–16, 19–23, 26–30. */
const OCTOBER_WORKDAYS = [1, 2, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 26, 27, 28, 29, 30].map(
  (d) => `2026-10-${String(d).padStart(2, '0')}`,
);

const codesOn = (days: readonly string[], code: AttendanceCode) =>
  Object.fromEntries(days.map((d) => [d, code])) as Record<string, AttendanceCode>;

const month = (over: Partial<InsuranceMonthInput> = {}): InsuranceMonthInput => ({
  month: '2026-10',
  codes: {},
  contracts: INSURED,
  joinedOn: null,
  leftOn: null,
  ...over,
});

const amounts = (r: InsuranceResult) => ({
  base: roundDong(r.socialBase),
  social: roundDong(r.employee.social),
  health: roundDong(r.employee.health),
  unemployment: roundDong(r.employee.unemployment),
  companySocial: roundDong(r.company.social),
  companyHealth: roundDong(r.company.health),
  companyUnemployment: roundDong(r.company.unemployment),
  unionFund: roundDong(r.company.unionFund),
});

const insure = (input: InsuranceMonthInput, over: { insured?: number; member?: boolean; rows?: SettingRow[] } = {}) => {
  const cfg = config(over.rows);
  const status = insuranceStatus(input, cfg);
  return computeInsurance(
    { status, insuredSalary: over.insured ?? 10_500_000, zone: 'I', unionMember: over.member ?? false },
    cfg,
  );
};

/** An insured salary of 10.500.000: Hồ sơ K with attendance insured by an override (salary + position + attendance). */
const HEALTH_ONLY = {
  base: 10_500_000,
  social: 0,
  health: 157_500,
  unemployment: 0,
  companySocial: 0,
  companyHealth: 315_000,
  companyUnemployment: 0,
  unionFund: 0,
};
const FULL = {
  base: 10_500_000,
  social: 840_000,
  health: 157_500,
  unemployment: 105_000,
  companySocial: 1_837_500,
  companyHealth: 315_000,
  companyUnemployment: 105_000,
  unionFund: 210_000,
};

describe('BH-1: a month with a joining, a leaving or a change of contract (days without pay, Đ.33 k5)', () => {
  it('L-K1-01: should pay health insurance only when someone leaving on 09/10 has 15 working days without pay', () => {
    // Act
    const input = month({ leftOn: '2026-10-09' });
    const status = insuranceStatus(input, config());

    // Assert: 7 days worked, 15 after leaving ≥ 14; D04 keeps BHYT
    expect(status).toMatchObject({ rule: 'BH-1', status: 'health-only', counted: 15, workingDays: 22 });
    expect(status.note).toBe('Chỉ BHYT · 15 ngày không hưởng lương');
    expect(amounts(insure(input))).toEqual(HEALTH_ONLY);
  });

  it('L-K1-02: should pay in full for someone leaving on 15/10, with 11 days without pay', () => {
    // Act
    const status = insuranceStatus(month({ leftOn: '2026-10-15' }), config());

    // Assert: the earlier reading "worked under 14 days" gave the opposite
    expect(status).toMatchObject({ rule: 'BH-1', status: 'full', counted: 11 });
  });

  it('L-K1-02: should keep the earlier reading of BH-1 as a setting', () => {
    // Arrange
    const rows: SettingRow[] = [
      { key: 'quy-tac.dem-ngay-bh', employeeId: null, from: '2026-10', value: 'insured-days' },
    ];

    // Act / Assert: 11 insured working days < 14
    expect(insuranceStatus(month({ leftOn: '2026-10-15' }), config(rows))).toMatchObject({
      status: 'health-only',
      counted: 11,
    });
  });

  it('L-K1-03: should pay in full for someone leaving on 20/10, with 8 days without pay', () => {
    // Act / Assert
    expect(amounts(insure(month({ leftOn: '2026-10-20' })))).toEqual(FULL);
  });

  it('L-K1-04: should pay in full for someone leaving on 21/10, with 7 days without pay', () => {
    expect(insuranceStatus(month({ leftOn: '2026-10-21' }), config())).toMatchObject({ status: 'full', counted: 7 });
  });

  it('L-K1-08: should pay in full, not by days worked, for someone joining on 07/10 (4 days before)', () => {
    // Act
    const input = month({ joinedOn: '2026-10-07' });

    // Assert
    expect(insuranceStatus(input, config())).toMatchObject({ rule: 'BH-1', status: 'full', counted: 4 });
    expect(amounts(insure(input))).toEqual(FULL);
  });

  it('L-K1-09: should not insure October for someone joining on 26/10 (17 days before)', () => {
    expect(insuranceStatus(month({ joinedOn: '2026-10-26' }), config())).toMatchObject({
      rule: 'none',
      status: 'none',
      counted: 17,
    });
    expect(amounts(insure(month({ joinedOn: '2026-10-26' })))).toEqual({
      ...HEALTH_ONLY,
      base: 0,
      health: 0,
      companyHealth: 0,
    });
  });

  it('should leave out BHYT and (27) too when an insured contract starting on 26/10 follows a probation contract', () => {
    // Arrange: a separate probation contract (not insured) the whole period, official on the day after it ends
    const contracts = [
      { from: '2026-08-01', insured: false },
      { from: '2026-10-26', insured: true },
    ];
    const input = month({ joinedOn: '2026-08-01', contracts, provisionalFrom: '2026-10-26' });

    // Act
    const status = insuranceStatus(input, config());

    // Assert: not yet in the employee group for October, so no fund at all; nothing left to settle in November
    expect(status).toMatchObject({ rule: 'none', status: 'none', counted: 17, provisional: false });
    expect(status.note).toBe('Không đóng BH trên bảng lương · 17 ngày không hưởng lương · tăng mới từ tháng sau');
    expect(amounts(insure(input))).toEqual({ ...HEALTH_ONLY, base: 0, health: 0, companyHealth: 0 });
  });

  it('L-K1-10: should insure October in full when the insured contract starts on 15/10 (10 days before)', () => {
    // Arrange: probation on its own contract until 14/10
    const contracts = [
      { from: '2026-08-01', insured: false },
      { from: '2026-10-15', insured: true },
    ];

    // Act
    const status = insuranceStatus(month({ joinedOn: '2026-08-01', contracts }), config());

    // Assert
    expect(status).toMatchObject({ rule: 'BH-1', status: 'full', counted: 10 });
  });

  it('L-K1-11: should insure October from 20/10 (13 days before) but not from 21/10 (14 days before)', () => {
    // Arrange
    const from = (day: string) => [
      { from: '2026-08-01', insured: false },
      { from: day, insured: true },
    ];

    // Act / Assert
    expect(insuranceStatus(month({ contracts: from('2026-10-20') }), config())).toMatchObject({
      status: 'full',
      counted: 13,
    });
    expect(insuranceStatus(month({ contracts: from('2026-10-21') }), config())).toMatchObject({
      status: 'none',
      counted: 14,
    });
  });

  it('should keep BHYT only for someone insured from before the month who leaves on 09/10 (D04)', () => {
    // Arrange: insured since 2020; the month began inside the employee group
    const input = month({ joinedOn: '2020-01-01', leftOn: '2026-10-09' });

    // Act / Assert
    expect(insuranceStatus(input, config())).toMatchObject({ rule: 'BH-1', status: 'health-only', counted: 15 });
  });

  it('should add unpaid leave to the days after leaving', () => {
    // Arrange: leaving 14/10 (12 days after), two KL before it
    const input = month({ leftOn: '2026-10-14', codes: { '2026-10-05': 'KL', '2026-10-06': 'KL' } });

    // Act / Assert
    expect(insuranceStatus(input, config())).toMatchObject({ status: 'health-only', counted: 14 });
  });

  it('L-K1-23: should still pay BHXH in the first month at work with 15 sick days, but not BHTN, and BHYT 0', () => {
    // Arrange: joined 01/10, OM on 15 working days
    const input = month({ joinedOn: '2026-10-01', codes: codesOn(OCTOBER_WORKDAYS.slice(0, 15), 'OM') });

    // Act
    const r = insure(input);

    // Assert: Đ.33 k6 for BHXH only; the insurance fund pays BHYT
    expect(amounts(r)).toEqual({
      base: 10_500_000,
      social: 840_000,
      health: 0,
      unemployment: 0,
      companySocial: 1_837_500,
      companyHealth: 0,
      companyUnemployment: 0,
      unionFund: 210_000,
    });
  });

  it('D15: should pay in full a month with 14 days without pay when both sides agreed', () => {
    // Arrange
    const rows: SettingRow[] = [
      UNION_FUND_ON,
      { key: 'tuy-chon.d15', employeeId: 'nv', from: '2026-10', value: 'agreed' },
    ];

    // Act / Assert
    expect(amounts(insure(month({ leftOn: '2026-10-09' }), { rows }))).toEqual(FULL);
  });
});

describe('BH-2: a whole month under an insured contract', () => {
  it('L-K1-05: should drop BHXH, BHTN and KPCĐ but keep BHYT and show (27) after 14 working days of unpaid leave', () => {
    // Arrange
    const input = month({ codes: codesOn(OCTOBER_WORKDAYS.slice(0, 14), 'KL') });

    // Act / Assert
    expect(insuranceStatus(input, config())).toMatchObject({ rule: 'BH-2', status: 'health-only', counted: 14 });
    expect(amounts(insure(input))).toEqual(HEALTH_ONLY);
  });

  it('L-K1-06: should pay in full after 13,5 working days of unpaid leave', () => {
    // Arrange
    const codes = { ...codesOn(OCTOBER_WORKDAYS.slice(0, 13), 'KL'), [OCTOBER_WORKDAYS[13] ?? '']: 'KL/2' as const };

    // Act / Assert
    expect(amounts(insure(month({ codes })))).toEqual(FULL);
  });

  it('should count sick leave, maternity, absence and leave beyond the balance as days without pay', () => {
    // Arrange: 4 OM + 4 TS + 4 KP + 1 KL/2 = 12,5, plus 2 days of leave beyond the balance
    const codes = {
      ...codesOn(OCTOBER_WORKDAYS.slice(0, 4), 'OM'),
      ...codesOn(OCTOBER_WORKDAYS.slice(4, 8), 'TS'),
      ...codesOn(OCTOBER_WORKDAYS.slice(8, 12), 'KP'),
      ...codesOn(OCTOBER_WORKDAYS.slice(12, 13), 'KL/2'),
    };

    // Act
    const status = insuranceStatus(month({ codes, leaveOverdrawn: 2 }), config());

    // Assert: 8 sick or maternity days < 14, so BHYT stays on the payroll
    expect(status).toMatchObject({ status: 'health-only', counted: 14.5 });
  });

  it('L-K1-24: should put BHYT at 0 for 15 days of maternity, and keep it for 15 days of unpaid leave', () => {
    // Act
    const maternity = insure(month({ codes: codesOn(OCTOBER_WORKDAYS.slice(0, 15), 'TS') }));
    const unpaid = insure(month({ codes: codesOn(OCTOBER_WORKDAYS.slice(0, 15), 'KL') }));

    // Assert
    expect(amounts(maternity)).toEqual({ ...HEALTH_ONLY, health: 0, companyHealth: 0 });
    expect(amounts(unpaid)).toEqual(HEALTH_ONLY);
  });

  it('L-K1-07: should count days 26–31 from the open next period as provisional', () => {
    // Arrange: KL on 10 working days of 01–25/10 and on 5 days of 26–30/10, the next period still open
    const closed = codesOn(OCTOBER_WORKDAYS.slice(0, 10), 'KL');
    const provisional = month({
      codes: { ...closed, ...codesOn(OCTOBER_WORKDAYS.slice(17), 'KL') },
      provisionalFrom: '2026-10-26',
    });
    const settled = month({ codes: { ...closed, ...codesOn(OCTOBER_WORKDAYS.slice(17, 20), 'KL') } });

    // Act
    const before = insure(provisional);
    const after = insure(settled);

    // Assert: 15 → BHYT only, "tạm"; once settled 13 → pay; the difference is what T11 adjusts
    expect(insuranceStatus(provisional, config())).toMatchObject({
      status: 'health-only',
      counted: 15,
      provisional: true,
    });
    expect(insuranceStatus(settled, config())).toMatchObject({ status: 'full', counted: 13, provisional: false });
    expect(roundDong(after.employee.social) - roundDong(before.employee.social)).toBe(840_000);
    expect(roundDong(after.employee.unemployment) - roundDong(before.employee.unemployment)).toBe(105_000);
    expect(roundDong(after.companyTotal) - roundDong(before.companyTotal)).toBe(1_837_500 + 105_000 + 210_000);
  });

  it('D04: should drop BHYT too when the option says so', () => {
    // Arrange
    const rows: SettingRow[] = [{ key: 'tuy-chon.d04', employeeId: null, from: '2026-10', value: 'skip' }];

    // Act
    const r = insure(month({ leftOn: '2026-10-09' }), { rows });

    // Assert
    expect([roundDong(r.employee.health), roundDong(r.company.health)]).toEqual([0, 0]);
  });
});

describe('insurance salary, floor and caps', () => {
  it('L-D16: should raise an insurance salary below the zone minimum to the minimum and report the sum before', () => {
    // Act
    const r = insure(month(), { insured: 5_000_000 });

    // Assert
    expect([roundDong(r.socialBase), r.insuredSalary, r.belowFloor]).toEqual([5_310_000, 5_000_000, true]);
  });

  it('L-D17: should cap BHXH, BHYT at 20 × base salary and BHTN at 20 × the zone minimum', () => {
    // Act
    const r = insure(month(), { insured: 60_000_000 });

    // Assert: (27) 50,6 tr; BHTN on MIN(60 tr, 106,2 tr) = 60 tr
    expect(roundDong(r.socialBase)).toBe(50_600_000);
    expect(roundDong(r.unemploymentBase)).toBe(60_000_000);
    expect(roundDong(r.employee.social)).toBe(4_048_000);
    expect(roundDong(r.employee.unemployment)).toBe(600_000);
  });

  it('L-D18: should insure the full salary, not by days worked, in a month that qualifies on 12/22 days', () => {
    // Arrange: 10 working days of unpaid leave, under 14
    const r = insure(month({ codes: codesOn(OCTOBER_WORKDAYS.slice(0, 10), 'KL') }));

    // Assert
    expect(amounts(r)).toEqual(FULL);
  });

  it('L-D19: should insure nothing, company and KPCĐ included, on a contract type without insurance', () => {
    // Act
    const input = month({ contracts: [{ from: '2026-01-01', insured: false }] });
    const r = insure(input);

    // Assert
    expect(insuranceStatus(input, config()).status).toBe('none');
    expect(amounts(r)).toEqual({ ...HEALTH_ONLY, base: 0, health: 0, companyHealth: 0 });
  });

  it('L-D20: should take 0,5% union fee from a member, which stays within 10% of the base salary', () => {
    // Act
    const member = insure(month(), { insured: 60_000_000, member: true });
    const other = insure(month(), { insured: 60_000_000 });

    // Assert: 0,5% × 50,6 tr = 253.000 = 10% × 2.530.000
    expect(roundDong(member.employee.unionFee)).toBe(253_000);
    expect(roundDong(other.employee.unionFee)).toBe(0);
  });

  it('L-D20: should take no union fee in a month without BHXH', () => {
    expect(roundDong(insure(month({ leftOn: '2026-10-09' }), { member: true }).employee.unionFee)).toBe(0);
  });

  it("L-D21: should charge KPCĐ 2% of each insured person's salary and nothing for others", () => {
    // Act
    const insured = insure(month(), { insured: 6_400_000 });
    const notInsured = insure(month({ contracts: [{ from: '2026-01-01', insured: false }] }), { insured: 6_400_000 });

    // Assert
    expect([roundDong(insured.company.unionFund), roundDong(notInsured.company.unionFund)]).toEqual([128_000, 0]);
  });

  it('D03: should turn KPCĐ on for one person only when the override is theirs', () => {
    // Arrange: the company leaves it off; person "nv" has it on
    const rows: SettingRow[] = [{ key: 'tuy-chon.d03', employeeId: 'nv', from: '2026-10', value: 'when-social' }];
    const fundOf = (personId: string) => {
      const cfg = payrollConfigFor(rows, personId, OCTOBER);
      const status = insuranceStatus(month(), cfg);
      const input = { status, insuredSalary: 6_400_000, zone: 'I' as const, unionMember: false };
      return roundDong(computeInsurance(input, cfg).company.unionFund);
    };

    // Act / Assert
    expect([fundOf('nv'), fundOf('nv-khac')]).toEqual([128_000, 0]);
  });

  it('D03: should charge no KPCĐ by default, and 2% of the insured salary once the company turns it on', () => {
    // Act
    const off = insure(month(), { insured: 6_400_000, rows: [] });
    const on = insure(month(), { insured: 6_400_000, rows: [UNION_FUND_ON] });

    // Assert: (46) and its part of (47)
    expect([roundDong(off.company.unionFund), roundDong(on.company.unionFund)]).toEqual([0, 128_000]);
    expect(roundDong(on.companyTotal) - roundDong(off.companyTotal)).toBe(128_000);
  });
});
