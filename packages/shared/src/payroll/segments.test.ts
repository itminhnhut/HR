import { describe, expect, it } from 'vitest';
import { KPI_K, PROFILE_K } from '../../test-fixtures/payroll-fixtures.js';
import { periodDays, type AttendanceCode } from '../timesheet.js';
import {
  computeIncome,
  payrollConfigFor,
  payrollDates,
  paySegmentsFor,
  roundDong,
  toNumber,
  type ProfileVersion,
} from './index.js';

/**
 * A period split where someone became official or got a raise (spec 5.6), using the timesheet's `paidBySegment`.
 * Cases: docs/test-cases-luong.md, L-C23, L-D03, L-D06, L-B05.
 */

const OCTOBER = payrollDates(2026, 10);
const NOVEMBER = payrollDates(2026, 11);
const config = payrollConfigFor([], 'nv', OCTOBER);
const PROFILE: ProfileVersion[] = [{ from: '2026-01-01', amounts: PROFILE_K }];

/** Mon–Fri worked, plus the Saturdays listed; Sundays and other Saturdays empty. */
function codesOf(days: readonly string[], saturdays: readonly string[]): (AttendanceCode | null)[] {
  return days.map((day) => {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (weekday === 0) return null;
    if (weekday === 6) return saturdays.includes(day) ? '1' : null;
    return '1';
  });
}

const OCTOBER_DAYS = periodDays(OCTOBER.period);
const TWO_SATURDAYS = codesOf(OCTOBER_DAYS, ['2026-10-03', '2026-10-17']);

describe('splitting the paid days (L-C23)', () => {
  it('L-C23: should split 22 paid days on the official date by the day codes, the parts adding up to the paid total', () => {
    // Act: official from 15/10
    const segments = paySegmentsFor({
      days: OCTOBER_DAYS,
      codes: TWO_SATURDAYS,
      paid: 22,
      leavePaid: 0,
      employment: 'official',
      officialOn: '2026-10-15',
      profiles: PROFILE,
    });

    // Assert: 26/09–14/10 has 14 days worked, 15/10–25/10 has 8
    expect(segments.map((s) => [s.from, s.days, s.probation])).toEqual([
      ['2026-09-26', 14, true],
      ['2026-10-15', 8, false],
    ]);
  });

  it('L-C23: should cut days above the norm from the later part and put an adjustment on it', () => {
    // Arrange: a third Saturday worked (23 days, paid 22), and an adjustment of −0,5 (paid 21,5)
    const codes = codesOf(OCTOBER_DAYS, ['2026-10-03', '2026-10-17', '2026-10-24']);
    const split = (paid: number) =>
      paySegmentsFor({
        days: OCTOBER_DAYS,
        codes,
        paid,
        leavePaid: 0,
        employment: 'official',
        officialOn: '2026-10-15',
        profiles: PROFILE,
      });

    // Act / Assert
    expect(split(22).map((s) => s.days)).toEqual([14, 8]);
    expect(split(21.5).map((s) => s.days)).toEqual([14, 7.5]);
  });

  it('should keep one segment for someone on probation all period, or official all period', () => {
    // Act
    const probation = paySegmentsFor({
      days: OCTOBER_DAYS,
      codes: TWO_SATURDAYS,
      paid: 22,
      leavePaid: 0,
      employment: 'probation',
      officialOn: null,
      profiles: PROFILE,
    });
    const official = paySegmentsFor({
      days: OCTOBER_DAYS,
      codes: TWO_SATURDAYS,
      paid: 22,
      leavePaid: 0,
      employment: 'official',
      officialOn: '2026-08-01',
      profiles: PROFILE,
    });

    // Assert
    expect(probation.map((s) => [s.days, s.probation])).toEqual([[22, true]]);
    expect(official.map((s) => [s.days, s.probation])).toEqual([[22, false]]);
  });
});

