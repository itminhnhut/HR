import { describe, expect, it } from 'vitest';
import { dropPlace } from './dragDrop';
import { floatingTop } from './FloatingToolbar';

const boxes = [
  { top: 100, bottom: 130 },
  { top: 146, bottom: 176 },
  { top: 192, bottom: 300 },
];

describe('dropping a block dragged with the handle', () => {
  it('should go before a block when dropped on its top half, after it on its bottom half', () => {
    expect(dropPlace(boxes, 148)).toEqual({ index: 1, before: true });
    expect(dropPlace(boxes, 174)).toEqual({ index: 1, before: false });
  });

  it('should go before the next block when dropped in the gap, and at the ends outside the blocks', () => {
    expect(dropPlace(boxes, 140)).toEqual({ index: 1, before: true });
    expect(dropPlace(boxes, 20)).toEqual({ index: 0, before: true });
    expect(dropPlace(boxes, 900)).toEqual({ index: 2, before: false });
    expect(dropPlace([], 10)).toBeNull();
  });
});

describe('floating toolbar position', () => {
  it('should sit above the selection when that leaves the main toolbar uncovered', () => {
    expect(floatingTop({ top: 400, bottom: 420 }, 40, 150)).toBe(350);
  });

  it('should flip below the selection when it would cover the sticky main toolbar', () => {
    expect(floatingTop({ top: 170, bottom: 190 }, 40, 150)).toBe(200);
  });
});
