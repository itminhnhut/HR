import type { EmployeeDto, PayrollExportDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { payrollKeyFromSecret } from '../lib/payroll-crypto.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Tải Excel bảng lương và phiếu lương (spec-luong.md 12.1, 11.7, 10.2; docs/test-cases-luong.md L-F01, L-F03, L-F06,
 * L-F18, L-F22, L-H02). A made-up company in November 2026: NV A with a job title, one dependant and a bank account,
 * NV B on probation without an account. The whole account number leaves the API only in the payroll workbook export.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const ACCOUNT = '012345678901';
const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const exportOf = (body: Record<string, unknown>, expected = 200) =>
  flow.payroll<PayrollExportDto>('POST', '/export', body, expected);
const logLines = async () => (await flow.t.db.select().from(payrollLog)).filter((l) => l.area === 'tai-xem');

interface Company {
  a: EmployeeDto;
  b: EmployeeDto;
}

async function hireCompany(): Promise<Company> {
  await givePayrollRight(flow);
  // The payslip email is the person's own; the one an old client still sends with a bank account is ignored.
  const a = await flow.addPerson({
    code: 'NV01',
    fullName: 'NV A',
    title: 'Kế toán',
    joinedOn: '2025-03-01',
    email: 'nv-a@example.test',
  });
  const b = await flow.addPerson({ code: 'NV02', fullName: 'NV B', employment: 'probation', joinedOn: '2026-10-01' });
  await flow.payroll(
    'POST',
    `/profiles/${a.id}/versions`,
    { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts: { luong: 9_000_000, com: 1_100_000 } },
    201,
  );
  await flow.payroll('POST', `/profiles/${a.id}/dependants`, { fromMonth: '2026-01', count: 1 }, 201);
  await flow.payroll(
    'POST',
    `/profiles/${a.id}/bank`,
    { bank: 'Ngân hàng Thử', accountNumber: ACCOUNT, payslipEmail: 'cu@example.test', changedOn: '2026-01-01' },
    201,
  );
  await flow.payroll(
    'POST',
    `/profiles/${b.id}/versions`,
    { effectiveOn: '2026-10-01', contractTypeId: 'thu-viec', amounts: { luong: 6_000_000, com: 1_100_000 } },
    201,
  );
  return { a, b };
}

async function closeNovember() {
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
}

const lineOf = (month: PayrollMonthDto, person: EmployeeDto) => {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`${person.code} has no line`);
  return line;
};

describe('who may download', () => {
  it('L-H02: should answer 403 to an HR without the payroll right and write no log line', async () => {
    // Act
    await exportOf({ months: ['2026-11'], kind: 'payroll' }, 403);

    // Assert
    expect(await logLines()).toEqual([]);
  });
});

describe('the month response carries what the sheet prints, the account masked', () => {
  it("should give each line the job title, dependants, what was paid of each component and the account's last four", async () => {
    // Arrange
    const { a, b } = await hireCompany();
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const lineA = lineOf(month, a);
    expect(lineA.sheet).toMatchObject({
      title: 'Kế toán',
      dependants: 1,
      taxMethod: 'progressive',
      payslipEmail: 'nv-a@example.test',
      bankName: 'Ngân hàng Thử',
      bankAccount: '••••8901',
    });
    expect(Object.values(lineA.sheet?.paid ?? {}).reduce((sum, paid) => sum + paid, 0)).toBeGreaterThan(0);
    expect(lineOf(month, b).sheet).toMatchObject({ dependants: 0, bankName: null, bankAccount: null });
    expect([month.closingNo, month.formulaVersion]).toEqual([1, 'luong-2026.11']);
    expect(JSON.stringify(month)).not.toContain(ACCOUNT);
  });
});

