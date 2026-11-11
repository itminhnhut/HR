import { describe, expect, it } from 'vitest';
import type { PayrollLineDto } from '../../../api';
import { cellPartsOf, noteFor } from './cellParts';
import { settingKeysOf } from './cellSources';
import { payrollBands } from './payrollModel';
import { person } from './payrollTestData';

/** "Trong đó" of a total cell in the sources drawer (F08). */

const COMPONENTS = [
  { id: 'luong', name: 'Lương thời gian' },
  { id: 'com', name: 'Tiền cơm' },
];
const COLUMNS = payrollBands(COMPONENTS).flatMap((b) => b.columns);

describe('the cells a total adds up', () => {
  it('should list (41) as its five deductions, each named with its column number', () => {
    // Arrange
    const line = person({
      cells: {
        social: 480_000,
        health: 90_000,
        unemployment: 60_000,
        unionFee: 0,
        tax: 100_000,
      } as PayrollLineDto['cells'],
    });

    // Act
    const parts = cellPartsOf('totalDeductions', line, COLUMNS, COMPONENTS);

    // Assert
    expect(parts.map((p) => `${p.sign} ${p.label} ${p.value}`)).toEqual([
      '+ (28) BHXH 480000',
      '+ (29) BHYT 90000',
      '+ (30) BHTN 60000',
      '+ (31) Đoàn phí 0',
      '+ (40) Thuế TNCN 100000',
    ]);
    expect(parts.every((p) => p.cell !== null)).toBe(true);
  });

  it('should subtract (41) from (26) and add (32) for (42)', () => {
    // Act
    const parts = cellPartsOf('netPay', person({}), COLUMNS, COMPONENTS);

    // Assert
    expect(parts.map((p) => `${p.sign}${p.cell ?? ''}`)).toEqual(['+income', '−totalDeductions', '+cash']);
  });

  it('should start (26) with what was paid of each pay component, then (20), (24), (25)', () => {
    // Arrange
    const line = person({
      cells: { kpiBonus: 1_000_000, otherIncome: 0, overtimePay: 200_000 } as PayrollLineDto['cells'],
      sheet: {
        title: '',
        dependants: 0,
        taxMethod: 'progressive',
        paid: { luong: 6_000_000, com: 0 },
        payslipEmail: null,
        bankName: null,
        bankAccount: null,
      },
    });

    // Act
    const parts = cellPartsOf('income', line, COLUMNS, COMPONENTS);

    // Assert
    expect(parts.map((p) => [p.label, p.value, p.cell])).toEqual([
      ['Lương thời gian (theo ngày công)', 6_000_000, null],
      ['(20) Thưởng hiệu suất', 1_000_000, 'kpiBonus'],
      ['(24) Thu nhập khác', 0, 'otherIncome'],
      ['(25) Tiền làm thêm', 200_000, 'overtimePay'],
    ]);
  });

  it('should have nothing to list for a cell that is not a total', () => {
    // Act + Assert
    expect(cellPartsOf('social', person({}), COLUMNS, COMPONENTS)).toEqual([]);
  });
});

describe('the note of the row in the drawer', () => {
  const note = 'Đóng BH đủ; Khối lấy từ hồ sơ nhân viên (lần chốt công chưa có khối)';

  it('should keep the block note on (19), which the block decides', () => {
    // Act + Assert
    expect(noteFor('kpiPercent', note)).toBe(note);
  });

  it('should leave the block note out of a cell the block does not touch', () => {
    // Act + Assert
    expect(noteFor('netPay', note)).toBe('Đóng BH đủ');
    expect(noteFor('netPay', 'Khối lấy từ hồ sơ nhân viên (lần chốt công chưa có khối)')).toBe('');
  });
});

describe('the settings a cell names as its sources (C04)', () => {
  const keys = (cell: Parameters<typeof settingKeysOf>[0]) => settingKeysOf(cell, person({}), ['luong']);

  it('should name the hours of a rest-day công on (25), the pay date on (40) and the rounding on the totals', () => {
    expect(keys('overtimePay')).toContain('quy-tac.gio-cong-ngay-nghi');
    expect(keys('tax')).toContain('quy-tac.ngay-chi-tra');
    expect(keys('income')).toEqual(['quy-tac.gross-gom-kpi', 'tuy-chon.d01']);
    expect([keys('totalDeductions'), keys('netPay'), keys('totalCost')]).toEqual([
      ['tuy-chon.d01'],
      ['tuy-chon.d01'],
      ['tuy-chon.d01'],
    ]);
  });
});
