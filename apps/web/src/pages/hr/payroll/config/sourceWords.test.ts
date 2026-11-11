import { describe, expect, it } from 'vitest';
import { shownLabel } from './configModel';
import { COMPANY_RULE, shownSource } from './sourceWords';

describe('shownSource', () => {
  it('should keep a law citation as it is', () => {
    expect(shownSource('NĐ 253/2026 Đ.8 k2 g, Đ.69 k1 b')).toBe('NĐ 253/2026 Đ.8 k2 g, Đ.69 k1 b');
    expect(shownSource('Luật BHXH 2024 Đ.33 k1; NĐ 188/2025 Đ.6 k1 a')).toBe(
      'Luật BHXH 2024 Đ.33 k1; NĐ 188/2025 Đ.6 k1 a',
    );
  });

  it('should say "Quy chế công ty" when only internal references remain', () => {
    expect(shownSource('spec 5.9')).toBe('Quy chế công ty');
    expect(shownSource('câu 7')).toBe('Quy chế công ty');
    expect(shownSource('câu 9, 32, 33')).toBe('Quy chế công ty');
    expect(shownSource('spec 5.7, câu 25')).toBe('Quy chế công ty');
    expect(shownSource('D13, R6')).toBe('Quy chế công ty');
  });

  it('F13: should call the builders own document "Quy chế công ty", with or without a section number', () => {
    // Act + Assert
    expect(shownSource('spec Lương')).toBe(COMPANY_RULE);
    expect(shownSource('spec 5.9')).toBe(COMPANY_RULE);
  });

  it('should keep the law and drop the internal reference next to it', () => {
    expect(shownSource('câu 21; NĐ 145/2020 Đ.60 k4')).toBe('NĐ 145/2020 Đ.60 k4');
    expect(shownSource('Luật BHXH 2024 Đ.33 k5; kế toán ký xác nhận (17.3)')).toBe(
      'Luật BHXH 2024 Đ.33 k5; kế toán ký xác nhận',
    );
    expect(shownSource('BLLĐ Đ.98 (R4)')).toBe('BLLĐ Đ.98');
  });

  it("should name HR's pay file in words", () => {
    expect(shownSource('câu 6, file T10')).toBe('Theo file lương của HR');
    expect(shownSource('spec 5.3, file T10: khối BO theo công ÷ chuẩn, khối KD do HR đánh giá')).toBe(
      'Theo file lương của HR: khối BO theo công ÷ chuẩn, khối KD do HR đánh giá',
    );
  });

  it('should leave what HR typed, and an empty source empty', () => {
    expect(shownSource('Quyết định 12/QĐ-GĐ ngày 01/10/2026')).toBe('Quyết định 12/QĐ-GĐ ngày 01/10/2026');
    expect(shownSource('')).toBe('');
  });
});

describe('shownLabel', () => {
  it('F13: should leave the builders codes out of a setting name', () => {
    expect(shownLabel('D03 KPCĐ')).toBe('KPCĐ');
    expect(shownLabel('Đếm 14 ngày cho tháng vào, nghỉ giữa tháng (BH-1)')).toBe(
      'Đếm 14 ngày cho tháng vào, nghỉ giữa tháng',
    );
    expect(shownLabel('Giảm trừ gia cảnh')).toBe('Giảm trừ gia cảnh');
  });
});
