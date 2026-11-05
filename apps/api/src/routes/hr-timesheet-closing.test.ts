import { standardPeriod, suggestedNorm, type TimesheetDto, type TimesheetRegionDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { allOn, createFlow, rowOf, totalsOf, weekdaysOf, type Flow } from '../test/timesheet-flow.js';

/** Closing, carrying leave over, reopening, and what may still move afterwards. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

describe('leave carried from period to period', () => {
  it('TC-CK-01: should carry a balance through six periods, past the new year and February, by the formula of AV9', async () => {
    // Arrange: opening 2, HCM, nothing but what is typed below
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    const closings: Record<string, { opening: number; closing: number; paid: number; overdrawn: number }> = {};
    const closeOn = async (day: string, year: number, month: number) => {
      await flow.at(day);
      const closed = await flow.close(year, month);
      const totals = totalsOf(closed, 'A');
      closings[`${month}/${year}`] = { opening: totals.leaveOpening, closing: totals.leaveClosing, paid: totals.paid, overdrawn: totals.leaveOverdrawn };
    };

    // Act: October, 20 Mon–Fri and 2 Saturdays: 22, so +1
    await flow.at('2026-10-20');
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-03': '1', '2026-10-10': '1' });
    await closeOn('2026-10-26', 2026, 10);

    // November, 23 Mon–Fri with 2 days of leave: 3 + 1 − 2
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-02': 'P', '2026-11-03': 'P' });
    await closeOn('2026-11-26', 2026, 11);

    // December, 22 Mon–Fri of which only 13 worked: no new day
    const december = await flow.period(2026, 12);
    await flow.enter(december, person.id, allOn(weekdaysOf(december).slice(13), 'KL'));
    await closeOn('2026-12-26', 2026, 12);

    // January, 21 Mon–Fri with 5 days of leave against 2 + 1: 3 paid, 2 not, balance 0
    await flow.enter(await flow.period(2027, 1), person.id, allOn(['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'], 'P'));
    await closeOn('2027-01-26', 2027, 1);

    // February 23 and March 20 Mon–Fri: +1 each
    await closeOn('2027-02-26', 2027, 2);
    await closeOn('2027-03-26', 2027, 3);

    // Assert
    expect(closings).toEqual({
      '10/2026': { opening: 2, closing: 3, paid: 22, overdrawn: 0 },
      '11/2026': { opening: 3, closing: 2, paid: 23, overdrawn: 0 },
      '12/2026': { opening: 2, closing: 2, paid: 13, overdrawn: 0 },
      '1/2027': { opening: 2, closing: 0, paid: 19, overdrawn: 2 },
      '2/2027': { opening: 0, closing: 1, paid: 23, overdrawn: 0 },
      '3/2027': { opening: 1, closing: 2, paid: 20, overdrawn: 0 },
    });
  });

  it('TC-CK-02: should never expire leave at the new year', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 12 });
    await flow.at('2026-12-26');
    await flow.close(2026, 12);

    // Act
    const january = await flow.period(2027, 1);

    // Assert
    expect(rowOf(january, 'A').leaveOpening).toBe(13);
  });

  it('TC-CK-03: should start from what HR typed until something has been closed', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 7.5 });

    // Act + Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(7.5);
  });

  it('TC-CK-04: should start someone added after a close from what HR typed for them', async () => {
    // Arrange
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await flow.addPerson({ code: 'A', openingLeave: 4, joinedOn: '2026-10-28' });

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(4);
  });
});

describe('when a period can be closed', () => {
  it('TC-CK-05: should refuse up to the last minute of the 24th, Vietnam time', async () => {
    // Arrange
    const dto = await flow.period(2026, 10);
    flow.t.clock.now = new Date('2026-10-24T16:59:00.000Z');

    // Act
    const answer = await flow.attempt('POST', `/${dto.periodId}/close`);

    // Assert
    expect(answer).toEqual({ status: 409, code: 'period_running' });
  });

  /** "Chỉ chốt khi kỳ đã hết" against the spec's "từ ngày 25": this pins the spec. See the report. */
  it('TC-CK-06: currently allows closing from the first minute of the 25th, Vietnam time', async () => {
    // Arrange
    const dto = await flow.period(2026, 10);
    flow.t.clock.now = new Date('2026-10-24T17:00:00.000Z');

    // Act
    const answer = await flow.attempt('POST', `/${dto.periodId}/close`);

    // Assert
    expect(answer.status).toBe(200);
  });

  it('TC-CK-07: should refuse a later period while an earlier one HR has entered something in is open', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-05': 'P' });
    const november = await flow.period(2026, 11);
    await flow.at('2026-11-26');

    // Act
    const answer = await flow.attempt('POST', `/${november.periodId}/close`);

    // Assert
    expect(answer).toEqual({ status: 409, code: 'earlier_open' });
  });

  it('TC-CK-12: should start from the first month closed when HR only looked at an older one', async () => {
    // Arrange
    await flow.period(2026, 9);
    const october = await flow.period(2026, 10);
    await flow.at('2026-10-26');

    // Act
    const answer = await flow.attempt('POST', `/${october.periodId}/close`);

    // Assert
    expect(answer.status).toBe(200);
  });

  it('TC-CK-08: should refuse a later period when the one between was never opened, or its leave is lost', async () => {
    // Arrange: October closed, nobody ever looked at November, then December
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    await flow.at('2026-12-26');
    const december = await flow.period(2026, 12);

    // Act
    const answer = await flow.attempt('POST', `/${december.periodId}/close`);

    // Assert
    expect(answer).toEqual({ status: 409, code: 'earlier_open' });
  });

  it('TC-CK-09: should refuse closing a month older than one already closed', async () => {
    // Arrange
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    const september = await flow.period(2026, 9);

    // Act
    const answer = await flow.attempt('POST', `/${september.periodId}/close`);

    // Assert
    expect(answer.status).toBe(409);
  });

  it('TC-CK-10: should not let a look at an older month block the next close', async () => {
    // Arrange
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    await flow.period(2026, 9);
    await flow.at('2026-11-26');
    const november = await flow.period(2026, 11);

    // Act
    const answer = await flow.attempt('POST', `/${november.periodId}/close`);

    // Assert
    expect(answer.status).toBe(200);
  });

  it('TC-CK-11: should refuse closing twice', async () => {
    // Arrange
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);

    // Act
    const answer = await flow.attempt('POST', `/${closed.periodId}/close`);

    // Assert
    expect(answer).toEqual({ status: 409, code: 'period_closed' });
  });
});

