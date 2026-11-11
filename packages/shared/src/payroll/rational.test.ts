import { describe, expect, it } from 'vitest';
import { moneyCell, rat, roundDong } from './index.js';
import { add, div, mul, sum } from './rational.js';

/** Exact money: fractions until a cell is rounded. Cases: docs/test-cases-luong.md, L-K1-21, L-D15. */

describe('rounding to the dong (D01)', () => {
  it('should round half a dong away from zero', () => {
    // Act / Assert
    expect([roundDong(rat(2.5)), roundDong(rat(-2.5)), roundDong(rat(2.49)), roundDong(724_500)]).toEqual([
      3, -3, 2, 724_500,
    ]);
  });

  it('should keep fractions exact where floating point would drift', () => {
    // Arrange: 10% of 7.245.000 is exactly 724.500, 0,1 + 0,2 is exactly 0,3
    const tenth = mul(rat(0.1), rat(7_245_000));

    // Act / Assert
    expect(roundDong(tenth)).toBe(724_500);
    expect(add(rat(0.1), rat(0.2))).toEqual(rat(0.3));
  });

  it('L-K1-21: should round each money cell as it is computed and build the next cell from the rounded one', () => {
    // Arrange: path L-K2-49, daily rate 22.450.000 × 90% ÷ 22, 14 days, KPI 10.500.000 × 14 ÷ 22 × 90%
    const daily = div(mul(rat(22_450_000), rat(0.9)), rat(22));
    const kpi = mul(rat(10_500_000), div(mul(rat(14), rat(0.9)), rat(22)));
    const cell = moneyCell('cell');

    // Act
    const dayPart = cell(mul(daily, rat(14)));
    const bonus = cell(kpi);
    const income = sum([dayPart, bonus]);

    // Assert: 12.857.727 + 6.013.636 = 18.871.363, the daily rate itself kept whole
    expect(roundDong(daily)).toBe(918_409);
    expect([roundDong(dayPart), roundDong(bonus), roundDong(income)]).toEqual([12_857_727, 6_013_636, 18_871_363]);
  });

  it('L-K1-21: should keep full numbers in the "as HR\'s file" mode and round only for display', () => {
    // Arrange
    const daily = div(mul(rat(22_450_000), rat(0.9)), rat(22));
    const kpi = mul(rat(10_500_000), div(mul(rat(14), rat(0.9)), rat(22)));
    const cell = moneyCell('as-hr');

    // Act
    const income = sum([cell(mul(daily, rat(14))), cell(kpi)]);

    // Assert: Tròn(18.871.363,64) = 18.871.364, one dong more than the cell mode
    expect(roundDong(income)).toBe(18_871_364);
  });
});
