import { describe, expect, it } from 'vitest';
import {
  dayCode,
  isWeekend,
  periodDays,
  periodMonthOf,
  standardPeriod,
  suggestedNorm,
  timesheetTotals,
  type AttendanceCode,
  type StaffType,
} from './timesheet.js';

/**
 * Sheet "Tháng 10.26" of HR's workbook: people are anonymous, the numbers are the sheet's. Only what HR has to enter
 * is given here (exceptions, Saturdays, working dates): the rest must come out of the rules, and match to the cell.
 */
const OCTOBER = standardPeriod(2026, 10);
const OCTOBER_TODAY = '2026-10-25';

interface Person {
  id: string;
  employment: StaffType;
  norm: number;
  opening: number;
  joinedOn?: string;
  leftOn?: string;
  adjustment?: number;
  entered: Record<string, AttendanceCode>;
  expected: [actual: number, late: number, leave: number, unpaid: number, paid: number, closing: number];
}

const sat = (...days: string[]) => Object.fromEntries(days.map((d) => [`2026-10-${d}`, '1' as AttendanceCode]));
const SHEET: Person[] = [
  { id: 'A', employment: 'official', norm: 22, opening: 7.5, entered: sat('10', '24'), expected: [22, 0, 0, 0, 22, 8.5] },
  { id: 'B', employment: 'official', norm: 22, opening: 3, entered: sat('10', '17'), expected: [22, 0, 0, 0, 22, 4] },
  { id: 'C', employment: 'official', norm: 22, opening: 2, entered: sat('10', '24'), expected: [22, 0, 0, 0, 22, 3] },
  { id: 'D', employment: 'official', norm: 22, opening: 1, entered: { ...sat('03', '17'), '2026-10-21': 'P' }, expected: [21, 0, 1, 0, 22, 1] },
  { id: 'E', employment: 'official', norm: 22, opening: 0, leftOn: '2026-10-09', entered: { '2026-10-06': 'P/2' }, expected: [9.5, 0, 0.5, 0, 9.5, 0] },
  {
    id: 'F', employment: 'official', norm: 22, opening: 0.5,
    entered: { ...sat('03', '17'), '2026-10-05': 'P', '2026-10-06': 'P', '2026-10-14': 'M', '2026-10-16': 'P' },
    expected: [19, 1, 3, 0, 20.5, 0],
  },
  { id: 'G', employment: 'probation', norm: 22, opening: 0, adjustment: -0.5, entered: { ...sat('17', '24'), '2026-10-15': 'KL/2' }, expected: [21.5, 0, 0, 0.5, 21, 0] },
  { id: 'H', employment: 'probation', norm: 22, opening: 0, leftOn: '2026-10-15', entered: { ...sat('03'), '2026-10-02': 'M', '2026-10-08': 'M' }, expected: [15, 2, 0, 0, 15, 0] },
  { id: 'I', employment: 'probation', norm: 22, opening: 0, entered: { '2026-10-09': 'KL/2' }, expected: [19.5, 0, 0, 0.5, 19.5, 0] },
  { id: 'J', employment: 'probation', norm: 22, opening: 0, joinedOn: '2026-10-07', entered: { ...sat('17', '24'), '2026-10-13': 'M', '2026-10-16': 'KL', '2026-10-23': 'M' }, expected: [14, 2, 0, 1, 14, 0] },
  { id: 'K', employment: 'official', norm: 24, opening: 6, entered: sat('03', '10', '17', '24'), expected: [24, 0, 0, 0, 24, 7] },
  { id: 'L', employment: 'probation', norm: 24, opening: 0, entered: sat('03', '10', '17', '24'), expected: [24, 0, 0, 0, 24, 0] },
];

function codesOf(person: Person) {
  return periodDays(OCTOBER).map((day) =>
    dayCode({
      day,
      entered: person.entered[day] ?? null,
      isHoliday: false,
      today: OCTOBER_TODAY,
      joinedOn: person.joinedOn ?? null,
      leftOn: person.leftOn ?? null,
    }),
  );
}

describe('the October sheet of the workbook', () => {
  it.each(SHEET)('should give person $id the same numbers as the sheet', (person) => {
    // Act
    const totals = timesheetTotals({
      codes: codesOf(person),
      norm: person.norm,
      leaveOpening: person.opening,
      employment: person.employment,
      adjustment: person.adjustment ?? 0,
    });

    // Assert
    const [actual, late, leave, unpaid, paid, closing] = person.expected;
    expect(totals).toMatchObject({ actual, lateCount: late, leave, unpaidLeave: unpaid, paid, leaveClosing: closing, overtime: 0 });
  });

  it('should need HR to enter only 36 of its 240 filled cells', () => {
    // Act
    const entered = SHEET.reduce((n, p) => n + Object.keys(p.entered).length, 0);

    // Assert
    expect(entered).toBe(36);
  });
});

