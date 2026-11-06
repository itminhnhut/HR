import { describe, expect, it } from 'vitest';
import { daysOfHolidayBreak, groupHolidays, holidaysInEffect, monthStatus, daysBetweenInclusive, periodDays, periodMonthOf, standardPeriod, suggestedNorm, WEEKDAY_LABELS, weekdayOf } from './timesheet.js';

/**
 * Periods as the sheets make them: =LET(bd,DATE($G$2,$G$3-1,26),kt,DATE($G$2,$G$3,25),SEQUENCE(1,kt-bd+1,bd)) on row 7.
 * Case numbers: docs/test-cases-cham-cong.md.
 */

/** The formula of row 7, done with the JS date that behaves the same for month 0 and for leap years. */
function sheetFormula(year: number, month: number) {
  const bd = new Date(Date.UTC(year, month - 2, 26));
  const kt = new Date(Date.UTC(year, month - 1, 25));
  return { from: bd.toISOString().slice(0, 10), to: kt.toISOString().slice(0, 10), days: Math.round((kt.getTime() - bd.getTime()) / 86_400_000) + 1 };
}

const MONTHS = Array.from({ length: 12 * 6 }, (_, i) => ({ year: 2026 + Math.floor(i / 12), month: (i % 12) + 1 }));

describe('the 26–25 period', () => {
  it.each(MONTHS)('TC-RG-01: should match the formula of the sheets for $month/$year', ({ year, month }) => {
    // Arrange
    const sheet = sheetFormula(year, month);

    // Act
    const range = standardPeriod(year, month);

    // Assert
    expect(range).toEqual({ from: sheet.from, to: sheet.to });
    expect(periodDays(range)).toHaveLength(sheet.days);
  });

  it('TC-RG-02: should leave no day out and no day twice between one period and the next', () => {
    // Act
    const days = MONTHS.flatMap(({ year, month }) => periodDays(standardPeriod(year, month)));

    // Assert
    const first = days[0] ?? '';
    const last = days.at(-1) ?? '';
    expect(new Set(days).size).toBe(days.length);
    expect(days).toHaveLength(daysBetweenInclusive(first, last));
  });

  it('TC-RG-03: should put the 25th in its month and the 26th in the next', () => {
    expect(periodMonthOf('2026-10-25')).toEqual({ year: 2026, month: 10 });
    expect(periodMonthOf('2026-10-26')).toEqual({ year: 2026, month: 11 });
    expect(periodMonthOf('2026-11-25')).toEqual({ year: 2026, month: 11 });
    expect(periodMonthOf('2026-11-26')).toEqual({ year: 2026, month: 12 });
  });

  it('TC-RG-04: should start January on 26/12 of the year before', () => {
    expect(standardPeriod(2027, 1)).toEqual({ from: '2026-12-26', to: '2027-01-25' });
    expect(periodMonthOf('2026-12-25')).toEqual({ year: 2026, month: 12 });
    expect(periodMonthOf('2026-12-26')).toEqual({ year: 2027, month: 1 });
    expect(periodMonthOf('2026-12-31')).toEqual({ year: 2027, month: 1 });
    expect(periodMonthOf('2027-01-01')).toEqual({ year: 2027, month: 1 });
    expect(periodMonthOf('2027-01-25')).toEqual({ year: 2027, month: 1 });
    expect(periodMonthOf('2027-01-26')).toEqual({ year: 2027, month: 2 });
  });

  it('TC-RG-05: should put every day of a period back in that period', () => {
    for (const { year, month } of MONTHS) {
      for (const day of periodDays(standardPeriod(year, month))) {
        expect(periodMonthOf(day), day).toEqual({ year, month });
      }
    }
  });

  it('TC-RG-06: should have 30 days in "Tháng 10.26" and 31 in "Tháng 11.26", as the two sheets have', () => {
    expect(periodDays(standardPeriod(2026, 10))).toHaveLength(30);
    expect(periodDays(standardPeriod(2026, 11))).toHaveLength(31);
  });

  it('TC-RG-07: should start "Tháng 10.26" on a Saturday and "Tháng 11.26" on a Monday, as row 8 of the sheets says', () => {
    expect(WEEKDAY_LABELS[weekdayOf('2026-09-26')]).toBe('T7');
    expect(WEEKDAY_LABELS[weekdayOf('2026-10-25')]).toBe('CN');
    expect(WEEKDAY_LABELS[weekdayOf('2026-10-26')]).toBe('T2');
    expect(WEEKDAY_LABELS[weekdayOf('2026-11-25')]).toBe('T4');
  });
});