describe('pay and KPI in a split month', () => {
  const segments = paySegmentsFor({
    days: OCTOBER_DAYS,
    codes: TWO_SATURDAYS,
    paid: 22,
    leavePaid: 0,
    employment: 'official',
    officialOn: '2026-10-15',
    profiles: PROFILE,
  });

  it("L-D03: should pay Σ(daily rate of the segment × its days) on the period's norm", () => {
    // Act
    const r = computeIncome({ norm: 22, segments, kpiAmount: 0 }, config);

    // Assert: 918.409,09 × 14 + 1.020.454,55 × 8 = 21.021.363,6
    expect(roundDong(r.dayPay)).toBe(21_021_364);
  });

  it('L-D06: should suggest (14 × 90% + 8 × 100%) ÷ 22 as the KPI % of the month', () => {
    // Act
    const r = computeIncome({ norm: 22, segments, kpiAmount: KPI_K, block: 'BO' }, config);

    // Assert
    expect(r.kpiPercentSource).toBe('suggested');
    expect(toNumber(r.kpiPercent)).toBeCloseTo((14 * 0.9 + 8) / 22, 12);
  });
});

describe('a raise during the period (L-B05)', () => {
  const days = periodDays(NOVEMBER.period);
  const codes = codesOf(days, []);
  const raise: ProfileVersion[] = [
    { from: '2026-01-01', amounts: { luong: 8_000_000 } },
    { from: '2026-11-01', amounts: { luong: 10_000_000 } },
  ];

  it('L-B05: should split 26/10–31/10 at the old level and 01/11–25/11 at the new one', () => {
    // Act: 23 weekdays, 5 before 01/11
    const segments = paySegmentsFor({
      days,
      codes,
      paid: 23,
      leavePaid: 0,
      employment: 'official',
      officialOn: null,
      profiles: raise,
    });

    // Assert
    expect(segments).toEqual([
      { from: '2026-10-26', days: 5, probation: false, amounts: { luong: 8_000_000 } },
      { from: '2026-11-01', days: 18, probation: false, amounts: { luong: 10_000_000 } },
    ]);
  });

  it('L-B05: should pay both segments on the one norm of the period', () => {
    // Arrange
    const segments = paySegmentsFor({
      days,
      codes,
      paid: 23,
      leavePaid: 0,
      employment: 'official',
      officialOn: null,
      profiles: raise,
    });

    // Act
    const r = computeIncome({ norm: 23, segments, kpiAmount: 0 }, payrollConfigFor([], 'nv', NOVEMBER));

    // Assert: 8 tr × 5 ÷ 23 + 10 tr × 18 ÷ 23
    expect(roundDong(r.dayPay)).toBe(Math.round((8_000_000 * 5 + 10_000_000 * 18) / 23));
  });

  it('L-B04: should not split a raise from the first day of the period', () => {
    // Arrange
    const fromStart: ProfileVersion[] = [
      { from: '2026-01-01', amounts: { luong: 8_000_000 } },
      { from: '2026-10-26', amounts: { luong: 10_000_000 } },
    ];

    // Act
    const segments = paySegmentsFor({
      days,
      codes,
      paid: 23,
      leavePaid: 0,
      employment: 'official',
      officialOn: null,
      profiles: fromStart,
    });

    // Assert
    expect(segments.map((s) => [s.days, s.amounts.luong])).toEqual([[23, 10_000_000]]);
  });

  it('should make three segments when the official date and a raise both fall in the period', () => {
    // Act: official from 05/11, raise from 16/11
    const both: ProfileVersion[] = [
      { from: '2026-01-01', amounts: { luong: 8_000_000 } },
      { from: '2026-11-16', amounts: { luong: 10_000_000 } },
    ];
    const segments = paySegmentsFor({
      days,
      codes,
      paid: 23,
      leavePaid: 0,
      employment: 'official',
      officialOn: '2026-11-05',
      profiles: both,
    });

    // Assert: 26/10–04/11 = 8 weekdays, 05/11–15/11 = 7, 16/11–25/11 = 8
    expect(segments.map((s) => [s.from, s.days, s.probation, s.amounts.luong])).toEqual([
      ['2026-10-26', 8, true, 8_000_000],
      ['2026-11-05', 7, false, 8_000_000],
      ['2026-11-16', 8, false, 10_000_000],
    ]);
  });
});
