import { describe, expect, it } from 'vitest';
import { paidBySegment, restDayWork, type AttendanceCode } from './timesheet.js';

/** What payroll reads from a period beyond its totals. Cases: docs/test-cases-cham-cong.md, TC-TL. */

describe('work on a rest day or a holiday', () => {
  it('TC-TL-01: should count a Sunday worked and a holiday worked apart, and nothing for a holiday off', () => {
    // Arrange: Sunday 8/11, holiday Tuesday 24/11 worked, holiday 25/11 off
    const days = ['2026-11-08', '2026-11-09', '2026-11-24', '2026-11-25'];
    const codes: (AttendanceCode | null)[] = ['1', '1', '1', 'NL'];

    // Act
    const work = restDayWork(days, codes, new Set(['2026-11-24', '2026-11-25']));

    // Assert
    expect(work).toEqual({ sundayWorked: 1, holidayWorked: 1 });
  });

  it('TC-TL-02: should count a late arrival on a Sunday as a Sunday worked', () => {
    expect(restDayWork(['2026-11-08'], ['M'], new Set())).toEqual({ sundayWorked: 1, holidayWorked: 0 });
  });
});

describe('paid days on each side of the day someone became official', () => {
  it('TC-TL-03: should split paid days, leave and holidays included, so the two parts add up to the paid total', () => {
    // Arrange: official from 4/11; before it 1 worked + 1 P paid, from it 1 worked + 1 NL + 1 P/2
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
    const codes: (AttendanceCode | null)[] = ['1', 'P', '1', 'NL', 'P/2'];

    // Act: worked 2,5 + leave 1,5 + holiday 1 = 5 paid days in all
    const split = paidBySegment({ days, codes, splitOn: '2026-11-04', leavePaid: 1.5, paid: 5 });

    // Assert: before 1 + 1, after 1 + 1 + (0,5 + 0,5)
    expect(split).toEqual({ before: 2, after: 3 });
  });

  it('TC-TL-04: should leave unpaid the latest leave days when the balance does not cover them all', () => {
    // Arrange: P before and after the date, only 1 day of leave paid
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    const codes: (AttendanceCode | null)[] = ['1', 'P', '1', 'P'];

    // Act
    const split = paidBySegment({ days, codes, splitOn: '2026-11-04', leavePaid: 1, paid: 3 });

    // Assert: the earlier P is the paid one
    expect(split).toEqual({ before: 2, after: 1 });
  });

  it('TC-TL-05: should keep the parts within the paid total when days above the norm are not paid', () => {
    // Arrange: 6 days worked, norm 4
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const split = paidBySegment({ days, codes: ['1', '1', '1', '1', '1', '1'], splitOn: '2026-11-05', leavePaid: 0, paid: 4 });

    // Assert: the days paid are the first 4
    expect(split).toEqual({ before: 3, after: 1 });
  });
});