describe('POST /export, the payroll workbook', () => {
  it('L-F06: should give the whole account only here and log one line with the month and the head count, no number', async () => {
    // Arrange
    const { a, b } = await hireCompany();
    await closeNovember();

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payroll' });

    // Assert
    const [only] = answer.months;
    if (!only) throw new Error('The export has no month');
    expect([answer.kind, answer.months.length, only.month.monthKey]).toEqual(['payroll', 1, '2026-11']);
    expect(lineOf(only.month, a).sheet).toMatchObject({ title: 'Kế toán', dependants: 1, bankAccount: ACCOUNT });
    expect(lineOf(only.month, b).sheet?.bankAccount).toBeNull();
    expect([only.closingNo, only.formulaVersion]).toEqual([1, 'luong-2026.11']);
    const lines = await logLines();
    expect(lines.map((l) => [l.action, l.detail, l.month])).toEqual([
      ['Tải', 'Tải Excel bảng lương T11/2026 (2 người)', '2026-11'],
    ]);
    expect(JSON.stringify(await flow.t.db.select().from(payrollLog))).not.toContain(ACCOUNT);
  });

  it('F29: should export only the people asked for, say how many the month has, and log the number in the file', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payroll', employeeIds: [a.id] });

    // Assert
    const [only] = answer.months;
    if (!only) throw new Error('The export has no month');
    expect(only.month.lines.map((l) => l.employeeId)).toEqual([a.id]);
    expect(only.peopleTotal).toBe(2);
    expect((await logLines()).map((l) => l.detail)).toEqual(['Tải Excel bảng lương T11/2026 (1 người)']);
  });

  it('L-F03: should hand over the settings the month resolves from, so "Tham số áp dụng" can be printed', async () => {
    // Arrange
    await hireCompany();
    await flow.payroll(
      'POST',
      '/settings',
      { key: 'quy-tac.ty-le-thu-viec', from: '2026-01', value: 0.9, source: 'Thử' },
      201,
    );
    await closeNovember();

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payroll' });

    // Assert
    const keys = answer.months[0]?.settings.map((s) => s.key) ?? [];
    expect(keys).toContain('quy-tac.ty-le-thu-viec');
  });

  it('L-F01: should read an approved month from its approval, with a note that the settings are read by its dates', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    const approved = await flow.payroll<PayrollMonthDto>('POST', '/months/2026-11/approve', { acknowledgedRed: true });
    await flow.payroll('POST', `/profiles/${a.id}/dependants`, { fromMonth: '2026-01', count: 3 }, 201);

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payroll' });

    // Assert
    const [only] = answer.months;
    if (!only) throw new Error('The export has no month');
    const line = lineOf(only.month, a);
    expect([only.month.status, only.month.approval?.no]).toEqual(['approved', 1]);
    expect([line.cells.netPay, line.sheet?.dependants]).toEqual([lineOf(approved, a).cells.netPay, 1]);
    expect(line.sheet?.bankAccount).toBe(ACCOUNT);
    expect(only.notes.join(' ')).toContain('Tham số');
  });

  it('should mark an account sealed under an older secret and still export the rest of the month', async () => {
    // Arrange
    flow.t.deps.config.payrollKey = payrollKeyFromSecret('an-old-session-secret-for-tests-only-x');
    const { a, b } = await hireCompany();
    flow.t.deps.config.payrollKey = payrollKeyFromSecret('a-new-session-secret-for-tests-only-yy');
    const other = '098765432109';
    await flow.payroll(
      'POST',
      `/profiles/${b.id}/bank`,
      { bank: 'Ngân hàng Thử', accountNumber: other, changedOn: '2026-10-01' },
      201,
    );
    await closeNovember();

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payroll' });

    // Assert
    const [only] = answer.months;
    if (!only) throw new Error('The export has no month');
    expect(lineOf(only.month, a).sheet?.bankAccount).toBe('Cần nhập lại số TK');
    expect(lineOf(only.month, b).sheet?.bankAccount).toBe(other);
    expect(await logLines()).toHaveLength(1);
  });

  it('should answer several months oldest first and log them in one line', async () => {
    // Arrange
    await hireCompany();
    await closeNovember();
    await flow.at('2026-12-26');
    await flow.close(2026, 12);

    // Act
    const answer = await exportOf({ months: ['2026-12', '2026-11'], kind: 'payroll' });

    // Assert
    expect(answer.months.map((m) => m.month.monthKey)).toEqual(['2026-11', '2026-12']);
    expect((await logLines()).map((l) => [l.detail, l.month])).toEqual([
      ['Tải Excel bảng lương T11/2026, T12/2026 (2 người)', null],
    ]);
  });
});

describe('POST /export, payslips', () => {
  it('L-F22: should give only the people asked for, the account masked, and log "Tải phiếu lương"', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();

    // Act
    const answer = await exportOf({ months: ['2026-11'], kind: 'payslips', employeeIds: [a.id] });

    // Assert
    const month = answer.months[0]?.month;
    expect(month?.lines.map((l) => l.code)).toEqual(['NV01']);
    expect(month?.lines[0]?.sheet?.bankAccount).toBe('••••8901');
    expect(JSON.stringify(answer)).not.toContain(ACCOUNT);
    expect((await logLines()).map((l) => l.detail)).toEqual(['Tải phiếu lương T11/2026 (1 người)']);
  });
});

describe('months that cannot be downloaded', () => {
  it('should answer 409 in Vietnamese for a month still waiting for the timesheet close, and log nothing', async () => {
    // Arrange
    await hireCompany();
    await flow.at('2026-11-10');

    // Act
    const refused = await exportOf({ months: ['2026-11'], kind: 'payroll' }, 409);

    // Assert
    expect(JSON.stringify(refused)).toContain('chờ chốt công');
    expect(await logLines()).toEqual([]);
  });

  it('should answer 404 for a month outside the range the web has', async () => {
    // Arrange
    await hireCompany();
    await closeNovember();

    // Act + Assert
    await exportOf({ months: ['2019-01'], kind: 'payroll' }, 404);
  });

  it('should answer 422 for a request without months or with an unknown kind', async () => {
    // Arrange
    await givePayrollRight(flow);

    // Act + Assert
    await exportOf({ months: [], kind: 'payroll' }, 422);
    await exportOf({ months: ['2026-11'], kind: 'khac' }, 422);
  });
});
