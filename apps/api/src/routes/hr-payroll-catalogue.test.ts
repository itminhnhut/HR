import {
  DEFAULT_COMPONENTS,
  type EmployeeDto,
  type PayrollLineDto,
  type PayrollMonthDto,
  type PayrollSettingSavedDto,
} from '@careers/shared';
import { asc } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { payrollLog } from '../db/schema.js';
import { addSetting, givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Thêm, đổi tên, ngừng dùng một khoản lương hoặc loại HĐ (F27): nothing is deleted; a new component is paid by its
 * flags from its month; a stopped one is gone from its month on and stays before; an approved month keeps its own.
 * Made-up people and amounts.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await givePayrollRight(flow);
});

const HAZARD = {
  id: 'pc-doc-hai',
  name: 'PC độc hại',
  order: 8,
  perDay: false,
  probationRate: false,
  insured: false,
  contractPay: false,
  overtimeBase: false,
  tax: { kind: 'taxable' },
  defaultAmount: 500_000,
  regulatedCap: null,
  stoppedFrom: null,
};

const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const logLines = async () =>
  (await flow.t.db.select().from(payrollLog).orderBy(asc(payrollLog.at), asc(payrollLog.id))).map((l) => l.detail);

async function hire(code: string, amounts: Record<string, number>): Promise<EmployeeDto> {
  const person = await flow.addPerson({
    code,
    fullName: `NV ${code}`,
    employment: 'official',
    joinedOn: '2026-01-05',
    officialOn: '2026-01-05',
    block: 'BO',
  });
  const level = { effectiveOn: '2026-01-05', contractTypeId: 'khong-thoi-han', amounts };
  await flow.payroll('POST', `/profiles/${person.id}/versions`, level, 201);
  return person;
}

async function closeNovember() {
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
}

function lineOf(month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`${person.code} is not in the month`);
  return line;
}

const addHazard = () =>
  addSetting(flow, { key: 'khoan.danh-sach', from: '2026-11', value: [...DEFAULT_COMPONENTS, HAZARD] });

describe('a pay component HR adds', () => {
  it('should be paid and counted in Gross, but stay out of the insurance salary when "tính BH" is off', async () => {
    // Arrange
    await addHazard();
    const person = await hire('NV41', { luong: 12_000_000, 'pc-doc-hai': 500_000 });
    await closeNovember();

    // Act
    const month = await monthOf('2026-11');

    // Assert
    const line = lineOf(month, person);
    expect(month.components.at(-1)).toEqual({ id: 'pc-doc-hai', name: 'PC độc hại' });
    expect(line.amounts['pc-doc-hai']).toBe(500_000);
    expect(line.cells.gross).toBe(12_500_000);
    // Not divided by the days worked ("chia theo ngày công" off): paid in full whatever the days.
    expect(line.sheet?.paid['pc-doc-hai']).toBe(500_000);
    expect(line.cells.socialBase).toBe(12_000_000);
    expect(await logLines()).toEqual(expect.arrayContaining([expect.stringContaining('PC độc hại')]));
  });

  it('should be gone from the month it is stopped from, and stay in the months before', async () => {
    // Arrange
    await addHazard();
    const person = await hire('NV42', { luong: 12_000_000, 'pc-doc-hai': 500_000 });
    await closeNovember();

    // Act
    const stopped = await addSetting(flow, { key: 'khoan.pc-doc-hai.ngung', from: '2026-12', value: '2026-12' });
    const november = await monthOf('2026-11');
    const december = await monthOf('2026-12');

    // Assert: still in use by one person, said in yellow and not blocked.
    expect((stopped as PayrollSettingSavedDto).warnings).toContain('Còn 1 người đang có khoản này.');
    expect(november.components.map((c) => c.id)).toContain('pc-doc-hai');
    expect(lineOf(november, person).cells.gross).toBe(12_500_000);
    expect(december.components.map((c) => c.id)).not.toContain('pc-doc-hai');
  });

  it('should leave an approved month as it was approved when the component is renamed and stopped after', async () => {
    // Arrange
    await addHazard();
    const person = await hire('NV43', { luong: 12_000_000, 'pc-doc-hai': 500_000 });
    await closeNovember();
    const approved = await flow.payroll<PayrollMonthDto>('POST', '/months/2026-11/approve', { acknowledgedRed: true });

    // Act
    await addSetting(flow, { key: 'khoan.pc-doc-hai.ten', from: '2026-12', value: 'PC nặng nhọc' });
    await addSetting(flow, { key: 'khoan.pc-doc-hai.ngung', from: '2026-12', value: '2026-12' });
    const month = await monthOf('2026-11');

    // Assert
    expect(month.status).toBe('approved');
    expect(month.components).toEqual(approved.components);
    expect(lineOf(month, person)).toEqual(lineOf(approved, person));
  });
});

describe('a contract type HR stops using', () => {
  it('should keep paying the people on it, mark it stopped for new levels and say how many are on it', async () => {
    // Arrange
    const person = await hire('NV44', { luong: 12_000_000 });
    await closeNovember();

    // Act
    const stopped = await addSetting(flow, { key: 'loai-hd.khong-thoi-han.ngung', from: '2026-11', value: '2026-11' });
    const month = await monthOf('2026-11');

    // Assert
    expect((stopped as PayrollSettingSavedDto).warnings).toContain('Còn 1 người đang ở loại HĐ này.');
    expect(lineOf(month, person).contractTypeId).toBe('khong-thoi-han');
    expect(lineOf(month, person).cells.gross).toBe(12_000_000);
    expect(month.contractTypes.find((t) => t.id === 'khong-thoi-han')).toMatchObject({ stopped: true });
    expect(month.contractTypes.find((t) => t.id === '12-thang')?.stopped).toBeUndefined();
  });
});
