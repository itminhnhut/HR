import { describe, expect, it } from 'vitest';
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

describe('education requirement', () => {
  it('should be met by a completed university degree for "Cao đẳng trở lên"', () => {
    // Arrange
    const text = cv('HỌC VẤN', 'Trường Đại học Kinh tế Quốc dân (2015 - 2019)', 'Chuyên ngành: Kế toán');
    // Act
    const item = judge(text, 'Học vấn: Cao đẳng trở lên');
    // Assert
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('Đại học Kinh tế');
  });

  it('should be unmet when the highest level is below the requirement', () => {
    const item = judge(cv('HỌC VẤN', 'Cao đẳng Công nghệ Thủ Đức, 2016 - 2019'), 'Tốt nghiệp Đại học trở lên');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('Cao đẳng');
  });

  it('should not count a third-year student as a graduate', () => {
    const text = cv('Sinh viên năm 3 - Đại học Bách khoa', 'HỌC VẤN', 'Đại học Bách khoa Hà Nội (2023 - nay)');
    const item = judge(text, 'Tốt nghiệp Cao đẳng trở lên');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('chưa tốt nghiệp');
  });

  it('should treat a university student as having finished THPT', () => {
    const text = cv('HỌC VẤN', 'Đại học Mở TP.HCM, đang học năm 2 (2024 - nay)');
    expect(judge(text, 'Tốt nghiệp THPT trở lên').verdict).toBe('met');
  });

  it('should not count a degree whose graduation year is in the future', () => {
    expect(judge(cv('HỌC VẤN', 'Đại học Thương mại, 2023 - 2027'), 'Đại học').verdict).toBe('unmet');
  });

  it('should understand English degrees', () => {
    const text = cv('EDUCATION', 'Bachelor of Business Administration, RMIT University, 2014 - 2018');
    expect(judge(text, 'Đại học trở lên').verdict).toBe('met');
  });

  it('should rank a Master above a Bachelor', () => {
    const text = cv('EDUCATION', 'Master of Finance, 2020 - 2022', 'Bachelor of Accounting, 2015 - 2019');
    expect(judge(text, 'Thạc sĩ trở lên').verdict).toBe('met');
  });

  it('should be unknown when the CV has no education at all', () => {
    expect(judge(cv('KINH NGHIỆM', 'Phục vụ nhà hàng 2020 - 2022'), 'Tốt nghiệp Cao đẳng trở lên').verdict).toBe(
      'unknown',
    );
  });

  it('should be met when the major matches loosely (English major for a Vietnamese requirement)', () => {
    const text = cv('EDUCATION', 'Bachelor of Accounting - National Economics University (2014 - 2018)');
    expect(judge(text, 'Tốt nghiệp Đại học chuyên ngành Kế toán').verdict).toBe('met');
  });

  it('should be unmet when the CV names a different major', () => {
    const text = cv('HỌC VẤN', 'Đại học Sư phạm (2012 - 2016)', 'Chuyên ngành: Sư phạm Ngữ văn');
    const item = judge(text, 'Tốt nghiệp Đại học chuyên ngành Kế toán');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('ngành');
  });

  it('should be unknown for a different major when "ngành liên quan" is accepted', () => {
    const text = cv('HỌC VẤN', 'Đại học Kinh tế (2012 - 2016)', 'Chuyên ngành: Quản trị kinh doanh');
    expect(judge(text, 'Tốt nghiệp Đại học ngành Tài chính hoặc liên quan').verdict).toBe('unknown');
  });

  it('should satisfy "Học vấn: Không yêu cầu" without education in the CV', () => {
    expect(judge(cv('KINH NGHIỆM', 'Phụ bếp 2020 - 2022'), 'Học vấn: Không yêu cầu').verdict).toBe('met');
  });

  it('should not read "Đại học" in a job line as the candidate\'s degree', () => {
    const text = cv(
      'KINH NGHIỆM',
      'Bảo vệ tại Trường Đại học Y, 2019 - 2022',
      'HỌC VẤN',
      'Tốt nghiệp THPT Lê Lợi, 2015',
    );
    expect(judge(text, 'Đại học trở lên').verdict).toBe('unmet');
  });
});
