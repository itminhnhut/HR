import { describe, expect, it } from 'vitest';
import { peakLabels, sourceLegend, sourceSeries } from './sourceSeries';

const SOURCES = ['website', 'email', 'zalo', 'referral', 'topcv', 'vieclam24h', 'linkedin'].map((key) => ({
  key,
  name: key,
}));

describe('sourceSeries', () => {
  it('should keep the colour of a source when another source appears', () => {
    // Act
    const alone = sourceSeries([{ source: 'zalo', counts: [1, 0] }], SOURCES);
    const together = sourceSeries(
      [
        { source: 'website', counts: [5, 5] },
        { source: 'zalo', counts: [1, 0] },
      ],
      SOURCES,
    );

    // Assert
    expect(together.find((s) => s.source === 'zalo')?.color).toBe(alone[0]?.color);
  });

  it('should list the biggest source first', () => {
    // Act
    const series = sourceSeries(
      [
        { source: 'zalo', counts: [1, 0] },
        { source: 'website', counts: [5, 5] },
      ],
      SOURCES,
    );

    // Assert
    expect(series.map((s) => s.source)).toEqual(['website', 'zalo']);
  });

  it('should draw every source that has applications while there are colours for them, wherever it sits in the list', () => {
    // Arrange: the real case. Sources added later sit past the first six places of the list.
    const sources = [
      'website',
      'email',
      'zalo',
      'referral',
      'topcv',
      'vietnamworks',
      'facebook',
      'other',
      'viec-lam-24h',
      'jobsgo',
    ].map((key) => ({ key, name: key }));
    const rows = [
      { source: 'topcv', counts: [5] },
      { source: 'viec-lam-24h', counts: [5] },
      { source: 'jobsgo', counts: [3] },
      { source: 'other', counts: [1] },
    ];

    // Act
    const series = sourceSeries(rows, sources);

    // Assert
    expect(series.map((line) => line.name)).toEqual(['topcv', 'viec-lam-24h', 'jobsgo', 'other']);
    expect(new Set(series.map((line) => line.color)).size).toBe(4);
    expect(series.every((line) => line.source !== null)).toBe(true);
  });

  it('should fold what does not fit the colours into "Nguồn khác", adding up each day, the smallest first', () => {
    // Arrange: seven sources on the list and six colours.
    const rows = SOURCES.map(({ key }, i) => ({ source: key, counts: [10 - i, 0] }));

    // Act
    const series = sourceSeries(rows, SOURCES);

    // Assert
    expect(series).toHaveLength(7);
    expect(series.filter((line) => line.source !== null)).toHaveLength(6);
    expect(series.find((line) => line.source === null)).toMatchObject({ name: 'Nguồn khác', total: 4 });
    expect(new Set(series.map((line) => line.color)).size).toBe(7);
  });

  it('should fold a source no longer on the list into "Nguồn khác"', () => {
    // Act
    const series = sourceSeries([{ source: 'gone-source', counts: [3, 0] }], SOURCES);

    // Assert
    expect(series).toEqual([expect.objectContaining({ source: null, name: 'Nguồn khác', counts: [3, 0], total: 3 })]);
  });
});

describe('sourceLegend', () => {
  it('should list every source, those with no application too, biggest first', () => {
    // Arrange
    const rows = [{ source: 'topcv', counts: [2, 3] }];
    const series = sourceSeries(rows, SOURCES);

    // Act
    const legend = sourceLegend(rows, SOURCES, series);

    // Assert
    expect(legend).toHaveLength(SOURCES.length);
    expect(legend[0]).toMatchObject({ source: 'topcv', total: 5, color: series[0]?.color });
    expect(legend.slice(1).every((item) => item.total === 0)).toBe(true);
  });
});

describe('peakLabels', () => {
  const line = (name: string, counts: number[]) => ({ source: name, name, color: '#000', counts, total: 0 });

  it('should put each name on its busiest day', () => {
    expect(peakLabels([line('A', [0, 3, 1, 0, 0, 0])])).toEqual([{ name: 'A', day: 1, count: 3 }]);
  });

  it('should leave out a name that would stand on top of another', () => {
    // Act
    const labels = peakLabels([line('A', [0, 3, 0, 0, 0, 0]), line('B', [0, 0, 2, 0, 0, 0])]);

    // Assert
    expect(labels.map((l) => l.name)).toEqual(['A']);
  });
});
