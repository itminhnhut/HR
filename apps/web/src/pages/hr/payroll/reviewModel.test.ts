import type { ReviewItem } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { reviewHint, reviewRows, reviewTarget } from './reviewModel';

/** Rà soát: each warning opens the place that fixes it (F05). */

const CONTEXT = { monthKey: '2026-10', search: 'ky=2026-10&rs=1', block: 'BO' };

const item = (code: string, employeeId: string | null, cell: ReviewItem['cell'] = null): ReviewItem => ({
  level: 'yellow',
  code,
  employeeId,
  cell,
  message: 'x',
});

describe('where a warning of Rà soát is fixed', () => {
  it('should open the person in Chấm công for a date HR has not confirmed', () => {
    // Act
    const target = reviewTarget(item('unconfirmed-date', 'nv-a'), CONTEXT);

    // Assert
    expect(target).toEqual({ to: '/hr/cham-cong/nhan-vien?nv=nv-a', words: 'Sửa ở Chấm công' });
  });

  it('should open the Hồ sơ lương of the person over the grid for a missing bank account', () => {
    // Act
    const target = reviewTarget(item('missing-bank-account', 'nv-a'), CONTEXT);

    // Assert
    expect(target).toEqual({ to: '/hr/luong?ky=2026-10&hs=nv-a', words: 'Sửa ở Hồ sơ lương' });
  });

  it('should open the pay levels of the person for a contract warning', () => {
    // Act
    const target = reviewTarget(item('default-official-contract', 'nv-a'), CONTEXT);

    // Assert
    expect(target).toEqual({ to: '/hr/luong?ky=2026-10&hs=nv-a&phan=muc', words: 'Sửa ở Hồ sơ lương' });
  });

  it('should keep a warning about a number on the grid, showing only that person', () => {
    // Act
    const target = reviewTarget(item('override-differs', 'nv-a', 'kpiPercent'), CONTEXT);

    // Assert
    expect(target).toEqual({ to: '/hr/luong?ky=2026-10&nv=nv-a', words: 'Xem trên lưới' });
  });

  it('should open Chấm công, Hồ sơ lương or Cấu hình for the warnings of the whole month', () => {
    // Act
    const targets = ['closing-unconfirmed', 'checklist-pending', 'union-fund-off', 'contract-commitment'].map(
      (code) => reviewTarget(item(code, null), CONTEXT)?.to,
    );

    // Assert
    expect(targets).toEqual([
      '/hr/cham-cong?ky=2026-10',
      '/hr/luong/ho-so?ky=2026-10',
      '/hr/luong/cau-hinh?ky=2026-10&muc=bao-hiem&khoa=tuy-chon.d03',
      '/hr/luong/cau-hinh?ky=2026-10&muc=loai-hd',
    ]);
  });

  it('should leave a month-wide warning with nothing to open as plain words', () => {
    // Act + Assert
    expect(reviewTarget(item('year-open-month', null), CONTEXT)).toBeNull();
  });
});

describe('the same warning of several people', () => {
  const bank = (employeeId: string): ReviewItem => ({
    ...item('missing-bank-account', employeeId),
    message: 'Thiếu số tài khoản',
  });

  it('F06: should fold a yellow warning several people share into one row, where the first one stood', () => {
    // Arrange
    const other = { ...item('override-differs', 'nv-b', 'kpiPercent'), message: '% KPI gõ 0% khác số tính 50%' };
    const items = [bank('nv-a'), other, bank('nv-b'), bank('nv-c')];

    // Act
    const rows = reviewRows(items);

    // Assert
    expect(rows.map((r) => r.kind)).toEqual(['group', 'one']);
    expect(rows[0]).toMatchObject({ message: 'Thiếu số tài khoản' });
    expect(rows[0]?.kind === 'group' ? rows[0].items.map((i) => i.employeeId) : []).toEqual(['nv-a', 'nv-b', 'nv-c']);
  });

  it('F06: should never fold red warnings, month-wide ones or a warning only one person has', () => {
    // Arrange
    const red = (employeeId: string): ReviewItem => ({ ...item('missing-block', employeeId), level: 'red' });
    const items = [
      red('nv-a'),
      red('nv-b'),
      item('year-open-month', null),
      item('year-open-month', null),
      bank('nv-a'),
    ];

    // Act
    const rows = reviewRows(items);

    // Assert
    expect(rows.map((r) => r.kind)).toEqual(['one', 'one', 'one', 'one', 'one']);
  });
});

describe('what to do about a warning', () => {
  it('F07: should say the next step for a warning that does not say it itself', () => {
    // Act + Assert
    expect(reviewHint('missing-bank-account')).toBe(
      'Thêm ở Hồ sơ lương › Tài khoản. Không ảnh hưởng số tiền, chỉ thiếu trên Excel và phiếu lương.',
    );
    expect(reviewHint('insurance-provisional')).toContain('Không cần làm gì bây giờ');
    expect(reviewHint('negative-net')).toBeNull();
  });
});
