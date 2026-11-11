import type { EmployeeDto, TimesheetClosingDto, TimesheetDto, TimesheetLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/**
 * People as Lương needs them (spec-luong.md 10.1, 4.20; docs/test-cases-luong.md L-B26, L-L29): khối, kept in each
 * close, and dates HR confirmed. People are fake.
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

describe('L-B26 khối is part of each close', () => {
  it('L-B26: should keep BO in the November close after the person moves to KD from December', async () => {
    // Arrange
    await flow.at('2026-11-20');
    const nv07 = await flow.addPerson({ code: 'NV07', fullName: 'NV G', block: 'BO' });
    await flow.at('2026-11-26');
    const november = await flow.close(2026, 11);

    // Act
    await flow.updatePerson(nv07, { block: 'KD' });
    await flow.at('2026-12-26');
    const december = await flow.close(2026, 12);

    // Assert
    expect((await closingsOf(november))[0]?.rows.map((r) => [r.code, r.block])).toEqual([['NV07', 'BO']]);
    expect((await closingsOf(december))[0]?.rows.map((r) => [r.code, r.block])).toEqual([['NV07', 'KD']]);
  });

  it('L-B26: should log the change of khối, and refuse anything but BO or KD', async () => {
    // Arrange
    await flow.at('2026-11-20');
    const nv07 = await flow.addPerson({ code: 'NV07', fullName: 'NV G', block: 'BO' });

    // Act
    const saved = await flow.updatePerson(nv07, { block: 'KD' });
    const wrong = await flow.attempt('PATCH', `/employees/${nv07.id}`, { ...saved, id: undefined, block: 'XX' });

    // Assert
    expect(saved.block).toBe('KD');
    expect(wrong.status).toBe(422);
    const log = await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nhan-vien');
    expect(log.lines[0]?.detail).toBe('NV07 NV G: Khối BO → KD');
  });

  it('L-B26: should leave khối empty for someone it was never given to', async () => {
    // Act
    const person = await flow.addPerson({ code: 'NV08' });

    // Assert
    expect(person.block).toBeNull();
  });
});

describe('L-L29 dates HR has confirmed', () => {
  it('L-L29: should hold an official date typed in as not confirmed until HR confirms it', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV09', officialOn: '2026-10-15' });

    // Act
    const confirmed = await flow.updatePerson(person, { officialOnConfirmed: true });

    // Assert
    expect(person).toMatchObject({ joinedOnConfirmed: false, officialOnConfirmed: false, leftOnConfirmed: false });
    expect(confirmed.officialOnConfirmed).toBe(true);
    const log = await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nhan-vien');
    expect(log.lines[0]?.detail).toBe('NV09 Người Thử: Xác nhận ngày chính thức Chưa → Có');
  });

  it('L-L29: should drop the confirmation when the date changes, unless the same save confirms the new one', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV09', officialOn: '2026-10-15', officialOnConfirmed: true });

    // Act
    const moved = await flow.updatePerson(person, { officialOn: '2026-10-20', officialOnConfirmed: undefined });
    const movedAndConfirmed = await flow.updatePerson(moved, { officialOn: '2026-10-21', officialOnConfirmed: true });

    // Assert
    expect(person.officialOnConfirmed).toBe(true);
    expect(moved.officialOnConfirmed).toBe(false);
    expect(movedAndConfirmed.officialOnConfirmed).toBe(true);
  });

  it('L-L29: should put the official date in the close', async () => {
    // Arrange
    await flow.at('2026-10-20');
    await flow.addPerson({ code: 'NV09', employment: 'probation', officialOn: '2026-10-15' });
    await flow.at('2026-10-26');

    // Act
    const closed = await flow.close(2026, 10);

    // Assert
    expect((await closingsOf(closed))[0]?.rows[0]?.officialOn).toBe('2026-10-15');
  });
});

describe('employees as the form sends them', () => {
  it('should keep khối and confirmations when a form that does not know them saves the person', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV10', block: 'KD', joinedOn: '2026-01-05', joinedOnConfirmed: true });
    const {
      block: _block,
      joinedOnConfirmed: _confirmed,
      officialOnConfirmed: _o,
      leftOnConfirmed: _l,
      ...oldForm
    } = person;

    // Act
    const saved = await flow.call<EmployeeDto>('PATCH', `/employees/${person.id}`, {
      ...oldForm,
      id: undefined,
      title: 'Kế toán',
    });

    // Assert
    expect(saved).toMatchObject({ block: 'KD', joinedOnConfirmed: true, title: 'Kế toán' });
  });
});
