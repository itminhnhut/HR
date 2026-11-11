import { describe, expect, it } from 'vitest';
import { KPI_K, PROFILE_K } from '../../test-fixtures/payroll-fixtures.js';
import {
  computeIncome,
  kpiLevelFor,
  kpiPercentError,
  overtimeHoursError,
  payrollConfigFor,
  payrollDates,
  restDayPrefill,
  roundDong,
  toNumber,
  type IncomeInput,
  type PaySegment,
  type SettingRow,
} from './index.js';

/** Income, columns (16)–(26). Cases: docs/test-cases-luong.md, L-D01–L-D09, L-D34, L-D38–L-D41, L-K1-19, L-K1-20. */

const OCTOBER = payrollDates(2026, 10);
const config = (rows: SettingRow[] = []) => payrollConfigFor(rows, 'nv', OCTOBER);
const official = (days: number, amounts = PROFILE_K): PaySegment => ({ days, probation: false, amounts });
const probation = (days: number, amounts = PROFILE_K): PaySegment => ({ days, probation: true, amounts });

const income = (input: Partial<IncomeInput> & Pick<IncomeInput, 'segments'>, rows: SettingRow[] = []) =>
  computeIncome({ norm: 22, kpiAmount: 0, ...input }, config(rows));

const cells = (r: ReturnType<typeof computeIncome>) => ({
  gross: r.gross,
  daily: roundDong(r.dailyRate),
  bonus: roundDong(r.kpiBonus),
  overtime: roundDong(r.overtimePay),
  income: roundDong(r.income),
});

