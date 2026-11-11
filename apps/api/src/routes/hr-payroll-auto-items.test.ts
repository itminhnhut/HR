import type {
  EmployeeDto,
  PayrollLineDto,
  PayrollMonthDto,
  PayrollProfileMonthDto,
  PayrollRecurringDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { addSetting, givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Two things HR's October file does that nobody types: the company pays an employee's own insurance back in (32)
 * ("Công ty trả thay BH", outside tax and cost), and a probation contract carries the tax commitment (no 10%). Each is
 * automatic, can be changed per person, and shows a yellow notice where the law reads otherwise. A made-up company in
 * November 2026: NV A official, NV B on probation.
 */

let flow: Flow;
let a: EmployeeDto;
let b: EmployeeDto;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
  a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  b = await flow.addPerson({ code: 'NV02', fullName: 'NV B', employment: 'probation', joinedOn: '2026-10-01' });
  const level = (effectiveOn: string, contractTypeId: string, luong: number) => ({
    effectiveOn,
    contractTypeId,
    amounts: { luong, com: 1_100_000 },
  });
  await flow.payroll('POST', `/profiles/${a.id}/versions`, level('2025-03-01', 'khong-thoi-han', 15_000_000), 201);
  await flow.payroll('POST', `/profiles/${b.id}/versions`, level('2026-10-01', 'thu-viec', 8_000_000), 201);
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
});

const november = () => flow.payroll<PayrollMonthDto>('GET', '/months/2026-11');
const lineIn = (month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto => {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`${person.code} has no line`);
  return line;
};
const lineOf = async (person: EmployeeDto) => lineIn(await november(), person);
const reviewOf = (month: PayrollMonthDto, code: string, person?: EmployeeDto) =>
  month.review.find((r) => r.code === code && (!person || r.employeeId === person.id));
const recurring = (person: EmployeeDto, rest = '') => `/profiles/${person.id}/recurring${rest}`;
const paidBack = { kind: 'insurance-paid', fromMonth: '2026-11' };
const logDetails = async () => (await flow.t.db.select().from(payrollLog)).map((l) => l.detail);

describe('(32) "Công ty trả thay BH": the employee insurance of the month, nothing typed', () => {
  it('should add (28) + (29) + (30) to (32) and net pay, outside tax and cost, with a yellow notice', async () => {
    // Arrange
    const before = await lineOf(a);

    // Act
    const saved = await flow.payroll<PayrollRecurringDto>('POST', recurring(a), paidBack, 201);
    const month = await november();
    const { cells, explain } = lineIn(month, a);

    // Assert
    expect(saved).toMatchObject({ kind: 'insurance-paid', amount: 0, taxable: false, toMonth: null });
    expect(cells.cash).toBe((cells.social ?? 0) + (cells.health ?? 0) + (cells.unemployment ?? 0));
    expect(cells.cash).toBeGreaterThan(0);
    expect(cells.netPay).toBe((before.cells.netPay ?? 0) + (cells.cash ?? 0));
    expect([cells.taxable, cells.tax, cells.totalCost]).toEqual([
      before.cells.taxable,
      before.cells.tax,
      before.cells.totalCost,
    ]);
    expect(explain.cash?.formula).toContain('Công ty trả thay BH [(28) + (29) + (30) = ');
    expect(reviewOf(month, 'insurance-paid-untaxed', a)).toMatchObject({ level: 'yellow', cell: 'cash' });
    expect(await logDetails()).toContain(
      'Thêm khoản (32) định kỳ của NV01 NV A: Công ty trả thay BH (chưa tính thuế), từ T11/2026',
    );
  });

  it('should tax it and count it in the cost once "Tính thuế" is on, then drop it when the item is deleted', async () => {
    // Arrange
    const before = await lineOf(a);
    const saved = await flow.payroll<PayrollRecurringDto>('POST', recurring(a), paidBack, 201);

    // Act
    await flow.payroll('PUT', recurring(a, `/${saved.id}`), { ...paidBack, taxable: true });
    const taxed = await november();
    const { cells } = lineIn(taxed, a);
    await flow.payroll('DELETE', recurring(a, `/${saved.id}`));
    const after = await lineOf(a);

    // Assert
    expect(cells.taxable).toBe((before.cells.taxable ?? 0) + (cells.cash ?? 0));
    expect(cells.totalCost).toBe((before.cells.totalCost ?? 0) + (cells.cash ?? 0));
    expect(reviewOf(taxed, 'insurance-paid-untaxed')).toBeUndefined();
    expect(after.cells).toEqual(before.cells);
  });

  it('should stop after its last month and pay nothing to a person who pays no insurance', async () => {
    // Act
    await flow.payroll('POST', recurring(a), { ...paidBack, fromMonth: '2026-09', toMonth: '2026-10' }, 201);
    await flow.payroll('POST', recurring(b), paidBack, 201);
    const month = await november();

    // Assert
    expect(lineIn(month, a).cells.cash).toBe(0);
    expect(lineIn(month, b).cells.cash).toBe(0);
    expect(reviewOf(month, 'insurance-paid-untaxed')).toBeUndefined();
  });

  it('should refuse a second one over the same months, and a typed kind without an amount', async () => {
    // Arrange
    await flow.payroll('POST', recurring(a), paidBack, 201);

    // Act
    const twice = await flow.payroll<{ error: string }>(
      'POST',
      recurring(a),
      { ...paidBack, fromMonth: '2027-01' },
      409,
    );
    await flow.payroll('POST', recurring(a), { ...paidBack, fromMonth: '2026-08', toMonth: '2026-10' }, 201);
    await flow.payroll('POST', recurring(a), { kind: 'support', fromMonth: '2026-11' }, 422);

    // Assert
    expect(twice.error).toBe('Đã có khoản công ty trả thay BH trong các tháng này.');
  });
});

