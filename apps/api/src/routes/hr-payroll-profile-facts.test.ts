import type {
  EmployeeDto,
  PayrollBankAccountDto,
  PayrollProfileDto,
  PayrollProfileListDto,
  PayrollProfileMonthDto,
} from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollBankAccounts, payrollLog } from '../db/schema.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Hồ sơ lương: dependants, tax commitment, đoàn viên, khoản (32) định kỳ, bank account, opening balances
 * (spec-luong.md 10.2, 11.5, R2; docs/test-cases-luong.md L-B18–L-B24, L-E07). People, accounts and amounts are fake.
 */

let flow: Flow;
let person: EmployeeDto;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
  person = await flow.addPerson({ code: 'NV02', fullName: 'NV B', joinedOn: '2026-01-05' });
});

const path = (rest: string) => `/profiles/${person.id}${rest}`;
const monthOf = (month: string) => flow.payroll<PayrollProfileMonthDto>('GET', path(`/month/${month}`));
const logDetails = async () => (await flow.t.db.select().from(payrollLog)).map((l) => l.detail);

describe('L-B18 – L-B20 dependants, by the pay date', () => {
  it('L-B18: should count a dependant from the month whose pay date falls in it', async () => {
    // Arrange + Act
    await flow.payroll('POST', path('/dependants'), { fromMonth: '2026-11', count: 1 }, 201);

    // Assert: T10 is paid on 05/11, T9 on 05/10
    expect((await monthOf('2026-10')).dependants).toBe(1);
    expect((await monthOf('2026-09')).dependants).toBe(0);
    expect(await logDetails()).toContain('Thêm người phụ thuộc của NV02 NV B: 1 người, từ T11/2026');
  });

  it('L-B20: should stop counting after the last month', async () => {
    // Arrange + Act
    await flow.payroll('POST', path('/dependants'), { fromMonth: '2026-11', toMonth: '2026-12', count: 2 }, 201);

    // Assert: T11 is paid on 05/12, T12 on 05/01/2027
    expect((await monthOf('2026-11')).dependants).toBe(2);
    expect((await monthOf('2026-12')).dependants).toBe(0);
  });

  it('L-B19: should apply a late dependant to drafts at once, changing and deleting it with a log', async () => {
    // Arrange
    const added = await flow.payroll<{ id: string }>(
      'POST',
      path('/dependants'),
      { fromMonth: '2026-07', count: 1 },
      201,
    );

    // Act
    await flow.payroll('PUT', path(`/dependants/${added.id}`), { fromMonth: '2026-07', count: 2 });
    const before = (await monthOf('2026-11')).dependants;
    await flow.payroll('DELETE', path(`/dependants/${added.id}`));

    // Assert
    expect(before).toBe(2);
    expect((await monthOf('2026-11')).dependants).toBe(0);
    expect(await logDetails()).toEqual(
      expect.arrayContaining([
        'Sửa người phụ thuộc của NV02 NV B: 1 người, từ T7/2026 → 2 người, từ T7/2026',
        'Xoá người phụ thuộc của NV02 NV B: 2 người, từ T7/2026',
      ]),
    );
  });

  it.todo(
    'L-B19: approved months keep their deduction; the change is "chỉ ghi nhận" until the year-end settlement (step 17)',
  );
});

describe('L-B21 – L-B22 commitment and đoàn viên', () => {
  it('L-B21: should apply a commitment from the first pay on or after it is signed, within its tax year', async () => {
    // Arrange + Act
    await flow.payroll('POST', path('/commitments'), { year: 2026, signedOn: '2026-11-20' }, 201);

    // Assert
    expect((await monthOf('2026-10')).hasCommitment).toBe(false);
    expect((await monthOf('2026-11')).hasCommitment).toBe(true);
    expect((await monthOf('2026-12')).hasCommitment).toBe(false);
  });

  it('L-B21: should refuse a second commitment for the same year', async () => {
    // Arrange
    await flow.payroll('POST', path('/commitments'), { year: 2026, signedOn: '2026-11-20' }, 201);

    // Act + Assert
    await flow.payroll('POST', path('/commitments'), { year: 2026, signedOn: '2026-11-25' }, 409);
  });

  it('L-B22: should make someone a union member from insurance month 11', async () => {
    // Arrange
    const level = { contractTypeId: 'khong-thoi-han', amounts: { luong: 10_000_000 } };
    await flow.payroll('POST', path('/versions'), { ...level, effectiveOn: '2026-01-05' }, 201);

    // Act
    await flow.payroll('POST', path('/versions'), { ...level, fromMonth: '2026-11', unionMember: true }, 201);

    // Assert
    expect((await monthOf('2026-10')).unionMember).toBe(false);
    expect((await monthOf('2026-11')).unionMember).toBe(true);
  });
});

describe('câu 4 khoản (32) định kỳ', () => {
  it('should prefill a recurring item, support when no kind is chosen, in its months only', async () => {
    // Arrange + Act
    await flow.payroll('POST', path('/recurring'), { amount: 500_000, fromMonth: '2026-11', toMonth: '2027-01' }, 201);

    // Assert
    expect((await monthOf('2026-11')).recurring).toEqual([
      expect.objectContaining({ kind: 'support', amount: 500_000, fromMonth: '2026-11', toMonth: '2027-01' }),
    ]);
    expect((await monthOf('2026-10')).recurring).toEqual([]);
    expect((await monthOf('2027-02')).recurring).toEqual([]);
  });
});

