import type { EmployeeDto, PayrollLineDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Khối of a draft month (spec-luong.md 5.3 (19), 10.1, 11.3): the close keeps the block as of the close; a close made
 * before HR gave the person a block has none, and a draft then reads the person's block of today, so HR does not have
 * to reopen the timesheet. A block the close has wins over a later change; an approved month keeps its snapshot.
 * A made-up company in November 2026.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const BLOCK_NOTE = 'Khối lấy từ hồ sơ nhân viên';
const AMOUNTS = { luong: 12_000_000, com: 1_100_000 };

const monthOf = () => flow.payroll<PayrollMonthDto>('GET', '/months/2026-11');

async function hireOnProbation(code: string, block: 'BO' | 'KD' | null): Promise<EmployeeDto> {
  const person = await flow.addPerson({
    code,
    fullName: `NV ${code}`,
    employment: 'probation',
    joinedOn: '2026-09-04',
    block,
  });
  const level = { effectiveOn: '2026-09-04', contractTypeId: 'thu-viec', amounts: AMOUNTS };
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

const missingBlock = (month: PayrollMonthDto, person: EmployeeDto) =>
  month.review.filter((i) => i.code === 'missing-block' && i.employeeId === person.id);

describe('Khối of a draft month', () => {
  it('should warn "Thiếu khối" while neither the close nor the person has a block', async () => {
    // Arrange
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV31', null);
    await closeNovember();

    // Act
    const month = await monthOf();

    // Assert
    expect(lineOf(month, person).block).toBeNull();
    expect(missingBlock(month, person)).toHaveLength(1);
    expect(lineOf(month, person).blockFromPerson).toBeUndefined();
  });

  it('should read the block HR gave the person after the close: BO probation gets the formula %', async () => {
    // Arrange: closed without a block, then HR sets BO in Chấm công › Nhân viên
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV32', null);
    await closeNovember();
    const before = lineOf(await monthOf(), person);
    await flow.updatePerson(person, { block: 'BO' });

    // Act
    const month = await monthOf();

    // Assert: paid ÷ norm × the probation rate, where the KD rule gave 0%
    const line = lineOf(month, person);
    expect(before.cells.kpiPercent).toBe(0);
    expect(line.block).toBe('BO');
    expect(missingBlock(month, person)).toEqual([]);
    expect(line.cells.kpiPercent).toBeGreaterThan(0);
    expect(line.cells.kpiPercent).toBeLessThan(1);
    // F19: said on the row's own mark and once for the month in Rà soát, never in the note Excel and payslips print.
    expect(line.blockFromPerson).toBe(true);
    expect(line.note).not.toContain(BLOCK_NOTE);
    expect(month.review.filter((r) => r.code === 'block-from-person')).toEqual([
      {
        level: 'yellow',
        code: 'block-from-person',
        employeeId: null,
        cell: null,
        message: 'Lần chốt công này chưa ghi khối: đang dùng khối hiện tại ở Chấm công › Nhân viên.',
      },
    ]);
  });

  it('should keep the block of the close when HR changes the person afterwards', async () => {
    // Arrange
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV33', 'KD');
    await closeNovember();
    await flow.updatePerson(person, { block: 'BO' });

    // Act
    const line = lineOf(await monthOf(), person);

    // Assert
    expect(line.block).toBe('KD');
    expect(line.cells.kpiPercent).toBe(0);
    expect(line.blockFromPerson).toBeUndefined();
  });

  it('should keep the approved snapshot when the block changes after approval', async () => {
    // Arrange: approved with the person's block of that day
    await givePayrollRight(flow);
    const person = await hireOnProbation('NV34', null);
    await closeNovember();
    const withBlock = await flow.updatePerson(person, { block: 'BO' });
    const approved = await flow.payroll<PayrollMonthDto>('POST', '/months/2026-11/approve', { acknowledgedRed: true });

    // Act
    await flow.updatePerson(withBlock, { block: 'KD' });
    const month = await monthOf();

    // Assert
    expect(month.status).toBe('approved');
    expect(lineOf(month, person)).toEqual(lineOf(approved, person));
    expect(lineOf(month, person).block).toBe('BO');
  });
});