describe('a closed period', () => {
  const closedOctober = async (over: Record<string, unknown> = {}) => {
    const person = await flow.addPerson({ code: 'A', fullName: 'Tên Cũ', department: 'Kế toán', openingLeave: 2, ...over });
    await flow.at('2026-10-26');
    const dto = await flow.close(2026, 10);
    return { person, dto };
  };

  it('TC-SC-01: should refuse cells, norms and adjustments, added or removed', async () => {
    // Arrange
    const { person, dto } = await closedOctober();
    const id = dto.periodId;

    // Act + Assert
    expect((await flow.attempt('PATCH', `/${id}/cells`, { cells: [{ employeeId: person.id, day: '2026-10-05', code: 'P' }] })).code).toBe('period_closed');
    expect((await flow.attempt('PATCH', `/${id}/norms`, { norms: { [flow.hcm.id]: 20 } })).code).toBe('period_closed');
    expect((await flow.attempt('POST', `/${id}/adjustments`, { employeeId: person.id, amount: -1, reason: 'x', isRecurring: false })).code).toBe('period_closed');
    expect((await flow.attempt('DELETE', `/${id}/adjustments/00000000-0000-4000-8000-000000000000`)).code).toBe('period_closed');
  });

  it('TC-SC-02: should keep name, department, region, type, dates, norm and balance when the person changes', async () => {
    // Arrange
    const { person } = await closedOctober({ employment: 'probation' });

    // Act
    await flow.updatePerson(person, {
      fullName: 'Tên Mới', department: 'HR', regionId: flow.hn.id, employment: 'official',
      joinedOn: '2026-10-10', leftOn: '2026-10-20', openingLeave: 9,
    });
    const after = await flow.period(2026, 10);

    // Assert
    expect(rowOf(after, 'A')).toMatchObject({
      fullName: 'Tên Cũ', department: 'Kế toán', regionId: flow.hcm.id, employment: 'probation',
      joinedOn: null, leftOn: null, norm: 22, leaveOpening: 2,
    });
    expect(totalsOf(after, 'A')).toMatchObject({ actual: 20, paid: 20, leaveClosing: 0 });
  });

  it('TC-SC-03: should carry its closing balance on, whatever HR then types as opening leave', async () => {
    // Arrange
    const { person } = await closedOctober();

    // Act
    await flow.updatePerson(person, { openingLeave: 9 });

    // Assert: 2 + 1, not 9
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(3);
  });

  it('TC-SC-04: should keep its norm when the Saturdays of a region change', async () => {
    // Arrange
    await closedOctober();

    // Act
    await flow.call<TimesheetRegionDto[]>('PATCH', `/regions/${flow.hcm.id}`, { name: 'HCM', saturdays: 3, tone: 'blue' });

    // Assert
    expect(rowOf(await flow.period(2026, 10), 'A').norm).toBe(22);
  });

  it('TC-LE-06: should keep its totals, and the day of rest taken instead, when closed with a holiday on a Sunday', async () => {
    // Arrange: 22/11/2026 is a Sunday, so the day off moves to Monday 23/11
    const person = await flow.addPerson({ code: 'A' });
    await flow.call('POST', '/holidays', { day: '2026-11-22', name: 'Lễ' });

    // Act
    await flow.at('2026-11-26');
    const sheet = await flow.period(2026, 11);

    // Assert
    expect(sheet.holidays).toEqual([{ day: '2026-11-23', name: 'Nghỉ bù Lễ' }]);
    expect(totalsOf(sheet, 'A').holiday).toBe(1);
    expect(rowOf(sheet, 'A').employeeId).toBe(person.id);
  });

  it('TC-SC-05: should keep its totals when a holiday is added afterwards on a Saturday', async () => {
    // Arrange
    await closedOctober();
    const before = totalsOf(await flow.period(2026, 10), 'A');

    // Act: 10/10/2026 is a Saturday nobody worked
    await flow.attempt('POST', '/holidays', { day: '2026-10-10', name: 'Lễ thêm sau' });
    const after = await flow.period(2026, 10);

    // Assert
    expect(after.holidays).toEqual([]);
    expect(totalsOf(after, 'A')).toEqual(before);
  });

  it('TC-SC-06: should keep its totals when a holiday is added afterwards on a working day', async () => {
    // Arrange
    await closedOctober();
    const before = totalsOf(await flow.period(2026, 10), 'A');

    // Act: 05/10/2026 is a Monday worked as usual
    await flow.attempt('POST', '/holidays', { day: '2026-10-05', name: 'Lễ thêm sau' });

    // Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toEqual(before);
  });

  it('TC-SC-07: should keep its totals when a holiday it counted is deleted afterwards', async () => {
    // Arrange: a Saturday holiday inside October, then closed
    await flow.call('POST', '/holidays', { day: '2026-10-10', name: 'Lễ' });
    await closedOctober();
    const before = totalsOf(await flow.period(2026, 10), 'A');
    expect(before.holiday).toBe(1);

    // Act
    await flow.attempt('DELETE', '/holidays/2026-10-10');

    // Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toEqual(before);
  });

  it('TC-SC-08: should keep the name of the region it closed with', async () => {
    // Arrange
    const { dto } = await closedOctober();

    // Act
    await flow.call('PATCH', `/regions/${flow.hcm.id}`, { name: 'Sài Gòn', saturdays: 2, tone: 'blue' });
    const after = await flow.period(2026, 10);

    // Assert
    const nameIn = (sheet: TimesheetDto) => sheet.regions.find((r) => r.id === rowOf(sheet, 'A').regionId)?.name;
    expect(nameIn(dto)).toBe('HCM');
    expect(nameIn(after)).toBe('HCM');
  });
});

