import type { TimesheetClosingDto, TimesheetDto, TimesheetLogPageDto } from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers, payrollLog, payrollPeriods } from '../db/schema.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * Chấm công for Lương (spec-luong.md 10.1, R7; docs/test-cases-luong.md L-C03, L-C04, L-C05, L-C07, L-L28): Lương told
 * when a period is reopened or closed again. People are fake. The payroll month is stored here only as far as these
 * steps need it.
 */

const APPROVED_NOTICE = 'Kỳ này đã có bảng lương duyệt. Người phụ trách lương sẽ xử lý.';

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const closingsOf = (dto: Pick<TimesheetDto, 'periodId'>) =>
  flow.call<TimesheetClosingDto[]>('GET', `/${dto.periodId}/closings`);

async function payrollMonth(year: number, month: number) {
  const [row] = await flow.t.db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, year), eq(payrollPeriods.month, month)));
  return row;
}

const payrollLines = async () =>
  (await flow.t.db.select().from(payrollLog).orderBy(payrollLog.at)).map((l) => ({
    area: l.area,
    action: l.action,
    detail: l.detail,
    month: l.month,
  }));

/** October with NV04 on 22 days, closed on 26/10 as close number 1. */
async function closeOctober() {
  await flow.at('2026-10-20');
  const nv04 = await flow.addPerson({ code: 'NV04', fullName: 'NV D' });
  await flow.enter(await flow.period(2026, 10), nv04.id, { '2026-10-03': '1', '2026-10-10': '1' });
  await flow.at('2026-10-26');
  const closed = await flow.close(2026, 10);
  const [first] = await closingsOf(closed);
  if (!first || !closed.periodId) throw new Error('October did not close');
  return { nv04, closed, first, periodId: closed.periodId };
}

const reopen = (periodId: string, reason = 'Sửa công NV D') =>
  flow.call<TimesheetDto>('POST', `/${periodId}/reopen`, { reason });

describe('L-C03 reopening while the payroll month is a draft', () => {
  it('L-C03: should turn the draft back to Chờ chốt công, log it in the payroll log, and say so', async () => {
    // Arrange
    const { first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'draft', closingId: first.id });

    // Act
    const reopened = await reopen(periodId);

    // Assert
    expect((await payrollMonth(2026, 10))?.status).toBe('waiting');
    expect(reopened.payrollNotice).toBe('Bảng lương tháng này về Chờ chốt công cho tới khi chốt lại kỳ công.');
    expect(await payrollLines()).toEqual([
      {
        area: 'cham-cong',
        action: 'Kỳ công mở lại',
        detail: 'Tháng 10/2026, lý do: Sửa công NV D. Bảng lương Nháp → Chờ chốt công',
        month: '2026-10',
      },
    ]);
  });

  it('L-C03: should make it a draft of the new close when closed again, and name who changed', async () => {
    // Arrange
    const { nv04, first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'draft', closingId: first.id });
    await reopen(periodId);
    await flow.enter(await flow.period(2026, 10), nv04.id, { '2026-10-05': 'KL' });

    // Act
    const closed = await flow.close(2026, 10);

    // Assert
    const [, second] = await closingsOf(closed);
    expect(await payrollMonth(2026, 10)).toMatchObject({ status: 'draft', closingId: second?.id });
    expect((await payrollLines()).at(-1)).toEqual({
      area: 'cham-cong',
      action: 'Kỳ công chốt lại',
      detail:
        'Tháng 10/2026, lần chốt 2. Đổi: NV04 NV D: Công hưởng lương 22 → 21, Nghỉ không lương 0 → 1, 1 ngày đổi mã',
      month: '2026-10',
    });
  });
});

