import { beforeEach, describe, expect, it } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { payrollMockApi } from './mock-payroll';
import { DEMO_HR } from './mock-seed';

/** Đầu vào tháng in the demo (spec-luong.md 2 (4), 5.3): what HR types is kept and the row is computed again. */

const golden = () => payrollMockApi.hrPayrollMonth(2026, 10);
const lineWithKpi = async () => {
  const found = (await golden()).lines.find((l) => l.kpiAmount > 0 && l.overrides.length === 0);
  if (!found) throw new Error('No line with a KPI');
  return found;
};

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

describe('saving month inputs in the demo', () => {
  it('should store a typed % KPI and answer with the row computed again', async () => {
    // Arrange
    const before = await lineWithKpi();

    // Act
    const saved = await payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { kpiPercent: 1.5 });

    // Assert
    expect(saved.inputs).toMatchObject({ kpiPercent: 1.5, updatedBy: DEMO_HR.name });
    expect(saved.line?.cells.kpiPercent).toBe(1.5);
    expect(saved.line?.cells.kpiBonus).toBe(Math.round(before.kpiAmount * 1.5));
    const reread = (await golden()).lines.find((l) => l.employeeId === before.employeeId);
    expect(reread?.inputs.kpiPercent).toBe(1.5);
  });

  it('should go back to the formula when % KPI is sent as null', async () => {
    // Arrange
    const before = await lineWithKpi();
    await payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { kpiPercent: 1.5 });

    // Act
    const reset = await payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { kpiPercent: null });

    // Assert
    expect(reset.inputs.kpiPercent).toBeNull();
    expect(reset.line?.cells.kpiPercent).toBe(before.cells.kpiPercent);
  });

  it('should add the typed (32) items to the cash cell, by kind', async () => {
    // Arrange
    const before = await lineWithKpi();
    const cash = [
      { kind: 'support' as const, amount: 300_000, reason: 'Hỗ trợ đi lại' },
      { kind: 'advance' as const, amount: 1_000_000, reason: '' },
    ];

    // Act
    const saved = await payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { cash });

    // Assert
    expect(saved.inputs.cash).toEqual(cash);
    expect(saved.line?.cells.netPay).not.toBe(before.cells.netPay);
  });

  it('should refuse a % outside 0–200% with the field named', async () => {
    // Arrange
    const before = await lineWithKpi();

    // Act
    const asked = payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { kpiPercent: 2.5 });

    // Assert
    await expect(asked).rejects.toMatchObject({
      status: 422,
      fieldErrors: { kpiPercent: 'Nhập % trong khoảng 0–200%.' },
    });
  });

  it('should refuse an approved month with payroll_month_locked', async () => {
    // Arrange
    const before = await lineWithKpi();
    await payrollMockApi.hrPayrollApprove(2026, 10, { acknowledgedRed: true });

    // Act
    const asked = payrollMockApi.hrPayrollSaveInputs('2026-10', before.employeeId, { overtimeHours: 2 });

    // Assert
    await expect(asked).rejects.toMatchObject({ status: 409, code: 'payroll_month_locked' });
  });
});