describe('daily rate, KPI and income (spec 5.3)', () => {
  it('L-D01: should pay an official person on full days the whole profile plus KPI × the typed %', () => {
    // Arrange: NV A of the golden month, 22/22
    const amounts = {
      luong: 6_400_000,
      com: 1_100_000,
      'chuyen-can': 1_000_000,
      'trang-phuc': 350_000,
      'xang-dt': 2_800_000,
      'nha-o': 2_200_000,
    };

    // Act
    const r = income({ segments: [official(22, amounts)], kpiAmount: 5_500_000, kpiPercent: 1 });

    // Assert: (16) 19.350.000, (18) 629.545, (20) 5.500.000, (26) 19.350.000
    expect(cells(r)).toEqual({ gross: 19_350_000, daily: 629_545, bonus: 5_500_000, overtime: 0, income: 19_350_000 });
  });

  it('L-D02: should apply the probation rate only to components that have "× tỷ lệ thử việc" switched on', () => {
    // Arrange: Chuyên cần without the probation flag
    const rows: SettingRow[] = [{ key: 'khoan.chuyen-can.thu-viec', employeeId: null, from: '2026-10', value: false }];

    // Act
    const r = income({ segments: [probation(22)] }, rows);

    // Assert: (21.450.000 × 90% + 1.000.000) ÷ 22
    expect(toNumber(r.dailyRate)).toBeCloseTo((21_450_000 * 0.9 + 1_000_000) / 22, 6);
    expect(roundDong(r.income)).toBe(21_450_000 * 0.9 + 1_000_000);
  });

  it("L-D03: should pay each segment at its own daily rate and probation rate, on the period's norm", () => {
    // Arrange: 10 days on probation, 12 days official
    const r = income({ segments: [probation(10), official(12)] });

    // Assert: 918.409,09 × 10 + 1.020.454,55 × 12 = 9.184.090,9 + 12.245.454,5 = 21.429.545,45
    expect(r.dailyRates.map(roundDong)).toEqual([918_409, 1_020_455]);
    expect(roundDong(r.dayPay)).toBe(21_429_545);
  });

  it('L-D04: should pay an official person KPI × the typed %, not reduced by the days worked', () => {
    // Act: NV06 19/22 days, HR typed 75%
    const r = income({ segments: [official(19)], kpiAmount: KPI_K, kpiPercent: 0.75 });

    // Assert
    expect(roundDong(r.kpiBonus)).toBe(7_875_000);
    expect(r.kpiPercentSource).toBe('typed');
  });

  it("L-D05: should work out a probation person's KPI % as days ÷ norm × 90% unless HR typed one", () => {
    // Act
    const formula = income({ segments: [probation(19.5)], kpiAmount: KPI_K, block: 'BO' });
    const typed = income({ segments: [probation(19.5)], kpiAmount: KPI_K, kpiPercent: 0.85 });

    // Assert: 19,5 ÷ 22 × 90% = 79,7727…%
    expect(toNumber(formula.kpiPercent)).toBeCloseTo((19.5 / 22) * 0.9, 12);
    expect(formula.kpiPercentSource).toBe('formula');
    expect(roundDong(formula.kpiBonus)).toBe(Math.round(KPI_K * (19.5 / 22) * 0.9));
    expect([toNumber(typed.kpiPercent), typed.kpiPercentSource]).toEqual([0.85, 'typed']);
  });

  it('L-D06: should suggest (days on probation × 90% + days official × 100%) ÷ norm in the month someone became official', () => {
    // Act
    const r = income({ segments: [probation(10), official(12)], kpiAmount: KPI_K, block: 'BO' });

    // Assert: (10 × 90% + 12) ÷ 22, labelled a suggestion
    expect(toNumber(r.kpiPercent)).toBeCloseTo((10 * 0.9 + 12) / 22, 12);
    expect(r.kpiPercentSource).toBe('suggested');
  });

  it('L-D06: should leave the KPI % to HR in that month when D06 is "manual"', () => {
    // Arrange
    const rows: SettingRow[] = [{ key: 'tuy-chon.d06', employeeId: null, from: '2026-10', value: 'manual' }];

    // Act
    const r = income({ segments: [probation(10), official(12)], kpiAmount: KPI_K, block: 'BO' }, rows);

    // Assert
    expect([toNumber(r.kpiPercent), r.kpiPercentSource]).toEqual([0, 'missing']);
  });

  it('L-D38: should work out a back-office (BO) probation KPI % as days ÷ norm × 90% and pay KPI × that', () => {
    // Act: 15/22 and 19,5/22, as the October sheet has them
    const r = income({ segments: [probation(15)], kpiAmount: KPI_K, block: 'BO' });
    const other = income({ segments: [probation(19.5)], kpiAmount: KPI_K, block: 'BO' });

    // Assert: 61,36% and 79,77%; (20) = KPI 100% × the exact %
    expect((toNumber(r.kpiPercent) * 100).toFixed(2)).toBe('61.36');
    expect((toNumber(other.kpiPercent) * 100).toFixed(2)).toBe('79.77');
    expect(r.kpiPercentSource).toBe('formula');
    expect(roundDong(r.kpiBonus)).toBe(Math.round((KPI_K * 15 * 0.9) / 22));
  });

  it('L-D39: should work out a BO official KPI % as days ÷ norm, 100% on full days', () => {
    // Act
    const short = income({ segments: [official(20)], kpiAmount: KPI_K, block: 'BO' });
    const full = income({ segments: [official(22)], kpiAmount: KPI_K, block: 'BO' });

    // Assert: 20 ÷ 22 = 90,91%
    expect((toNumber(short.kpiPercent) * 100).toFixed(2)).toBe('90.91');
    expect([short.kpiPercentSource, roundDong(short.kpiBonus)]).toEqual(['formula', Math.round((KPI_K * 20) / 22)]);
    expect([toNumber(full.kpiPercent), roundDong(full.kpiBonus)]).toEqual([1, KPI_K]);
  });

  it('L-D39: should not divide a BO official KPI by the days twice when "chia theo ngày công" is on', () => {
    // Arrange
    const rows: SettingRow[] = [
      { key: 'quy-tac.kpi-chinh-thuc-theo-ngay', employeeId: null, from: '2026-10', value: true },
    ];

    // Act / Assert
    const r = income({ segments: [official(20)], kpiAmount: KPI_K, block: 'BO' }, rows);
    expect(roundDong(r.kpiBonus)).toBe(Math.round((KPI_K * 20) / 22));
  });

  it('L-D40: should leave a sales (KD) KPI % to HR, on probation and official, and take what HR typed', () => {
    // Act
    const untyped = income({ segments: [probation(19.5)], kpiAmount: KPI_K, block: 'KD' });
    const official80 = income({ segments: [official(22)], kpiAmount: KPI_K, block: 'KD', kpiPercent: 0.8 });
    const probation80 = income({ segments: [probation(13)], kpiAmount: KPI_K, block: 'KD', kpiPercent: 0.8 });

    // Assert
    expect([toNumber(untyped.kpiPercent), untyped.kpiPercentSource, roundDong(untyped.kpiBonus)]).toEqual([
      0,
      'missing',
      0,
    ]);
    expect([toNumber(official80.kpiPercent), official80.kpiPercentSource]).toEqual([0.8, 'typed']);
    expect([toNumber(probation80.kpiPercent), roundDong(probation80.kpiBonus)]).toEqual([0.8, 8_400_000]);
  });

  it('L-D40: should treat a person without a block as KD, and a typed % always wins for BO', () => {
    // Act
    const noBlock = income({ segments: [probation(19.5)], kpiAmount: KPI_K, block: null });
    const typed = income({ segments: [official(20)], kpiAmount: KPI_K, block: 'BO', kpiPercent: 1 });

    // Assert
    expect(noBlock.kpiPercentSource).toBe('missing');
    expect([toNumber(typed.kpiPercent), typed.kpiPercentSource]).toEqual([1, 'typed']);
  });

  it('L-D41: should flip the rule of a block for everyone or for one person with "KPI theo khối"', () => {
    // Arrange: KD by formula for person "nv" only; BO typed for everyone
    const rows: SettingRow[] = [
      { key: 'quy-tac.kpi-theo-khoi', employeeId: 'nv', from: '2026-10', value: { BO: 'formula', KD: 'formula' } },
    ];
    const everyone: SettingRow[] = [
      { key: 'quy-tac.kpi-theo-khoi', employeeId: null, from: '2026-10', value: { BO: 'typed', KD: 'typed' } },
    ];
    const input = { segments: [probation(15)], kpiAmount: KPI_K };

    // Act
    const kdOwn = income({ ...input, block: 'KD' }, rows);
    const kdOther = computeIncome({ norm: 22, ...input, block: 'KD' }, payrollConfigFor(rows, 'nv-khac', OCTOBER));
    const boTyped = income({ ...input, block: 'BO' }, everyone);

    // Assert
    expect([(toNumber(kdOwn.kpiPercent) * 100).toFixed(2), kdOwn.kpiPercentSource]).toEqual(['61.36', 'formula']);
    expect(kdOther.kpiPercentSource).toBe('missing');
    expect(boTyped.kpiPercentSource).toBe('missing');
  });

  it('L-D07: should take the KPI level of the last day of the period, or of the leaving day', () => {
    // Arrange: KPI 4 tr, 5 tr from 01/11; period T11 is 26/10–25/11
    const levels = [
      { from: '2026-01-01', amount: 4_000_000 },
      { from: '2026-11-01', amount: 5_000_000 },
    ];
    const period = payrollDates(2026, 11).period;

    // Act / Assert
    expect(kpiLevelFor(levels, period, null)).toBe(5_000_000);
    expect(kpiLevelFor(levels, period, '2026-10-30')).toBe(4_000_000);
  });

  it('L-D08: should refuse a KPI % for a person without KPI and a % outside 0–200%', () => {
    // Act / Assert
    expect(kpiPercentError(0.8, 0)).toMatch(/không có KPI/);
    expect(kpiPercentError(-0.05, KPI_K)).toMatch(/0–200%/);
    expect(kpiPercentError(2.5, KPI_K)).toMatch(/0–200%/);
    expect(kpiPercentError(2, KPI_K)).toBeNull();
  });

  it('L-D09: should pay weekday overtime as hours × daily rate ÷ 8 × 150%, in steps of half an hour', () => {
    // Act
    const r = income({ segments: [official(22)], overtime: { weekdayHours: 10, restDays: 0, holidayDays: 0 } });

    // Assert: 10 × 1.020.454,55 ÷ 8 × 1,5 = 1.913.352,27
    expect(roundDong(r.overtimePay)).toBe(1_913_352);
    expect(overtimeHoursError(10.5)).toBeNull();
    expect(overtimeHoursError(10.25)).toMatch(/0,5/);
  });

  it('L-D34: should show the agreed gross as every component plus KPI 100%, for every row, without paying it', () => {
    // Act: a probation person on 14 days
    const r = income({ segments: [probation(14)], kpiAmount: KPI_K });

    // Assert
    expect(r.gross).toBe(22_450_000 + KPI_K);
  });
});

