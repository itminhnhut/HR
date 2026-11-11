import { describe, expect, it } from 'vitest';
import type { PayrollMonthDto } from '../../../api';
import { canApproveNow, monthActions, monthStatusLabel, reviewCounts } from './monthActionsModel';

/** What each month state lets HR do (spec 11.2, 11.4, R7) and how the chip names it (spec 11.1). */

type MonthState = Pick<PayrollMonthDto, 'status' | 'lines' | 'computedAt' | 'approval' | 'paidOn'>;

const state = (over: Partial<MonthState> = {}): MonthState => ({
  status: 'draft',
  lines: [{} as PayrollMonthDto['lines'][number]],
  computedAt: '2026-11-03T02:00:00.000Z',
  approval: null,
  paidOn: null,
  ...over,
});

const red = { level: 'red', code: 'closing-unconfirmed', employeeId: null, cell: null, message: 'Đỏ' } as const;
const yellow = { level: 'yellow', code: 'override-differs', employeeId: 'nv-j', cell: null, message: 'Vàng' } as const;

describe('the buttons of each month state', () => {
  it('L-E01: should offer only Duyệt on a draft, usable with the approve right', () => {
    expect(monthActions(state(), true)).toEqual([{ action: 'approve', disabledReason: null }]);
  });

  it('L-E02: should keep Duyệt and Mở lại but say why they cannot be used without the approve right', () => {
    expect(monthActions(state(), false)).toEqual([{ action: 'approve', disabledReason: 'Cần quyền Duyệt lương' }]);
    expect(monthActions(state({ status: 'approved' }), false)).toEqual([
      { action: 'reopen', disabledReason: 'Cần quyền Duyệt lương' },
      { action: 'markPaid', disabledReason: null },
    ]);
  });

  it('L-E01: should not let a month waiting for the timesheet close be approved', () => {
    expect(monthActions(state({ status: 'waiting', lines: [] }), true)).toEqual([
      { action: 'approve', disabledReason: 'Chờ chốt công, chưa duyệt được' },
    ]);
  });

  it('should not let a draft without any row be approved', () => {
    expect(monthActions(state({ lines: [] }), true)).toEqual([
      { action: 'approve', disabledReason: 'Chưa có dòng lương nào' },
    ]);
  });

  it('L-M03, L-M05: should offer Mở lại and Đã chuyển khoản on an approved month', () => {
    expect(monthActions(state({ status: 'approved' }), true).map((a) => a.action)).toEqual(['reopen', 'markPaid']);
  });

  it('L-E08: should leave nothing to do on a paid month', () => {
    expect(monthActions(state({ status: 'paid' }), true)).toEqual([]);
  });
});

describe('the status chip', () => {
  it('should name each state with when and by whom', () => {
    expect(monthStatusLabel(state({ status: 'waiting', computedAt: null }))).toBe('Chờ chốt công');
    expect(monthStatusLabel(state())).toBe('Nháp · tính lúc 09:00 03/11');
    expect(
      monthStatusLabel(state({ status: 'approved', approval: { no: 2, at: '2026-11-05T09:20:00.000Z', by: 'HR' } })),
    ).toBe('Đã duyệt lần 2 · 16:20 05/11 · bởi HR');
    expect(monthStatusLabel(state({ status: 'paid', paidOn: '2026-11-06' }))).toBe('Đã chuyển khoản 06/11');
  });
});

describe('warnings and Duyệt', () => {
  it('should count warnings by level', () => {
    expect(reviewCounts([red, yellow, yellow])).toEqual({ red: 1, yellow: 2 });
  });

  it('L-M01: should block Duyệt while a red warning is not marked "Đã xem", and never for yellow ones', () => {
    expect(canApproveNow([red, yellow], false)).toBe(false);
    expect(canApproveNow([red, yellow], true)).toBe(true);
    expect(canApproveNow([yellow], false)).toBe(true);
  });
});
