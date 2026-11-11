import { describe, expect, it } from 'vitest';
import { GOLDEN_PEOPLE } from '../../test-fixtures/payroll-golden.js';
import { contractTypesFor, settingFor, sortPayrollRows } from './index.js';

/** Row order D13 and self-approval D14 (spec 9). Cases: docs/test-cases-luong.md, L-K1-18, L-E16. */

const BLOCKS: Record<string, string> = {
  'NV C': 'KD',
  'NV D': 'KD',
  'NV E': 'KD',
  'NV F': 'KD',
  'NV J': 'KD',
  'NV K': 'KD',
  'NV L': 'KD',
};

describe('row order (D13)', () => {
  it('L-K1-18: should order rows by region, then contract type, then block, then code', () => {
    // Arrange: the golden month, shuffled
    const rows = [...GOLDEN_PEOPLE].reverse().map((p) => ({
      code: p.id,
      regionOrder: p.region === 'HCM' ? 0 : 1,
      contractTypeId: p.contract,
      block: BLOCKS[p.id] ?? 'BO',
    }));

    // Act
    const sorted = sortPayrollRows(rows, contractTypesFor([], null, '2026-10'));

    // Assert: HCM open-ended BO A, B, KD C; 12 months D, E, F; probation BO G, H, I, KD J; HN K, L
    expect(sorted.map((r) => r.code)).toEqual(GOLDEN_PEOPLE.map((p) => p.id));
  });
});

describe('self-approval (D14)', () => {
  it('L-E16: should let the person who prepared the month approve it by default', () => {
    expect(settingFor([], 'tuy-chon.d14', null, '2026-11').value).toBe('allowed');
  });
});
