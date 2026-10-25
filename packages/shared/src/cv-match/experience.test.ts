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

describe('experience requirement', () => {
  it('should be met by one job long enough, quoting the dates as evidence', () => {
    // Arrange
    const text = cv('KINH NGHIỆM LÀM VIỆC', 'Nhân viên bán hàng - Công ty ABC', '03/2021 – 06/2023');
    // Act
    const item = judge(text, 'Kinh nghiệm: Từ 2 năm');
    // Assert
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('03/2021');
  });

  it('should be unmet when the jobs add up to less than required, saying how much the CV has', () => {
    const item = judge(cv('KINH NGHIỆM', 'Thu ngân - Siêu thị B', '01/2025 - 12/2025'), 'Tối thiểu 2 năm kinh nghiệm');
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('1 năm');
  });

  it('should not double-count overlapping jobs', () => {
    // Arrange: 2020-01..2021-06 and 2021-01..2021-12 overlap → 24 months, not 30
    const text = cv('KINH NGHIỆM', 'Công ty A', '01/2020 - 06/2021', 'Công ty B (bán thời gian)', '01/2021 - 12/2021');
    // Act
    const twoYears = judge(text, 'Từ 2 năm kinh nghiệm');
    const thirtyMonths = judge(text, 'Từ 2.5 năm kinh nghiệm');
    // Assert
    expect(twoYears.verdict).toBe('met');
    expect(thirtyMonths.verdict).toBe('unmet');
  });

  it('should count a job running until "nay" up to today', () => {
    expect(judge(cv('KINH NGHIỆM', 'Kế toán viên', '09/2024 - nay'), 'Từ 2 năm kinh nghiệm').verdict).toBe('met');
    expect(judge(cv('KINH NGHIỆM', 'Kế toán viên', '09/2024 - nay'), 'Từ 3 năm kinh nghiệm').verdict).toBe('unmet');
  });

  it('should not count the birth year or school years as experience', () => {
    // Arrange
    const text = cv(
      'Ngày sinh: 15/04/1998',
      'HỌC VẤN',
      'Đại học Kinh tế (2016 - 2020)',
      'KINH NGHIỆM',
      'Nhân viên kinh doanh',
      '06/2025 - nay',
    );
    // Act / Assert
    expect(judge(text, 'Từ 2 năm kinh nghiệm').verdict).toBe('unmet');
  });

  it('should use an explicit "3 năm kinh nghiệm" statement when there are no dates', () => {
    const item = judge(
      cv('GIỚI THIỆU', 'Tôi có hơn 3 năm kinh nghiệm telesales cho ngân hàng.'),
      'Từ 2 năm kinh nghiệm',
    );
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('3 năm kinh nghiệm');
  });

  it('should read an English "3+ years of experience" statement', () => {
    expect(
      judge(cv('SUMMARY', 'Frontend developer with 3+ years of experience in React.'), '2+ years of experience')
        .verdict,
    ).toBe('met');
  });

  it('should be unmet when the CV says "chưa có kinh nghiệm"', () => {
    const item = judge(
      cv('MỤC TIÊU', 'Sinh viên mới ra trường, chưa có kinh nghiệm, mong muốn được học hỏi.'),
      'Từ 1 năm kinh nghiệm',
    );
    expect(item.verdict).toBe('unmet');
  });

  it('should be unknown when the CV gives no dates and no statement', () => {
    expect(
      judge(cv('KINH NGHIỆM', 'Bán hàng tại cửa hàng điện thoại của gia đình'), 'Từ 1 năm kinh nghiệm').verdict,
    ).toBe('unknown');
  });

  it('should count only the jobs in the named field', () => {
    // Arrange: 4 years teaching, 6 months sales
    const text = cv(
      'KINH NGHIỆM',
      'Giáo viên tiếng Anh - Trung tâm X',
      '01/2020 - 12/2023',
      'Nhân viên bán hàng - Shop Y',
      '01/2024 - 06/2024',
    );
    // Act
    const item = judge(text, 'Tối thiểu 1 năm kinh nghiệm bán hàng');
    // Assert
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('6 tháng');
  });

  it('should be met when the field jobs alone are long enough', () => {
    const text = cv('KINH NGHIỆM', 'Sales Executive - Công ty Z', '2019 - 2022', 'Giáo viên', '2022 - 2023');
    expect(judge(text, 'Có 2 năm kinh nghiệm bán hàng').verdict).toBe('met');
  });

  it('should be unknown for "vị trí tương đương" when the total is enough', () => {
    const text = cv('KINH NGHIỆM', 'Chuyên viên', '2018 - 2022');
    expect(judge(text, 'Có 2 năm kinh nghiệm ở vị trí tương đương').verdict).toBe('unknown');
  });

  it('should not turn internships alone into a met, and say so', () => {
    const text = cv('KINH NGHIỆM', 'Thực tập sinh kế toán - Công ty A', '01/2024 - 06/2025');
    const item = judge(text, 'Từ 1 năm kinh nghiệm');
    expect(item.verdict).toBe('unknown');
    expect(item.reason).toContain('thực tập');
  });

  it('should take title lines above the dates into account for the field', () => {
    const text = cv(
      'WORK EXPERIENCE',
      'Accountant',
      'ABC Trading Co.',
      'Jan 2020 - Dec 2022',
      '- Prepared monthly reports',
    );
    expect(judge(text, 'Kinh nghiệm kế toán từ 2 năm').verdict).toBe('met');
  });

  it('should satisfy "Không yêu cầu kinh nghiệm" whatever the CV says', () => {
    const item = judge(cv('Chưa có kinh nghiệm làm việc, sẵn sàng học hỏi.'), 'Kinh nghiệm: Không yêu cầu');
    expect(item.verdict).toBe('met');
    expect(item.reason).toContain('không yêu cầu');
  });
});