describe('changing the norm of a region from a month on', () => {
  const change = (saturdaysFrom: string, saturdays: number) =>
    flow.call('PATCH', `/regions/${flow.hcm.id}`, { name: 'HCM', saturdays, tone: 'blue', saturdaysFrom });

  it('TC-DM-01: should leave earlier months alone, opened or not, and move those from that month on', async () => {
    // Arrange: HCM counted 2 Saturdays; December already opened by a look
    const opened = await flow.period(2026, 12);
    await flow.at('2026-11-05');

    // Act: from December on, 3 Saturdays
    await change('2026-12', 3);

    // Assert
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);
    const december = await flow.period(2026, 12);
    const january = await flow.period(2027, 1);
    expect(october.norms[flow.hcm.id]).toBe(22);
    expect(november.norms[flow.hcm.id]).toBe(25);
    expect(december.norms[flow.hcm.id]).toBe((opened.norms[flow.hcm.id] ?? 0) + 1);
    expect(january.norms[flow.hcm.id]).toBe(suggestedNorm(standardPeriod(2027, 1), 3));
  });

  it('TC-DM-02: should keep a month HR set by hand', async () => {
    // Arrange
    const december = await flow.period(2026, 12);
    await flow.call('PATCH', `/${december.periodId}/norms`, { norms: { [flow.hcm.id]: 20 } });

    // Act
    await change('2026-12', 3);

    // Assert
    expect((await flow.period(2026, 12)).norms[flow.hcm.id]).toBe(20);
  });

  it('TC-DM-03: should not touch a closed month', async () => {
    // Arrange
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await change('2026-10', 5);

    // Assert
    expect((await flow.period(2026, 10)).norms[flow.hcm.id]).toBe(22);
  });

  it('TC-DM-04: should replace what was planned from that month on when changed again', async () => {
    // Arrange
    await change('2027-01', 3);

    // Act
    await change('2026-12', 4);

    // Assert
    expect((await flow.period(2027, 3)).norms[flow.hcm.id]).toBe(suggestedNorm(standardPeriod(2027, 3), 4));
  });

  it('TC-DM-05: should recount pay and OT at once when a month changes by hand', async () => {
    // Arrange
    await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);

    // Act: 20 days of T2–T6 in October; lower the norm to 19
    const edited = await flow.call<TimesheetDto>('PATCH', `/${october.periodId}/norms`, { norms: { [flow.hcm.id]: 19 } });

    // Assert
    expect(totalsOf(edited, 'A')).toMatchObject({ norm: 19, paid: 19, overtime: 1 });
  });
});

