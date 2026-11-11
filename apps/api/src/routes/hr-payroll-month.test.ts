import {
  computeLine,
  contractTypeFor,
  payrollConfigFor,
  payrollDates,
  payrollTotals,
  type EmployeeDto,
  type PayrollLineInput,
  type PayrollMonthDto,
  type PayrollProfileDto,
  type TimesheetClosingDto,
  type TimesheetClosingRowDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollPeriods } from '../db/schema.js';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Bảng lương nháp, read side (spec-luong.md R2, R3, 10.2, 15 step 15; docs/test-cases-luong.md L-C01, L-C02, L-C24,
 * L-L22, L-B13, L-B25). A made-up company in November 2026 (26/10–25/11): NV A official with chuyên cần and one
 * dependant, NV B on probation with a tax commitment, NV C without a profile, NV I left before the period.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const NOVEMBER = payrollDates(2026, 11);
const monthOf = (key: string, expected = 200) =>
  flow.payroll<PayrollMonthDto>('GET', `/months/${key}`, undefined, expected);

interface Company {
  a: EmployeeDto;
  b: EmployeeDto;
  c: EmployeeDto;
  i: EmployeeDto;
}

async function addProfile(person: EmployeeDto, body: Record<string, unknown>) {
  await flow.payroll('POST', `/profiles/${person.id}/versions`, body, 201);
}

async function hireCompany(): Promise<Company> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  const b = await flow.addPerson({ code: 'NV02', fullName: 'NV B', employment: 'probation', joinedOn: '2026-10-01' });
  const c = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2025-06-01' });
  const i = await flow.addPerson({ code: 'NV09', fullName: 'NV I', joinedOn: '2025-01-05', leftOn: '2026-10-09' });
  const amountsA = { luong: 9_000_000, com: 1_100_000, 'chuyen-can': 1_000_000 };
  await addProfile(a, { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts: amountsA });
  await flow.payroll('POST', `/profiles/${a.id}/dependants`, { fromMonth: '2026-01', count: 1 }, 201);
  await addProfile(b, {
    effectiveOn: '2026-10-01',
    contractTypeId: 'thu-viec',
    amounts: { luong: 6_000_000, com: 1_100_000 },
  });
  await flow.payroll('POST', `/profiles/${b.id}/commitments`, { year: 2026, signedOn: '2026-10-01' }, 201);
  await addProfile(i, { effectiveOn: '2025-01-05', contractTypeId: 'khong-thoi-han', amounts: { luong: 8_000_000 } });
  return { a, b, c, i };
}

async function closeNovember(): Promise<TimesheetClosingDto> {
  await flow.at('2026-11-26');
  const closed = await flow.close(2026, 11);
  const closings = await flow.call<TimesheetClosingDto[]>('GET', `/${closed.periodId}/closings`);
  const last = closings[closings.length - 1];
  if (!last) throw new Error('November did not close');
  return last;
}

function rowIn(closing: TimesheetClosingDto, person: EmployeeDto): TimesheetClosingRowDto {
  const row = closing.rows.find((r) => r.employeeId === person.id);
  if (!row) throw new Error(`${person.code} is not in the close`);
  return row;
}

/** The engine on the same facts, written out by hand: the close's days, the profile's level, no stored setting. */
async function expectedLine(
  person: EmployeeDto,
  row: TimesheetClosingRowDto,
  facts: { dependants: number; hasCommitment: boolean },
) {
  const profile = await flow.payroll<PayrollProfileDto>('GET', `/profiles/${person.id}`);
  const level = profile.versions[0];
  if (!level || !row.totals) throw new Error(`${person.code} has no level or no totals`);
  const contract = contractTypeFor([], level.contractTypeId, person.id, NOVEMBER.monthKey);
  const input: PayrollLineInput = {
    employeeId: person.id,
    income: {
      norm: row.norm,
      segments: [{ days: row.totals.paid, probation: person.employment === 'probation', amounts: level.amounts }],
      kpiAmount: level.kpiAmount,
      overtime: { weekdayHours: 0, restDays: 0, holidayDays: 0 },
    },
    insurance: {
      month: {
        month: '2026-11',
        codes: row.codes ?? {},
        contracts: [{ from: level.effectiveOn, insured: contract.insured }],
        joinedOn: row.joinedOn,
        leftOn: null,
        provisionalFrom: '2026-11-26',
      },
      zone: 'I',
      unionMember: false,
    },
    person: { contract, leftOn: null, ...facts },
  };
  return computeLine(input, payrollConfigFor([], person.id, NOVEMBER));
}