describe('L-C04 and L-C05 reopening once the payroll month is approved', () => {
  it('L-C04: should leave the approved month as it is, pointing at close 1, with the label of the reopen', async () => {
    // Arrange
    const { first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'approved', closingId: first.id });
    await flow.at('2026-11-02');

    // Act
    const reopened = await reopen(periodId, 'Thiếu một ngày phép');

    // Assert
    expect(await payrollMonth(2026, 10)).toMatchObject({
      status: 'approved',
      closingId: first.id,
      timesheetReopenedAt: new Date('2026-11-02T03:00:00.000Z'),
      timesheetReopenedBy: 'Lan',
      timesheetReopenReason: 'Thiếu một ngày phép',
    });
    expect(reopened.payrollNotice).toBe(APPROVED_NOTICE);
  });

  it('L-C05: should take the label off when closed again with the same figures, and log "không chênh"', async () => {
    // Arrange
    const { first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'approved', closingId: first.id });
    await reopen(periodId);

    // Act
    const closed = await flow.close(2026, 10);

    // Assert
    expect(await payrollMonth(2026, 10)).toMatchObject({
      status: 'approved',
      closingId: first.id,
      timesheetReopenedAt: null,
      timesheetReopenReason: null,
    });
    expect(closed.payrollNotice).toBeUndefined();
    expect((await payrollLines()).at(-1)).toMatchObject({
      action: 'Kỳ công chốt lại',
      detail: 'Tháng 10/2026, lần chốt 2: không chênh với bảng lương đã duyệt',
    });
  });

  it('L-L28: should keep the approved month on close 1 when the period closes again with other figures', async () => {
    // Arrange
    const { nv04, first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'approved', closingId: first.id });
    await reopen(periodId);
    await flow.enter(await flow.period(2026, 10), nv04.id, { '2026-10-05': 'KL' });

    // Act
    const closed = await flow.close(2026, 10);

    // Assert
    const month = await payrollMonth(2026, 10);
    expect(month).toMatchObject({ status: 'approved', closingId: first.id });
    expect(month?.timesheetReopenedAt).not.toBeNull();
    expect(closed.payrollNotice).toBe(APPROVED_NOTICE);
    expect((await payrollLines()).at(-1)?.detail).toBe(
      'Tháng 10/2026, lần chốt 2 khác bảng lương đã duyệt (lần chốt 1), chờ xử lý: NV04 NV D: Công hưởng lương 22 → 21, Nghỉ không lương 0 → 1, 1 ngày đổi mã',
    );
  });
});

describe('L-C07 someone without the payroll right reopens the period', () => {
  it('L-C07: should give only the general sentence, without a figure, and still log the event for Lương', async () => {
    // Arrange: the HR of the flow has no payroll right
    const { first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'approved', closingId: first.id });
    const [me] = await flow.t.db.select().from(hrUsers);
    expect(me?.canPayroll).toBe(false);

    // Act
    const reopened = await reopen(periodId);

    // Assert
    expect(reopened.payrollNotice).toBe(APPROVED_NOTICE);
    expect(reopened.payrollNotice).not.toMatch(/\d/);
    expect(await payrollLines()).toEqual([
      {
        area: 'cham-cong',
        action: 'Kỳ công mở lại',
        detail: 'Tháng 10/2026, lý do: Sửa công NV D. Bảng lương đã duyệt giữ nguyên, gắn nhãn kỳ công đã mở lại',
        month: '2026-10',
      },
    ]);
  });

  it('L-C07: should keep the timesheet log free of anything about payroll', async () => {
    // Arrange
    const { first, periodId } = await closeOctober();
    await flow.t.db.insert(payrollPeriods).values({ year: 2026, month: 10, status: 'approved', closingId: first.id });

    // Act
    await reopen(periodId);

    // Assert
    const log = await flow.call<TimesheetLogPageDto>('GET', '/log');
    expect(log.lines.filter((l) => /lương/i.test(l.detail))).toEqual([]);
  });

  it('L-C07: should still log a reopen for Lương when there is no payroll month yet, and say nothing on the sheet', async () => {
    // Arrange
    const { periodId } = await closeOctober();

    // Act
    const reopened = await reopen(periodId);

    // Assert
    expect(reopened.payrollNotice).toBeUndefined();
    expect(await payrollLines()).toEqual([
      { area: 'cham-cong', action: 'Kỳ công mở lại', detail: 'Tháng 10/2026, lý do: Sửa công NV D', month: '2026-10' },
    ]);
  });
});
