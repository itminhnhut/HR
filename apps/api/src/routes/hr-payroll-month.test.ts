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