describe('a long break', () => {
  it('TC-LE-07: should give everyone NL on each day at once, with one line in the log', async () => {
    // Arrange
    await flow.addPerson({ code: 'A' });
    const october = await flow.period(2026, 10);

    // Act: Saturday 10/10 to Tuesday 13/10
    await flow.call('POST', '/holidays/range', { from: '2026-10-10', to: '2026-10-13', name: 'Nghỉ dài' }, 200);
    const sheet = await flow.period(2026, 10);

    // Assert
    expect(sheet.holidays.map((h) => h.day)).toEqual(['2026-10-10', '2026-10-12', '2026-10-13']);
    expect(totalsOf(sheet, 'A').holiday).toBe(3);
    expect((await flow.log(october)).filter((l) => l.action === 'Lưu ngày lễ')).toHaveLength(1);
  });

  it('TC-LE-08: should let HR take a person off NL for a day they worked, and give it back', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.call('POST', '/holidays/range', { from: '2026-10-12', to: '2026-10-13', name: 'Nghỉ dài' }, 200);
    await flow.at('2026-10-26');

    // Act
    const worked = await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-12': '1' });

    // Assert
    expect(totalsOf(worked, 'A').holiday).toBe(1);
  });

  it('TC-LE-09: should remove a whole break at once', async () => {
    // Arrange
    await flow.call('POST', '/holidays/range', { from: '2026-10-12', to: '2026-10-14', name: 'Nghỉ dài' }, 200);

    // Act
    const left = await flow.call<unknown[]>('DELETE', '/holidays/range?from=2026-10-12&to=2026-10-14');

    // Assert
    expect(left).toEqual([]);
  });

  it('TC-LE-10: should refuse a break longer than a month, the wrong way round, or without a name', async () => {
    // Act + Assert
    await flow.call('POST', '/holidays/range', { from: '2026-10-01', to: '2026-12-01', name: 'Dài' }, 422);
    await flow.call('POST', '/holidays/range', { from: '2026-10-05', to: '2026-10-01', name: 'Ngược' }, 422);
    await flow.call('POST', '/holidays/range', { from: '2026-10-01', to: '2026-10-05', name: ' ' }, 422);
  });
});

describe('the twelve months of a year', () => {
  it('should say where each month stands, and tell a month nobody used from one waiting to be closed', async () => {
    // Arrange: November entered and past its end, October closed, today in December
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    await flow.at('2026-11-26');
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-05': 'P' });

    // Act
    const months = await flow.call<{ month: number; status: string }[]>('GET', '/years/2026');

    // Assert
    expect(months).toHaveLength(12);
    expect(Object.fromEntries(months.map((m) => [m.month, m.status]))).toMatchObject({ 9: 'empty', 10: 'closed', 11: 'waiting', 12: 'running' });
  });

  it('should not create any period by being read', async () => {
    // Act
    await flow.call('GET', '/years/2030');

    // Assert: nothing to close before a first month, so a later one still closes
    const october = await flow.period(2026, 10);
    await flow.at('2026-10-26');
    expect((await flow.attempt('POST', `/${october.periodId}/close`)).status).toBe(200);
  });
});

