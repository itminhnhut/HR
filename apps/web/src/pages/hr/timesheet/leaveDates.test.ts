import { workingDayCheck } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { defaultEnd, lastOfWorkdays, typedDaysWithin, typedNotice, workdaysBetween } from './leaveDates';

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

describe('days HR typed on the sheet inside the dates of a new absence (B3)', () => {
  const typed = (code: string, from: string, to: string, over: { employeeId?: string; source?: 'absence' | 'sheet' } = {}) => ({ source: 'sheet' as const, employeeId: 'e1', code, from, to, ...over });

  it('should find the days of the person\'s typed lines inside the dates, and none of a registered absence or another person', () => {
    // Arrange: KL typed Thursday 5/11 to Monday 9/11, over a weekend; a registered absence and someone else on the same days
    const lines = [typed('KL', '2026-11-05', '2026-11-09'), typed('P', '2026-11-04', '2026-11-04', { source: 'absence' }), typed('P', '2026-11-04', '2026-11-04', { employeeId: 'e2' })];

    // Act
    const days = typedDaysWithin(lines, 'e1', '2026-11-03', '2026-11-06');

    // Assert
    expect(days).toEqual([{ day: '2026-11-05', code: 'KL' }, { day: '2026-11-06', code: 'KL' }]);
  });

  it('should leave out the typed line the form is taking over', () => {
    // Arrange
    const line = typed('P', '2026-11-05', '2026-11-06');

    // Act + Assert
    expect(typedDaysWithin([line], 'e1', '2026-11-03', '2026-11-06', { code: 'P', from: '2026-11-05', to: '2026-11-06' })).toEqual([]);
  });

  it('should say how many days saving will count when it fills around days typed with another code', () => {
    // Act: P over 3–5/11, KL typed on 4/11
    const notice = typedNotice([{ day: '2026-11-04', code: 'KL' }], 'P', 3, WEEKDAYS);

    // Assert
    expect(notice).toBe('04/11 đã chấm trên bảng công (KL): giữ nguyên, không tính. Lưu sẽ tính 2 ngày.');
  });

  it('should warn that saving is refused over a day typed with the same code', () => {
    // Act
    const notice = typedNotice([{ day: '2026-11-04', code: 'P' }], 'P', 3, WEEKDAYS);

    // Assert
    expect(notice).toBe('04/11 đã chấm P trên bảng công: lưu sẽ bị từ chối. Bấm "Sửa" trên dòng đó để gộp vào, hoặc chọn ngày khác.');
  });

  it('should say nothing when no typed day is in the way', () => {
    // Act + Assert
    expect(typedNotice([], 'P', 3, WEEKDAYS)).toBeNull();
  });
});