describe('February', () => {
  it('TC-T2-01: should give the March period only the days February has', () => {
    expect(standardPeriod(2027, 3)).toEqual({ from: '2027-02-26', to: '2027-03-25' });
    expect(periodDays(standardPeriod(2027, 3))).toHaveLength(28);
    expect(periodDays(standardPeriod(2027, 3)).slice(2, 4)).toEqual(['2027-02-28', '2027-03-01']);
  });

  it('TC-T2-02: should give the March period one more day in a leap year', () => {
    expect(periodDays(standardPeriod(2028, 3))).toHaveLength(29);
    expect(periodDays(standardPeriod(2028, 3))).toContain('2028-02-29');
  });

  it('TC-T2-03: should run the February period the usual 26/1 to 25/2', () => {
    expect(standardPeriod(2027, 2)).toEqual({ from: '2027-01-26', to: '2027-02-25' });
    expect(periodDays(standardPeriod(2027, 2))).toHaveLength(31);
  });

  it('TC-T2-04: should suggest a norm from the weekdays of those short periods', () => {
    // 26/2/2027 is a Friday: 28 days are exactly 4 weeks, so 20 Mon–Fri
    expect(suggestedNorm(standardPeriod(2027, 3), 2)).toBe(22);
    expect(suggestedNorm(standardPeriod(2027, 3), 4)).toBe(24);
    // 26/2/2028 is a Saturday: 4 weeks and one more Saturday, still 20 Mon–Fri
    expect(suggestedNorm(standardPeriod(2028, 3), 2)).toBe(22);
  });
});

describe('the suggested norm', () => {
  it('TC-CC-04: should give what G4 and G5 of both sheets hold', () => {
    expect(suggestedNorm(standardPeriod(2026, 10), 2)).toBe(22);
    expect(suggestedNorm(standardPeriod(2026, 10), 4)).toBe(24);
    expect(suggestedNorm(standardPeriod(2026, 11), 2)).toBe(25);
    expect(suggestedNorm(standardPeriod(2026, 11), 4)).toBe(27);
  });

  it('TC-CC-05: should count T2–T6 by hand-counted weeks across the new year', () => {
    // 26/12/2026 is a Saturday: 4 full weeks of 5, then Saturday, Sunday and Monday 25/1
    expect(suggestedNorm(standardPeriod(2027, 1), 0)).toBe(21);
    expect(suggestedNorm(standardPeriod(2027, 1), 2)).toBe(23);
  });

  it('TC-CC-06: should keep a holiday in the norm, as G4 of "Tháng 11.26" does with 24/11 inside its 25', () => {
    // 23 Mon–Fri including Tuesday 24/11, plus 2 Saturdays
    expect(WEEKDAY_LABELS[weekdayOf('2026-11-24')]).toBe('T3');
    expect(suggestedNorm(standardPeriod(2026, 11), 2)).toBe(25);
  });
});

describe('a holiday on a Sunday (Điều 111 khoản 3 BLLĐ 2019)', () => {
  it('should be taken on the next working day, TC-LE-06', () => {
    // Act
    const inEffect = holidaysInEffect([{ day: '2026-11-22', name: 'Lễ' }]);

    // Assert
    expect(inEffect).toEqual([{ day: '2026-11-23', name: 'Nghỉ bù Lễ' }]);
  });

  it('should skip a day that is already a holiday, as 30/4 on a Sunday before 1/5', () => {
    // Act
    const inEffect = holidaysInEffect([{ day: '2028-04-30', name: 'Chiến thắng' }, { day: '2028-05-01', name: 'Lao động' }]);

    // Assert
    expect(inEffect).toEqual([{ day: '2028-05-01', name: 'Lao động' }, { day: '2028-05-02', name: 'Nghỉ bù Chiến thắng' }]);
  });

  it('should stay on a Saturday or a weekday, since those are not the weekly day of rest, TC-LE-05', () => {
    // Arrange
    const list = [{ day: '2026-11-21', name: 'Thứ Bảy' }, { day: '2026-11-24', name: 'Thứ Ba' }];

    // Act
    const inEffect = holidaysInEffect(list);

    // Assert
    expect(inEffect).toEqual(list);
  });
});

