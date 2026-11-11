import { describe, expect, it } from 'vitest';
import { GOLDEN_MONTH, goldenCellsOf, goldenInput } from '../../test-fixtures/payroll-golden-inputs.js';
import { AS_HR_ROWS, GOLDEN_COLUMNS, GOLDEN_PEOPLE, type GoldenRow } from '../../test-fixtures/payroll-golden.js';
import { asHrFileSettings, componentsFor, computeLine, payrollConfigFor, payrollTotals } from './index.js';

/**
 * The anonymous golden month in the "as HR's file" mode and the October configuration (spec 5.7, 5.9): one exempt
 * "Xăng xe + ĐT" component, meal and clothing fully exempt, no KPCĐ, (32) a refund, KPI % as typed, D01 "as HR's
 * file", D10 10% for short contracts only. Cases: docs/test-cases-luong.md, L-K3-F01–F12 and both total rows.
 */

const ROWS = asHrFileSettings(GOLDEN_MONTH.monthKey);
const personRows = AS_HR_ROWS.filter((r) => r.id.startsWith('L-K3-'));
const [cellSum, fullSum] = AS_HR_ROWS.filter((r) => !r.id.startsWith('L-K3-'));
const lines = GOLDEN_PEOPLE.map((p) =>
  computeLine(goldenInput(p, { asHrFile: true }), payrollConfigFor(ROWS, p.id, GOLDEN_MONTH)),
);
const moneyColumns = GOLDEN_COLUMNS.filter((key) => key !== 'dailyRate' && key !== 'kpiPercent');

describe('the October configuration "as HR\'s file"', () => {
  it('should pay fuel and phone as one exempt component and exempt meal and clothing in full', () => {
    // Act
    const components = componentsFor(ROWS, 'nv', GOLDEN_MONTH.monthKey);

    // Assert
    expect(components.map((c) => [c.id, c.tax.kind])).toEqual([
      ['luong', 'taxable'],
      ['trach-nhiem', 'taxable'],
      ['com', 'exempt'],
      ['xang-dt', 'exempt'],
      ['trang-phuc', 'exempt'],
      ['nha-o', 'taxable'],
      ['chuyen-can', 'taxable'],
    ]);
  });

  it('should mark "Tính BH" only on the time pay, the one component its insurance salary counts', () => {
    // Act
    const insured = componentsFor(ROWS, 'nv', GOLDEN_MONTH.monthKey).filter((c) => c.insured);
    const bases = lines.filter((l) => l.cells.socialBase > 0).map((l) => l.cells.socialBase);

    // Assert: Chuyên cần and PC trách nhiệm off, as the (27) of the file
    expect(insured.map((c) => c.id)).toEqual(['luong']);
    expect(new Set(bases)).toEqual(new Set([6_400_000]));
  });

  it('should leave the default configuration untouched before the month it starts', () => {
    const meal = componentsFor(ROWS, 'nv', '2026-09').find((c) => c.id === 'com');
    expect(meal?.tax).toEqual({ kind: 'cap', cap: 'meal' });
  });
});

describe('golden month, "as HR\'s file" (K3-F)', () => {
  it('should have the twelve rows and both total rows of the catalogue', () => {
    expect([personRows.length, cellSum?.id, fullSum?.id]).toEqual([12, 'Σ', 'Tròn(Σ đủ)']);
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
    },
  );

  it('L-K3-F Σ: should give Tròn(Σ of the full numbers) on the total row, one dong off Σ of the cells in four columns', () => {
    // Act
    const totals = payrollTotals(lines, 'as-hr');
    const sumOfCells = Object.fromEntries(
      moneyColumns.map((key) => [key, lines.reduce((acc, l) => acc + l.cells[key], 0)]),
    );

    // Assert: (26) 152.656.523, (34) 121.112.501, (42) 149.142.623, (48) 161.104.523
    expect(Object.fromEntries(moneyColumns.map((key) => [key, totals[key]]))).toEqual(fullSum?.cells);
    expect(sumOfCells).toEqual(cellSum?.cells);
  });
});
