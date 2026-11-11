import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROWS, GOLDEN_COLUMNS } from '../../../../packages/shared/test-fixtures/payroll-golden';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { DEMO_HR } from './mock-seed';
import { load } from './mock-store';
import { payrollMockApi } from './mock-payroll';
import { ApiError } from './types';

/**
 * The demo's payroll month: the anonymous golden month of the catalogue (K3), computed by the engine itself, so the
 * screens show real engine output. NV A has a meal tax setting of their own (L-L03) and NV J's % KPI is typed over
 * (L-L04, the 0% of HR's file); every other row is the catalogue's row.
 */

const golden = () => payrollMockApi.hrPayrollMonth(2026, 10);

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

describe('the demo payroll month', () => {
  it('L-K1-18: should order the twelve rows by region, contract type, block, then code', async () => {
    // Act
    const month = await golden();

    // Assert
    expect(month.lines.map((l) => l.fullName)).toEqual([
      'NV A',
      'NV B',
      'NV C',
      'NV D',
      'NV E',
      'NV F',
      'NV G',
      'NV H',
      'NV I',
      'NV J',
      'NV K',
      'NV L',
    ]);
    expect(month.lines.map((l) => `${l.regionId}|${l.contractTypeId}|${l.block}`).slice(0, 3)).toEqual([
      'hcm|khong-thoi-han|BO',
      'hcm|khong-thoi-han|BO',
      'hcm|khong-thoi-han|KD',
    ]);
  });

  it('L-K3-S: should match the catalogue row by row for everyone without a setting or a typed cell', async () => {
    // Act
    const month = await golden();

    // Assert
    const untouched = DEFAULT_ROWS.filter((r) => r.person && r.person !== 'NV A' && r.person !== 'NV J');
    for (const row of untouched) {
      const line = month.lines.find((l) => l.fullName === row.person);
      const cells = Object.fromEntries(
        GOLDEN_COLUMNS.map((key) => [
          key,
          key === 'kpiPercent' ? Number((line?.cells.kpiPercent ?? 0).toFixed(6)) : line?.cells[key],
        ]),
      );
      expect(cells).toEqual(row.cells);
    }
  });

  it('L-K3-S Σ: should total each money column as the sum of its cells', async () => {
    // Act
    const month = await golden();

    // Assert
    const sum = (key: 'netPay' | 'totalCost' | 'income') => month.lines.reduce((acc, l) => acc + l.cells[key], 0);
    expect(month.totals.netPay).toBe(sum('netPay'));
    expect(month.totals.totalCost).toBe(sum('totalCost'));
    expect(month.totals.income).toBe(sum('income'));
  });

  it("L-L03: should carry NV A's own meal tax setting, shown on (33)", async () => {
    // Act
    const month = await golden();

    // Assert
    const a = month.lines.find((l) => l.fullName === 'NV A');
    expect(a?.personSettings).toEqual([expect.objectContaining({ text: 'Tiền cơm chịu thuế', cells: ['exempt'] })]);
    // Full month (22/22): Xăng xe + ĐT 2.300.000 + 500.000 exempt in full, Trang phục 350.000 under the yearly cap;
    // the meal is taxed by NV A's own setting, so none of it is exempt.
    expect(a?.cells.exempt).toBe(2_800_000 + 350_000);
  });

  it("L-L04: should carry NV J's typed % KPI as HR's own evaluation, with nothing computed to type over", async () => {
    // Act
    const month = await golden();

    // Assert: NV J is in the KD block, whose % HR types (spec 5.3), so the 0% is no override
    const j = month.lines.find((l) => l.fullName === 'NV J');
    expect(j?.overrides).toEqual([]);
    expect(j?.inputs).toMatchObject({ kpiPercent: 0, note: expect.any(String) });
    expect(j?.cells.kpiPercent).toBe(0);
  });

  it('L-L07: should say the month waits for the timesheet close when its period is still running', async () => {
    // Act
    const month = await payrollMockApi.hrPayrollMonth(2026, 11);

    // Assert
    expect([month.status, month.lines.length]).toEqual(['waiting', 0]);
  });

  it('L-H02: should refuse the month with 403 and no numbers to an HR account without the payroll right', async () => {
    // Arrange
    for (const user of load().hrUsers) user.canPayroll = false;

    // Act
    const asked = golden();

    // Assert
    await expect(asked).rejects.toMatchObject({ status: 403, message: 'Bạn không có quyền xem lương.' });
  });

  it('L-L07: should refuse a month before the first payroll month, naming the range', async () => {
    // Act
    const asked = payrollMockApi.hrPayrollMonth(2019, 1);

    // Assert
    await expect(asked).rejects.toBeInstanceOf(ApiError);
    await expect(asked).rejects.toThrow(/T10\/2026/);
  });
});

