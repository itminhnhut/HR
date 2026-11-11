import { describe, expect, it } from 'vitest';
import { DEFAULT_ROWS, GOLDEN_COLUMNS, GOLDEN_PEOPLE, type GoldenRow } from '../../test-fixtures/payroll-golden.js';
import { GOLDEN_MONTH, goldenCellsOf, goldenInput } from '../../test-fixtures/payroll-golden-inputs.js';
import { computeLine, payrollConfigFor, payrollTotals } from './index.js';

/**
 * The anonymous golden month in the default configuration (spec 5, 5.9, D01–D12): fuel taxed, phone and clothing
 * exempt up to their levels, (32) of NV D and NV F a support, no KPCĐ (off by default), KPI % by block (BO by formula, KD typed), probation people with
 * a valid commitment, NV E and NV H by D10. Cases: docs/test-cases-luong.md, L-K3-S01–S12 and the total row.
 */

const personRows = DEFAULT_ROWS.filter((r) => r.id.startsWith('L-K3-'));
const totalRow = DEFAULT_ROWS.find((r) => r.id === 'Σ');
const lines = GOLDEN_PEOPLE.map((p) =>
  computeLine(goldenInput(p, { asHrFile: false }), payrollConfigFor([], p.id, GOLDEN_MONTH)),
);

describe('golden month, default configuration (K3-S)', () => {
  it('should have the twelve rows and the total row of the catalogue', () => {
    expect([personRows.length, totalRow?.cells.income]).toEqual([12, 152_306_522]);
  });

  it.each(personRows.map((row, i) => [row.id, row.person, row, i] as const))(
    '%s: should match every cell of %s',
    (_id, _person, row: GoldenRow, i: number) => {
      // Arrange
      const line = lines[i];

      // Act
      const cells = line ? goldenCellsOf(line, GOLDEN_COLUMNS) : {};

      // Assert
      expect(cells).toEqual(row.cells);
      expect(line?.cells.netPay).toBe(
        (line?.cells.income ?? 0) - (line?.cells.totalDeductions ?? 0) + (line?.cells.cash ?? 0),
      );
    },
  );

  it('L-K3-S Σ: should total each column as the sum of its cells, so total net pay is the total transferred', () => {
    // Act
    const totals = payrollTotals(lines, 'cell');
    const expected = totalRow?.cells ?? {};

    // Assert
    const moneyColumns = GOLDEN_COLUMNS.filter((key) => key !== 'dailyRate' && key !== 'kpiPercent');
    expect(Object.fromEntries(moneyColumns.map((key) => [key, totals[key]]))).toEqual(expected);
  });
});
