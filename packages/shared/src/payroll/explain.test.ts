import { describe, expect, it } from 'vitest';
import { GOLDEN_PEOPLE } from '../../test-fixtures/payroll-golden.js';
import { GOLDEN_MONTH, goldenInput } from '../../test-fixtures/payroll-golden-inputs.js';
import { computeLine, explainLine, payrollConfigFor, type SettingRow } from './index.js';

/**
 * What the payroll grid's tooltips say (spec 11.2, Q6, Q7): each formula with the row's real numbers, the setting
 * versions it used, and the person's own settings. Cases: docs/test-cases-luong.md, L-L03, L-L08, L-L09.
 */

const explainFor = (id: string, rows: SettingRow[] = []) => {
  const person = GOLDEN_PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`No golden person ${id}`);
  const input = goldenInput(person, { asHrFile: false });
  const config = payrollConfigFor(rows, id, GOLDEN_MONTH);
  return { line: computeLine(input, config), explain: explainLine(input, computeLine(input, config), config) };
};

const MEAL_TAXED_FOR_A: SettingRow = {
  key: 'khoan.com.thue',
  employeeId: 'NV A',
  from: '2026-10',
  value: { kind: 'taxable' },
  source: 'Quyết định HR',
};

describe('the formula behind each cell, with real numbers', () => {
  it('L-L08: should write (18) of NV G as the per-day components × 90% ÷ the norm', () => {
    // Act
    const { explain } = explainFor('NV G');

    // Assert
    expect(explain.cells.dailyRate?.formula).toBe('(6.400.000 + 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136');
  });

  it('L-L08: should list each exempt part of (33) with the cap it used', () => {
    // Act
    const { explain, line } = explainFor('NV G');

    // Assert
    const formula = explain.cells.exempt?.formula ?? '';
    expect(formula).toContain('Tiền cơm');
    expect(formula).toContain('trần 1.200.000');
    expect(formula).toContain('Xăng xe + ĐT');
    expect(formula.endsWith(`= ${line.cells.exempt.toLocaleString('vi-VN')}`)).toBe(true);
  });

  it('L-L08: should give the tax method and its reason in (40)', () => {
    // Act
    const g = explainFor('NV G').explain.cells.tax?.formula;
    const b = explainFor('NV B').explain.cells.tax?.formula;

    // Assert: NV B (34) 19.700.000 − 2.300.000 fuel now exempt = 17.400.000; (38) 17.400.000 − 15.500.000 − 672.000
    expect(g).toBe('Không khấu trừ · Có cam kết (D09) = 0');
    expect(b).toBe('Lũy tiến trên (38) 1.228.000: 1.228.000 × 5% = 61.400');
  });

  it('L-L09: should name the setting version (33) used: the meal cap from 01/07/2026', () => {
    // Act
    const refs = explainFor('NV G').explain.cells.exempt?.refs ?? [];

    // Assert
    expect(refs).toContainEqual(
      expect.objectContaining({ key: 'luat.tran-tien-an', value: '1.200.000', from: '01/07/2026', area: 'tham-so' }),
    );
  });

  it('L-L08: should mark (17) as coming from the timesheet closing', () => {
    // Act
    const cell = explainFor('NV A').explain.cells.paidDays;

    // Assert
    expect(cell?.fromTimesheet).toBe(true);
  });
});

describe('(32) with the insurance the company pays back', () => {
  const paidBack = (taxable: boolean) => {
    const person = GOLDEN_PEOPLE.find((p) => p.id === 'NV A');
    if (!person) throw new Error('No golden person NV A');
    const base = goldenInput(person, { asHrFile: false });
    const input = { ...base, cash: { support: 300_000, insurancePaid: { taxable } } };
    const config = payrollConfigFor([], 'NV A', GOLDEN_MONTH);
    const line = computeLine(input, config);
    return { c: line.cells, cells: explainLine(input, line, config).cells };
  };
  const dots = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  it('should show the item and its formula (28) + (29) + (30), marked as not taxed', () => {
    // Act
    const { c, cells } = paidBack(false);

    // Assert
    expect(cells.cash?.formula).toBe(
      `Hỗ trợ 300.000 + Hoàn ứng 0 − Tạm ứng 0 + Công ty trả thay BH [(28) + (29) + (30) = ${dots(c.social)} + ${dots(c.health)} + ${dots(c.unemployment)} = ${dots(c.insuranceDeduction)}, chưa tính thuế] = ${dots(c.cash)}`,
    );
    expect(cells.taxable?.formula).toBe(`${dots(c.income)} + Hỗ trợ 300.000 − ${dots(c.exempt)} = ${dots(c.taxable)}`);
  });

  it('should carry it into (34) and (48) when it is taxed', () => {
    // Act
    const { c, cells } = paidBack(true);
    const paid = dots(c.insuranceDeduction);

    // Assert
    expect(cells.cash?.formula).toContain(`= ${paid}, tính thuế] = ${dots(c.cash)}`);
    expect(cells.taxable?.formula).toBe(
      `${dots(c.income)} + Hỗ trợ 300.000 + Công ty trả thay BH ${paid} − ${dots(c.exempt)} = ${dots(c.taxable)}`,
    );
    expect(cells.totalCost?.formula).toBe(
      `${dots(c.income)} + Hỗ trợ 300.000 + Công ty trả thay BH ${paid} + ${dots(c.companyTotal)} = ${dots(c.totalCost)}`,
    );
  });
});

describe("a person's own settings", () => {
  it("L-L03: should list NV A's own meal tax setting on (33), from its month", () => {
    // Act
    const { explain } = explainFor('NV A', [MEAL_TAXED_FOR_A]);

    // Assert
    expect(explain.personSettings).toEqual([
      expect.objectContaining({
        key: 'khoan.com.thue',
        text: 'Tiền cơm chịu thuế',
        from: 'T10/2026',
        cells: ['exempt'],
      }),
    ]);
  });

  it('L-L03: should list nothing for someone without their own rows', () => {
    // Act
    const { explain } = explainFor('NV B', [MEAL_TAXED_FOR_A]);

    // Assert
    expect(explain.personSettings).toEqual([]);
  });
});
