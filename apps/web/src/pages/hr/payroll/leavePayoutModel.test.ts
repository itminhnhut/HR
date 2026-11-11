import { describe, expect, it } from 'vitest';
import type { PayrollLeavePayoutDto, PayrollLineYearDto } from '@careers/shared';
import { leavePayoutInput, leavePayoutLines, yearToDateOf } from './leavePayoutModel';

const PAYOUT: PayrollLeavePayoutDto = {
  days: 3.5,
  base: 6_600_000,
  norm: 22,
  basisOn: '2026-09-25',
  computed: 1_050_000,
  typed: null,
  amount: 1_050_000,
  exempt: 1_050_000,
};

describe('leavePayoutLines', () => {
  it('should spell the formula with the numbers of the row', () => {
    expect(leavePayoutLines(PAYOUT)).toEqual([
      '3,5 ngày phép chưa nghỉ × 6.600.000 (lương theo HĐ, mức ngày 25/09/2026) ÷ 22 công chuẩn = 1.050.000',
      'Trả 1.050.000 (tự tính), miễn thuế cả khoản.',
    ]);
  });

  it("should say HR's amount and the part that is taxed", () => {
    const typed = { ...PAYOUT, typed: 1_500_000, amount: 1_500_000 };
    expect(leavePayoutLines(typed)[1]).toBe(
      'Trả 1.500.000 (HR nhập, số tính 1.050.000), miễn thuế 1.050.000, chịu thuế 450.000.',
    );
  });

  it('should say nothing is paid when HR typed 0', () => {
    const none = { ...PAYOUT, typed: 0, amount: 0, exempt: 0 };
    expect(leavePayoutLines(none)[1]).toBe('Không trả (HR nhập 0, số tính 1.050.000).');
  });

  it('should leave out the day of the level when the row has none', () => {
    expect(leavePayoutLines({ ...PAYOUT, basisOn: null })[0]).toBe(
      '3,5 ngày phép chưa nghỉ × 6.600.000 (lương theo HĐ) ÷ 22 công chuẩn = 1.050.000',
    );
  });
});

describe('leavePayoutInput', () => {
  it('should read an empty box as automatic', () => {
    expect(leavePayoutInput('  ')).toEqual({ value: null });
  });

  it('should read 0 as paying nothing and an amount with dots as dong', () => {
    expect(leavePayoutInput('0')).toEqual({ value: 0 });
    expect(leavePayoutInput('1.500.000')).toEqual({ value: 1_500_000 });
  });

  it('should refuse what is not a whole amount from 0', () => {
    expect(leavePayoutInput('abc')).toEqual({
      error: 'Tiền phép chưa nghỉ: nhập số đồng từ 0, hoặc để trống để web tự tính.',
    });
    expect(leavePayoutInput('-5')).toEqual({
      error: 'Tiền phép chưa nghỉ: nhập số đồng từ 0, hoặc để trống để web tự tính.',
    });
  });
});

describe('yearToDateOf', () => {
  const YEAR: PayrollLineYearDto = {
    before: {
      clothingExempt: 3_000_000,
      overtimeHours: 120,
      taxable: 90_000_000,
      tax: 4_500_000,
      insurance: 9_450_000,
    },
    month: { clothingExempt: 416_667, overtimeHours: 12.5, taxable: 10_000_000, tax: 500_000, insurance: 1_050_000 },
  };

  it('should show the clothing pay exempted so far on (33)', () => {
    expect(yearToDateOf('exempt', YEAR)).toEqual([
      { label: 'Trang phục đã miễn thuế', kind: 'money', before: 3_000_000, month: 416_667, total: 3_416_667 },
    ]);
  });

  it('should show the overtime hours so far on the overtime pay', () => {
    expect(yearToDateOf('overtimePay', YEAR)).toEqual([
      { label: 'Giờ làm thêm tính vào trần năm', kind: 'hours', before: 120, month: 12.5, total: 132.5 },
    ]);
  });

  it('should show taxable income, insurance and tax so far on (40)', () => {
    expect(yearToDateOf('tax', YEAR).map((l) => [l.label, l.total])).toEqual([
      ['Thu nhập chịu thuế', 100_000_000],
      ['BH người lao động đã đóng', 10_500_000],
      ['Thuế đã khấu trừ', 5_000_000],
    ]);
  });

  it('should show nothing on a cell the year does not touch, or a row without the year', () => {
    expect(yearToDateOf('netPay', YEAR)).toEqual([]);
    expect(yearToDateOf('tax', undefined)).toEqual([]);
  });
});
