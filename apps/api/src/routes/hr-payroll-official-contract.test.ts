import type { EmployeeDto, PayrollLineDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Becoming official mid-period with only a probation level (spec-luong.md 5.6, 17.1 câu 9, 23; BLLĐ Đ.27 k1): from the
 * official date the person is on a labour contract, so insurance (Luật BHXH 2024 Đ.2 k1 a, the 14-day rule BH-1) and
 * tax (NĐ 253 Đ.50 k2: HĐLĐ từ 3 tháng lũy tiến) follow the default official contract until HR picks one.
 * A made-up company in November 2026 (period 26/10–25/11, insurance month 11/2026).
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const WARNING = 'Chưa chọn loại HĐ chính thức — đang dùng mặc định HĐLĐ không xác định thời hạn';
const AMOUNTS = { luong: 12_000_000, com: 1_100_000 };

async function hireOnProbation(code: string, officialOn: string | null): Promise<EmployeeDto> {
  const person = await flow.addPerson({
    code,
    fullName: `NV ${code}`,
    employment: 'probation',
    joinedOn: '2026-09-04',
    officialOn,
  });
  const level = { effectiveOn: '2026-09-04', contractTypeId: 'thu-viec', amounts: AMOUNTS };
  await flow.payroll('POST', `/profiles/${person.id}/versions`, level, 201);
  return person;
}

async function closedNovember(): Promise<PayrollMonthDto> {
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
  return flow.payroll<PayrollMonthDto>('GET', '/months/2026-11');
}

function lineOf(month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`${person.code} is not in the month`);
  return line;
}

const warningsOf = (month: PayrollMonthDto, person: EmployeeDto) =>
  month.review.filter((i) => i.code === 'default-official-contract' && i.employeeId === person.id);

describe('official mid-period with only a probation level', () => {
  it('should insure and tax by the default official contract from the official date, and warn HR once', async () => {
    // Arrange: official on day 10 of the period (04/11: 2 working days of November before it)
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV21', '2026-11-04');

    // Act
    const month = await closedNovember();

    // Assert
    const line = lineOf(month, person);
    expect(line.contractTypeId).toBe('khong-thoi-han');
    expect(line.probation).toBe(false);
    expect(line.cells.social).toBeGreaterThan(0);
    expect(line.cells.unemployment).toBeGreaterThan(0);
    expect(line.note).not.toContain('10%');
    expect(line.amounts.luong).toBeGreaterThan(0);
    expect(warningsOf(month, person)).toEqual([
      { level: 'yellow', code: 'default-official-contract', employeeId: person.id, cell: null, message: WARNING },
    ]);
  });

  it('should leave insurance off when 14 working days of the month fall before the official date', async () => {
    // Arrange: official on 20/11, Mon–Fri 02/11–19/11 = 14 working days outside an insured contract
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV22', '2026-11-20');

    // Act
    const month = await closedNovember();

    // Assert
    const line = lineOf(month, person);
    expect(line.contractTypeId).toBe('khong-thoi-han');
    expect(line.cells.social).toBe(0);
    expect(line.cells.unemployment).toBe(0);
    expect([line.cells.socialBase, line.cells.health, line.cells.companyHealth]).toEqual([0, 0, 0]);
    expect(line.note).not.toContain('10%');
    expect(warningsOf(month, person)).toHaveLength(1);
  });

  it('should insure nothing, BHYT and (27) included, when official on the day after the period ends', async () => {
    // Arrange: official on 26/11, so Mon–Fri 02/11–25/11 = 18 working days of November before the labour contract
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV25', '2026-11-26');

    // Act
    const month = await closedNovember();

    // Assert: still the probation contract for the period (10%), and no fund for November
    const line = lineOf(month, person);
    expect(line.contractTypeId).toBe('thu-viec');
    expect(line.probation).toBe(true);
    const { socialBase, social, health, unemployment, companyHealth, companyTotal } = line.cells;
    expect({ socialBase, social, health, unemployment, companyHealth, companyTotal }).toEqual({
      socialBase: 0,
      social: 0,
      health: 0,
      unemployment: 0,
      companyHealth: 0,
      companyTotal: 0,
    });
    expect(line.note).toContain('tăng mới từ tháng sau');
    const provisional = month.review.filter((i) => i.code === 'insurance-provisional' && i.employeeId === person.id);
    expect(provisional).toEqual([]);
  });

  it('should use the official level HR added from the official date, without a warning', async () => {
    // Arrange
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV23', '2026-11-04');
    const official = { effectiveOn: '2026-11-04', contractTypeId: '12-thang', amounts: AMOUNTS };
    await flow.payroll('POST', `/profiles/${person.id}/versions`, official, 201);

    // Act
    const month = await closedNovember();

    // Assert
    const line = lineOf(month, person);
    expect(line.contractTypeId).toBe('12-thang');
    expect(line.cells.social).toBeGreaterThan(0);
    expect(warningsOf(month, person)).toEqual([]);
  });

  it('should keep someone never made official on the probation contract: no insurance, its commitment, no warning', async () => {
    // Arrange
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV24', null);

    // Act
    const month = await closedNovember();

    // Assert
    const line = lineOf(month, person);
    expect(line.contractTypeId).toBe('thu-viec');
    expect(line.probation).toBe(true);
    expect(line.cells.social).toBe(0);
    expect(line.note).toContain('Cam kết theo hợp đồng');
    expect(warningsOf(month, person)).toEqual([]);
  });
});
