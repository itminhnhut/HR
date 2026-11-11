import { beforeEach, describe, expect, it } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { DEMO_HR } from './mock-seed';
import { load } from './mock-store';
import { payrollMockApi } from './mock-payroll';
import { ApiError } from './types';

/** The demo's Nhật ký lương (spec-luong.md 11.9; L-I05, L-I09): made-up lines, filtered the way the API filters. */

const read = payrollMockApi.hrPayrollLog;

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

describe('the demo payroll log', () => {
  it('should give the newest line first', async () => {
    // Act
    const page = await read({ offset: 0 });

    // Assert
    const times = page.lines.map((l) => l.at);
    expect(times.length).toBeGreaterThan(3);
    expect(times).toEqual([...times].sort().reverse());
    expect(page.hasMore).toBe(false);
  });

  it('L-I09: should keep one month, one group and one person apart', async () => {
    // Act
    const month = await read({ month: '2026-10', offset: 0 });
    const group = await read({ area: 'ho-so', offset: 0 });
    const person = await read({ personCode: 'NV01', offset: 0 });

    // Assert
    expect(month.lines.every((l) => l.month === '2026-10')).toBe(true);
    expect(group.lines.every((l) => l.area === 'ho-so')).toBe(true);
    expect(person.lines.length).toBeGreaterThan(0);
    expect(person.lines.every((l) => /(^|\W)NV01(\W|$)/.test(l.detail))).toBe(true);
  });

  it('L-I09: should find typed words whatever their case, and say who wrote lines', async () => {
    // Act
    const page = await read({ search: 'nv10', offset: 0 });

    // Assert
    expect(page.lines.length).toBeGreaterThan(0);
    expect(page.lines.every((l) => l.detail.includes('NV10'))).toBe(true);
    expect(page.actors).toContain(DEMO_HR.name);
  });

  it('L-I05: should write Duyệt, Mở lại and Đã chuyển khoản as the demo does them', async () => {
    // Arrange
    await payrollMockApi.hrPayrollApprove(2026, 10, { acknowledgedRed: true });
    await payrollMockApi.hrPayrollReopen(2026, 10, { reason: 'Kiểm lại' });
    await payrollMockApi.hrPayrollApprove(2026, 10, { acknowledgedRed: true });
    await payrollMockApi.hrPayrollMarkPaid(2026, 10, { paidOn: '2026-11-05' });

    // Act
    const page = await read({ isApprovalOnly: true, month: '2026-10', offset: 0 });

    // Assert
    expect(page.lines.map((l) => l.action)).toEqual(['Đã chuyển khoản', 'Duyệt', 'Mở lại', 'Duyệt']);
    expect(page.lines[2]?.detail).toContain('lý do: Kiểm lại');
    expect(page.lines[1]?.detail).toMatch(/^Duyệt lần 2/);
  });

  it('L-H02: should refuse someone without the payroll right', async () => {
    // Arrange
    const db = load();
    db.hrUsers = db.hrUsers.map((u) => ({ ...u, canPayroll: false }));

    // Act
    const refused = await read({ offset: 0 }).catch((e: unknown) => e);

    // Assert
    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).status).toBe(403);
  });
});
