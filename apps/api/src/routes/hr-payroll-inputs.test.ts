import {
  computeLine,
  contractTypeFor,
  payrollConfigFor,
  payrollDates,
  type EmployeeDto,
  type PayrollLineDto,
  type PayrollLineInput,
  type PayrollLogPageDto,
  type PayrollMonthDto,
  type PayrollMonthInputsInput,
  type PayrollMonthInputsResultDto,
  type PayrollProfileDto,
  type TimesheetClosingDto,
  type TimesheetClosingRowDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers, payrollMonthInputs } from '../db/schema.js';
import { approvedMonth, givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Đầu vào tháng (spec-luong.md 2 (4), 5.3 (19), (21)–(24), (32), step 15; docs/test-cases-luong.md L-C01, L-D08,
 * L-D09, L-D11–L-D13). A made-up company in November 2026 (26/10–25/11): NV A official with KPI, NV B on probation
 * with KPI, NV C official without KPI.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const NOVEMBER = payrollDates(2026, 11);

interface Company {
  a: EmployeeDto;
  b: EmployeeDto;
  c: EmployeeDto;
}

async function hireCompany(): Promise<Company> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  // Khối BO: the probation KPI % goes by the formula; NV A and NV C have no block, so HR types theirs (as KD)
  const b = await flow.addPerson({
    code: 'NV02',
    fullName: 'NV B',
    employment: 'probation',
    joinedOn: '2026-10-01',
    block: 'BO',
  });
  const c = await flow.addPerson({ code: 'NV03', fullName: 'NV C', joinedOn: '2025-06-01' });
  const level = (effectiveOn: string, contractTypeId: string, kpiAmount: number, luong: number) => ({
    effectiveOn,
    contractTypeId,
    kpiAmount,
    amounts: { luong, com: 1_100_000 },
  });
  await flow.payroll(
    'POST',
    `/profiles/${a.id}/versions`,
    level('2025-03-01', 'khong-thoi-han', 4_000_000, 15_000_000),
    201,
  );
  await flow.payroll('POST', `/profiles/${b.id}/versions`, level('2026-10-01', 'thu-viec', 2_000_000, 8_000_000), 201);
  await flow.payroll('POST', `/profiles/${c.id}/versions`, level('2025-06-01', 'khong-thoi-han', 0, 9_000_000), 201);
  return { a, b, c };
}

async function closeNovember(): Promise<TimesheetClosingDto> {
  await flow.at('2026-11-26');
  const closed = await flow.close(2026, 11);
  const closings = await flow.call<TimesheetClosingDto[]>('GET', `/${closed.periodId}/closings`);
  const last = closings[closings.length - 1];
  if (!last) throw new Error('November did not close');
  return last;
}

type Body = PayrollMonthInputsInput | Record<string, unknown>;
const inputsPath = (person: EmployeeDto) => `/months/2026-11/lines/${person.id}/inputs`;

const putInputs = (person: EmployeeDto, body: Body) =>
  flow.payroll<PayrollMonthInputsResultDto>('PUT', inputsPath(person), body, 200);

interface Refusal {
  error: string;
  code?: string;
  fieldErrors: Record<string, string>;
}

const refused = (person: EmployeeDto, body: Body, expected = 422) =>
  flow.payroll<Refusal>('PUT', inputsPath(person), body, expected);

async function lineOf(person: EmployeeDto, key = '2026-11'): Promise<PayrollLineDto> {
  const month = await flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`${person.code} has no line in ${key}`);
  return line;
}

