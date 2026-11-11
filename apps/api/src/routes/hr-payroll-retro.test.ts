import type {
  EmployeeDto,
  PayrollLineDto,
  PayrollLogPageDto,
  PayrollMonthDto,
  PayrollMonthInputsResultDto,
  PayrollRetroItemDto,
} from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Truy lĩnh / truy thu (spec-luong.md R6 (a), 11.4, step 17; docs/test-cases-luong.md L-M08, L-E05): an approved month
 * never changes; what it would compute differently now goes to the next open month, per person, as the difference
 * between the month computed again and its approval. A made-up company: NV A on 30.000.000 with one dependant, NV B
 * on 9.000.000. T11/2026 is approved, T12/2026 is the draft that receives.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const approve = (key: string) =>
  flow.payroll<PayrollMonthDto>('POST', `/months/${key}/approve`, { acknowledgedRed: true });
const typeInputs = (key: string, person: EmployeeDto, body: Record<string, unknown>, expected = 200) =>
  flow.payroll<PayrollMonthInputsResultDto>('PUT', `/months/${key}/lines/${person.id}/inputs`, body, expected);

function lineOf(month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`No line of ${person.code} in ${month.monthKey}`);
  return line;
}

const retroOf = (month: PayrollMonthDto, person: EmployeeDto): PayrollRetroItemDto[] =>
  (month.retro ?? []).filter((r) => r.employeeId === person.id);

function onlyRetro(month: PayrollMonthDto, person: EmployeeDto): PayrollRetroItemDto {
  const [item, ...more] = retroOf(month, person);
  if (!item || more.length > 0) throw new Error(`Expected one adjustment of ${person.code} in ${month.monthKey}`);
  return item;
}

const LEVEL = { contractTypeId: 'khong-thoi-han' };

interface Company {
  a: EmployeeDto;
  b: EmployeeDto;
  november: PayrollMonthDto;
  /** NV A's dependant, from T01/2026 on. */
  dependantId: string;
}

/** T11/2026 approved, the timesheet of T12/2026 closed. */
async function approvedNovember(): Promise<Company> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  const b = await flow.addPerson({ code: 'NV02', fullName: 'NV B', joinedOn: '2025-03-01' });
  const levelA = { ...LEVEL, effectiveOn: '2025-03-01', amounts: { luong: 30_000_000, com: 1_100_000 } };
  const levelB = { ...LEVEL, effectiveOn: '2025-03-01', amounts: { luong: 9_000_000, com: 1_100_000 } };
  await flow.payroll('POST', `/profiles/${a.id}/versions`, levelA, 201);
  await flow.payroll('POST', `/profiles/${b.id}/versions`, levelB, 201);
  const dependant = await flow.payroll<{ id: string }>(
    'POST',
    `/profiles/${a.id}/dependants`,
    { fromMonth: '2026-01', count: 1 },
    201,
  );
  await flow.at('2026-11-26');
  await flow.close(2026, 11);
  const november = await approve('2026-11');
  await flow.at('2026-12-26');
  await flow.close(2026, 12);
  return { a, b, november, dependantId: dependant.id };
}

/** A raise of NV B dated on the first day of the November period, entered after November was approved. */
const raiseB = (b: EmployeeDto, luong = 12_000_000, effectiveOn = '2026-10-26') =>
  flow.payroll(
    'POST',
    `/profiles/${b.id}/versions`,
    { ...LEVEL, effectiveOn, amounts: { luong, com: 1_100_000 } },
    201,
  );

const numbers = (m: PayrollMonthDto) => ({ lines: m.lines, totals: m.totals, review: m.review });

