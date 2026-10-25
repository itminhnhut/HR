import { describe, expect, it } from 'vitest';
import { findScores, levelWords } from './language.js';
import { fold } from './normalize.js';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

const TODAY = '2026-10-25';

/** Scores one requirement line against a CV text. */
function judge(cvText: string, requirement: string, today = TODAY): MatchItem {
  return scoreCv({ cvText, requirements: [requirement], today }).items[0];
}

/** A CV with a header block, so short bodies stay above the "no readable text" threshold. */
function cv(...lines: string[]): string {
  return ['Nguyễn Văn An', 'Email: an.nguyen@example.com - Điện thoại: 0912 345 678', ...lines].join('\n');
}

describe('language helpers', () => {
  it('should find TOEIC and IELTS scores', () => {
    expect(findScores(fold('TOEIC: 750 điểm, IELTS 6.5'))).toEqual([
      { test: 'toeic', score: 750 },
      { test: 'ielts', score: 6.5 },
    ]);
  });

  it('should not read "tốt nghiệp" or "khả năng" as proficiency words', () => {
    expect(levelWords(fold('tốt nghiệp, khả năng'))).toEqual([]);
  });

  it('should read "pre-intermediate" as reading level, not intermediate', () => {
    expect(levelWords(fold('English: pre-intermediate'))).toEqual([2]);
  });
});

describe('language requirement', () => {
  it('should be met by a TOEIC score at or above the minimum', () => {
    const item = judge(cv('NGOẠI NGỮ', 'Tiếng Anh: TOEIC 650'), 'TOEIC 600 trở lên');
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('TOEIC 650');
  });

  it('should be unmet by a lower TOEIC score, quoting both numbers', () => {
    const item = judge(cv('NGOẠI NGỮ', 'TOEIC 450'), 'TOEIC 600 trở lên');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('450');
  });

  it('should accept a clearly higher IELTS for a TOEIC requirement', () => {
    expect(judge(cv('NGOẠI NGỮ', 'IELTS 7.0'), 'TOEIC 600').verdict).toBe('met');
  });

  it('should be unknown when the CV says fluent English but gives no score', () => {
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Anh thành thạo'), 'TOEIC 700').verdict).toBe('unknown');
  });

  it('should be unmet when English is not mentioned at all', () => {
    expect(judge(cv('KỸ NĂNG', 'Excel, Word'), 'Tiếng Anh giao tiếp').verdict).toBe('unmet');
  });

  it('should be unmet when the CV states only basic English for a conversational requirement', () => {
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Anh: cơ bản'), 'Tiếng Anh giao tiếp tốt').verdict).toBe('unmet');
  });

  it('should be met by "giao tiếp tốt" for "tiếng Anh giao tiếp"', () => {
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Anh: giao tiếp tốt'), 'Tiếng Anh giao tiếp').verdict).toBe('met');
  });

  it('should read the level on the line after the language name', () => {
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Anh', 'Thành thạo'), 'Thành thạo tiếng Anh').verdict).toBe('met');
  });

  it('should count an English-only CV as reading English', () => {
    // Arrange
    const text =
      'John Tran\nWORK EXPERIENCE\nSales executive at the ABC company, responsible for key accounts in the north.\nEDUCATION\nBachelor of Business, Foreign Trade University';
    // Act / Assert
    expect(judge(text, 'Đọc hiểu tài liệu tiếng Anh').verdict).toBe('met');
    expect(judge(text, 'Tiếng Anh lưu loát').verdict).toBe('unknown');
  });

  it('should not count English mentioned only as a wish to learn', () => {
    expect(judge(cv('SỞ THÍCH', 'Mong muốn học thêm tiếng Anh'), 'Tiếng Anh cơ bản').verdict).toBe('unmet');
  });

  it('should compare JLPT levels with N1 the best', () => {
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Nhật N2'), 'Tiếng Nhật N3 trở lên').verdict).toBe('met');
    expect(judge(cv('NGOẠI NGỮ', 'Tiếng Nhật N4'), 'Tiếng Nhật N3 trở lên').verdict).toBe('unmet');
  });
});
