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

describe('availability requirement', () => {
  it('should be met when the CV says the candidate can start now', () => {
    const item = judge(cv('THÔNG TIN KHÁC', 'Hiện đang nghỉ việc, có thể đi làm ngay.'), 'Có thể đi làm ngay');
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('đi làm ngay');
  });

  it('should be unmet when the CV states a notice period', () => {
    expect(judge(cv('OTHER', 'Notice period: 30 days'), 'Có thể đi làm ngay').verdict).toBe('unmet');
  });

  it('should be unmet when the CV says it cannot start now', () => {
    expect(judge(cv('Chưa thể đi làm ngay, cần 2 tuần bàn giao'), 'Nhận việc ngay').verdict).toBe('unmet');
  });

  it('should be unknown when the CV says nothing about it', () => {
    expect(judge(cv('KỸ NĂNG', 'Excel'), 'Có thể đi làm ngay').verdict).toBe('unknown');
  });
});

describe('tools and certificates missing from the dictionary', () => {
  it('should find a product name written word for word', () => {
    const item = judge(
      cv('KỸ NĂNG', 'Phần mềm bán hàng KiotViet, tính tiền nhanh'),
      'Biết sử dụng phần mềm bán hàng KiotViet',
    );
    expect(item.verdict).toBe('met');
    expect(item.evidence).toContain('KiotViet');
  });

  it('should find a certificate by its words', () => {
    expect(
      judge(cv('CHỨNG CHỈ', 'Chứng chỉ vận hành xe nâng hàng (2021)'), 'Có chứng chỉ vận hành xe nâng').verdict,
    ).toBe('met');
  });

  it('should be unmet when the product is only something the candidate wants to learn', () => {
    const text = cv('KỸ NĂNG', 'Word, Excel', 'MONG MUỐN HỌC THÊM', 'Power BI, SQL');
    expect(judge(text, 'Sử dụng được Power BI').verdict).toBe('unmet');
    expect(judge(text, 'Biết SQL').verdict).toBe('unmet');
  });

  it('should be unknown, not unmet, when the name is simply absent', () => {
    expect(judge(cv('KỸ NĂNG', 'Word, Excel'), 'Biết sử dụng Zalo OA').verdict).toBe('unknown');
  });
});

describe('preference lines', () => {
  it('should be met as a bonus when the CV has it', () => {
    const item = judge(cv('KỸ NĂNG', 'Figma, Photoshop'), 'Ưu tiên biết Figma');
    expect(item.verdict).toBe('met');
    expect(item.reason).toContain('Điểm cộng');
  });

  it('should be unknown, never unmet, when the CV does not have it', () => {
    expect(judge(cv('KỸ NĂNG', 'Photoshop'), 'Biết Figma là một lợi thế').verdict).toBe('unknown');
  });

  it('should be unknown for "kinh nghiệm trong ngành" even with years of work', () => {
    expect(
      judge(cv('KINH NGHIỆM', 'Chuyên viên', '2015 - 2022'), 'Ưu tiên ứng viên có kinh nghiệm trong ngành').verdict,
    ).toBe('unknown');
  });
});

describe('majors and licences written loosely', () => {
  it('should read a major written after the school name without "chuyên ngành"', () => {
    const text = cv('HỌC VẤN', 'Đại học Ngân hàng TP.HCM – Tài chính – Ngân hàng (2017 – 2021)');
    expect(judge(text, 'Tốt nghiệp Đại học chuyên ngành Kế toán').verdict).toBe('unmet');
    expect(judge(text, 'Tốt nghiệp Đại học chuyên ngành Tài chính').verdict).toBe('met');
  });

  it('should match a major abbreviation (CNTT) to the full name', () => {
    const text = cv('HỌC VẤN', '2013 – 2018 Đại học Bách khoa Hà Nội – Kỹ sư Công nghệ thông tin');
    expect(judge(text, 'Tốt nghiệp Đại học chuyên ngành CNTT').verdict).toBe('met');
  });

  it('should not take a campus city for a major', () => {
    const text = cv('HỌC VẤN', 'Đại học FPT – Hà Nội (2016 – 2020)');
    expect(judge(text, 'Tốt nghiệp Đại học chuyên ngành Kế toán').verdict).toBe('unknown');
  });

  it('should be unmet when the CV only has a motorbike licence and a car class is required', () => {
    const item = judge(
      cv('GIẤY TỜ / PHƯƠNG TIỆN', '- Bằng lái xe: A1', '- Có xe máy riêng'),
      'Có bằng lái xe B2 trở lên',
    );
    expect(item.verdict).toBe('unmet');
    expect(item.reason).toContain('A1');
  });
});