describe('where a month stands', () => {
  const range = standardPeriod(2026, 11);

  it.each([
    ['closed', { isClosed: true, hasEntries: true, today: '2026-12-01' }],
    ['future', { isClosed: false, hasEntries: false, today: '2026-10-25' }],
    ['running', { isClosed: false, hasEntries: false, today: '2026-10-26' }],
    ['running', { isClosed: false, hasEntries: false, today: '2026-11-25' }],
    ['waiting', { isClosed: false, hasEntries: true, today: '2026-11-26' }],
    ['empty', { isClosed: false, hasEntries: false, today: '2026-11-26' }],
  ])('should be %s with %o', (expected, args) => {
    // Act + Assert
    expect(monthStatus({ ...args, range })).toBe(expected);
  });
});

describe('a long break such as Tết', () => {
  it('should leave out the Sundays in it, which the announced schedule already counts as rest, TC-LE-07', () => {
    // Act: Saturday 14/02 to Sunday 22/02/2026
    const days = daysOfHolidayBreak('2026-02-14', '2026-02-22');

    // Assert
    expect(days).toEqual(['2026-02-14', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21']);
  });

  it('should keep one day on its own even on a Sunday, so that it moves to the next working day', () => {
    // Act + Assert
    expect(daysOfHolidayBreak('2026-11-22', '2026-11-22')).toEqual(['2026-11-22']);
  });

  it('should show a break as one line, across the Sunday it leaves out', () => {
    // Arrange
    const list = [
      ...daysOfHolidayBreak('2026-02-14', '2026-02-22').map((day) => ({ day, name: 'Tết' })),
      { day: '2026-04-30', name: 'Chiến thắng' },
      { day: '2026-05-01', name: 'Lao động' },
    ];

    // Act
    const groups = groupHolidays(list);

    // Assert
    expect(groups).toEqual([
      { from: '2026-02-14', to: '2026-02-21', name: 'Tết', days: 7 },
      { from: '2026-04-30', to: '2026-04-30', name: 'Chiến thắng', days: 1 },
      { from: '2026-05-01', to: '2026-05-01', name: 'Lao động', days: 1 },
    ]);
  });
});

describe('a fixed holiday on a Sunday inside a range (Điều 111 khoản 3)', () => {
  it('TC-LE-11: should give the same day in lieu whether 30/4–1/5/2028 is entered as a range or day by day', () => {
    // Arrange: 30/4/2028 is a Sunday
    const asRange = daysOfHolidayBreak('2028-04-30', '2028-05-01').map((day) => ({ day, name: 'Lễ 30/4 – 1/5' }));
    const oneByOne = [{ day: '2028-04-30', name: 'Ngày Chiến thắng' }, { day: '2028-05-01', name: 'Quốc tế Lao động' }];

    // Act
    const days = (list: { day: string; name: string }[]) => holidaysInEffect(list).map((h) => h.day);

    // Assert: 1/5 and the day in lieu 2/5, both ways
    expect(days(asRange)).toEqual(['2028-05-01', '2028-05-02']);
    expect(days(oneByOne)).toEqual(['2028-05-01', '2028-05-02']);
  });

  it('TC-LE-12: should keep 2/9/2029, a Sunday, inside a range so that it moves to Monday', () => {
    // Act
    const days = holidaysInEffect(daysOfHolidayBreak('2029-09-01', '2029-09-03').map((day) => ({ day, name: 'Quốc khánh' }))).map((h) => h.day);

    // Assert: 1/9 (Saturday), 3/9 and 4/9 in lieu of the Sunday
    expect(days).toEqual(['2029-09-01', '2029-09-03', '2029-09-04']);
  });

  it('TC-LE-13: should still leave out a Sunday of Tết, which the announced schedule already counts', () => {
    // Act + Assert: 22/2/2026 is a Sunday inside the Tết break
    expect(daysOfHolidayBreak('2026-02-14', '2026-02-22')).not.toContain('2026-02-22');
  });
});

