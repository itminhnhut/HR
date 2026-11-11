import type { EmployeeDto, PayrollLineDto, PayrollMonthDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { givePayrollRight } from '../test/payroll-flow.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Số cộng dồn năm thuế (spec-luong.md R9, 5.3 (33), câu 2, 29, 34; rà soát BA L1): the yearly figures the engine
 * reads for a month are the opening balance plus the earlier pay months of the same tax year: the approved snapshot
 * of a month, or its live draft with a yellow notice. A made-up company: NV A, clothing pay 3.000.000 a month, paid by the day (so a month pays a little under it).
 * T12/2026, T01/2027 and T02/2027 are paid in 2027 (one tax year); T11/2026 is paid in December 2026 (the year before).
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const CLOTHING = 3_000_000;
const CAP = 5_000_000;
const monthOf = (key: string) => flow.payroll<PayrollMonthDto>('GET', `/months/${key}`);
const approve = (key: string) =>
  flow.payroll<PayrollMonthDto>('POST', `/months/${key}/approve`, { acknowledgedRed: true });

function lineOf(month: PayrollMonthDto, person: EmployeeDto): PayrollLineDto {
  const line = month.lines.find((l) => l.employeeId === person.id);
  if (!line) throw new Error(`No line of ${person.code} in ${month.monthKey}`);
  return line;
}

const yearOf = (month: PayrollMonthDto, person: EmployeeDto) => {
  const { year } = lineOf(month, person);
  if (!year) throw new Error(`No yearly figures on the line of ${month.monthKey}`);
  return year;
};

async function hire(): Promise<EmployeeDto> {
  await givePayrollRight(flow);
  const a = await flow.addPerson({ code: 'NV01', fullName: 'NV A', joinedOn: '2025-03-01' });
  const amounts = { luong: 9_000_000, com: 1_100_000, 'trang-phuc': CLOTHING };
  await flow.payroll(
    'POST',
    `/profiles/${a.id}/versions`,
    { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts },
    201,
  );
  return a;
}

async function close(year: number, month: number) {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  await flow.at(`${year}-${String(month).padStart(2, '0')}-26`);
  await flow.close(year, month);
  return next;
}

const notices = (month: PayrollMonthDto) => month.review.filter((i) => i.code === 'year-open-month');

describe('L1 clothing cap over the months of one tax year', () => {
  it('should exempt nothing of the clothing pay in month 3 when the cap is reached in month 2', async () => {
    // Arrange
    const a = await hire();
    await flow.payroll('PUT', `/profiles/${a.id}/opening/2027`, { clothingPaid: 500_000 });
    await close(2026, 11);
    await approve('2026-11');
    await close(2026, 12);
    const december = await approve('2026-12');
    await close(2027, 1);
    const january = await approve('2027-01');
    await close(2027, 2);

    // Act
    const february = await monthOf('2027-02');

    // Assert: 500.000 opening + all of T12 + what is left of the cap in T01 = 5.000.000
    const paidInDecember = yearOf(december, a).month.clothingExempt;
    expect(paidInDecember).toBeGreaterThan(2_500_000);
    expect(yearOf(january, a).before.clothingExempt).toBe(500_000 + paidInDecember);
    expect(yearOf(january, a).month.clothingExempt).toBe(CAP - 500_000 - paidInDecember);
    expect(january.review.some((i) => i.code === 'clothing-cap')).toBe(true);
    expect(yearOf(february, a).before.clothingExempt).toBe(CAP);
    expect(yearOf(february, a).month.clothingExempt).toBe(0);
    expect(lineOf(december, a).cells.exempt - lineOf(february, a).cells.exempt).toBeGreaterThan(2_000_000);
    expect(notices(february)).toEqual([]);
  });

  it('should not count a month paid in the tax year before', async () => {
    // Arrange
    const a = await hire();
    await close(2026, 11);
    await approve('2026-11');
    await close(2026, 12);

    // Act
    const december = await monthOf('2026-12');

    // Assert: T11/2026 is paid on 05/12/2026, T12/2026 on 05/01/2027
    expect(yearOf(december, a).before).toMatchObject({ clothingExempt: 0, taxable: 0, tax: 0, overtimeHours: 0 });
  });
});

describe('L1 a month of the year still in draft', () => {
  it('should read the draft of the earlier month and say so in a yellow notice', async () => {
    // Arrange
    const a = await hire();
    await close(2026, 11);
    await approve('2026-11');
    await close(2026, 12);
    await approve('2026-12');
    await close(2027, 1);
    await close(2027, 2);

    // Act
    const february = await monthOf('2027-02');

    // Assert
    expect(yearOf(february, a).before.clothingExempt).toBe(CAP);
    expect(yearOf(february, a).month.clothingExempt).toBe(0);
    expect(notices(february)).toMatchObject([
      { level: 'yellow', message: 'Tháng 01 chưa duyệt — số cộng dồn năm đang lấy bản nháp' },
    ]);
  });

  it('should read the approved numbers of a month, not what its profile says afterwards', async () => {
    // Arrange
    const a = await hire();
    await close(2026, 11);
    await approve('2026-11');
    await close(2026, 12);
    const december = await approve('2026-12');
    const cut = { luong: 9_000_000, com: 1_100_000, 'trang-phuc': 100_000 };
    const body = { effectiveOn: '2025-03-01', contractTypeId: 'khong-thoi-han', amounts: cut };
    await flow.payroll('POST', `/profiles/${a.id}/versions`, { ...body, effectiveOn: '2026-11-26' }, 201);
    await close(2027, 1);

    // Act
    const january = await monthOf('2027-01');

    // Assert
    expect(yearOf(january, a).before.clothingExempt).toBe(yearOf(december, a).month.clothingExempt);
    expect(yearOf(january, a).before.clothingExempt).toBeGreaterThan(2_500_000);
    expect(yearOf(january, a).month.clothingExempt).toBeLessThanOrEqual(100_000);
  });
});

describe('L1 opening balance plus the months on the web', () => {
  it('should add the opening balance and every earlier month of the tax year', async () => {
    // Arrange
    const a = await hire();
    const opening = { taxableIncome: 40_000_000, taxWithheld: 1_200_000, overtimeHours: 30, clothingPaid: 500_000 };
    await flow.payroll('PUT', `/profiles/${a.id}/opening/2027`, opening);
    await close(2026, 11);
    await approve('2026-11');
    await close(2026, 12);
    await flow.payroll('PUT', `/months/2026-12/lines/${a.id}/inputs`, { overtimeHours: 6 });
    const december = await approve('2026-12');
    await close(2027, 1);
    await flow.payroll('PUT', `/months/2027-01/lines/${a.id}/inputs`, { overtimeHours: 4.5 });
    const january = await approve('2027-01');
    await close(2027, 2);

    // Act
    const february = await monthOf('2027-02');

    // Assert
    const dec = lineOf(december, a).cells;
    const jan = lineOf(january, a).cells;
    expect(yearOf(december, a).before).toEqual({
      clothingExempt: 500_000,
      overtimeHours: 30,
      taxable: 40_000_000,
      tax: 1_200_000,
      insurance: 0,
    });
    expect(yearOf(december, a).month).toEqual({
      clothingExempt: yearOf(december, a).month.clothingExempt,
      overtimeHours: 6,
      taxable: dec.taxable,
      tax: dec.tax,
      insurance: dec.insuranceDeduction,
    });
    expect(yearOf(february, a).before).toEqual({
      clothingExempt: CAP,
      overtimeHours: 40.5,
      taxable: 40_000_000 + dec.taxable + jan.taxable,
      tax: 1_200_000 + dec.tax + jan.tax,
      insurance: dec.insuranceDeduction + jan.insuranceDeduction,
    });
  });
});
