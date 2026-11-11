import type { EmployeeDto, PayrollLineDto, PayrollMonthDto, PayrollMonthInputsResultDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, rowOf, totalsOf, type Flow } from '../test/timesheet-flow.js';

/**
 * Tiền phép chưa nghỉ khi nghỉ việc (spec-luong.md 5.5, D08, câu 18; BLLĐ Đ.113 k3; NĐ 145/2020 Đ.67 k3; rà soát BA
 * L2). A made-up leaver, NV L: last working day 10/11/2026, in the November period (26/10–25/11), 2,5 leave days
 * left at the close. Until 25/10 the profile pays 9.000.000 time pay, 1.000.000 attendance pay (both "lương theo HĐ")
 * and 1.100.000 meal pay (not); from 26/10 the time pay is 12.000.000, which the payout must not read.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const DAYS_LEFT = 2.5;
const CONTRACT_PAY = 9_000_000 + 1_000_000;
const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const typeInputs = (person: EmployeeDto, body: Record<string, unknown>, expected = 200) =>
  flow.payroll<PayrollMonthInputsResultDto>('PUT', `/months/2026-11/lines/${person.id}/inputs`, body, expected);

function lineOf(month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`No line of ${person.code}`);
  return line;
}

interface Company {
  leaver: EmployeeDto;
  stayer: EmployeeDto;
  /** Công chuẩn of the October period, the divisor of the payout. */
  octoberNorm: number;
}

async function hireAndClose(): Promise<Company> {
  await givePayrollRight(flow);
  const leaver = await flow.addPerson({
    code: 'NV12',
    fullName: 'NV L',
    joinedOn: '2025-03-01',
    leftOn: '2026-11-10',
    // One day is credited in the October period; the close of November is checked below.
    openingLeave: DAYS_LEFT - 1,
  });
  const stayer = await flow.addPerson({ code: 'NV13', fullName: 'NV M', joinedOn: '2025-03-01', openingLeave: 4 });
  const before = { luong: 9_000_000, 'chuyen-can': 1_000_000, com: 1_100_000 };
  const level = { contractTypeId: 'khong-thoi-han' };
  for (const person of [leaver, stayer]) {
    await flow.payroll(
      'POST',
      `/profiles/${person.id}/versions`,
      { ...level, effectiveOn: '2025-03-01', amounts: before },
      201,
    );
  }
  const raised = { ...before, luong: 12_000_000 };
  await flow.payroll(
    'POST',
    `/profiles/${leaver.id}/versions`,
    { ...level, effectiveOn: '2026-10-26', amounts: raised },
    201,
  );
  const october = await flow.close(2026, 10);
  await flow.at('2026-11-26');
  const november = await flow.close(2026, 11);
  expect(totalsOf(november, 'NV12').leaveClosing).toBe(DAYS_LEFT);
  return { leaver, stayer, octoberNorm: rowOf(october, 'NV12').norm };
}

const payoutOf = (norm: number, days = DAYS_LEFT) => Math.round((CONTRACT_PAY / norm) * days);

describe('L2 unused leave paid in the final pay', () => {
  it('should pay the days left on the contract pay of the month before, as its own exempt item of (24)', async () => {
    // Arrange
    const { leaver, octoberNorm } = await hireAndClose();
    const expected = payoutOf(octoberNorm);

    // Act
    const line = lineOf(await monthOf('2026-11'), leaver);

    // Assert
    expect(line.leavePayout).toEqual({
      days: DAYS_LEFT,
      base: CONTRACT_PAY,
      norm: octoberNorm,
      basisOn: '2026-10-25',
      computed: expected,
      typed: null,
      amount: expected,
      exempt: expected,
    });
    expect(line.cells.otherIncome).toBe(expected);
    expect(line.explain.otherIncome?.formula).toMatch(/^Tiền phép chưa nghỉ 2,5 ngày × 10\.000\.000 ÷ \d+ công = /);
    expect(line.explain.exempt?.formula).toMatch(/tiền phép chưa nghỉ/);
    expect(line.overrides.some((o) => o.cell === 'otherIncome')).toBe(false);
  });

  it('should leave the insurance salary alone and tax nothing of the payout', async () => {
    // Arrange
    const { leaver } = await hireAndClose();
    const withPayout = lineOf(await monthOf('2026-11'), leaver);

    // Act
    const without = (await typeInputs(leaver, { leavePayout: 0 })).line;

    // Assert
    expect(without?.leavePayout).toMatchObject({ typed: 0, amount: 0 });
    expect(withPayout.cells.socialBase).toBe(without?.cells.socialBase);
    expect(withPayout.cells.taxable).toBe(without?.cells.taxable);
    expect(withPayout.cells.income - (without?.cells.income ?? 0)).toBe(withPayout.leavePayout?.amount);
  });

  it('should pay nothing to someone who stays, whatever leave they have left', async () => {
    // Arrange
    const { stayer } = await hireAndClose();

    // Act
    const line = lineOf(await monthOf('2026-11'), stayer);

    // Assert
    expect(line.leavePayout ?? null).toBeNull();
    expect(line.cells.otherIncome).toBe(0);
  });
});

describe('L2 HR types over the payout', () => {
  it('should pay the typed amount, keep the computed one beside it and warn in yellow', async () => {
    // Arrange
    const { leaver, octoberNorm } = await hireAndClose();
    const computed = payoutOf(octoberNorm);

    // Act
    const saved = await typeInputs(leaver, { leavePayout: 500_000, note: 'Thoả thuận khi nghỉ' });
    const month = await monthOf('2026-11');

    // Assert
    expect(saved.inputs.leavePayout).toBe(500_000);
    expect(saved.line?.leavePayout).toMatchObject({ computed, typed: 500_000, amount: 500_000, exempt: 500_000 });
    expect(saved.line?.cells.otherIncome).toBe(500_000);
    expect(saved.line?.overrides).toContainEqual(
      expect.objectContaining({ cell: 'otherIncome', computed, typed: 500_000, reason: 'Thoả thuận khi nghỉ' }),
    );
    const notice = month.review.find((i) => i.code === 'leave-payout-typed');
    expect(notice).toMatchObject({ level: 'yellow', employeeId: leaver.id, cell: 'otherIncome' });
    expect(notice?.message).toMatch(/thấp hơn số tính .*BLLĐ Đ\.113/);
  });

  it('should tax the part typed above the amount the law exempts', async () => {
    // Arrange
    const { leaver, octoberNorm } = await hireAndClose();
    const computed = payoutOf(octoberNorm);
    const plain = lineOf(await monthOf('2026-11'), leaver);

    // Act
    const { line } = await typeInputs(leaver, { leavePayout: computed + 300_000 });

    // Assert
    expect(line?.leavePayout).toMatchObject({ amount: computed + 300_000, exempt: computed });
    expect((line?.cells.taxable ?? 0) - plain.cells.taxable).toBe(300_000);
  });

  it('should go back to the computed amount when the cell is cleared, and refuse a negative amount', async () => {
    // Arrange
    const { leaver, octoberNorm } = await hireAndClose();
    await typeInputs(leaver, { leavePayout: 500_000 });

    // Act
    const refused = await typeInputs(leaver, { leavePayout: -1 }, 422);
    const cleared = await typeInputs(leaver, { leavePayout: null });

    // Assert
    expect(refused).toMatchObject({ fieldErrors: { leavePayout: expect.any(String) } });
    expect(cleared.inputs.leavePayout).toBeNull();
    expect(cleared.line?.leavePayout).toMatchObject({ typed: null, amount: payoutOf(octoberNorm) });
  });
});