describe('L-B24 bank account', () => {
  it('L-B24: should store the number encrypted and show only its last four digits', async () => {
    // Arrange + Act
    const saved = await flow.payroll<PayrollBankAccountDto>(
      'POST',
      path('/bank'),
      { bank: 'Ngân hàng Thử', accountNumber: '0123 4567 8901', changedOn: '2026-11-01' },
      201,
    );

    // Assert
    expect(saved).toEqual({
      id: expect.any(String),
      bank: 'Ngân hàng Thử',
      last4: '8901',
      changedOn: '2026-11-01',
    });
    const [row] = await flow.t.db.select().from(payrollBankAccounts).where(eq(payrollBankAccounts.id, saved.id));
    expect(JSON.stringify(row)).not.toContain('012345678901');
    expect(row?.keyVersion).toBe(1);
    const profile = await flow.payroll<PayrollProfileDto>('GET', path(''));
    expect(JSON.stringify(profile)).not.toContain('012345678901');
    expect(await logDetails()).toEqual(['Thêm STK của NV02 NV B: Ngân hàng Thử ••••8901, từ 01/11/2026']);
  });

  it('L-B24: should show the full number on request and log that it was seen, never the number', async () => {
    // Arrange
    const saved = await flow.payroll<PayrollBankAccountDto>(
      'POST',
      path('/bank'),
      { bank: 'Ngân hàng Thử', accountNumber: '012345678901', changedOn: '2026-11-01' },
      201,
    );

    // Act
    const shown = await flow.payroll<{ accountNumber: string }>('POST', path(`/bank/${saved.id}/reveal`));

    // Assert
    expect(shown.accountNumber).toBe('012345678901');
    const lines = await flow.t.db.select().from(payrollLog);
    expect(lines.map((l) => [l.area, l.detail])).toContainEqual(['tai-xem', 'Xem đủ STK của NV02 NV B: ••••8901']);
    expect(JSON.stringify(lines)).not.toContain('012345678901');
  });

  it('L-B24: should refuse a number that is not 6–19 digits, and saving without the encryption key', async () => {
    // Arrange
    const body = { bank: 'Ngân hàng Thử', accountNumber: '12AB34', changedOn: '2026-11-01' };

    // Act + Assert
    await flow.payroll('POST', path('/bank'), body, 422);
    flow.t.deps.config.payrollKey = null;
    await flow.payroll('POST', path('/bank'), { ...body, accountNumber: '012345678901' }, 503);
  });

  it('should list the account in force today, and say from when for one that only starts later', async () => {
    // Arrange
    await flow.at('2026-11-11');
    const later = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2026-01-05' });
    const none = await flow.addPerson({ code: 'NV04', fullName: 'NV D', joinedOn: '2026-01-05' });
    const add = (id: string, accountNumber: string, changedOn: string) =>
      flow.payroll('POST', `/profiles/${id}/bank`, { bank: 'Ngân hàng Thử', accountNumber, changedOn }, 201);
    await add(person.id, '000000001111', '2026-01-05');
    await add(person.id, '000000002222', '2026-11-11');
    await add(person.id, '000000003333', '2026-12-01');
    await add(later.id, '000000004444', '2026-11-12');

    // Act
    const list = await flow.payroll<PayrollProfileListDto>('GET', '/profiles');

    // Assert
    const accountOf = (id: string) => list.people.find((p) => p.employeeId === id)?.account;
    expect(accountOf(person.id)).toEqual({ last4: '2222', changedOn: '2026-11-11', isInForce: true });
    expect(accountOf(later.id)).toEqual({ last4: '4444', changedOn: '2026-11-12', isInForce: false });
    expect(accountOf(none.id)).toBeNull();
  });

  it.todo('L-B23: an account changed after approval is flagged in the Excel of that month (steps 16, 23)');
});

describe('L-E07 opening balances of the tax year', () => {
  it('L-E07: should keep each person’s figures for 2026 and read them in a month paid in 2026', async () => {
    // Arrange
    const figures = {
      taxableIncome: 150_000_000,
      taxWithheld: 4_000_000,
      overtimeHours: 12.5,
      clothingPaid: 3_500_000,
      monthsPaid: 10,
    };

    // Act
    await flow.payroll('PUT', path('/opening/2026'), figures);
    await flow.payroll('PUT', path('/opening/2026'), { ...figures, monthsPaid: 11 });

    // Assert
    expect((await monthOf('2026-11')).opening).toEqual({ taxYear: 2026, ...figures, monthsPaid: 11 });
    expect((await monthOf('2026-12')).opening).toBeNull();
    expect(await logDetails()).toContain('Sửa số dư đầu năm 2026 của NV02 NV B: số tháng đã trả 10 → 11');
  });

  it('L-E07: should refuse half-hour steps it cannot store and negative amounts', async () => {
    // Act + Assert
    await flow.payroll('PUT', path('/opening/2026'), { overtimeHours: 1.2 }, 422);
    await flow.payroll('PUT', path('/opening/2026'), { taxWithheld: -1 }, 422);
  });
});
