import { timesheetPeriods, timesheetSnapshots } from '../db/schema.js';
import type { TimesheetDto } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { allOn, createFlow, rowOf, totalsOf, weekdaysOf, type Flow } from '../test/timesheet-flow.js';

/** Annual leave as NĐ 145/2020 Điều 65, 66 count it, over the real API. Cases: docs/test-cases-cham-cong.md, TC-PL. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

/** Someone on probation through October who becomes official on the first day of the November period. */
async function probationThenOfficial(over: Record<string, unknown> = {}) {
  await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-10-26', joinedOn: '2026-09-01', ...over });
  await flow.at('2026-10-26');
  await flow.close(2026, 10);
  await flow.at('2026-11-25');
  return flow.period(2026, 11);
}

describe('leave earned on probation (Điều 65 khoản 2)', () => {
  it('TC-PL-20: should add October\'s probation leave in November, the first official period', async () => {
    // Act
    const november = await probationThenOfficial();

    // Assert: 1 held from October, 1 earned in November
    expect(rowOf(november, 'A').leaveSoFar).toMatchObject({ leavePending: 1 });
    expect(totalsOf(november, 'A')).toMatchObject({ leaveCredited: 1, leaveClosing: 2 });
  });

  it('TC-PL-21: should count as the workbook did once HR chooses it, from the open periods on', async () => {
    // Arrange
    const before = await probationThenOfficial();

    // Act
    const november = await flow.call<TimesheetDto>('PUT', `/${before.periodId}/leave-mode`, { mode: 'excel' });

    // Assert
    expect(november.rule.mode).toBe('excel');
    expect(totalsOf(november, 'A')).toMatchObject({ leaveCredited: 0, leaveClosing: 1 });
  });

  it('TC-PL-22: should keep an opening balance through a probation period', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', employment: 'probation', openingLeave: 3 });

    // Act
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);

    // Assert
    expect(totalsOf(october, 'A')).toMatchObject({ leaveClosing: 3, leavePendingClosing: 1 });
  });

  it('TC-PL-23: should store the held leave when closing, and read it back after', async () => {
    // Act
    await probationThenOfficial();
    const [snapshot] = await flow.t.db.select().from(timesheetSnapshots);

    // Assert
    expect(snapshot?.totals).toMatchObject({ leavePendingClosing: 1 });
  });

  it('TC-PL-24: should work out the held leave of a period closed before it was stored', async () => {
    // Arrange: close October, then strip the new fields as an older close would have left them
    await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-10-26' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    const [snapshot] = await flow.t.db.select().from(timesheetSnapshots);
    const { leavePendingClosing: _p, leaveCredited: _c, unpaidCounted: _u, sickCounted: _s, maternity: _m, sick: _k, ...older } = snapshot?.totals ?? ({} as never);
    await flow.t.db.update(timesheetSnapshots).set({ totals: older as never }).where(eq(timesheetSnapshots.employeeId, snapshot?.employeeId ?? ''));

    // Act
    await flow.at('2026-11-25');
    const november = await flow.period(2026, 11);

    // Assert
    expect(rowOf(november, 'A').leaveSoFar).toMatchObject({ leavePending: 1 });
  });

  it('TC-PL-25: should drop the held leave of someone who leaves before becoming official', async () => {
    // Arrange: on probation in October and November, gone on 25/11
    await flow.addPerson({ code: 'A', employment: 'probation', leftOn: '2026-11-25' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await flow.at('2026-11-25');
    const november = await flow.period(2026, 11);

    // Assert: still held, never added, nothing to pay out
    expect(totalsOf(november, 'A')).toMatchObject({ leaveCredited: 0, leaveClosing: 0, leavePendingClosing: 2 });
  });
});

describe('the yearly caps carry from closed periods', () => {
  it('TC-PL-26: should bring the approved unpaid days that counted in October into November, the same year', async () => {
    // Arrange: approved unpaid leave on every October weekday
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);
    const weekdays = weekdaysOf(october);
    await flow.enter(october, person.id, allOn(weekdays, 'KL'));
    await flow.close(2026, 10);

    // Act
    const november = await flow.period(2026, 11);

    // Assert
    expect(rowOf(november, 'A').leaveSoFar).toMatchObject({ unpaidCountedBefore: weekdays.length });
  });
});

