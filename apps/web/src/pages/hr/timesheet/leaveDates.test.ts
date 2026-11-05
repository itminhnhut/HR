import { describe, expect, it } from 'vitest';
import { defaultEnd, lastOfWeekdays, weekdaysBetween } from './leaveDates';

describe('how long an absence runs by default', () => {
  it('should skip Saturday and Sunday: 3 days from Thursday end on Monday', () => {
    // Act + Assert: 05/11/2026 is a Thursday
    expect(lastOfWeekdays('2026-11-05', 3)).toBe('2026-11-09');
  });

  it('should stay on the day for one day', () => {
    // Act + Assert
    expect(lastOfWeekdays('2026-11-05', 1)).toBe('2026-11-05');
  });

  it('should start counting on Monday when picked on a weekend', () => {
    // Act + Assert: 07/11/2026 is a Saturday
    expect(lastOfWeekdays('2026-11-07', 1)).toBe('2026-11-09');
  });

  it('should count back the same number it was given', () => {
    // Act + Assert
    expect(weekdaysBetween('2026-11-05', lastOfWeekdays('2026-11-05', 7))).toBe(7);
  });

  it('should run maternity leave for 6 months, across a new year', () => {
    // Act + Assert
    expect(defaultEnd('2026-11-05', 'maternity', 1)).toBe('2027-05-04');
  });
});
