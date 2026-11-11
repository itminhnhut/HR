import type { TimesheetClosingDto, TimesheetDto } from '@careers/shared';
import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, type Flow } from '../test/timesheet-flow.js';

/**
 * Lần chốt bất biến (spec-luong.md 10.1, 4.19; docs/test-cases-luong.md L-C02, L-C05, L-C06, L-L28). Every close of a
 * timesheet period is kept as it was, with each person's code of every day; closing again adds one, never changes one.
 * People are fake: NV04, NV05. October 2026 = 26/09–25/10: 20 Mon–Fri, HCM norm 22.
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

const rowIn = (closing: TimesheetClosingDto | undefined, code: string) => {
  const row = closing?.rows.find((r) => r.code === code);
  if (!row) throw new Error(`${code} is not in the closing`);
  return row;
};

/** October with NV04 on 22 days (two Saturdays typed) and NV05 on the 20 Mon–Fri, closed on 26/10. */
async function closeOctober() {
  await flow.at('2026-10-20');
  const nv04 = await flow.addPerson({ code: 'NV04', fullName: 'NV D' });
  await flow.addPerson({ code: 'NV05', fullName: 'NV E' });
  await flow.enter(await flow.period(2026, 10), nv04.id, { '2026-10-03': '1', '2026-10-10': '1' });
  await flow.at('2026-10-26');
  const closed = await flow.close(2026, 10);
  return { nv04, closed };
}

async function reopenAndClose(change?: { employeeId: string; day: string; code: 'KL' }) {
  const october = await flow.period(2026, 10);
  await flow.call('POST', `/${october.periodId}/reopen`, { reason: 'Sửa công NV D' });
  if (change) await flow.enter(await flow.period(2026, 10), change.employeeId, { [change.day]: change.code });
  return flow.close(2026, 10);
}

describe('L-C02 a close is kept as close number 1, with what was paid', () => {
  it('L-C02: should keep the first close as number 1, when and by whom, with each person paid as the closed sheet says', async () => {
    // Arrange + Act
    const { closed } = await closeOctober();
    const closings = await closingsOf(closed);

    // Assert
    expect(closings.map((c) => [c.closeNo, c.closedAt, c.closedBy, c.source])).toEqual([
      [1, '2026-10-26T03:00:00.000Z', 'Lan', 'web'],
    ]);
    const [first] = closings;
    for (const code of ['NV04', 'NV05'])
      expect(rowIn(first, code).totals?.paid).toBe(rowOf(closed, code).frozenTotals?.paid);
    expect(rowIn(first, 'NV04').totals?.paid).toBe(22);
    expect(rowIn(first, 'NV05').totals?.paid).toBe(20);
  });

  it('L-C02: should keep the code of every day of the period, a typed one, an automatic one and a day off', async () => {
    // Arrange + Act
    const { closed } = await closeOctober();
    const [first] = await closingsOf(closed);
    const codes = rowIn(first, 'NV04').codes;

    // Assert
    expect(Object.keys(codes ?? {})).toHaveLength(30);
    expect(codes).toMatchObject({
      '2026-09-26': null,
      '2026-09-28': '1',
      '2026-10-03': '1',
      '2026-10-04': null,
      '2026-10-25': null,
    });
    expect(rowIn(first, 'NV04').cannotRebuild).toBe(false);
  });

  it('L-C02: should number closes per period, so the next month starts at 1 again', async () => {
    // Arrange
    await closeOctober();
    await flow.at('2026-11-26');

    // Act
    const november = await flow.close(2026, 11);

    // Assert
    expect((await closingsOf(november)).map((c) => c.closeNo)).toEqual([1]);
  });
});

describe('L-C05 closing again with the same figures', () => {
  it('L-C05: should add close number 2 that differs from number 1 in nothing', async () => {
    // Arrange
    const { closed } = await closeOctober();

    // Act
    await reopenAndClose();
    const closings = await closingsOf(closed);

    // Assert
    expect(closings.map((c) => c.closeNo)).toEqual([1, 2]);
    expect(closings[0]?.changesFromPrevious).toBeNull();
    expect(closings[1]?.changesFromPrevious).toEqual([]);
  });
});

describe('L-C06 closing again with other figures', () => {
  it('L-C06: should keep close 1 at 22 days, give close 2 the 21 days, and say who changed from what to what', async () => {
    // Arrange
    const { nv04, closed } = await closeOctober();

    // Act
    await reopenAndClose({ employeeId: nv04.id, day: '2026-10-05', code: 'KL' });
    const [first, second] = await closingsOf(closed);

    // Assert
    expect(rowIn(first, 'NV04').totals?.paid).toBe(22);
    expect(rowIn(second, 'NV04').totals?.paid).toBe(21);
    expect(second?.changesFromPrevious).toHaveLength(1);
    expect(second?.changesFromPrevious?.[0]).toMatchObject({ employeeId: nv04.id, code: 'NV04', fullName: 'NV D' });
    expect(second?.changesFromPrevious?.[0]?.changes).toEqual(
      expect.arrayContaining([
        { label: 'Công hưởng lương', before: '22', after: '21' },
        { label: 'Nghỉ không lương', before: '0', after: '1' },
        { label: 'Ngày 05/10/2026', before: '1', after: 'KL' },
      ]),
    );
  });
});

describe('L-L28 a close is never changed', () => {
  it('L-L28: should still read close 1 with its own codes after the period is reopened, edited and closed again', async () => {
    // Arrange
    const { nv04, closed } = await closeOctober();

    // Act
    await reopenAndClose({ employeeId: nv04.id, day: '2026-10-05', code: 'KL' });
    const [first, second] = await closingsOf(closed);

    // Assert
    expect(rowIn(first, 'NV04').codes?.['2026-10-05']).toBe('1');
    expect(rowIn(second, 'NV04').codes?.['2026-10-05']).toBe('KL');
    expect(first?.closedAt).toBe('2026-10-26T03:00:00.000Z');
  });

  it('L-L28: should refuse to change or remove a close, and to delete a period that has one (RESTRICT)', async () => {
    // Arrange
    const { closed } = await closeOctober();
    const db = flow.t.db;

    // Act + Assert
    await expect(db.execute(sql`update timesheet_closings set closed_by = 'Ai đó'`)).rejects.toThrow();
    await expect(db.execute(sql`update timesheet_closing_rows set full_name = 'Ai đó'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from timesheet_closing_rows`)).rejects.toThrow();
    await expect(db.execute(sql`delete from timesheet_closings`)).rejects.toThrow();
    await expect(db.execute(sql`delete from timesheet_periods where id = ${closed.periodId}`)).rejects.toThrow();
    expect(await closingsOf(closed)).toHaveLength(1);
  });

  it('L-L28: should not keep anything for a period that was never closed', async () => {
    // Arrange
    await flow.at('2026-10-20');
    await flow.addPerson({ code: 'NV04' });

    // Act
    const october = await flow.period(2026, 10);

    // Assert
    expect(await closingsOf(october)).toEqual([]);
  });
});