describe('L-M08 a raise dated inside an approved month', () => {
  it('should add the difference of that month to the next draft month, and leave the approved month alone', async () => {
    // Arrange
    const { a, b, november } = await approvedNovember();
    const before = await monthOf('2026-12');

    // Act
    await raiseB(b);
    const december = await monthOf('2026-12');
    const novemberNow = await monthOf('2026-11');

    // Assert
    const item = onlyRetro(december, b);
    expect(retroOf(before, b)).toEqual([]);
    expect(retroOf(december, a)).toEqual([]);
    expect(item).toMatchObject({ origin: '2026-11', code: 'NV02', typed: null, placed: true });
    expect(item.computed).toBeGreaterThan(2_000_000);
    expect(item.amount).toBe(item.computed);
    expect(item.cells.netPay).toBe(item.computed);
    expect(item.cells.income).toBeGreaterThan(2_500_000);
    expect(numbers(novemberNow)).toEqual(numbers(november));
    expect(novemberNow.retroOut).toEqual({ month: '2026-12', people: 1, net: item.computed });
    expect(november.retroOut ?? null).toBeNull();
  });

  it('should carry every cell of the difference, so the row and the totals still add up', async () => {
    // Arrange
    const { b } = await approvedNovember();
    await raiseB(b);

    // Act
    const december = await monthOf('2026-12');
    const without = (await typeInputs('2026-12', b, { retro: [{ origin: '2026-11', amount: 0, reason: 'Thử' }] })).line;

    // Assert
    const item = onlyRetro(december, b);
    const { cells } = lineOf(december, b);
    expect(cells.netPay - (without?.cells.netPay ?? 0)).toBe(item.computed);
    expect(cells.income - (without?.cells.income ?? 0)).toBe(item.cells.income);
    expect(cells.social - (without?.cells.social ?? 0)).toBe(item.cells.social);
    expect(cells.netPay).toBe(cells.income - cells.totalDeductions + cells.cash);
    expect(december.totals.netPay).toBe(december.lines.reduce((sum, l) => sum + l.cells.netPay, 0));
    expect(lineOf(december, b).note).toMatch(/Truy lĩnh T11\/2026/);
  });

  it('should say so in Rà soát, with what changed, who and when', async () => {
    // Arrange
    const { b } = await approvedNovember();

    // Act
    await raiseB(b);
    const december = await monthOf('2026-12');

    // Assert
    const notice = december.review.find((i) => i.code === 'retro-carried');
    expect(notice).toMatchObject({ level: 'yellow', message: 'Có truy lĩnh/truy thu từ tháng 11' });
    const [cause] = onlyRetro(december, b).causes;
    expect(cause).toMatchObject({ area: 'ho-so', by: 'Lan', at: '2026-12-26T03:00:00.000Z' });
    expect(cause?.detail).toMatch(/NV02/);
  });
});

describe('L-M08 a dependant taken away in an approved month', () => {
  it('should take the tax of that month back from the next draft month', async () => {
    // Arrange
    const { a, dependantId } = await approvedNovember();

    // Act: the dependant ends with the pays of November, so the pay of T11/2026 (05/12) has none
    const ended = { fromMonth: '2026-01', toMonth: '2026-11', count: 1 };
    await flow.payroll('PUT', `/profiles/${a.id}/dependants/${dependantId}`, ended);
    const december = await monthOf('2026-12');

    // Assert
    const item = onlyRetro(december, a);
    expect(item.computed).toBeLessThan(0);
    expect(item.cells.tax).toBe(-item.computed);
    expect(item.cells.dependantDeduction).toBeLessThan(0);
    expect(item.cells.income).toBeUndefined();
  });
});

describe('L-M09 HR leaves an adjustment out or types over it', () => {
  it('should pay nothing of an adjustment HR left out, and write it to the log', async () => {
    // Arrange
    const { b } = await approvedNovember();
    await raiseB(b);
    const computed = onlyRetro(await monthOf('2026-12'), b).computed;

    // Act
    const noReason = await typeInputs('2026-12', b, { retro: [{ origin: '2026-11', amount: 0, reason: ' ' }] }, 422);
    await typeInputs('2026-12', b, { retro: [{ origin: '2026-11', amount: 0, reason: 'Đã trả tay tháng 11' }] });
    const december = await monthOf('2026-12');

    // Assert
    expect(noReason).toMatchObject({ fieldErrors: expect.any(Object) });
    expect(onlyRetro(december, b)).toMatchObject({ computed, typed: 0, amount: 0, reason: 'Đã trả tay tháng 11' });
    expect(lineOf(december, b).note).not.toMatch(/Truy lĩnh/);
    expect(december.review.find((i) => i.code === 'retro-typed')).toMatchObject({ level: 'yellow', employeeId: b.id });
    const log = await flow.payroll<PayrollLogPageDto>('GET', '/log?ky=2026-12&nhom=bang-luong');
    expect(log.lines[0]?.detail).toMatch(/NV02.*truy lĩnh \/ truy thu.*T11\/2026.*Đã trả tay tháng 11/);
  });

  it('should pay the amount HR typed in place of the computed one, outside tax and insurance', async () => {
    // Arrange
    const { b } = await approvedNovember();
    await raiseB(b);
    const left = { retro: [{ origin: '2026-11', amount: 0, reason: 'Thử' }] };
    const without = (await typeInputs('2026-12', b, left)).line;

    // Act
    const typed = { retro: [{ origin: '2026-11', amount: 1_000_000, reason: 'Thoả thuận' }] };
    const { line } = await typeInputs('2026-12', b, typed);
    const back = await typeInputs('2026-12', b, { retro: [] });

    // Assert
    expect((line?.cells.netPay ?? 0) - (without?.cells.netPay ?? 0)).toBe(1_000_000);
    expect((line?.cells.cash ?? 0) - (without?.cells.cash ?? 0)).toBe(1_000_000);
    expect(line?.cells.taxable).toBe(without?.cells.taxable);
    expect(back.inputs.retro).toEqual([]);
    expect((back.line?.cells.netPay ?? 0) - (without?.cells.netPay ?? 0)).toBeGreaterThan(2_000_000);
  });
});

