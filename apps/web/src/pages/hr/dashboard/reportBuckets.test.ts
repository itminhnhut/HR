import { addDays } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { bucketsOf, sumBuckets, unitOf } from './reportBuckets';

const daysFrom = (start: string, count: number) => Array.from({ length: count }, (_, i) => addDays(start, i));

describe('how a chart groups its days', () => {
  it.each([
    [1, 'ngày'],
    [30, 'ngày'],
    [90, 'tuần'],
    [308, 'tháng'],
    [365, 'tháng'],
    [366, 'tháng'],
    [1096, 'năm'],
  ])('should show %i days by %s', (count, unit) => {
    expect(unitOf(count)).toBe(unit);
  });

  it('should keep each day under two months', () => {
    expect(bucketsOf(daysFrom('2026-11-03', 2)).map((b) => b.label)).toEqual(['03/11', '04/11']);
  });

  it('should make weeks from the first day, the last one possibly shorter', () => {
    const buckets = bucketsOf(daysFrom('2026-08-07', 90));

    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toEqual({ label: '07/08–13/08', from: 0, to: 6 });
    expect(buckets[12]?.to).toBe(89);
  });

  it('should make one group per calendar month, across a new year', () => {
    const labels = bucketsOf(daysFrom('2025-11-15', 300)).map((b) => b.label);

    expect(labels[0]).toBe('T11/2025');
    expect(labels[2]).toBe('T1/2026');
  });

  it('should show one group per year across years, with no months', () => {
    expect(bucketsOf(daysFrom('2020-01-01', 1096)).map((b) => b.label)).toEqual(['2020', '2021', '2022']);
  });

  it('should lose no application when adding up', () => {
    // Arrange
    const days = daysFrom('2026-01-01', 200);
    const counts = days.map((_, i) => i % 3);

    // Act
    const sums = sumBuckets(counts, bucketsOf(days));

    // Assert
    expect(sums.reduce((a, b) => a + b, 0)).toBe(counts.reduce((a, b) => a + b, 0));
  });
});
