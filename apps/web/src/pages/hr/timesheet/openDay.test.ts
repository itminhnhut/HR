import { describe, expect, it } from 'vitest';
import { dayToOpen } from './openDay';

const days = [{ iso: '2026-11-09', key: 'd09' }, { iso: '2026-11-10', key: 'd10' }];

describe('the day the sheet opens on (TC-NG-03)', () => {
  it('should open on the day a link asks for', () => {
    expect(dayToOpen(days, '2026-11-10', 'd09')).toBe('d10');
  });

  it('should open on today when the link asks for nothing, or for a day not on this sheet', () => {
    expect(dayToOpen(days, null, 'd09')).toBe('d09');
    expect(dayToOpen(days, '2026-12-01', 'd09')).toBe('d09');
  });
});