describe('C03 a truy lĩnh / truy thu HR adds by hand', () => {
  it('should pay an amount for a month the web computed no difference for, outside tax and insurance', async () => {
    // Arrange: nothing changed after November was approved, so December carries nothing by itself.
    const { b } = await approvedNovember();
    const before = lineOf(await monthOf('2026-12'), b);

    // Act
    const noReason = await typeInputs(
      '2026-12',
      b,
      { retro: [{ origin: '2026-10', amount: 500_000, reason: '' }] },
      422,
    );
    await typeInputs('2026-12', b, { retro: [{ origin: '2026-10', amount: 500_000, reason: 'Bù lương tháng 10' }] });
    const december = await monthOf('2026-12');

    // Assert
    const line = lineOf(december, b);
    expect(noReason).toMatchObject({ fieldErrors: expect.any(Object) });
    expect(onlyRetro(december, b)).toMatchObject({
      origin: '2026-10',
      computed: 0,
      typed: 500_000,
      amount: 500_000,
      placed: true,
      reason: 'Bù lương tháng 10',
      cells: {},
    });
    expect(line.cells.netPay - before.cells.netPay).toBe(500_000);
    expect(line.cells.cash - before.cells.cash).toBe(500_000);
    expect([line.cells.taxable, line.cells.socialBase]).toEqual([before.cells.taxable, before.cells.socialBase]);
    expect(line.retroNet).toBe(500_000);
    expect(december.review.find((i) => i.code === 'retro-typed')).toMatchObject({ level: 'yellow', employeeId: b.id });
    const log = await flow.payroll<PayrollLogPageDto>('GET', '/log?ky=2026-12&nhom=bang-luong');
    expect(log.lines[0]?.detail).toMatch(/NV02.*truy lĩnh \/ truy thu.*T10\/2026.*Bù lương tháng 10/);
  });

  it('should take money back with a negative amount, and go when the line is removed', async () => {
    // Arrange
    const { b } = await approvedNovember();
    const before = lineOf(await monthOf('2026-12'), b);

    // Act
    const taken = await typeInputs('2026-12', b, {
      retro: [{ origin: '2026-09', amount: -200_000, reason: 'Thu lại tạm ứng thừa' }],
    });
    const back = await typeInputs('2026-12', b, { retro: [] });

    // Assert
    expect((taken.line?.cells.netPay ?? 0) - before.cells.netPay).toBe(-200_000);
    expect(back.line?.cells.netPay).toBe(before.cells.netPay);
    expect(retroOf(await monthOf('2026-12'), b)).toEqual([]);
  });
});

describe('L-M08 once the receiving month is approved', () => {
  it('should keep the adjustment in its approval and not propose it again', async () => {
    // Arrange
    const { b } = await approvedNovember();
    await raiseB(b);
    const draft = await monthOf('2026-12');

    // Act
    const december = await approve('2026-12');
    await flow.at('2027-01-26');
    await flow.close(2027, 1);
    const january = await monthOf('2027-01');

    // Assert
    expect(december.retro).toEqual(draft.retro);
    expect(lineOf(december, b).cells).toEqual(lineOf(draft, b).cells);
    expect(january.retro ?? []).toEqual([]);
    expect((await monthOf('2026-11')).retroOut ?? null).toBeNull();
    expect((await monthOf('2026-12')).retroOut ?? null).toBeNull();
  });

  it('should carry only what changed since, when the earlier month changes once more', async () => {
    // Arrange
    const { b } = await approvedNovember();
    await raiseB(b);
    const first = onlyRetro(await approve('2026-12'), b).computed;
    await flow.at('2027-01-26');
    await flow.close(2027, 1);

    // Act: one more raise from 01/11, in force for most of November and all of December
    await raiseB(b, 13_000_000, '2026-11-01');
    const january = await monthOf('2027-01');

    // Assert
    const items = retroOf(january, b);
    expect(items.map((i) => i.origin)).toEqual(['2026-11', '2026-12']);
    expect(items[0]?.computed).toBeGreaterThan(0);
    expect(items[0]?.computed).toBeLessThan(first);
    expect(january.review.filter((i) => i.code === 'retro-carried').map((i) => i.message)).toEqual([
      'Có truy lĩnh/truy thu từ tháng 11',
      'Có truy lĩnh/truy thu từ tháng 12',
    ]);
  });
});
