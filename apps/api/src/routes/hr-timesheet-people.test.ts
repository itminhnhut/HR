import type { TimesheetDto, TimesheetRegionDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, totalsOf, type Flow } from '../test/timesheet-flow.js';

/** People coming, leaving and changing during periods; adjustments; free ranges. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const codesIn = (dto: TimesheetDto) => dto.rows.map((r) => r.code);

describe('someone who starts during a period', () => {
  it('TC-VG-04: should count from that day against the full norm, and earn leave at 14', async () => {
    // Arrange: 05/10 leaves 15 Mon–Fri of October
    await flow.addPerson({ code: 'A', joinedOn: '2026-10-05', openingLeave: 0 });
    await flow.at('2026-10-26');

    // Act
    const totals = totalsOf(await flow.period(2026, 10), 'A');

    // Assert
    expect(totals).toMatchObject({ actual: 15, norm: 22, paid: 15, leaveClosing: 1 });
  });

  it('TC-VG-05: should earn no leave under 14', async () => {
    // Arrange: 12/10 leaves 10 Mon–Fri
    await flow.addPerson({ code: 'A', joinedOn: '2026-10-12' });
    await flow.at('2026-10-26');

    // Act + Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toMatchObject({ actual: 10, paid: 10, leaveClosing: 0 });
  });

  it('TC-VG-06: should refuse an entry before the start date, and take one on it', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', joinedOn: '2026-11-03' });
    const november = await flow.period(2026, 11);
    const cell = (day: string) => ({ cells: [{ employeeId: person.id, day, code: 'M' }] });

    // Act + Assert
    expect((await flow.attempt('PATCH', `/${november.periodId}/cells`, cell('2026-11-02'))).status).toBe(422);
    expect((await flow.attempt('PATCH', `/${november.periodId}/cells`, cell('2026-11-03'))).status).toBe(200);
  });

  it('TC-VG-07: should not appear in a period that ends before the start date, and appear in one that ends on it', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', joinedOn: '2026-11-25' });
    await flow.addPerson({ code: 'B', joinedOn: '2026-11-26' });

    // Act
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);
    const december = await flow.period(2026, 12);

    // Assert
    expect(codesIn(october)).toEqual([]);
    expect(codesIn(november)).toEqual(['A']);
    expect(codesIn(december)).toEqual(['A', 'B']);
  });
});

describe('someone who leaves during a period', () => {
  it('TC-NV-04: should count up to that day against the full norm, with the balance left to pay out', async () => {
    // Arrange: 09/10 leaves 10 Mon–Fri, under 14
    await flow.addPerson({ code: 'A', leftOn: '2026-10-09', openingLeave: 3 });
    await flow.at('2026-10-26');

    // Act + Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toMatchObject({ actual: 10, norm: 22, paid: 10, leaveOpening: 3, leaveClosing: 3 });
  });

  it('TC-NV-05: should refuse an entry after the last day', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', leftOn: '2026-11-03' });
    const november = await flow.period(2026, 11);

    // Act
    const answer = await flow.attempt('PATCH', `/${november.periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'P' }] });

    // Assert
    expect(answer.status).toBe(422);
  });

  it('TC-NV-06: should be gone from the next period if the last day is the 25th, and in it if it is the 26th', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', leftOn: '2026-10-25' });
    await flow.addPerson({ code: 'B', leftOn: '2026-10-26' });

    // Act
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);

    // Assert
    expect(codesIn(october)).toEqual(['A', 'B']);
    expect(codesIn(november)).toEqual(['B']);
  });

  it('TC-NV-07: should keep the period closed with them when someone leaves afterwards', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await flow.updatePerson(person, { leftOn: '2026-10-30' });

    // Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toMatchObject({ actual: 20, leaveClosing: 3 });
    expect(rowOf(await flow.period(2026, 11), 'A')).toMatchObject({ leaveOpening: 3, leftOn: '2026-10-30' });
  });
});

describe('from probation to official', () => {
  it('TC-TV-02: should count as official for the whole period the date falls in, and earn leave from there', async () => {
    // Arrange: official from 20/11, while the type still says probation
    await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-11-20' });
    await flow.at('2026-11-26');

    // Act
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);

    // Assert
    expect(rowOf(october, 'A').employment).toBe('probation');
    expect(totalsOf(october, 'A').leaveClosing).toBe(0);
    expect(rowOf(november, 'A').employment).toBe('official');
    expect(totalsOf(november, 'A').leaveClosing).toBe(1);
  });

  it('TC-TV-03: should turn on the last day of a period, and not one day after it', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-11-25' });
    await flow.addPerson({ code: 'B', employment: 'probation', officialOn: '2026-11-26' });

    // Act
    const november = await flow.period(2026, 11);

    // Assert
    expect(rowOf(november, 'A').employment).toBe('official');
    expect(rowOf(november, 'B').employment).toBe('probation');
  });

  it('TC-TV-04: should keep someone on probation for periods ending before the date, even when the type already says official', async () => {
    // Arrange: HR picks "Chính thức" and types the date, as the form offers. October is still open
    await flow.addPerson({ code: 'A', employment: 'official', officialOn: '2026-11-10' });
    await flow.at('2026-11-26');

    // Act
    const october = await flow.period(2026, 10);

    // Assert
    expect(rowOf(october, 'A').employment).toBe('probation');
    expect(totalsOf(october, 'A').leaveClosing).toBe(0);
  });

  it('TC-TV-05: should carry leave through the change: October held on probation, added in November with November\'s own day', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-11-20' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    await flow.at('2026-11-26');
    await flow.close(2026, 11);

    // Act
    const december = await flow.period(2026, 12);

    // Assert: 1 held from October + 1 earned in November (NĐ 145 Điều 65 khoản 2)
    expect(rowOf(december, 'A').leaveOpening).toBe(2);
  });

  it('TC-TV-06: should pay no leave taken before the period of the change', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', employment: 'probation', officialOn: '2026-11-20' });
    await flow.at('2026-10-20');
    await flow.enter(await flow.period(2026, 10), person.id, { '2026-10-05': 'P' });
    await flow.at('2026-10-26');

    // Act + Assert
    expect(totalsOf(await flow.period(2026, 10), 'A')).toMatchObject({ actual: 19, leave: 1, paid: 19, leaveOverdrawn: 1 });
  });
});

describe('changing region', () => {
  it('TC-KV-01: should take the norm of the new region for the whole open period', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    expect(rowOf(await flow.period(2026, 11), 'A').norm).toBe(25);

    // Act
    await flow.updatePerson(person, { regionId: flow.hn.id });

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A')).toMatchObject({ regionId: flow.hn.id, norm: 27 });
  });

  it('TC-KV-02: should leave the closed period in the old region and keep the balance', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await flow.updatePerson(person, { regionId: flow.hn.id });

    // Assert
    expect(rowOf(await flow.period(2026, 10), 'A')).toMatchObject({ regionId: flow.hcm.id, norm: 22 });
    expect(rowOf(await flow.period(2026, 11), 'A')).toMatchObject({ regionId: flow.hn.id, norm: 27, leaveOpening: 3 });
  });

  it('TC-KV-03: should use the norm HR edited for the new region in that period', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const november = await flow.period(2026, 11);
    await flow.call('PATCH', `/${november.periodId}/norms`, { norms: { [flow.hn.id]: 26 } });

    // Act
    await flow.updatePerson(person, { regionId: flow.hn.id });

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').norm).toBe(26);
  });

  it('TC-KV-04: should have a norm in the header for a region added after the period was opened', async () => {
    // Arrange
    const november = await flow.period(2026, 11);

    // Act
    const regions = await flow.call<TimesheetRegionDto[]>('POST', '/regions', { name: 'Đà Nẵng', saturdays: 2, tone: 'cyan' }, 201);
    const added = regions.find((r) => r.name === 'Đà Nẵng');
    await flow.addPerson({ code: 'A', regionId: added?.id });
    const after = await flow.period(2026, 11);

    // Assert
    expect(november.periodId).toBe(after.periodId);
    expect(rowOf(after, 'A').norm).toBe(25);
    expect(after.norms[added?.id ?? '']).toBe(25);
  });
});

describe('the norm of a period', () => {
  it('TC-CC-07: should move pay and overtime in that period, and in no other', async () => {
    // Arrange: 23 Mon–Fri of November
    await flow.addPerson({ code: 'A' });
    await flow.at('2026-11-26');
    const november = await flow.period(2026, 11);
    expect(totalsOf(november, 'A')).toMatchObject({ paid: 23, overtime: 0, norm: 25 });

    // Act
    const edited = await flow.call<TimesheetDto>('PATCH', `/${november.periodId}/norms`, { norms: { [flow.hcm.id]: 22 } });

    // Assert
    expect(totalsOf(edited, 'A')).toMatchObject({ paid: 22, overtime: 1, norm: 22 });
    expect(totalsOf(await flow.period(2026, 12), 'A').norm).toBe(24);
  });
});

describe('adjustments across periods', () => {
  const adjust = (dto: TimesheetDto, employeeId: string, amount: number, isRecurring: boolean, reason = 'Lý do') =>
    flow.call<TimesheetDto>('POST', `/${dto.periodId}/adjustments`, { employeeId, amount, reason, isRecurring });
  const paidIn = async (year: number, month: number) => totalsOf(await flow.period(year, month), 'A').paid;

  it('TC-DC-09: should repeat each period through the new year until removed, leaving the closed ones alone', async () => {
    // Arrange: 20, 23, 22, 21 and 23 Mon–Fri from October to February
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await adjust(await flow.period(2026, 10), person.id, -0.5, true);
    await flow.close(2026, 10);
    await flow.at('2026-11-26');
    await flow.close(2026, 11);
    await flow.at('2026-12-26');
    await flow.close(2026, 12);
    await flow.at('2027-01-26');

    // Act: removed in January, while it stays in everything before
    const january = await flow.period(2027, 1);
    await flow.call('DELETE', `/${january.periodId}/adjustments/${rowOf(january, 'A').adjustments[0]?.id}`);

    // Assert
    expect(await paidIn(2026, 10)).toBe(19.5);
    expect(await paidIn(2026, 11)).toBe(22.5);
    expect(await paidIn(2026, 12)).toBe(21.5);
    expect(await paidIn(2027, 1)).toBe(21);
    expect(rowOf(await flow.period(2026, 12), 'A').adjustments).toHaveLength(1);
    expect(rowOf(await flow.period(2027, 2), 'A').adjustments).toEqual([]);
  });

  it('TC-DC-10: should stay in its own period when it is once only', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-11-26');
    await adjust(await flow.period(2026, 11), person.id, 1, false);

    // Act + Assert: 23 + 1 in November
    expect(await paidIn(2026, 11)).toBe(24);
    expect(rowOf(await flow.period(2026, 10), 'A').adjustments).toEqual([]);
    expect(rowOf(await flow.period(2026, 12), 'A').adjustments).toEqual([]);
  });

  it('TC-DC-11: should add up several in one period', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-11-26');
    const november = await flow.period(2026, 11);
    await adjust(november, person.id, -0.5, true);
    await adjust(november, person.id, -1, false);
    await adjust(november, person.id, 0.5, false);

    // Act + Assert
    expect(await paidIn(2026, 11)).toBe(22);
  });

  it('TC-DC-12: should not pay below zero however large it is', async () => {
    // Arrange: 05/10 is the last day: 6 Mon–Fri
    const person = await flow.addPerson({ code: 'A', leftOn: '2026-10-05' });
    await flow.at('2026-10-26');

    // Act
    const adjusted = await adjust(await flow.period(2026, 10), person.id, -31, false);

    // Assert
    expect(totalsOf(adjusted, 'A')).toMatchObject({ actual: 6, paid: 0, paidBeforeAdjustment: 6 });
  });

  it('TC-DC-13: should leave a balance alone when closing', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    await flow.at('2026-10-26');
    await adjust(await flow.period(2026, 10), person.id, -10, true);

    // Act
    await flow.close(2026, 10);

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').leaveOpening).toBe(3);
  });

  it('TC-DC-14: should say who added it, and how much, why and for how long in the log', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const november = await flow.period(2026, 11);

    // Act
    await adjust(november, person.id, -0.5, true, 'Sáng thứ 6 vào trễ');

    // Assert
    expect((await flow.log(november))[0]).toMatchObject({ actor: 'Lan', action: 'Điều chỉnh công' });
    expect((await flow.log(november))[0]?.detail).toContain('-0,5 công, mỗi kỳ (Sáng thứ 6 vào trễ)');
  });
});

describe('a free range of days', () => {
  const range = (from: string, to: string) => flow.call<TimesheetDto>('GET', `/range?from=${from}&to=${to}`);

  it('TC-KT-01: should take exactly 31 days and refuse 32', async () => {
    // Act + Assert
    expect((await range('2026-10-26', '2026-11-25')).periodId).toBeNull();
    expect((await flow.attempt('GET', '/range?from=2026-10-26&to=2026-11-26')).status).toBe(422);
  });

  it('TC-KT-02: should take one single day, and refuse a range running backwards or a date that is not one', async () => {
    // Act + Assert
    expect((await range('2026-11-02', '2026-11-02')).rows).toEqual([]);
    expect((await flow.attempt('GET', '/range?from=2026-11-03&to=2026-11-02')).status).toBe(422);
    expect((await flow.attempt('GET', '/range?from=hom-nay&to=2026-11-02')).status).toBe(422);
  });

  it('TC-KT-03: should cross a new year and a 25/26 border, showing what was typed on both sides', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2027-01-05');
    await flow.enter(await flow.period(2026, 12), person.id, { '2026-12-25': 'P' });
    await flow.enter(await flow.period(2027, 1), person.id, { '2026-12-28': 'M' });

    // Act
    const dto = await range('2026-12-20', '2027-01-04');

    // Assert
    expect(rowOf(dto, 'A').cells).toMatchObject({ '2026-12-25': { entered: 'P' }, '2026-12-28': { entered: 'M' } });
    expect(totalsOf(dto, 'A')).toMatchObject({ lateCount: 1, leave: 1 });
  });

  it('TC-KT-04: should not become a period that then has to be closed', async () => {
    // Arrange
    await flow.at('2026-11-26');
    await range('2026-08-01', '2026-08-20');
    const november = await flow.period(2026, 11);

    // Act
    const answer = await flow.attempt('POST', `/${november.periodId}/close`);

    // Assert
    expect(answer.status).toBe(200);
  });

  it('TC-KT-05: should list only who worked some day of it', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', leftOn: '2026-11-01' });
    await flow.addPerson({ code: 'B', joinedOn: '2026-11-20' });
    await flow.addPerson({ code: 'C' });

    // Act
    const dto = await range('2026-11-02', '2026-11-15');

    // Assert
    expect(codesIn(dto)).toEqual(['C']);
  });

  it('TC-KT-06: should say the same as the period when it covers the same days', async () => {
    // Arrange: a balance, a day of leave, a norm HR edited
    const person = await flow.addPerson({ code: 'A', openingLeave: 3 });
    await flow.at('2026-10-26');
    const october = await flow.period(2026, 10);
    await flow.enter(october, person.id, { '2026-10-05': 'P' });
    const edited = await flow.call<TimesheetDto>('PATCH', `/${october.periodId}/norms`, { norms: { [flow.hcm.id]: 21 } });

    // Act
    const same = await range(october.from, october.to);

    // Assert
    expect(totalsOf(same, 'A')).toEqual(totalsOf(edited, 'A'));
  });
});

describe('addresses that do not exist', () => {
  it('TC-CC-08: should answer that a period does not exist rather than fall over', async () => {
    // Act
    const answer = await flow.attempt('PATCH', '/khong-phai-ky/norms', { norms: {} });

    // Assert
    expect(answer.status).toBe(404);
  });

  it('TC-RG-08: should refuse a month that is not one', async () => {
    // Act + Assert
    expect((await flow.attempt('GET', '/periods/2026/13')).status).toBe(422);
    expect((await flow.attempt('GET', '/periods/2026/0')).status).toBe(422);
  });
});
