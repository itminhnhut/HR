import type { PayrollExportDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/** Rà soát: "Thiếu email nhận phiếu lương", yellow, for each person of the month without an address. Made-up people. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);

describe('rà soát: thiếu email nhận phiếu lương', () => {
  it('should warn in yellow about the person without an email, and not about the one who has it', async () => {
    // Arrange
    await givePayrollRight(flow);
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
    const b = await flow.addPerson({
      code: 'NV02',
      fullName: 'NV B',
      joinedOn: '2025-03-01',
      email: 'nv02@example.com',
    });
    await flow.at('2026-11-26');
    await flow.close(2026, 11);

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const missing = month.review.filter((r) => r.code === 'missing-payslip-email');
    expect(missing.map((r) => [r.employeeId, r.level, r.message])).toEqual([
      [a.id, 'yellow', 'Thiếu email nhận phiếu lương'],
    ]);
    expect(month.lines.find((l) => l.employeeId === b.id)?.sheet?.payslipEmail).toBe('nv02@example.com');
  });

  it('should stop warning once HR types the email in Chấm công › Nhân viên', async () => {
    // Arrange
    await givePayrollRight(flow);
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
    await flow.at('2026-11-26');
    await flow.close(2026, 11);

    // Act
    await flow.updatePerson(a, { email: 'nv01@example.com' });

    // Assert
    expect((await monthOf('2026-11')).review.filter((r) => r.code === 'missing-payslip-email')).toEqual([]);
  });
  it('should print the email the person has now in the Excel export, also for a month approved before it was typed', async () => {
    // Arrange
    await givePayrollRight(flow);
    const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
    const level = { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts: { luong: 9_000_000 } };
    await flow.payroll('POST', `/profiles/${a.id}/versions`, level, 201);
    await flow.at('2026-11-26');
    await flow.close(2026, 11);
    await flow.payroll('POST', '/months/2026-11/approve', { acknowledgedRed: true });

    // Act
    await flow.updatePerson(a, { email: 'nv01@example.com' });
    const answer = await flow.payroll<PayrollExportDto>('POST', '/export', { months: ['2026-11'], kind: 'payslips' });

    // Assert
    expect(answer.months[0]?.month.lines[0]?.sheet?.payslipEmail).toBe('nv01@example.com');
  });
});