describe('reopening', () => {
  it('TC-MK-02: should need a reason, write it down, and take the entries again', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 1 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);

    // Act + Assert
    expect((await flow.attempt('POST', `/${closed.periodId}/reopen`, { reason: ' ' })).status).toBe(422);
    const reopened = await flow.call<TimesheetDto>('POST', `/${closed.periodId}/reopen`, { reason: 'Quên một ngày phép' });
    expect(reopened).toMatchObject({ status: 'open', closedBy: null, canReopen: false });
    await flow.enter(reopened, person.id, { '2026-10-05': 'P' });
    expect((await flow.log(reopened)).find((l) => l.action === 'Mở lại kỳ')).toMatchObject({ actor: 'Lan', detail: 'Quên một ngày phép' });
  });

  it('TC-MK-03: should change the next opening balance once it is closed again', async () => {
    // Arrange: 2 + 1 = 3 going into November
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(3);

    // Act: one day of leave was forgotten
    const reopened = await flow.call<TimesheetDto>('POST', `/${closed.periodId}/reopen`, { reason: 'Sót phép' });
    await flow.enter(reopened, person.id, { '2026-10-05': 'P' });
    await flow.call('POST', `/${closed.periodId}/close`);

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(2);
  });

  it('TC-MK-04: should only reopen the latest closed period, through several of them', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const october = await flow.close(2026, 10);
    await flow.at('2026-11-26');
    const november = await flow.close(2026, 11);
    await flow.at('2026-12-26');
    const december = await flow.close(2026, 12);

    // Act + Assert
    expect(await flow.period(2026, 10)).toMatchObject({ canReopen: false });
    expect(await flow.period(2026, 11)).toMatchObject({ canReopen: false });
    expect(await flow.period(2026, 12)).toMatchObject({ canReopen: true });
    expect((await flow.attempt('POST', `/${october.periodId}/reopen`, { reason: 'x' })).code).toBe('not_latest');
    expect((await flow.attempt('POST', `/${november.periodId}/reopen`, { reason: 'x' })).code).toBe('not_latest');
    await flow.call('POST', `/${december.periodId}/reopen`, { reason: 'x' });
    expect(await flow.period(2026, 11)).toMatchObject({ canReopen: true });
    await flow.call('POST', `/${november.periodId}/reopen`, { reason: 'x' });
    expect(await flow.period(2026, 10)).toMatchObject({ canReopen: true });
  });

  it('TC-MK-05: should refuse reopening a period that is open', async () => {
    // Arrange
    const dto = await flow.period(2026, 11);

    // Act + Assert
    expect((await flow.attempt('POST', `/${dto.periodId}/reopen`, { reason: 'x' })).status).toBe(409);
  });

  it('TC-MK-06: should close and reopen the same period over and over without trouble', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const { periodId } = await flow.period(2026, 10);

    // Act
    for (let i = 0; i < 3; i += 1) {
      await flow.call('POST', `/${periodId}/close`);
      await flow.call('POST', `/${periodId}/reopen`, { reason: `Lần ${i}` });
    }
    await flow.call('POST', `/${periodId}/close`);

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(3);
  });

  it('TC-MK-07: should not move someone to their new region when the old period is reopened to fix one cell', async () => {
    // Arrange: HCM in October, moved to HN in November
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.at('2026-11-05');
    await flow.updatePerson(person, { regionId: flow.hn.id });

    // Act
    const reopened = await flow.call<TimesheetDto>('POST', `/${closed.periodId}/reopen`, { reason: 'Sửa một ô' });

    // Assert
    expect(rowOf(reopened, 'A')).toMatchObject({ regionId: flow.hcm.id, norm: 22 });
  });

  it('TC-MK-08: should not turn someone official in a period they closed on probation when it is reopened', async () => {
    // Arrange: on probation through October, official from November
    const person = await flow.addPerson({ code: 'A', employment: 'probation' });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.updatePerson(person, { employment: 'official', officialOn: '2026-11-01' });

    // Act
    const reopened = await flow.call<TimesheetDto>('POST', `/${closed.periodId}/reopen`, { reason: 'Sửa một ô' });

    // Assert
    expect(rowOf(reopened, 'A').employment).toBe('probation');
    expect(totalsOf(reopened, 'A').leaveClosing).toBe(0);
  });
});

describe('the log', () => {
  it('TC-NK-01: should write down every change to a period, by whom', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);

    // Act
    await flow.enter(october, person.id, { '2026-10-05': 'P' });
    await flow.call('PATCH', `/${october.periodId}/norms`, { norms: { [flow.hcm.id]: 21 } });
    const adjusted = await flow.call<TimesheetDto>('POST', `/${october.periodId}/adjustments`, { employeeId: person.id, amount: -0.5, reason: 'Đi trễ', isRecurring: false });
    await flow.call('DELETE', `/${october.periodId}/adjustments/${rowOf(adjusted, 'A').adjustments[0]?.id}`);
    await flow.call('POST', `/${october.periodId}/close`);
    await flow.call('POST', `/${october.periodId}/reopen`, { reason: 'Sửa' });
    const log = await flow.log(october);

    // Assert
    expect(log.map((l) => l.action).sort()).toEqual(['Bỏ điều chỉnh công', 'Chấm công', 'Chốt kỳ', 'Mở lại kỳ', 'Sửa định mức', 'Điều chỉnh công'].sort());
    expect(new Set(log.map((l) => l.actor))).toEqual(new Set(['Lan']));
  });

  it('TC-NK-02: should let HR read that a holiday in the period was changed', async () => {
    // Arrange
    const november = await flow.period(2026, 11);

    // Act
    await flow.call('POST', '/holidays', { day: '2026-11-24', name: 'Lễ' });
    const log = await flow.log(november);

    // Assert
    expect(log.map((l) => l.action)).toContain('Lưu ngày lễ');
  });

  it('TC-NK-03: should let HR read that a person in the period was changed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const november = await flow.period(2026, 11);

    // Act
    await flow.updatePerson(person, { regionId: flow.hn.id });
    const log = await flow.log(november);

    // Assert
    expect(log.map((l) => l.action)).toContain('Sửa nhân viên');
  });
});