describe('L-C02 a closed month is computed by the engine from the close, the profiles and the config', () => {
  it('L-C02: should give each person the engine’s numbers on the same inputs, and totals that add them up', async () => {
    // Arrange
    const { a, b } = await hireCompany();
    const closing = await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const lineA = await expectedLine(a, rowIn(closing, a), { dependants: 1, hasCommitment: false });
    const lineB = await expectedLine(b, rowIn(closing, b), { dependants: 0, hasCommitment: true });
    const [gotA, gotB] = month.lines;
    expect(month).toMatchObject({ status: 'draft', monthKey: '2026-11', payDate: '2026-12-05', approval: null });
    expect(month.period).toEqual({ from: '2026-10-26', to: '2026-11-25' });
    expect(month.computedAt).toBe('2026-11-26T03:00:00.000Z');
    expect(gotA?.cells).toMatchObject(lineA.cells);
    expect(gotB?.cells).toMatchObject(lineB.cells);
    expect(month.totals).toEqual(payrollTotals([lineA, lineB], 'cell'));
    expect(lineA.cells.netPay).toBeGreaterThan(0);
  });

  it('L-C02: should pay chuyên cần to NV A and mark NV B as on probation, in region and contract order', async () => {
    // Arrange
    const { a, b } = await hireCompany();
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.lines.map((l) => [l.code, l.contractTypeId, l.probation])).toEqual([
      ['NV01', 'khong-thoi-han', false],
      ['NV02', 'thu-viec', true],
      ['NV03', '', false],
    ]);
    expect(month.lines[0]).toMatchObject({
      employeeId: a.id,
      amounts: { 'chuyen-can': 1_000_000 },
      regionId: flow.hcm.id,
    });
    expect(month.lines[1]?.employeeId).toBe(b.id);
    expect(month.regions.map((r) => r.name)).toEqual(['HCM', 'HN']);
    expect(month.components.map((c) => c.id)).toContain('chuyen-can');
    expect(month.lines[0]?.explain.paidDays?.fromTimesheet).toBe(true);
  });
});

describe('people without a profile, people not in the close (L-C24, L-B13, L-B25)', () => {
  it('should show someone in the close without a profile as a zero row with a red warning', async () => {
    // Arrange
    const { c } = await hireCompany();
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const line = month.lines.find((l) => l.employeeId === c.id);
    expect(line).toMatchObject({ note: 'Chưa có hồ sơ lương', amounts: {}, contractTypeId: '' });
    expect(line?.cells.netPay).toBe(0);
    expect(line?.cells.paidDays).toBeGreaterThan(0);
    expect(month.review).toContainEqual(
      expect.objectContaining({ level: 'red', code: 'missing-profile', employeeId: c.id }),
    );
  });

  it('should warn in red about days worked before the first pay level, which are paid nothing', async () => {
    // Arrange: NV D joins on 28/10, inside the period, but the first level starts on 01/11.
    await givePayrollRight(flow);
    const d = await flow.addPerson({ code: 'NV04', fullName: 'NV D', joinedOn: '2026-10-28' });
    await addProfile(d, { effectiveOn: '2026-11-01', contractTypeId: 'khong-thoi-han', amounts: { luong: 9_000_000 } });
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const line = month.lines.find((l) => l.employeeId === d.id);
    expect(line?.cells.netPay).toBeGreaterThan(0);
    expect(month.review).toContainEqual(
      expect.objectContaining({
        level: 'red',
        code: 'profile-gap',
        employeeId: d.id,
        cell: 'paidDays',
        message: '28/10–31/10 có công nhưng chưa có mức',
      }),
    );
  });

  it('should not warn about a gap for someone whose level starts before the period', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.review.filter((i) => i.code === 'profile-gap' && i.employeeId === a.id)).toEqual([]);
  });

  it('should name a level whose contract type the month does not know, not call it a missing profile', async () => {
    // Arrange
    await givePayrollRight(flow);
    const e = await flow.addPerson({ code: 'NV05', fullName: 'NV E', joinedOn: '2025-03-01' });
    await addProfile(e, { effectiveOn: '2025-03-01', contractTypeId: 'hd-cu', amounts: { luong: 9_000_000 } });
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const line = month.lines.find((l) => l.employeeId === e.id);
    expect(line?.note).toBe('Loại HĐ hd-cu không còn trong cấu hình');
    expect(line?.cells.netPay).toBe(0);
    const mine = month.review.filter((i) => i.employeeId === e.id);
    expect(mine).toContainEqual(
      expect.objectContaining({
        level: 'red',
        code: 'unknown-contract',
        message: 'Loại HĐ của mức lương không còn trong cấu hình: hd-cu',
      }),
    );
    expect(mine.map((i) => i.code)).not.toContain('missing-profile');
    expect(mine.map((i) => i.code)).not.toContain('missing-contract');
  });

  it('should warn about a missing account when the only one starts after the pay date', async () => {
    // Arrange: November is paid on 05/12; NV A's account is used from 01/2027, NV B's from 01/11.
    const { a, b } = await hireCompany();
    const account = { bank: 'Ngân hàng Thử', accountNumber: '0123 4567 8901' };
    await flow.payroll('POST', `/profiles/${a.id}/bank`, { ...account, changedOn: '2027-01-01' }, 201);
    await flow.payroll('POST', `/profiles/${b.id}/bank`, { ...account, changedOn: '2026-11-01' }, 201);
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const missing = month.review.filter((i) => i.code === 'missing-bank-account').map((i) => i.employeeId);
    expect(missing).toContain(a.id);
    expect(missing).not.toContain(b.id);
    expect(month.lines.find((l) => l.employeeId === a.id)?.sheet?.bankName).toBeNull();
  });

  it('L-C24, L-B13: should leave out someone who left before the period even with a profile', async () => {
    // Arrange
    const { i } = await hireCompany();
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.lines.map((l) => l.employeeId)).not.toContain(i.id);
    expect(month.lines).toHaveLength(3);
  });

  it('L-B25: should take the name from the close, not from today', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    await flow.updatePerson(a, { fullName: 'NV A mới' });

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.lines[0]?.fullName).toBe('NV A');
  });
});