/** The engine on the same facts written out by hand: the close's days, the profile's level, what HR typed. */
async function engineLine(
  person: EmployeeDto,
  closing: TimesheetClosingDto,
  income: Partial<PayrollLineInput['income']>,
) {
  const row: TimesheetClosingRowDto | undefined = closing.rows.find((r) => r.employeeId === person.id);
  const profile = await flow.payroll<PayrollProfileDto>('GET', `/profiles/${person.id}`);
  const level = profile.versions[0];
  if (!row?.totals || !level) throw new Error(`${person.code} has no totals or no level`);
  const contract = contractTypeFor([], level.contractTypeId, person.id, NOVEMBER.monthKey);
  const input: PayrollLineInput = {
    employeeId: person.id,
    income: {
      norm: row.norm,
      segments: [{ days: row.totals.paid, probation: person.employment === 'probation', amounts: level.amounts }],
      kpiAmount: level.kpiAmount,
      overtime: { weekdayHours: 0, restDays: 0, holidayDays: 0 },
      ...income,
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
    person: { contract, leftOn: null, dependants: 0, hasCommitment: false },
  };
  return computeLine(input, payrollConfigFor([], person.id, NOVEMBER));
}

describe('KPI % typed by HR (spec 5.3 (19), (20); L-D08)', () => {
  it('should pay KPI × 80% and change every cell after it exactly as the engine computes', async () => {
    // Arrange
    const { a } = await hireCompany();
    const closing = await closeNovember();
    const before = await lineOf(a);

    // Act
    const saved = await putInputs(a, { kpiPercent: 0.8 });

    // Assert
    const expected = await engineLine(a, closing, { kpiPercent: 0.8 });
    const after = await lineOf(a);
    expect(before.cells.kpiBonus).toBe(0);
    expect(after.cells).toMatchObject(expected.cells);
    expect(after.cells.kpiPercent).toBe(0.8);
    expect(after.cells.kpiBonus).toBe(3_200_000);
    expect(after.cells.netPay).toBeGreaterThan(before.cells.netPay);
    expect(after.inputs).toMatchObject({ kpiPercent: 0.8, updatedBy: expect.any(String) });
    expect(saved.line?.cells).toEqual(after.cells);
    expect(saved.inputs.kpiPercent).toBe(0.8);
    expect(after.overrides).toEqual([]);
  });

  it('should mark a KPI % typed over the BO probation formula as an override, and drop it when set back to null', async () => {
    // Arrange
    const { b } = await hireCompany();
    await closeNovember();
    const computed = (await lineOf(b)).cells.kpiPercent;

    // Act
    await putInputs(b, { kpiPercent: 0.5, note: 'Đạt một nửa chỉ tiêu' });
    const typed = await lineOf(b);
    await putInputs(b, { kpiPercent: null });
    const back = await lineOf(b);

    // Assert
    expect(computed).toBeGreaterThan(0);
    expect(typed.cells.kpiPercent).toBe(0.5);
    expect(typed.overrides).toEqual([
      expect.objectContaining({ cell: 'kpiPercent', computed, typed: 0.5, reason: 'Đạt một nửa chỉ tiêu' }),
    ]);
    expect(back.cells.kpiPercent).toBe(computed);
    expect(back.overrides).toEqual([]);
    expect(back.inputs.note).toBe('Đạt một nửa chỉ tiêu');
  });

  it('L-D08: should refuse a % over 200% or below 0, and any % for someone without KPI', async () => {
    // Arrange
    const { a, c } = await hireCompany();
    await closeNovember();

    // Act
    const tooHigh = await refused(a, { kpiPercent: 2.5 }, 422);
    const negative = await refused(a, { kpiPercent: -0.05 }, 422);
    const noKpi = await refused(c, { kpiPercent: 0.8 }, 422);

    // Assert
    expect(tooHigh).toMatchObject({ fieldErrors: { kpiPercent: 'Nhập % trong khoảng 0–200%.' } });
    expect(negative).toMatchObject({ fieldErrors: { kpiPercent: 'Nhập % trong khoảng 0–200%.' } });
    expect(noKpi).toMatchObject({ fieldErrors: { kpiPercent: 'Người này không có KPI, ô % khoá.' } });
    expect(await flow.t.db.select().from(payrollMonthInputs)).toEqual([]);
  });
});

describe('overtime, rest and holiday days (spec 5.3 (21)–(23), (25); L-D09)', () => {
  it('L-D09: should pay 10 weekday hours at the engine’s 150%, keep it on a later partial save, refuse 1,3 hours', async () => {
    // Arrange
    const { a } = await hireCompany();
    const closing = await closeNovember();

    // Act
    await putInputs(a, { overtimeHours: 10 });
    await putInputs(a, { note: 'Làm thêm dự án X' });
    const odd = await refused(a, { overtimeHours: 1.3 }, 422);

    // Assert
    const line = await lineOf(a);
    const expected = await engineLine(a, closing, { overtime: { weekdayHours: 10, restDays: 0, holidayDays: 0 } });
    expect(line.cells).toMatchObject(expected.cells);
    expect(line.cells.overtimeHours).toBe(10);
    expect(line.cells.overtimePay).toBeGreaterThan(0);
    expect(line.inputs).toMatchObject({ overtimeHours: 10, note: 'Làm thêm dự án X' });
    expect(odd).toMatchObject({ fieldErrors: { overtimeHours: 'Nhập giờ theo bước 0,5.' } });
  });

  it('should pay typed rest-day and holiday days as the engine does, and list them as overrides of the close', async () => {
    // Arrange
    const { a } = await hireCompany();
    const closing = await closeNovember();

    // Act
    await putInputs(a, { restDays: 1, holidayDays: 0.5 });

    // Assert
    const line = await lineOf(a);
    const expected = await engineLine(a, closing, { overtime: { weekdayHours: 0, restDays: 1, holidayDays: 0.5 } });
    expect(line.cells).toMatchObject(expected.cells);
    expect(line.cells).toMatchObject({ restDays: 1, holidayDays: 0.5 });
    expect(line.overrides.map((o) => [o.cell, o.computed, o.typed])).toEqual([
      ['restDays', 0, 1],
      ['holidayDays', 0, 0.5],
    ]);
  });
});

describe('(24) other income and (32) one-off support, refund, advance (L-D11–L-D13)', () => {
  it('L-D11: should tax other income marked taxable, exempt the rest, and refuse it without a reason or negative', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    const before = await lineOf(a);

    // Act
    await putInputs(a, {
      otherIncome: [
        { amount: 250_000, taxable: true, reason: 'Thưởng sáng kiến' },
        { amount: 100_000, taxable: false, reason: 'Quà sinh nhật' },
      ],
    });
    const noReason = await refused(a, { otherIncome: [{ amount: 250_000, taxable: true, reason: ' ' }] }, 422);
    const negative = await refused(a, { otherIncome: [{ amount: -250_000, taxable: true, reason: 'Sai' }] }, 422);

    // Assert
    const after = await lineOf(a);
    expect(after.cells.otherIncome).toBe(before.cells.otherIncome + 350_000);
    expect(after.cells.income).toBe(before.cells.income + 350_000);
    expect(after.cells.exempt).toBe(before.cells.exempt + 100_000);
    expect(after.cells.taxable).toBe(before.cells.taxable + 250_000);
    expect(noReason.fieldErrors).toHaveProperty('otherIncome');
    expect(negative.fieldErrors).toHaveProperty('otherIncome');
    expect(after.inputs.otherIncome).toHaveLength(2);
  });

  it('L-D12, L-D13: should put one-off support in tax and cost, and refund, advance only in net pay', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    const before = await lineOf(a);

    // Act
    await putInputs(a, { cash: [{ kind: 'support', amount: 700_000, reason: 'Hỗ trợ đi công tác' }] });
    const support = await lineOf(a);
    await putInputs(a, {
      cash: [
        { kind: 'support', amount: 700_000, reason: 'Hỗ trợ đi công tác' },
        { kind: 'refund', amount: 500_000, reason: 'Hoàn tiền mua văn phòng phẩm' },
        { kind: 'advance', amount: 300_000, reason: 'Tạm ứng 10/11' },
      ],
    });
    const all = await lineOf(a);

    // Assert
    expect(support.cells.cash).toBe(700_000);
    expect(support.cells.taxable).toBe(before.cells.taxable + 700_000);
    expect(support.cells.totalCost).toBe(before.cells.totalCost + 700_000);
    expect(support.cells.income).toBe(before.cells.income);
    expect(all.cells.cash).toBe(700_000 + 500_000 - 300_000);
    expect(all.cells.taxable).toBe(support.cells.taxable);
    expect(all.cells.tax).toBe(support.cells.tax);
    expect(all.cells.totalCost).toBe(support.cells.totalCost);
    expect(all.cells.netPay).toBe(support.cells.netPay + 500_000 - 300_000);
  });
});

