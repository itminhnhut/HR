import type { ReviewItem } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { reviewHint, reviewRows, reviewTarget } from '../reviewModel';

/** Rà soát: "Thiếu email nhận phiếu lương" folds like the account warning and opens the person in Chấm công. */
const item = (employeeId: string): ReviewItem => ({
  level: 'yellow',
  code: 'missing-payslip-email',
  employeeId,
  cell: null,
  message: 'Thiếu email nhận phiếu lương',
});

describe('missing payslip email in Rà soát', () => {
  it('should open the person form in Chấm công › Nhân viên', () => {
    // Act
    const target = reviewTarget(item('e1'), { monthKey: '2026-11', search: '?ky=2026-11', block: null });

    // Assert
    expect(target).toEqual({ to: '/hr/cham-cong/nhan-vien?nv=e1', words: 'Sửa ở Chấm công' });
  });

  it('should fold several people into one row and say what to do', () => {
    // Act
    const rows = reviewRows([item('e1'), item('e2')]);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'group', code: 'missing-payslip-email' });
    expect(reviewHint('missing-payslip-email')).toContain('Email nhận phiếu lương');
  });
});
