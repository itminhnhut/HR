import { describe, expect, it } from 'vitest';
import { joinPdfItems, pagesToRead, type PdfTextItem } from './pdf-text.js';

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

describe('text pieces of a PDF joined into lines', () => {
  /** Pieces on one line of a font 10.5 high, each starting where the given x says. */
  const piece = (str: string, x: number, width: number, extra: Partial<PdfTextItem> = {}): PdfTextItem => ({
    str,
    x,
    y: 487,
    width,
    height: 10.5,
    hasEOL: false,
    ...extra,
  });

  it('should keep a word whole when the font splits it around an accented letter', () => {
    // Arrange: the positions of "Xử lý chứng từ" in a real CV: each piece starts where the last one ends.
    const items = [
      piece('X', 327, 6.89),
      piece('ử', 333.89, 7.08),
      piece(' ', 340.97, 3.74, { height: 0 }),
      piece('lý ch', 343.78, 24.4),
      piece('ứ', 368.18, 7.08),
      piece('ng t', 375.26, 20.45),
      piece('ừ', 395.71, 7.08),
    ];

    // Act
    const text = joinPdfItems(items);

    // Assert
    expect(text).toBe('Xử lý chứng từ');
  });

  it('should part two words the PDF places apart without a space character', () => {
    expect(joinPdfItems([piece('Công', 100, 30), piece('ty', 133, 12)])).toBe('Công ty');
  });

  it('should leave a wide gap between two columns, which the CV reader splits on', () => {
    expect(joinPdfItems([piece('KINH NGHIỆM', 50, 80), piece('HỌC VẤN', 300, 60)])).toBe('KINH NGHIỆM   HỌC VẤN');
  });

  it('should keep a gap set on purpose with a wide blank, which tells the words of a spaced heading apart', () => {
    // Arrange: a blank wider than a word space, as in a real "L Ê   M I N H" banner.
    const items = [
      piece('L Ê', 22, 48, { height: 30 }),
      piece(' ', 71, 39, { height: 0 }),
      piece('M I N H', 100, 108, { height: 30 }),
    ];

    // Act
    const text = joinPdfItems(items);

    // Assert
    expect(text).toBe('L Ê   M I N H');
  });

  it('should start a new line where the PDF ends one', () => {
    const items = [piece('Excel', 50, 30, { hasEOL: true }), piece('Word', 50, 30, { y: 470 })];

    expect(joinPdfItems(items)).toBe('Excel\nWord');
  });

  it('should part pieces on different lines when the PDF marks no line end', () => {
    expect(joinPdfItems([piece('Excel', 50, 30), piece('Word', 50, 30, { y: 470 })])).toBe('Excel Word');
  });

  it('should part pieces when the text jumps back along the same line', () => {
    expect(joinPdfItems([piece('Excel', 300, 30), piece('Word', 50, 30)])).toBe('Excel Word');
  });
});
