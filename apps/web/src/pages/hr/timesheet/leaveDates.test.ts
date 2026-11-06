import { workingDayCheck } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { defaultEnd, lastOfWorkdays, workdaysBetween } from './leaveDates';

const WEEKDAYS = workingDayCheck(undefined);
/** A region working every Saturday of the period, as Hà Nội does (4 of 4 in T11/2026). */
const ALL_SATURDAYS = workingDayCheck({ saturdays: 4 });

describe('how long an absence runs by default', () => {
  it('should skip Saturday and Sunday: 3 days from Thursday end on Monday', () => {
    // Act + Assert: 05/11/2026 is a Thursday
    expect(lastOfWorkdays('2026-11-05', 3, WEEKDAYS)).toBe('2026-11-09');
  });

  it('should stay on the day for one day', () => {
    // Act + Assert
    expect(lastOfWorkdays('2026-11-05', 1, WEEKDAYS)).toBe('2026-11-05');
  });

  it('should start counting on Monday when picked on a weekend', () => {
    // Act + Assert: 07/11/2026 is a Saturday
    expect(lastOfWorkdays('2026-11-07', 1, WEEKDAYS)).toBe('2026-11-09');
  });

  it('should count back the same number it was given', () => {
    // Act + Assert
    expect(workdaysBetween('2026-11-05', lastOfWorkdays('2026-11-05', 7, WEEKDAYS), WEEKDAYS)).toBe(7);
  });

  it('should run maternity leave for 6 months, across a new year', () => {
    // Act + Assert
    expect(defaultEnd('2026-11-05', 'maternity', 1, WEEKDAYS)).toBe('2027-05-04');
  });
});

describe('the same working days the sheet fills (RV2-06)', () => {
  it('should count Saturday where the region works every Saturday: 3 days from Thursday end on Saturday', () => {
    // Act + Assert
    expect(lastOfWorkdays('2026-11-05', 3, ALL_SATURDAYS)).toBe('2026-11-07');
    expect(workdaysBetween('2026-11-05', '2026-11-09', ALL_SATURDAYS)).toBe(4);
  });

  it('should not count Saturday where the region works only some of them', () => {
    // Act + Assert: 2 of 4, as Hồ Chí Minh
    expect(lastOfWorkdays('2026-11-05', 3, workingDayCheck({ saturdays: 2 }))).toBe('2026-11-09');
  });

  it('should not count a holiday, which keeps NL on the sheet', () => {
    // Arrange: a holiday on Friday 06/11/2026
    const isWorked = workingDayCheck(undefined, new Set(['2026-11-06']));

    // Act + Assert: Thursday, Monday, Tuesday
    expect(lastOfWorkdays('2026-11-05', 3, isWorked)).toBe('2026-11-10');
  });
});
