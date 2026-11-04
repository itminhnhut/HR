import { describe, expect, it } from 'vitest';
import { peakLabels, sourceSeries } from './sourceSeries';

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

  it('should fold a source past the colours into "Khác", adding up each day', () => {
    // Act
    const series = sourceSeries(
      [
        { source: 'linkedin', counts: [1, 2] },
        { source: 'gone-source', counts: [3, 0] },
      ],
      SOURCES,
    );

    // Assert
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ source: null, name: 'Khác', counts: [4, 2], total: 6 });
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