describe('Rà soát against the month before and the law (spec 11.3)', () => {
  it('should flag a net pay more than 10% off the approved month before', async () => {
    // Arrange: November approved, then NV A's pay goes from 9 to 15 million from the December period on.
    const { a, b } = await hireCompany();
    await closeNovember();
    await flow.payroll('POST', '/months/2026-11/approve', { acknowledgedRed: true });
    const raised = { luong: 15_000_000, com: 1_100_000, 'chuyen-can': 1_000_000 };
    await addProfile(a, { effectiveOn: '2026-11-26', contractTypeId: 'khong-thoi-han', amounts: raised });
    await flow.at('2026-12-26');
    await flow.close(2026, 12);

    // Act
    const december = await monthOf('2026-12');

    // Assert
    const change = december.review.filter((i) => i.code === 'change-over-10');
    expect(change.map((i) => i.employeeId)).toContain(a.id);
    expect(change.find((i) => i.employeeId === a.id)?.message).toMatch(/^Thực nhận lệch \+\d+% so với tháng trước$/);
    expect(change.map((i) => i.employeeId)).not.toContain(b.id);
  });

  it('câu 33: should flag probation days beyond what BLLĐ Đ.25 allows the job', async () => {
    // Arrange: NV F on a 90-day probation, not a job managing the business (60 days at most).
    await givePayrollRight(flow);
    const f = await flow.addPerson({ code: 'NV06', fullName: 'NV F', employment: 'probation', joinedOn: '2026-10-01' });
    const level = { effectiveOn: '2026-10-01', contractTypeId: 'thu-viec', amounts: { luong: 6_000_000 } };
    await addProfile(f, { ...level, probationDays: 90 });
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.review).toContainEqual(
      expect.objectContaining({
        level: 'red',
        code: 'probation-too-long',
        employeeId: f.id,
        message: 'Thử việc 90 ngày, vượt 60 ngày (BLLĐ Đ.25)',
      }),
    );
  });

  it('câu 33: should allow 180 probation days to a job managing the business', async () => {
    // Arrange
    await givePayrollRight(flow);
    const f = await flow.addPerson({ code: 'NV06', fullName: 'NV F', employment: 'probation', joinedOn: '2026-10-01' });
    const level = { effectiveOn: '2026-10-01', contractTypeId: 'thu-viec', amounts: { luong: 6_000_000 } };
    await addProfile(f, { ...level, probationDays: 90, managesBusiness: true });
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.review.filter((i) => i.code === 'probation-too-long')).toEqual([]);
  });
});

describe('a month without a closed timesheet, rights and range (L-C01, L-L22)', () => {
  it('L-C01, L-L22: should answer a month still open as waiting, with no line, and write nothing', async () => {
    // Arrange
    await hireCompany();
    await flow.at('2026-11-26');

    // Act
    const month = await monthOf('2026-12');

    // Assert
    expect(month).toMatchObject({ status: 'waiting', computedAt: null, lines: [], totals: {}, review: [] });
    expect(month.payDate).toBe('2027-01-05');
    expect(await flow.t.db.select().from(payrollPeriods)).toEqual([]);
  });

  it('L-C01: should go back to waiting while the timesheet period is reopened', async () => {
    // Arrange
    await hireCompany();
    const closing = await closeNovember();
    await flow.call('POST', `/${closing.periodId}/reopen`, { reason: 'Sửa công NV A' });

    // Act
    const month = await monthOf('2026-11');

    // Assert
    expect(month.status).toBe('waiting');
    expect(month.lines).toEqual([]);
  });

  it('should refuse a month outside the payroll range with the range in words', async () => {
    // Arrange
    await givePayrollRight(flow);

    // Act
    const before = await flow.payroll<{ error: string }>('GET', '/months/2026-10', undefined, 404);
    const garbage = await flow.payroll<{ error: string }>('GET', '/months/thang-10', undefined, 404);

    // Assert
    expect(before.error).toBe('Có bảng lương từ T11/2026 đến T11/2027.');
    expect(garbage.error).toBe(before.error);
  });

  it('L-H01: should refuse HR without the payroll right, with no figure in the answer', async () => {
    // Arrange: November closed, nobody has the payroll right
    await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
    await closeNovember();

    // Act
    const body = await flow.payroll<Record<string, unknown>>('GET', '/months/2026-11', undefined, 403);

    // Assert
    expect(Object.keys(body).sort()).toEqual(['code', 'error', 'fieldErrors']);
    expect(JSON.stringify(body)).not.toMatch(/\d{4,}/);
  });
});
