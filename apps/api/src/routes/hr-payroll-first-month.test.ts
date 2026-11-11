import type { PayrollFirstMonthCheckDto, TimesheetClosingDto, TimesheetDto } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers, payrollLog, timesheetClosings, timesheetPeriods } from '../db/schema.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Danh sách kiểm trước tháng lương đầu (spec-luong.md 17.2, 4.21; docs/test-cases-luong.md L-L30): a close made before
 * closes were kept, e.g. by a script under an HR name, is checked by HR in Lương before the first payroll month.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const closingsOf = (dto: Pick<TimesheetDto, 'periodId'>) =>
  flow.call<TimesheetClosingDto[]>('GET', `/${dto.periodId}/closings`);

const givePayrollRight = () => flow.t.db.update(hrUsers).set({ canPayroll: true, canApprovePayroll: true });

/** September, closed before closes were kept: the migration made it close number 1, from its snapshot. */
async function backfilledSeptember() {
  const closedAt = new Date('2026-09-26T03:00:00Z');
  const range = { year: 2026, month: 9, fromOn: '2026-08-26', toOn: '2026-09-25' };
  const [period] = await flow.t.db
    .insert(timesheetPeriods)
    .values({ ...range, status: 'closed', closedBy: 'Lan', closedAt })
    .returning();
  if (!period) throw new Error('No period');
  const [closing] = await flow.t.db
    .insert(timesheetClosings)
    .values({
      ...range,
      periodId: period.id,
      closeNo: 1,
      closedAt,
      closedBy: 'Lan',
      source: 'backfill',
      holidays: [],
      regions: [],
      norms: {},
    })
    .returning();
  if (!closing) throw new Error('No closing');
  return { period, closing };
}

describe('L-L30 a close made before closes were kept', () => {
  it('L-L30: should tell a backfilled close from one made on the web', async () => {
    // Arrange
    await flow.at('2026-10-20');
    await flow.addPerson({ code: 'NV04' });
    const { period } = await backfilledSeptember();
    await flow.at('2026-10-26');

    // Act
    const october = await flow.close(2026, 10);

    // Assert
    expect((await closingsOf({ periodId: period.id })).map((c) => c.source)).toEqual(['backfill']);
    expect((await closingsOf(october)).map((c) => c.source)).toEqual(['web']);
  });

  it('L-L30: should record that HR checked the close, by whom and when, and log it once', async () => {
    // Arrange
    await flow.at('2026-10-20');
    await givePayrollRight();
    const { closing } = await backfilledSeptember();
    const body = { item: 'lan-chot-ky-cong', closingId: closing.id, confirmed: true };

    // Act
    await flow.payroll('PUT', '/first-month-checks', body);
    const again = await flow.payroll<PayrollFirstMonthCheckDto[]>('PUT', '/first-month-checks', body);

    // Assert
    expect(again).toEqual([
      expect.objectContaining({
        item: 'lan-chot-ky-cong',
        employeeId: null,
        closingId: closing.id,
        confirmed: true,
        confirmedBy: 'Lan',
        confirmedAt: '2026-10-20T03:00:00.000Z',
      }),
    ]);
    const lines = await flow.t.db.select().from(payrollLog);
    expect(lines.map((l) => [l.area, l.action, l.detail, l.month])).toEqual([
      ['cham-cong', 'Xác nhận lần chốt kỳ công', 'Tháng 9/2026, lần chốt 1', '2026-09'],
    ]);
  });

  it('L-L30: should let HR take the check back, and log that too', async () => {
    // Arrange
    await flow.at('2026-10-20');
    await givePayrollRight();
    const { closing } = await backfilledSeptember();
    await flow.payroll('PUT', '/first-month-checks', {
      item: 'lan-chot-ky-cong',
      closingId: closing.id,
      confirmed: true,
    });

    // Act
    const checks = await flow.payroll<PayrollFirstMonthCheckDto[]>('PUT', '/first-month-checks', {
      item: 'lan-chot-ky-cong',
      closingId: closing.id,
      confirmed: false,
    });

    // Assert
    expect(checks.map((c) => c.confirmed)).toEqual([false]);
    const lines = await flow.t.db.select().from(payrollLog).orderBy(payrollLog.at);
    expect(lines.map((l) => l.action)).toEqual(['Xác nhận lần chốt kỳ công', 'Bỏ xác nhận lần chốt kỳ công']);
  });

  it('L-L30: should refuse a check without its close, or with a close that does not exist', async () => {
    // Arrange
    await givePayrollRight();

    // Act + Assert
    await flow.payroll('PUT', '/first-month-checks', { item: 'lan-chot-ky-cong', confirmed: true }, 422);
    await flow.payroll(
      'PUT',
      '/first-month-checks',
      { item: 'lan-chot-ky-cong', closingId: '11111111-1111-4111-8111-111111111111', confirmed: true },
      404,
    );
    await flow.payroll('PUT', '/first-month-checks', { item: 'khong-co', confirmed: true }, 422);
  });

  it('L-L30: should keep the list to people with the payroll right', async () => {
    // Arrange
    const { closing } = await backfilledSeptember();

    // Act + Assert
    await flow.payroll('GET', '/first-month-checks', undefined, 403);
    await flow.payroll(
      'PUT',
      '/first-month-checks',
      { item: 'lan-chot-ky-cong', closingId: closing.id, confirmed: true },
      403,
    );
    await givePayrollRight();
    expect(await flow.payroll('GET', '/first-month-checks')).toEqual([]);
    expect((await flow.t.db.select().from(hrUsers).where(eq(hrUsers.canPayroll, true))).length).toBe(1);
  });
});