describe('the tax commitment that comes with the probation contract', () => {
  const OFF = 'loai-hd.thu-viec.cam-ket-kem-hd';

  it('should withhold nothing from a probation person without anything typed, and say how many rely on it', async () => {
    // Act
    const month = await november();
    const line = lineIn(month, b);

    // Assert
    expect(line.cells.income).toBeGreaterThanOrEqual(5_000_000);
    expect(line.cells.tax).toBe(0);
    expect(line.explain.tax?.formula).toBe('Không khấu trừ · Cam kết theo hợp đồng = 0');
    expect(reviewOf(month, 'probation-no-commitment')).toBeUndefined();
    expect(reviewOf(month, 'contract-commitment')?.message).toMatch(/^1 người không bị khấu trừ 10% nhờ cam kết/);
  });

  it('should withhold 10% once HR turns it off for the person, until a signed commitment is on file', async () => {
    // Act
    await addSetting(flow, { key: OFF, employeeId: b.id, from: '2026-11', value: false, source: 'Chưa ký cam kết' });
    const off = await november();
    await flow.payroll('POST', `/profiles/${b.id}/commitments`, { year: 2026, signedOn: '2026-11-20' }, 201);
    const signed = await lineOf(b);

    // Assert
    const withheld = lineIn(off, b);
    expect(withheld.cells.tax).toBe(Math.round((withheld.cells.income ?? 0) * 0.1));
    expect(withheld.explain.tax?.formula).toContain('HĐ dưới 3 tháng: khấu trừ 10%');
    expect(reviewOf(off, 'probation-no-commitment', b)?.message).toMatch(/^Chưa có cam kết thuế — đang khấu trừ 10%/);
    expect(reviewOf(off, 'contract-commitment')).toBeUndefined();
    expect(signed.cells.tax).toBe(0);
    expect(signed.explain.tax?.formula).toBe('Không khấu trừ · Cam kết ký ngày 20/11/2026 = 0');
  });

  it('should point out a commitment the estimated income of the year outgrows', async () => {
    // Arrange: 190 tr taxable already this year, ten months paid
    const opening = { taxableIncome: 190_000_000, taxWithheld: 0, overtimeHours: 0, clothingPaid: 0, monthsPaid: 10 };
    await flow.payroll('PUT', `/profiles/${b.id}/opening/2026`, opening);

    // Act
    const month = await november();

    // Assert: 12 × 15,5 tr = 186 tr
    expect(reviewOf(month, 'commitment-exceeds', b)).toMatchObject({ level: 'yellow', cell: 'tax' });
    expect(reviewOf(month, 'commitment-exceeds', b)?.message).toMatch(
      /^Thu nhập ước tính cả năm vượt mức được cam kết — nên khấu trừ 10% \(ước tính [\d.]+ > 186\.000\.000; NĐ 253\/2026 Đ\.50 k2\)$/,
    );
    expect(reviewOf(month, 'commitment-exceeds', a)).toBeUndefined();
  });

  it('L-B21: should know the year of the last signed commitment in a month paid the year after', async () => {
    // Arrange
    await flow.payroll('POST', `/profiles/${b.id}/commitments`, { year: 2026, signedOn: '2026-11-20' }, 201);
    const monthOf = (month: string) => flow.payroll<PayrollProfileMonthDto>('GET', `/profiles/${b.id}/month/${month}`);

    // Act: T11 is paid on 05/12/2026, T12 on 05/01/2027
    const [paidThisYear, paidNextYear] = [await monthOf('2026-11'), await monthOf('2026-12')];

    // Assert
    expect(paidThisYear).toMatchObject({
      hasCommitment: true,
      commitmentSignedOn: '2026-11-20',
      lastCommitmentYear: 2026,
    });
    expect(paidNextYear).toMatchObject({ hasCommitment: false, commitmentSignedOn: null, lastCommitmentYear: 2026 });
  });
});
