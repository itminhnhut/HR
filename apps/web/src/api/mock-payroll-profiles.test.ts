import { beforeEach, describe, expect, it } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from './mock';
import { DEMO_HR } from './mock-seed';
import { ApiError } from './types';

/** The demo's Hồ sơ lương answers like the API: profile state, field errors, masked account numbers (L-B01, L-B24). */

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});

describe('the demo payroll profiles', () => {
  it('L-B01: should list the last golden person as missing a profile', async () => {
    // Act
    const list = await mockApi.hrPayrollProfiles();

    // Assert
    expect(list.missing.map((p) => p.fullName)).toEqual(['NV L']);
    expect(list.people.filter((p) => p.hasProfile)).toHaveLength(11);
  });

  it('L-B24: should keep only the last four digits until "Hiện đủ"', async () => {
    // Arrange
    const id = (await mockApi.hrPayrollProfiles()).people[1]?.employeeId ?? '';

    // Act
    const saved = await mockApi.hrPayrollAddBank(id, {
      bank: 'Ngân hàng Demo',
      accountNumber: '9876 5432 10',
      changedOn: '2026-11-01',
    });
    const profile = await mockApi.hrPayrollProfile(id);
    const shown = await mockApi.hrPayrollRevealBank(id, saved.id);

    // Assert
    expect(saved.last4).toBe('3210');
    expect(JSON.stringify(profile)).not.toContain('9876543210');
    expect(shown.accountNumber).toBe('9876543210');
  });

  it('should answer a bad account number with an error on that field', async () => {
    // Arrange
    const id = (await mockApi.hrPayrollProfiles()).people[1]?.employeeId ?? '';

    // Act
    const error = await mockApi
      .hrPayrollAddBank(id, { bank: 'Ngân hàng Demo', accountNumber: '12', changedOn: '2026-11-01' })
      .catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error instanceof ApiError ? error.fieldErrors.accountNumber : '').toBe('Số tài khoản gồm 6–19 chữ số.');
  });
});

describe('the demo month follows the profile', () => {
  const lineOf = async (employeeId: string) => {
    const month = await mockApi.hrPayrollMonth(2026, 10);
    const line = month.lines.find((l) => l.employeeId === employeeId);
    if (!line) throw new Error(`No line for ${employeeId}`);
    return { line, review: month.review.filter((r) => r.employeeId === employeeId) };
  };
  const paidBack = { kind: 'insurance-paid' as const, amount: 0, fromMonth: '2026-10', toMonth: null, note: '' };

  it('should add "Công ty trả thay BH" to (32) as the employee insurance, with the yellow notice until it is taxed', async () => {
    // Arrange
    const before = (await lineOf('nv-a')).line.cells;

    // Act
    const saved = await mockApi.hrPayrollSaveRecurring('nv-a', null, paidBack);
    const { line, review } = await lineOf('nv-a');
    await mockApi.hrPayrollSaveRecurring('nv-a', saved.id, { ...paidBack, taxable: true });
    const taxed = await lineOf('nv-a');

    // Assert
    const insurance = (line.cells.social ?? 0) + (line.cells.health ?? 0) + (line.cells.unemployment ?? 0);
    expect(insurance).toBeGreaterThan(0);
    expect(line.cells.cash).toBe((before.cash ?? 0) + insurance);
    expect(line.cells.taxable).toBe(before.taxable);
    expect(line.explain.cash?.formula).toContain('Công ty trả thay BH [(28) + (29) + (30) = ');
    expect(review.map((r) => r.code)).toContain('insurance-paid-untaxed');
    expect(taxed.line.cells.taxable).toBe((before.taxable ?? 0) + insurance);
    expect(taxed.review.map((r) => r.code)).not.toContain('insurance-paid-untaxed');
  });

  it('should refuse a second "Công ty trả thay BH" over the same months, as the API does', async () => {
    // Arrange
    await mockApi.hrPayrollSaveRecurring('nv-a', null, paidBack);

    // Act
    const error = await mockApi
      .hrPayrollSaveRecurring('nv-a', null, { ...paidBack, fromMonth: '2026-12' })
      .catch((e: unknown) => e);

    // Assert
    expect(error instanceof ApiError ? [error.status, error.message] : []).toEqual([
      409,
      'Đã có khoản công ty trả thay BH trong các tháng này.',
    ]);
  });

  it('should not withhold from a probation person by the commitment of the contract, then by the signed one', async () => {
    // Act
    const byContract = (await lineOf('nv-g')).line;
    await mockApi.hrPayrollSaveCommitment('nv-g', null, { year: 2026, signedOn: '2026-10-01' });
    const signed = (await lineOf('nv-g')).line;

    // Assert
    expect(byContract.explain.tax?.formula).toBe('Không khấu trừ · Cam kết theo hợp đồng = 0');
    expect(signed.explain.tax?.formula).toBe('Không khấu trừ · Cam kết ký ngày 01/10/2026 = 0');
    expect(signed.cells.tax).toBe(0);
  });
});