describe('six periods by the law, against the workbook', () => {
  it('TC-PL-27: should earn December\'s day from approved unpaid leave, then start the caps again in January', async () => {
    // Arrange: the same periods as TC-CK-01, counted by the law
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    const closings: Record<string, { opening: number; closing: number; paid: number; overdrawn: number }> = {};
    const closeOn = async (day: string, year: number, month: number) => {
      await flow.at(day);
      const closed = await flow.close(year, month);
      const totals = totalsOf(closed, 'A');
      closings[`${month}/${year}`] = { opening: totals.leaveOpening, closing: totals.leaveClosing, paid: totals.paid, overdrawn: totals.leaveOverdrawn };
    };

    // Act
    await flow.at('2026-10-20');
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-03': '1', '2026-10-10': '1' });
    await closeOn('2026-10-26', 2026, 10);
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-02': 'P', '2026-11-03': 'P' });
    await closeOn('2026-11-26', 2026, 11);
    const december = await flow.period(2026, 12);
    await flow.enter(december, person.id, allOn(weekdaysOf(december).slice(13), 'KL'));
    await closeOn('2026-12-26', 2026, 12);
    await flow.enter(await flow.period(2027, 1), person.id, allOn(['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'], 'P'));
    await closeOn('2027-01-26', 2027, 1);
    await closeOn('2027-02-26', 2027, 2);
    await closeOn('2027-03-26', 2027, 3);

    // Assert: December 13 worked + 9 approved unpaid = 22 counted, so +1; January then pays 4 of the 5 days
    expect(closings).toEqual({
      '10/2026': { opening: 2, closing: 3, paid: 22, overdrawn: 0 },
      '11/2026': { opening: 3, closing: 2, paid: 23, overdrawn: 0 },
      '12/2026': { opening: 2, closing: 3, paid: 13, overdrawn: 0 },
      '1/2027': { opening: 3, closing: 0, paid: 20, overdrawn: 1 },
      '2/2027': { opening: 0, closing: 1, paid: 23, overdrawn: 0 },
      '3/2027': { opening: 1, closing: 2, paid: 20, overdrawn: 0 },
    });
  });
});

describe('a free date range', () => {
  it('TC-PL-28: should pay leave from the balance the person has, as the period would', async () => {
    // Arrange: 2 days of leave to start with, 1 taken in the range
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-08': 'P' });

    // Act: 01/10–25/10, not a standard period
    const range = await flow.call<TimesheetDto>('GET', '/range?from=2026-10-01&to=2026-10-25');

    // Assert: the P is paid from the 2 days, so nothing is over the balance
    expect(rowOf(range, 'A').leaveOpening).toBe(2);
    expect(totalsOf(range, 'A')).toMatchObject({ leave: 1, leaveOverdrawn: 0 });
  });

  it('TC-PL-29: should count leave in a range the way its period does', async () => {
    // Arrange
    await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await flow.call('PUT', `/${(await flow.period(2026, 10)).periodId}/leave-mode`, { mode: 'excel' });

    // Act
    const range = await flow.call<TimesheetDto>('GET', '/range?from=2026-10-01&to=2026-10-25');

    // Assert
    expect(range.rule.mode).toBe('excel');
  });
});

describe('what a close keeps for payroll', () => {
  it('TC-TL-10: should store Sunday and holiday work, and maternity and sick days apart, in the closed totals', async () => {
    // Arrange: a holiday on Wednesday 14/10 worked, Sunday 18/10 worked, a sick day, a maternity day
    const person = await flow.addPerson({ code: 'A' });
    await flow.call('POST', '/holidays', { day: '2026-10-14', name: 'Lễ thử' });
    await flow.at('2026-10-26');
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-14': '1', '2026-10-18': '1', '2026-10-20': 'OM', '2026-10-21': 'TS' });

    // Act
    await flow.close(2026, 10);
    const [snapshot] = await flow.t.db.select().from(timesheetSnapshots);

    // Assert
    expect(snapshot?.totals).toMatchObject({ sundayWorked: 1, holidayWorked: 1, sick: 1, maternity: 1 });
  });
});

describe('looking at a month that has not started', () => {
  it('TC-KY-01: should show a month that has not started without storing a period for it', async () => {
    // Act: March 2027, on 05/11/2026
    const march = await flow.period(2027, 3);

    // Assert
    expect(march.periodId).toBeNull();
    expect(await flow.t.db.select().from(timesheetPeriods)).toHaveLength(0);
  });

  it('TC-KY-02: should still store the period of a month already started, so HR can type in it', async () => {
    // Act
    const november = await flow.period(2026, 11);

    // Assert
    expect(november.periodId).not.toBeNull();
    expect(await flow.t.db.select().from(timesheetPeriods)).toHaveLength(1);
  });

  it('TC-KY-03: should store a month not started once HR opens it to type ahead, and say so in the log', async () => {
    // Act
    const march = await flow.call<TimesheetDto>('POST', '/periods/2027/3', undefined, 201);
    const again = await flow.call<TimesheetDto>('POST', '/periods/2027/3', undefined, 201);

    // Assert
    expect(march.periodId).not.toBeNull();
    expect(again.periodId).toBe(march.periodId);
    expect((await flow.log(march)).filter((l) => l.action === 'Mở kỳ để nhập trước')).toHaveLength(1);
  });
});
