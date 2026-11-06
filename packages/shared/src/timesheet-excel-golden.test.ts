import { describe, expect, it } from 'vitest';
import { cellsOf, enteredOf, NOVEMBER_SHEET, OCTOBER_SHEET, type GoldenPerson } from '../test-fixtures/timesheet-golden.js';
import { dayCode, periodDays, standardPeriod, timesheetTotals } from './timesheet.js';

/**
 * Every total column of HR's sheets, worked out from what HR types and the rules, against the number HR's sheet shows.
 * Case numbers: docs/test-cases-cham-cong.md.
 */

function worked(person: GoldenPerson, year: number, month: number, today: string) {
  const range = standardPeriod(year, month);
  const entered = enteredOf(person.grid, range.from);
  const codes = periodDays(range).map((day) =>
    dayCode({
      day,
      entered: entered[day] ?? null,
      isHoliday: false,
      today,
      joinedOn: person.joinedOn ?? null,
      leftOn: person.leftOn ?? null,
    }),
  );
  const { leaveOverdrawn: _overdrawn, paidBeforeAdjustment: _before, ...totals } = timesheetTotals({
    codes,
    norm: person.expected.norm,
    leaveOpening: person.expected.leaveOpening,
    employment: person.employment,
    adjustment: person.adjustment ?? 0,
  });
  return { codes, totals, range };
}

describe('sheet "Tháng 10.26" (TC-BT-01)', () => {
  it.each(OCTOBER_SHEET)('should give person $id on row $sheetRow every total the sheet shows', (person) => {
    // Act
    const { totals } = worked(person, 2026, 10, '2026-10-25');

    // Assert
    expect(totals).toMatchObject(person.expected);
  });

  it.each(OCTOBER_SHEET)('should fill the day cells of person $id exactly as HR did, from the exceptions alone', (person) => {
    // Arrange
    const range = standardPeriod(2026, 10);
    const sheet = cellsOf(person.grid, range.from);

    // Act
    const { codes } = worked(person, 2026, 10, '2026-10-25');

    // Assert
    expect(periodDays(range).map((day, i) => [day, codes[i]]).filter(([, code]) => code)).toEqual(Object.entries(sheet));
  });

  it('should hold 240 filled cells, of which HR only has to type 36', () => {
    // Arrange
    const { from } = standardPeriod(2026, 10);

    // Act
    const filled = OCTOBER_SHEET.flatMap((p) => Object.keys(cellsOf(p.grid, from)));
    const typed = OCTOBER_SHEET.flatMap((p) => Object.keys(enteredOf(p.grid, from)));

    // Assert
    expect(filled).toHaveLength(240);
    expect(typed).toHaveLength(36);
  });
});

describe('sheet "Tháng 11.26" on the day HR saved it (TC-BT-02)', () => {
  it.each(NOVEMBER_SHEET)('should give person $id on row $sheetRow every total the sheet shows', (person) => {
    // Act
    const { totals } = worked(person, 2026, 11, '2026-11-05');

    // Assert
    expect(totals).toMatchObject(person.expected);
  });

  it.each(NOVEMBER_SHEET)('should fill the day cells of person $id exactly as HR did, up to today', (person) => {
    // Arrange
    const range = standardPeriod(2026, 11);
    const sheet = cellsOf(person.grid, range.from);

    // Act
    const { codes } = worked(person, 2026, 11, '2026-11-05');

    // Assert
    expect(periodDays(range).map((day, i) => [day, codes[i]]).filter(([, code]) => code)).toEqual(Object.entries(sheet));
  });
});

describe('where the two sheets disagree (TC-HP-02)', () => {
  /**
   * Person F of "Tháng 10.26": opening 0.5, 3 days of leave. The sheet shows 20.5, so the new day of the period was paid.
   * The formula HR has in "Tháng 11.26" (AS9 = AL9 + MIN(AN9, AU9) + AQ9 − AT9) would give 19.5 from the same cells.
   * The code follows October's number. This pins that choice until the owner rules on it.
   */
  it('should pay what October paid, not what the formula of November would pay', () => {
    // Arrange
    const person = OCTOBER_SHEET.find((p) => p.id === 'F');
    if (!person) throw new Error('Person F is missing from the fixture');
    const novemberFormula = person.expected.actual + Math.min(person.expected.leave, person.expected.leaveOpening);

    // Act
    const { totals } = worked(person, 2026, 10, '2026-10-25');

    // Assert
    expect(novemberFormula).toBe(19.5);
    expect(totals.paid).toBe(20.5);
  });
});