describe('work on a holiday and on a Sunday (BLLĐ Đ.98)', () => {
  it('L-K1-19: should add 300% for a holiday worked, on top of the day already in the paid days', () => {
    // Act: profile K, official 22/22, KPI 80%, holidayWorked 1
    const r = income({
      segments: [official(22)],
      kpiAmount: KPI_K,
      kpiPercent: 0.8,
      overtime: { weekdayHours: 0, restDays: 0, holidayDays: 1 },
    });

    // Assert: (25) = 1.020.454,55 × 300% = 3.061.364; (26) = 22.450.000 + 8.400.000 + 3.061.364
    expect(roundDong(r.overtimePay)).toBe(3_061_364);
    expect(roundDong(r.income)).toBe(33_911_364);
  });

  it('L-K1-20: should pay a Sunday outside (17) at 200% when there is an overtime day', () => {
    // Arrange: sundayWorked 1, OT 1
    const prefill = restDayPrefill({ sundayWorked: 1, overtime: 1 }, 'total-200');

    // Act
    const r = income({
      segments: [official(22)],
      kpiAmount: KPI_K,
      kpiPercent: 0.8,
      overtime: { weekdayHours: 0, holidayDays: 0, ...prefill },
    });

    // Assert: (25) = 1.020.454,55 × 200% = 2.040.909; (26) 32.890.909
    expect(prefill).toEqual({ restDays: 1, sundayInPaid: 0 });
    expect(roundDong(r.overtimePay)).toBe(2_040_909);
    expect(roundDong(r.income)).toBe(32_890_909);
  });

  it('L-K1-20: should add 100% for a Sunday already in (17) making up a weekday off, 200% in all (D12)', () => {
    // Arrange: sundayWorked 1, OT 0 (one weekday KL)
    const prefill = restDayPrefill({ sundayWorked: 1, overtime: 0 }, 'total-200');

    // Act
    const r = income({
      segments: [official(22)],
      kpiAmount: KPI_K,
      kpiPercent: 0.8,
      overtime: { weekdayHours: 0, holidayDays: 0, ...prefill },
    });

    // Assert: (25) 1.020.455; (26) 31.870.455
    expect(prefill).toEqual({ restDays: 0, sundayInPaid: 1 });
    expect(roundDong(r.overtimePay)).toBe(1_020_455);
    expect(roundDong(r.income)).toBe(31_870_455);
  });

  it('L-K1-20: should add nothing for that Sunday when D12 is "đổi ngày nghỉ theo nội quy"', () => {
    // Arrange
    const rows: SettingRow[] = [{ key: 'tuy-chon.d12', employeeId: null, from: '2026-10', value: 'swap-day' }];
    const prefill = restDayPrefill({ sundayWorked: 1, overtime: 0 }, 'swap-day');

    // Act
    const r = income(
      {
        segments: [official(22)],
        kpiAmount: KPI_K,
        kpiPercent: 0.8,
        overtime: { weekdayHours: 0, holidayDays: 0, ...prefill },
      },
      rows,
    );

    // Assert: (25) 0; (26) 30.850.000
    expect(roundDong(r.overtimePay)).toBe(0);
    expect(roundDong(r.income)).toBe(30_850_000);
  });

  it('câu 20: should pay overtime on the daily rate of the components "vào lương làm thêm" only', () => {
    // Arrange: housing taken out of the overtime base
    const rows: SettingRow[] = [{ key: 'khoan.nha-o.vao-lam-them', employeeId: null, from: '2026-10', value: false }];

    // Act
    const r = income({ segments: [official(22)], overtime: { weekdayHours: 8, restDays: 0, holidayDays: 0 } }, rows);

    // Assert: (22.450.000 − 8.500.000) ÷ 22 × 150%
    expect(roundDong(r.overtimePay)).toBe(Math.round((13_950_000 / 22) * 1.5));
  });
});