describe('Rà soát of the demo month', () => {
  it("L-L19: should carry the engine's warnings, red first, each naming the row it links to", async () => {
    // Act
    const month = await golden();

    // Assert
    const levels = month.review.map((i) => i.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === 'red' ? -1 : 1)));
    expect(month.review).toContainEqual(expect.objectContaining({ level: 'red', code: 'closing-unconfirmed' }));
    const ids = new Set(month.lines.map((l) => l.employeeId));
    expect(month.review.filter((i) => i.employeeId).every((i) => ids.has(i.employeeId ?? ''))).toBe(true);
  });

  it('L-L07: should have nothing to review on a month waiting for the timesheet close', async () => {
    // Act
    const month = await payrollMockApi.hrPayrollMonth(2026, 11);

    // Assert
    expect(month.review).toEqual([]);
  });
});

describe('Duyệt, Mở lại, Đã chuyển khoản on the demo month', () => {
  const approve = () => payrollMockApi.hrPayrollApprove(2026, 10, { acknowledgedRed: true });

  it('L-M01: should refuse Duyệt while a red warning is not marked "Đã xem"', async () => {
    // Act
    const asked = payrollMockApi.hrPayrollApprove(2026, 10, { acknowledgedRed: false });

    // Assert
    await expect(asked).rejects.toMatchObject({ status: 422 });
    expect((await golden()).status).toBe('draft');
  });

  it('L-E03: should approve as lần 1 by the signed-in HR and keep it on the next read', async () => {
    // Act
    const approved = await approve();

    // Assert
    expect(approved.status).toBe('approved');
    expect(approved.approval).toMatchObject({ no: 1, by: DEMO_HR.name });
    expect((await golden()).status).toBe('approved');
  });

  it('L-E02: should refuse Duyệt and Mở lại with 403 to an HR without the approve right', async () => {
    // Arrange
    for (const user of load().hrUsers) user.canApprovePayroll = false;

    // Act
    const asked = approve();

    // Assert
    await expect(asked).rejects.toMatchObject({ status: 403 });
  });

  it('L-E09: should refuse Mở lại without a reason and go back to Nháp with one', async () => {
    // Arrange
    await approve();

    // Act
    const empty = payrollMockApi.hrPayrollReopen(2026, 10, { reason: '  ' });
    await expect(empty).rejects.toMatchObject({ status: 422 });
    const reopened = await payrollMockApi.hrPayrollReopen(2026, 10, { reason: 'Sửa KPI NV J' });

    // Assert
    expect([reopened.status, reopened.approval]).toEqual(['draft', null]);
  });

  it('L-E12: should approve again as lần 2 after Mở lại', async () => {
    // Arrange
    await approve();
    await payrollMockApi.hrPayrollReopen(2026, 10, { reason: 'Sửa KPI NV J' });

    // Act
    const again = await approve();

    // Assert
    expect(again.approval?.no).toBe(2);
  });

  it('L-E08: should mark an approved month paid on the given day, and refuse Mở lại from then on', async () => {
    // Arrange
    await approve();

    // Act
    const paid = await payrollMockApi.hrPayrollMarkPaid(2026, 10, { paidOn: '2026-11-06' });

    // Assert
    expect([paid.status, paid.paidOn]).toEqual(['paid', '2026-11-06']);
    await expect(payrollMockApi.hrPayrollReopen(2026, 10, { reason: 'Nhầm' })).rejects.toMatchObject({ status: 409 });
  });

  it('L-M05: should refuse Đã chuyển khoản on a draft and on a bad day', async () => {
    // Act
    const draft = payrollMockApi.hrPayrollMarkPaid(2026, 10, { paidOn: '2026-11-06' });
    await expect(draft).rejects.toMatchObject({ status: 409 });
    await approve();
    const bad = payrollMockApi.hrPayrollMarkPaid(2026, 10, { paidOn: '06/11' });

    // Assert
    await expect(bad).rejects.toMatchObject({ status: 422 });
  });
});
