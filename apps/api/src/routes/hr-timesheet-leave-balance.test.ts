import type { LeaveBalanceDto, TimesheetAbsenceDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, totalsOf, type Flow } from '../test/timesheet-flow.js';

/** "Phép còn" while HR fills the leave form: the sheet's own leave count, with the absence about to be saved added. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const balanceOf = (id: string, from: string, to: string, code = 'P') =>
  flow.call<LeaveBalanceDto>('GET', `/employees/${id}/leave-balance?from=${from}&to=${to}&code=${encodeURIComponent(code)}`);
const register = (id: string, body: Record<string, unknown>) =>
  flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${id}/absences`, { approvedBy: 'Giám đốc', ...body }, 201);

describe('the leave balance shown while entering leave', () => {
  it('TC-NP-01: should say what is left today, as the sheet counts it, and what the absence leaves', async () => {
    // Arrange: 3 days carried in, today 05/11
    const person = await flow.addPerson({ code: 'A', openingLeave: 3 });

    // Act: two days of annual leave on 09–10/11
    const balance = await balanceOf(person.id, '2026-11-09', '2026-11-10');

    // Assert
    expect(balance.now).toBe(totalsOf(await flow.period(2026, 11), 'A').leaveClosing);
    expect(balance).toEqual({ now: 3, after: 1, overdrawn: 0 });
  });

  it('TC-NP-02: should go below zero and say by how much when the absence takes more than is left', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 1 });

    // Act: three days on 09–11/11
    const balance = await balanceOf(person.id, '2026-11-09', '2026-11-11');

    // Assert
    expect(balance).toEqual({ now: 1, after: -2, overdrawn: 2 });
  });

  it('TC-NP-03: should take leave already approved off what is left before this absence', async () => {
    // Arrange: two days approved on 09–10/11
    const person = await flow.addPerson({ code: 'A', openingLeave: 3 });
    await register(person.id, { reason: 'annual', from: '2026-11-09', to: '2026-11-10' });

    // Act: half a day on 12/11
    const balance = await balanceOf(person.id, '2026-11-12', '2026-11-12', 'P/2');

    // Assert
    expect(balance).toEqual({ now: 1, after: 0.5, overdrawn: 0 });
  });

  it('TC-NP-04: should carry the balance into a later period for leave planned ahead', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 3 });

    // Act: 01–02/12 is in the December period
    const annual = await balanceOf(person.id, '2026-12-01', '2026-12-02');
    const unpaid = await balanceOf(person.id, '2026-12-01', '2026-12-02', 'KL');

    // Assert
    expect(annual).toEqual({ now: 3, after: 1, overdrawn: 0 });
    expect(unpaid).toEqual({ now: 3, after: 3, overdrawn: 0 });
  });

  it('TC-NP-05: should not count a weekend, nor a day already marked on the sheet', async () => {
    // Arrange: P typed by hand on 10/11
    const person = await flow.addPerson({ code: 'A', openingLeave: 5 });
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-10': 'P' });

    // Act: Friday 06/11 to Tuesday 10/11
    const balance = await balanceOf(person.id, '2026-11-06', '2026-11-10');

    // Assert: 06/11 and 09/11 only
    expect(balance).toEqual({ now: 4, after: 2, overdrawn: 0 });
  });

  it('TC-NP-06: should refuse someone unknown or dates the wrong way round', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const unknown = await flow.attempt('GET', '/employees/00000000-0000-4000-8000-000000000000/leave-balance?from=2026-11-09&to=2026-11-09&code=P');
    const backwards = await flow.attempt('GET', `/employees/${person.id}/leave-balance?from=2026-11-10&to=2026-11-09&code=P`);

    // Assert
    expect(unknown.status).toBe(404);
    expect(backwards.status).toBe(422);
  });
});