describe('when inputs can be saved, by whom, and the log (L-C01, L-H01, spec 11.9)', () => {
  it('should write one payroll log line with each changed field old → new, and none when nothing changes', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    await putInputs(a, { kpiPercent: 0.8 });

    // Act
    await flow.at('2026-11-27');
    await putInputs(a, { kpiPercent: 0.9, overtimeHours: 4 });
    await putInputs(a, { kpiPercent: 0.9 });

    // Assert
    const log = await flow.payroll<PayrollLogPageDto>('GET', '/log?nhom=bang-luong&ky=2026-11');
    expect(log.lines.map((l) => l.detail)).toEqual([
      'NV01 NV A: % KPI 80% → 90%; giờ làm thêm ngày thường 0 → 4',
      'NV01 NV A: % KPI trống → 80%',
    ]);
    expect(log.lines[0]).toMatchObject({ area: 'bang-luong', action: 'Sửa đầu vào tháng', month: '2026-11' });
  });

  it('should refuse inputs on an approved or paid month with 409 and store nothing', async () => {
    // Arrange
    const { a } = await hireCompany();
    await flow.at('2026-11-26');
    await approvedMonth(flow, 2026, 11);

    // Act
    const body = await refused(a, { kpiPercent: 0.8 }, 409);

    // Assert
    expect(body).toMatchObject({ code: 'payroll_month_locked' });
    expect(await flow.t.db.select().from(payrollMonthInputs)).toEqual([]);
  });

  it('L-C01: should take inputs for a month still waiting for its close and use them once it closes', async () => {
    // Arrange
    const { a } = await hireCompany();
    await flow.at('2026-11-20');

    // Act
    const saved = await putInputs(a, { kpiPercent: 0.8, cash: [{ kind: 'advance', amount: 1_000_000 }] });
    await closeNovember();

    // Assert
    const line = await lineOf(a);
    expect(saved.line).toBeNull();
    expect(line.cells.kpiBonus).toBe(3_200_000);
    expect(line.cells.cash).toBe(-1_000_000);
  });

  it('should answer 404 for someone unknown and for a month out of range', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();

    // Act
    const unknown = await flow.payroll<{ error: string }>(
      'PUT',
      '/months/2026-11/lines/00000000-0000-4000-8000-000000000000/inputs',
      { kpiPercent: 0.8 },
      404,
    );
    const outside = await flow.payroll<{ error: string }>(
      'PUT',
      `/months/2026-10/lines/${a.id}/inputs`,
      { kpiPercent: 0.8 },
      404,
    );

    // Assert
    expect(unknown.error).toBe('Không tìm thấy nhân viên.');
    expect(outside.error).toBe('Có bảng lương từ T11/2026 đến T12/2027.');
  });

  it('L-H01: should refuse HR without the payroll right with 403 and store nothing', async () => {
    // Arrange
    const { a } = await hireCompany();
    await closeNovember();
    await flow.t.db.update(hrUsers).set({ canPayroll: false, canApprovePayroll: false });

    // Act
    const body = await refused(a, { kpiPercent: 0.8 }, 403);

    // Assert
    expect(Object.keys(body).sort()).toEqual(['code', 'error', 'fieldErrors']);
    expect(await flow.t.db.select().from(payrollMonthInputs)).toEqual([]);
  });
});