describe('a period', () => {
  it('should run from the 26th to the 25th, also across a new year', () => {
    expect(standardPeriod(2026, 11)).toEqual({ from: '2026-10-26', to: '2026-11-25' });
    expect(standardPeriod(2027, 1)).toEqual({ from: '2026-12-26', to: '2027-01-25' });
    expect(periodDays(standardPeriod(2026, 11))).toHaveLength(31);
    expect(periodDays(standardPeriod(2027, 3))).toHaveLength(28);
  });

  it('should know which month a day belongs to', () => {
    expect(periodMonthOf('2026-10-25')).toEqual({ year: 2026, month: 10 });
    expect(periodMonthOf('2026-10-26')).toEqual({ year: 2026, month: 11 });
    expect(periodMonthOf('2026-12-26')).toEqual({ year: 2027, month: 1 });
  });

  it('should suggest the norms of both sheets', () => {
    expect(suggestedNorm(standardPeriod(2026, 10), 2)).toBe(22);
    expect(suggestedNorm(standardPeriod(2026, 10), 4)).toBe(24);
    expect(suggestedNorm(standardPeriod(2026, 11), 2)).toBe(25);
    expect(suggestedNorm(standardPeriod(2026, 11), 4)).toBe(27);
  });

  it('should tell weekends whatever the time zone', () => {
    expect(isWeekend('2026-10-31')).toBe(true);
    expect(isWeekend('2026-11-01')).toBe(true);
    expect(isWeekend('2026-11-02')).toBe(false);
  });
});

describe('a day', () => {
  const base = { joinedOn: null, leftOn: null, entered: null, isHoliday: false, today: '2026-11-05' };

  it('should be 1 by itself on a working day that has come', () => {
    expect(dayCode({ ...base, day: '2026-11-05' })).toBe('1');
  });

  it('should stay empty before it comes, and on Saturdays and Sundays', () => {
    expect(dayCode({ ...base, day: '2026-11-06' })).toBeNull();
    expect(dayCode({ ...base, day: '2026-10-31' })).toBeNull();
    expect(dayCode({ ...base, day: '2026-11-01' })).toBeNull();
  });

  it('should keep what HR entered, also for a day still to come', () => {
    expect(dayCode({ ...base, day: '2026-11-04', entered: 'KL' })).toBe('KL');
    expect(dayCode({ ...base, day: '2026-11-10', entered: 'P' })).toBe('P');
    expect(dayCode({ ...base, day: '2026-10-31', entered: '1' })).toBe('1');
  });

  it('should be a holiday by itself, in the future too, unless HR says otherwise', () => {
    expect(dayCode({ ...base, day: '2026-11-24', isHoliday: true })).toBe('NL');
    expect(dayCode({ ...base, day: '2026-11-24', isHoliday: true, entered: '1' })).toBe('1');
  });

  it('should count for nothing outside the working dates', () => {
    expect(dayCode({ ...base, day: '2026-11-02', joinedOn: '2026-11-03' })).toBeNull();
    expect(dayCode({ ...base, day: '2026-11-04', leftOn: '2026-11-03', entered: 'P' })).toBeNull();
    expect(dayCode({ ...base, day: '2026-11-03', joinedOn: '2026-11-03', leftOn: '2026-11-03' })).toBe('1');
  });
});

describe('the totals', () => {
  const ones = (n: number) => Array<AttendanceCode>(n).fill('1');

  it('should never pay beyond the norm and put the rest in overtime', () => {
    // Act
    const totals = timesheetTotals({ codes: ones(26), norm: 25, leaveOpening: 0, employment: 'official' });

    // Assert
    expect(totals).toMatchObject({ paid: 25, overtime: 1 });
  });

  it('should count leave and holidays towards overtime, as the workbook does', () => {
    // Act
    const totals = timesheetTotals({ codes: [...ones(24), 'P', 'P'], norm: 25, leaveOpening: 5, employment: 'official' });

    // Assert
    expect(totals).toMatchObject({ actual: 24, paid: 25, overtime: 1 });
  });

  it('should pay leave out of the new day of this period, and not take a day from the balance unpaid', () => {
    // Act
    const totals = timesheetTotals({ codes: [...ones(13), 'P/2'], norm: 25, leaveOpening: 0, employment: 'official' });

    // Assert
    expect(totals).toMatchObject({ paid: 14, leaveClosing: 0.5, leaveOverdrawn: 0 });
  });

  it('should say how much leave went beyond the balance', () => {
    // Act
    const totals = timesheetTotals({ codes: ['1', 'P', 'P'], norm: 25, leaveOpening: 0.5, employment: 'official' });

    // Assert
    expect(totals).toMatchObject({ paid: 1.5, leaveClosing: 0, leaveOverdrawn: 1.5 });
  });

  it('should not build leave during probation', () => {
    // Act
    const totals = timesheetTotals({ codes: ones(20), norm: 25, leaveOpening: 3, employment: 'probation' });

    // Assert
    expect(totals.leaveClosing).toBe(0);
  });

  it('should add an adjustment to the pay only, never below zero', () => {
    // Act
    const down = timesheetTotals({ codes: ones(9), norm: 25, leaveOpening: 0, employment: 'official', adjustment: -0.5 });
    const floor = timesheetTotals({ codes: [], norm: 25, leaveOpening: 0, employment: 'official', adjustment: -1 });

    // Assert
    expect(down).toMatchObject({ actual: 9, paid: 8.5, paidBeforeAdjustment: 9 });
    expect(floor.paid).toBe(0);
  });

  it('should take the leave threshold and amount from the rule', () => {
    // Act
    const totals = timesheetTotals({
      codes: ones(10), norm: 25, leaveOpening: 1, employment: 'official', rule: { threshold: 10, perPeriod: 2 },
    });

    // Assert
    expect(totals.leaveClosing).toBe(3);
  });
});
