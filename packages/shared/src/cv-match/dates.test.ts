import { describe, expect, it } from 'vitest';
import { findRanges, formatMonths, monthIndex, parseToday, totalMonths } from './dates.js';
import { fold } from './normalize.js';

const TODAY = parseToday('2026-10-25');

function months(line: string): number[] {
  return findRanges(fold(line), TODAY).map((r) => r.endMonth - r.startMonth);
}

describe('findRanges', () => {
  it.each([
    ['03/2021 – 05/2021', 3],
    ['T6/2020 - T12/2023', 43],
    ['06.2018 – 05.2020', 24],
    ['Tháng 3/2020 đến tháng 5/2022', 27],
    ['tháng 3 năm 2020 - tháng 2 năm 2021', 12],
    ['Jan 2020 – Mar 2022', 27],
    ['January 2019 to December 2019', 12],
    ['01/03/2020 - 30/06/2021', 16],
    ['2018 - 05/2020', 29],
  ])('should measure "%s" as %i months', (line, expected) => {
    expect(months(line)).toEqual([expected]);
  });

  it('should count year-only ranges by the difference of years', () => {
    expect(months('2019 - 2022')).toEqual([36]);
  });

  it('should count a same-year range as half a year rather than nothing', () => {
    expect(months('2020 - 2020')).toEqual([6]);
  });

  it.each(['03/2021 – nay', '03/2021 - hiện tại', '03/2021 - Present', '03/2021 đến nay', 'Mar 2021 - now'])(
    'should end "%s" at today (inclusive of the current month)',
    (line) => {
      expect(months(line)).toEqual([monthIndex(2026, 10) + 1 - monthIndex(2021, 3)]);
    },
  );

  it('should mark a range ending with "nay" as ongoing', () => {
    expect(findRanges(fold('01/2025 - nay'), TODAY)[0]?.ongoing).toBe(true);
  });

  it('should ignore "nay" when today is unknown', () => {
    expect(findRanges(fold('01/2025 - nay'), null)).toEqual([]);
  });

  it('should cap a range that ends in the future at today', () => {
    expect(months('01/2026 - 12/2027')).toEqual([10]);
  });

  it('should not read a phone number as a date range', () => {
    expect(months('SĐT: 0912 345 678 - 0988 123 456')).toEqual([]);
  });

  it('should not read a single date as a range', () => {
    expect(months('Ngày sinh: 12/05/1998')).toEqual([]);
  });

  it('should reject an end before the start', () => {
    expect(months('2022 - 2019')).toEqual([]);
  });

  it('should find two ranges on one line', () => {
    expect(months('Công ty A (2015 - 2017), Công ty B (2018 - 2020)')).toEqual([24, 24]);
  });
});

describe('totalMonths', () => {
  it('should not double-count overlapping jobs', () => {
    // Arrange: 2019-01..2020-12 and 2020-07..2021-06 overlap by 6 months
    const intervals = [
      { startMonth: monthIndex(2019, 1), endMonth: monthIndex(2020, 12) + 1 },
      { startMonth: monthIndex(2020, 7), endMonth: monthIndex(2021, 6) + 1 },
    ];
    // Act / Assert
    expect(totalMonths(intervals)).toBe(30);
  });

  it('should add disjoint jobs and handle a job nested inside another', () => {
    const intervals = [
      { startMonth: 0, endMonth: 24 },
      { startMonth: 6, endMonth: 12 },
      { startMonth: 36, endMonth: 48 },
    ];
    expect(totalMonths(intervals)).toBe(36);
  });

  it('should return 0 for no intervals', () => {
    expect(totalMonths([])).toBe(0);
  });
});

describe('parseToday and formatMonths', () => {
  it('should reject a malformed today', () => {
    expect(parseToday('25/10/2026')).toBeNull();
  });

  it.each([
    [8, '8 tháng'],
    [24, '2 năm'],
    [27, '2 năm 3 tháng'],
  ])('should format %i months as "%s"', (m, text) => {
    expect(formatMonths(m)).toBe(text);
  });
});
