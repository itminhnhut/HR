import { describe, expect, it } from 'vitest';
import { pagesToRead } from './pdf-text.js';

describe('which pages of a PDF are read', () => {
  it.each([
    [0, []],
    [1, [1]],
    [6, [1, 2, 3, 4, 5, 6]],
    [7, [1, 2, 3, 4, 5, 6, 7]],
    [40, [1, 2, 3, 4, 5, 6, 40]],
  ])('should read the first six and the last of %i pages', (count, pages) => {
    expect(pagesToRead(count)).toEqual(pages);
  });
});