describe('a month whose previous month is still open', () => {
  it('TC-TT-01: should open with what the previous month ends with, not with the last closed balance', async () => {
    // Arrange: 2 days at the start, 1 taken in November, nothing closed, today in December's period
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-11-26');
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-05': 'P' });

    // Act
    const december = await flow.period(2026, 12);

    // Assert: 2 + 1 earned − 1 taken
    expect(rowOf(december, 'A').leaveOpening).toBe(2);
  });

  it('TC-TT-02: should keep the balance moving forward while an earlier month is reopened', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.at('2026-11-05');
    const before = rowOf(await flow.period(2026, 11), 'A').leaveOpening;

    // Act
    await flow.call('POST', `/${closed.periodId}/reopen`, { reason: 'Sửa một ô' });

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(before);
    expect(person.code).toBe('A');
  });

  it('TC-TT-03: should not count a month before anyone started using the sheet', async () => {
    // Arrange: nothing entered before November, opening balance as HR typed it for November
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-11-05');

    // Act
    const november = await flow.period(2026, 11);

    // Assert
    expect(rowOf(november, 'A').leaveOpening).toBe(2);
  });
});

describe('what a closed period remembers', () => {
  it('TC-SC-20: should keep its totals as they were closed, not work them out again', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');

    // Act
    const closed = await flow.close(2026, 10);

    // Assert
    const row = rowOf(closed, 'A');
    expect(row.frozenTotals).toEqual(totalsOf(closed, 'A'));
    expect(row.frozenTotals?.paid).toBe(20);
  });

  it('TC-SC-21: should write what changed for each person when a reopened period closes again', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.call('POST', `/${closed.periodId}/reopen`, { reason: 'Sửa' });
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-05': 'KL' });

    // Act
    const again = await flow.close(2026, 10);

    // Assert: 20 paid before, 19 now
    const line = (await flow.log(again)).find((l) => l.action === 'Chênh lệch khi chốt lại');
    expect(line?.detail).toContain('Công hưởng lương 20 → 19');
  });

  it('TC-SC-22: should say nothing changed when a period closes again the same', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.call('POST', `/${closed.periodId}/reopen`, { reason: 'Xem lại' });

    // Act
    const again = await flow.close(2026, 10);

    // Assert
    expect((await flow.log(again)).map((l) => l.action)).not.toContain('Chênh lệch khi chốt lại');
  });
});

describe('changing a balance by hand', () => {
  it('TC-PT-01: should move the balance of that period and carry on, with a reason in the log', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);

    // Act
    const changed = await flow.call<TimesheetDto>('POST', `/${october.periodId}/leave-changes`, { employeeId: person.id, amount: 1.5, reason: 'Đủ 5 năm' }, 201);
    const closed = await flow.close(2026, 10);

    // Assert: 2 + 1.5 + 1 earned
    expect(totalsOf(changed, 'A').leaveClosing).toBe(4.5);
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(4.5);
    expect((await flow.log(closed)).map((l) => l.action)).toContain('Điều chỉnh phép');
  });

  it('TC-PT-02: should refuse taking away more than the person has, or no reason', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 1 });
    const november = await flow.period(2026, 11);
    const path = `/${november.periodId}/leave-changes`;

    // Act + Assert
    await flow.call('POST', path, { employeeId: person.id, amount: -5, reason: 'Sai' }, 422);
    await flow.call('POST', path, { employeeId: person.id, amount: -1, reason: ' ' }, 422);
  });

  it('TC-PT-03: should take the change back when removed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    const november = await flow.period(2026, 11);
    const changed = await flow.call<TimesheetDto>('POST', `/${november.periodId}/leave-changes`, { employeeId: person.id, amount: 1, reason: 'Thừa' }, 201);
    const id = rowOf(changed, 'A').leaveChanges[0]?.id;

    // Act
    const back = await flow.call<TimesheetDto>('DELETE', `/${november.periodId}/leave-changes/${id}`);

    // Assert
    expect(rowOf(back, 'A').leaveChanges).toEqual([]);
    expect(totalsOf(back, 'A').leaveOpening).toBe(2);
  });

  it('TC-PT-04: should warn that the starting balance no longer counts once a period has closed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    const saved = await flow.updatePerson(person, { openingLeave: 9 });

    // Assert
    expect(saved.warning).toContain('Điều chỉnh phép');
  });
});

