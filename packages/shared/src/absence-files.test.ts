import { describe, expect, it } from 'vitest';
import { ABSENCE_FILE_MAX_BYTES, ABSENCE_FILES_MAX, PAPER_REASONS_DEFAULT, absenceFileProblem, needsPaperByDefault } from './absence-files.js';

/** Papers kept with an absence (spec-giay-to-nghi.md). Cases TC-GT-20..29. */

const bytes = (...head: number[]) => new Uint8Array([...head, ...Array<number>(32).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = new Uint8Array([...text('RIFF'), 0x24, 0, 0, 0, ...text('WEBPVP8 '), ...Array<number>(16).fill(0)]);
const PDF = text('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

describe('what a file is, by its content', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WEBP', WEBP, 'image/webp'],
    ['PDF', PDF, 'application/pdf'],
  ])('TC-GT-20: should accept a %s and tell its type', (_name, file, type) => {
    // Act
    const result = absenceFileProblem(file);

    // Assert
    expect(result).toEqual({ problem: null, contentType: type, ext: type === 'application/pdf' ? 'pdf' : type.slice(6).replace('jpeg', 'jpg') });
  });

  it('TC-GT-21: should refuse a program renamed to .jpg', () => {
    expect(absenceFileProblem(text('MZ\x90\x00 this is not an image at all')).problem).toBe('not_allowed');
  });

  it('TC-GT-22: should refuse an iPhone HEIC photo with its own message', () => {
    // Arrange: ....ftypheic
    const heic = new Uint8Array([0, 0, 0, 0x18, ...text('ftypheic'), ...Array<number>(16).fill(0)]);

    // Act + Assert
    expect(absenceFileProblem(heic).problem).toBe('heic');
  });

  it('TC-GT-23: should refuse a PDF cut off before its end', () => {
    expect(absenceFileProblem(text('%PDF-1.7\n1 0 obj\n<<>>')).problem).toBe('broken_pdf');
  });

  it('TC-GT-24: should refuse an empty file', () => {
    expect(absenceFileProblem(new Uint8Array()).problem).toBe('empty');
  });

  it('TC-GT-25: should refuse a file over 4 MB, and take one of exactly 4 MB', () => {
    // Arrange
    const at = (size: number) => { const b = new Uint8Array(size); b.set(JPEG); return b; };

    // Act + Assert
    expect(absenceFileProblem(at(ABSENCE_FILE_MAX_BYTES)).problem).toBeNull();
    expect(absenceFileProblem(at(ABSENCE_FILE_MAX_BYTES + 1)).problem).toBe('too_large');
  });
});

describe('the limits and defaults HR agreed', () => {
  it('TC-GT-26: should allow 10 files to one absence', () => {
    expect(ABSENCE_FILES_MAX).toBe(10);
  });

  it('TC-GT-27: should ask for papers by default on sick, maternity, own and child wedding, and close family funerals', () => {
    expect([...PAPER_REASONS_DEFAULT].sort()).toEqual(['child-wedding', 'funeral-close', 'maternity', 'sick', 'wedding']);
  });

  it('TC-GT-28: should not ask for papers by default on annual leave, lateness or unpaid leave', () => {
    expect(['annual', 'late', 'unpaid', 'other-paid', 'funeral-family', 'family-wedding'].filter(needsPaperByDefault)).toEqual([]);
  });

  it('TC-GT-29: should not ask for papers by default on a reason HR added', () => {
    expect(needsPaperByDefault('6f1c2a7e-0b1d-4c8e-9a51-2f3b4c5d6e7f')).toBe(false);
  });
});
