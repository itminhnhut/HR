import { describe, expect, it } from 'vitest';
import { kpiLevelFor } from './payroll/index.js';
import {
  payrollKpiLevelOf,
  payrollProfileVersionOf,
  payrollRecurringSchema,
  type PayrollProfileVersionDto,
} from './payroll-profile.js';

/** A stored pay level read by the payroll engine. Amounts are fake. */

const level = (effectiveOn: string, kpiAmount: number): PayrollProfileVersionDto => ({
  id: `level-${effectiveOn}`,
  effectiveOn,
  contractTypeId: 'khong-thoi-han',
  probationDays: null,
  managesBusiness: false,
  unionMember: false,
  kpiAmount,
  amounts: { luong: 9_000_000, com: 700_000 },
  createdBy: 'hr',
  createdAt: '2026-10-01T00:00:00.000Z',
});

describe('payroll profile levels for the engine', () => {
  it('should map a level onto the engine’s ProfileVersion from its effective date', () => {
    // Arrange
    const stored = level('2026-10-15', 1_000_000);

    // Act
    const version = payrollProfileVersionOf(stored);

    // Assert
    expect(version).toEqual({
      from: '2026-10-15',
      contractTypeId: 'khong-thoi-han',
      amounts: { luong: 9_000_000, com: 700_000 },
    });
  });

  it('should give kpiLevelFor the KPI 100% of the level in force on the last day of the period', () => {
    // Arrange
    const levels = [level('2026-01-01', 1_000_000), level('2026-11-20', 1_500_000)].map(payrollKpiLevelOf);

    // Act
    const amount = kpiLevelFor(levels, { from: '2026-10-26', to: '2026-11-25' }, null);

    // Assert
    expect(amount).toBe(1_500_000);
  });
});

describe('khoản (32) định kỳ', () => {
  const months = { fromMonth: '2026-10', toMonth: null };

  it('should need an amount for a support, a refund or an advance', () => {
    // Act
    const typed = payrollRecurringSchema.safeParse({ kind: 'refund', amount: 500_000, ...months });
    const empty = payrollRecurringSchema.safeParse({ kind: 'support', ...months });

    // Assert
    expect(typed.success && typed.data).toMatchObject({ kind: 'refund', amount: 500_000, taxable: false });
    expect(empty.success).toBe(false);
  });

  it('should take "Công ty trả thay BH" without an amount, not taxed unless HR says so', () => {
    // Act
    const asSheet = payrollRecurringSchema.safeParse({ kind: 'insurance-paid', ...months });
    const taxed = payrollRecurringSchema.safeParse({ kind: 'insurance-paid', amount: 99, taxable: true, ...months });

    // Assert: the amount is the month's employee insurance, never a typed one
    expect(asSheet.success && asSheet.data).toMatchObject({ kind: 'insurance-paid', amount: 0, taxable: false });
    expect(taxed.success && taxed.data).toMatchObject({ amount: 0, taxable: true });
  });

  it('should keep "Tính thuế" for the insurance paid back only', () => {
    const support = payrollRecurringSchema.safeParse({ kind: 'support', amount: 1, taxable: true, ...months });
    expect(support.success && support.data.taxable).toBe(false);
  });
});