describe('someone leaving after their last month closed', () => {
  it('TC-NV-20: should warn about the days already paid and the leave left, naming the month', async () => {
    // Arrange: closed October, then told they left on 10/10
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    const saved = await flow.updatePerson(person, { leftOn: '2026-10-10' });

    // Assert
    expect(saved.warning).toContain('tháng 10/2026');
    expect(saved.warning).toContain('còn 3 ngày phép');
  });

  it('TC-NV-21: should not warn when the last day falls in a period still open', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await flow.period(2026, 11);

    // Act
    const saved = await flow.updatePerson(person, { leftOn: '2026-11-10' });

    // Assert
    expect(saved.warning).toBeUndefined();
  });
});

describe('removing someone added by mistake', () => {
  it('TC-NV-22: should work while nothing was entered for them', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const left = await flow.call<unknown[]>('DELETE', `/employees/${person.id}`);

    // Assert
    expect(left).toEqual([]);
  });

  it('TC-NV-23: should refuse once they have a day or a closed period', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act + Assert
    await flow.call('DELETE', `/employees/${person.id}`, undefined, 409);
  });
});

describe('fixes from the review', () => {
  it('RV-01: should refuse taking leave from someone on probation below nothing, whatever the typed start says', async () => {
    // Arrange: probation counts no balance, so −2 has nothing to come from
    const person = await flow.addPerson({ code: 'A', employment: 'probation', openingLeave: 3 });
    const november = await flow.period(2026, 11);

    // Act + Assert
    await flow.call('POST', `/${november.periodId}/leave-changes`, { employeeId: person.id, amount: -2, reason: 'Sai' }, 422);
  });

  it('RV-02: should refuse removing a change when the balance would go below nothing', async () => {
    // Arrange: +3 then −3 on an empty balance
    const person = await flow.addPerson({ code: 'A', openingLeave: 0 });
    const november = await flow.period(2026, 11);
    const path = `/${november.periodId}/leave-changes`;
    const plus = await flow.call<TimesheetDto>('POST', path, { employeeId: person.id, amount: 3, reason: 'Cộng' }, 201);
    await flow.call('POST', path, { employeeId: person.id, amount: -3, reason: 'Trừ' }, 201);

    // Act + Assert
    await flow.call('DELETE', `${path}/${rowOf(plus, 'A').leaveChanges[0]?.id}`, undefined, 422);
  });

  it('RV-03: should let a reopened period take the last day HR learned later, and enter the days after it fall away', async () => {
    // Arrange: closed October, then told they left on 10/10
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    const closed = await flow.close(2026, 10);
    await flow.updatePerson(person, { leftOn: '2026-10-10' });

    // Act
    const reopened = await flow.call<TimesheetDto>('POST', `/${closed.periodId}/reopen`, { reason: 'Nghỉ việc sớm hơn' });

    // Assert: days worked stop at the last day, instead of 20
    expect(rowOf(reopened, 'A').leftOn).toBe('2026-10-10');
    expect(totalsOf(reopened, 'A').actual).toBeLessThan(20);
  });

  it('RV-04: should keep planned changes when a region is saved with the same number of Saturdays', async () => {
    // Arrange: 3 Saturdays planned for March
    await flow.at('2026-11-05');
    await flow.call('PATCH', `/regions/${flow.hcm.id}`, { name: 'HCM', saturdays: 3, tone: 'blue', saturdaysFrom: '2027-03' });

    // Act: only the colour changes, this month's count is sent as it stands
    const regions = await flow.call<TimesheetRegionDto[]>('PATCH', `/regions/${flow.hcm.id}`, { name: 'HCM', saturdays: 2, tone: 'rose', saturdaysFrom: '2026-11' });

    // Assert
    expect(regions.find((r) => r.id === flow.hcm.id)?.saturdayChanges).toEqual([{ from: '2027-03', saturdays: 3 }]);
    expect(regions.find((r) => r.id === flow.hcm.id)?.tone).toBe('rose');
  });

  it('RV-05: should keep a code HR entered by hand when an absence covers that day, and when the absence is cancelled', async () => {
    // Arrange: Tuesday late, with a note
    const person = await flow.addPerson({ code: 'A', openingLeave: 5 });
    await flow.at('2026-11-05');
    await flow.call('PATCH', `/${(await flow.period(2026, 11)).periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-03', code: 'M', note: 'Muộn' }] });

    // Act: Mon–Wed of leave
    const [absence] = await flow.call<{ id: string; days: number }[]>('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-02', to: '2026-11-04', approvedBy: 'Sếp' }, 201);
    const during = await flow.period(2026, 11);
    await flow.call('DELETE', `/employees/${person.id}/absences/${absence?.id}`);
    const after = await flow.period(2026, 11);

    // Assert
    expect(absence?.days).toBe(2);
    expect(rowOf(during, 'A').cells['2026-11-03']).toMatchObject({ entered: 'M', note: 'Muộn' });
    expect(rowOf(during, 'A').cells['2026-11-02']?.entered).toBe('P');
    expect(rowOf(after, 'A').cells['2026-11-03']).toMatchObject({ entered: 'M', note: 'Muộn' });
    expect(rowOf(after, 'A').cells['2026-11-02']).toBeUndefined();
  });

  it('RV-06: should not undo a day HR corrected when the absence is edited later', async () => {
    // Arrange: Mon–Wed of leave, Wednesday corrected back to a day worked
    const person = await flow.addPerson({ code: 'A', openingLeave: 5 });
    await flow.at('2026-11-05');
    const [absence] = await flow.call<{ id: string }[]>('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-02', to: '2026-11-04', approvedBy: 'Sếp' }, 201);
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-04': '1' });

    // Act: only the note changes
    await flow.call('PATCH', `/employees/${person.id}/absences/${absence?.id}`, { reason: 'annual', from: '2026-11-02', to: '2026-11-04', approvedBy: 'Sếp', note: 'Có việc' });

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-04']?.entered).toBe('1');
  });

  it('RV-07: should give back the leave when a holiday is added over an absence, and charge it when the holiday goes', async () => {
    // Arrange: leave Mon–Wed, then Tuesday turns out to be a holiday
    const person = await flow.addPerson({ code: 'A', openingLeave: 5 });
    await flow.at('2026-11-26');
    const [absence] = await flow.call<{ id: string }[]>('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-02', to: '2026-11-04', approvedBy: 'Sếp' }, 201);

    // Act
    await flow.call('POST', '/holidays', { day: '2026-11-03', name: 'Lễ' });
    const withHoliday = await flow.period(2026, 11);
    const rows = await flow.call<{ id: string; days: number }[]>('GET', '/absences?year=2026');
    await flow.call('DELETE', '/holidays/2026-11-03');
    const without = await flow.period(2026, 11);

    // Assert
    expect(totalsOf(withHoliday, 'A')).toMatchObject({ leave: 2, holiday: 1 });
    expect(rows.find((r) => r.id === absence?.id)?.days).toBe(2);
    expect(totalsOf(without, 'A')).toMatchObject({ leave: 3, holiday: 0 });
  });

  it('RV-08: should refuse deleting someone with an adjustment, an absence or a change of balance, and answer 404 to a bad address', async () => {
    // Arrange
    const adjusted = await flow.addPerson({ code: 'A' });
    const away = await flow.addPerson({ code: 'B' });
    const changed = await flow.addPerson({ code: 'C' });
    const november = await flow.period(2026, 11);
    await flow.call('POST', `/${november.periodId}/adjustments`, { employeeId: adjusted.id, amount: -0.5, reason: 'Trừ', isRecurring: true });
    await flow.call('POST', `/employees/${away.id}/absences`, { reason: 'sick', from: '2026-11-03', to: '2026-11-03' }, 201);
    await flow.call('POST', `/${november.periodId}/leave-changes`, { employeeId: changed.id, amount: 1, reason: 'Cộng' }, 201);

    // Act + Assert
    for (const id of [adjusted.id, away.id, changed.id]) await flow.call('DELETE', `/employees/${id}`, undefined, 409);
    await flow.call('DELETE', '/employees/khong-phai-id', undefined, 404);
    await flow.call('DELETE', '/regions/khong-phai-id', undefined, 404);
    await flow.call('DELETE', `/${november.periodId}/adjustments/khong-phai-id`, undefined, 404);
    await flow.call('PATCH', '/employees/khong-phai-id', { code: 'Z', fullName: 'Z', department: '', title: '', regionId: flow.hcm.id, employment: 'official', joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 }, 404);
    await flow.call('PATCH', '/regions/khong-phai-id', { name: 'Z', saturdays: 0, tone: 'blue' }, 404);
  });

  it('RV-09: should refuse closing an old month nobody used as the first close, which would force every month after it', async () => {
    // Arrange: looking at January while it is November
    await flow.addPerson({ code: 'A' });
    await flow.at('2026-11-05');
    const january = await flow.period(2026, 1);

    // Act
    const answer = await flow.attempt('POST', `/${january.periodId}/close`);

    // Assert
    expect(answer).toEqual({ status: 409, code: 'empty_month' });
  });
});
