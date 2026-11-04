import { describe, expect, it } from 'vitest';
import { allSources } from './SourceFunnel';

const row = (source: string, received: number, hired = 0) => ({
  source,
  received,
  interview: 0,
  passed: 0,
  hired,
  topRejectReason: null,
});

describe('allSources', () => {
  it('should show every source on the list, those with no application at zero', () => {
    // Act
    const all = allSources([row('topcv', 5)], [{ key: 'topcv' }, { key: 'zalo' }, { key: 'email' }]);

    // Assert
    expect(all.map((r) => [r.source, r.received])).toEqual([
      ['topcv', 5],
      ['zalo', 0],
      ['email', 0],
    ]);
  });

  it('should keep a source no longer on the list that still has numbers', () => {
    expect(allSources([row('da-xoa', 2)], [{ key: 'zalo' }]).map((r) => r.source)).toEqual(['da-xoa', 'zalo']);
  });

  it('should put the source that hired the most first', () => {
    expect(allSources([row('a', 9), row('b', 2, 1)], []).map((r) => r.source)).toEqual(['b', 'a']);
  });
});
