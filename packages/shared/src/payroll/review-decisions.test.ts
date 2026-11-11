import { describe, expect, it } from 'vitest';
import {
  codes,
  find,
  reviewMonth as month,
  rowInput,
  UNION_FUND_ON,
} from '../../test-fixtures/payroll-review-inputs.js';
import { needsAcknowledgement, reviewPayroll, type SettingRow } from './index.js';

/** Rà soát checks from the decisions of spec 17, and warn-never-block. Cases: L-B28, L-K1-22, L-L19, L-E01, câu 8, 20, 33. */

describe('decisions of spec 17 (bản đã chốt)', () => {
  it('câu 33, L-B28: should flag probation days beyond what BLLĐ Đ.25 allows', () => {
    // Act
    const row = rowInput(
      { probation: true },
      {
        employment: {
          leftOn: null,
          contractTypeId: 'thu-viec',
          block: 'BO',
          unconfirmedDates: [],
          probation: { days: 90, limit: 60 },
        },
      },
    );

    // Assert
    expect(find(reviewPayroll(month([row])), 'probation-too-long')).toMatchObject({
      level: 'red',
      message: 'Thử việc 90 ngày, vượt 60 ngày (BLLĐ Đ.25)',
    });
  });

  it('L-K1-22: should flag clothing pay that reached the yearly cap', () => {
    // Arrange
    const row = rowInput();
    const line = row.line;
    const capped = line ? { ...line, tax: { ...line.tax, clothing: { exempt: 200_000, capReached: true } } } : null;

    // Act / Assert
    expect(find(reviewPayroll(month([{ ...row, line: capped }])), 'clothing-cap')?.message).toBe(
      'Trang phục chạm trần năm 5.000.000',
    );
  });

  it('L-B28: should keep a red warning in the first month while checklist items are not confirmed', () => {
    // Act
    const items = reviewPayroll(
      month([rowInput()], { firstWebMonth: true, closingConfirmed: true, checklistPending: 3 }),
    );

    // Assert
    expect(codes(items)).toEqual(['red:checklist-pending']);
  });

  it('câu 8: should note in yellow, once for the month, that KPCĐ is off, and nothing once it is on', () => {
    // Act: off is the company default since 09/11/2026
    const off = reviewPayroll(month([rowInput({ rows: [] }), rowInput({ rows: [] })]));
    const turnedOn = reviewPayroll(month([rowInput({ rows: [UNION_FUND_ON] })]));

    // Assert
    expect(codes(off)).toEqual(['yellow:union-fund-off']);
    expect(find(off, 'union-fund-off')?.message).toMatch(/Luật Công đoàn 2024 Đ\.29/);
    expect(codes(turnedOn)).toEqual([]);
  });

  it('L-D40: should flag in red a sales (KD) person with KPI whose % HR has not typed, and nobody without KPI', () => {
    // Act
    const untyped = reviewPayroll(month([rowInput({ probation: true, kpiAmount: 4_500_000, block: 'KD' })]));
    const typed = reviewPayroll(month([rowInput({ kpiAmount: 4_500_000, kpiPercent: 0.8, block: 'KD' })]));
    const noKpi = reviewPayroll(month([rowInput({ block: 'KD' })]));

    // Assert
    expect(find(untyped, 'kpi-missing')).toMatchObject({ level: 'red', cell: 'kpiPercent', message: 'Chưa gõ % KPI' });
    expect([find(typed, 'kpi-missing'), find(noKpi, 'kpi-missing')]).toEqual([undefined, undefined]);
  });

  it('câu 20: should flag time pay or the position allowance taken out of the overtime base', () => {
    // Arrange
    const rows: SettingRow[] = [{ key: 'khoan.luong.vao-lam-them', employeeId: null, from: '2026-10', value: false }];

    // Act
    const items = reviewPayroll(month([rowInput({ rows })]));

    // Assert
    expect(find(items, 'overtime-base')).toMatchObject({
      level: 'red',
      message: 'Lương thời gian không vào lương làm thêm',
    });
  });
});

describe('warn, never block (spec 4.8)', () => {
  it('L-L19, L-E01: should ask for "Đã xem" only while a red item is left', () => {
    // Arrange
    const red = reviewPayroll(month([rowInput({ amounts: { luong: 13_000_000 }, advance: 15_000_000 })]));
    const yellow = reviewPayroll(month([rowInput()], { previousMonthDraft: true }));

    // Act / Assert
    expect([needsAcknowledgement(red), needsAcknowledgement(yellow)]).toEqual([true, false]);
  });

  it('should list red items before yellow ones', () => {
    // Act
    const items = reviewPayroll(month([rowInput({ amounts: { luong: 5_000_000 } })], { previousMonthDraft: true }));

    // Assert
    expect(items.map((i) => i.level)).toEqual(['red', 'yellow', 'yellow']);
  });
});
