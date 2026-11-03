import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

const job = '\nKINH NGHIỆM\n2022 - nay Lái xe, Công ty Thái Sơn';

describe('driving licences', () => {
  it.each([
    ['Bằng lái xe hạng C', 'Có bằng FC', 'unmet'],
    ['Bằng lái xe hạng FC', 'Có bằng FC', 'met'],
    ['Bằng lái xe hạng FC', 'Có bằng lái hạng C', 'met'],
    ['Bằng lái xe hạng FC', 'Có bằng lái hạng D', 'unmet'],
    ['Bằng lái xe hạng E', 'Có bằng lái FC', 'unmet'],
    ['Bằng lái xe hạng B2, FC', 'Có bằng lái FC', 'met'],
  ])('should compare "%s" with "%s"', (line, requirement, want) => {
    // Arrange
    const cv = `Hồ Tâm\n${line}${job}`;

    // Act
    const got = verdict(cv, requirement);

    // Assert
    expect(got).toBe(want);
  });

  it.each(['Đang học bằng lái C', 'Dự kiến thi bằng lái C tháng 3/2027', 'Chưa có bằng lái hạng C'])(
    'should not count "%s" as holding the licence',
    (line) => {
      // Arrange
      const cv = `Hồ Tâm\n${line}${job}`;

      // Act
      const got = verdict(cv, 'Có bằng lái xe hạng C');

      // Assert
      expect(got).toBe('unmet');
    },
  );

  it('should not read a referee as the candidate', () => {
    // Arrange
    const cv = `Hồ Tâm${job}\nNGƯỜI THAM CHIẾU\nÔng Nguyễn Tú, có bằng lái hạng E, Giám đốc Vận tải`;

    // Act
    const got = verdict(cv, 'Có bằng lái hạng E');

    // Assert
    expect(got).toBe('unmet');
  });

  it("should not read duties at a driving school as the candidate's licence", () => {
    // Arrange
    const cv = `Hồ Tâm\nKINH NGHIỆM\n2020 - nay Nhân viên tuyển sinh, Công ty Đào tạo Lái xe Mê Linh\nTư vấn học viên học bằng lái hạng C`;

    // Act
    const got = verdict(cv, 'Có bằng lái hạng C');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should keep a licence granted by a named training centre', () => {
    // Arrange
    const cv = `Hồ Tâm\nCHỨNG CHỈ\nBằng lái xe hạng C, Trung tâm Đào tạo Lái xe Mê Linh, 2019${job}`;

    // Act
    const got = verdict(cv, 'Có bằng lái hạng C');

    // Assert
    expect(got).toBe('met');
  });

  it('should fail a car licence for someone holding only a motorbike licence', () => {
    // Arrange
    const cv = `Hồ Tâm\nBằng lái A2${job}`;

    // Act
    const got = verdict(cv, 'Có bằng lái ô tô');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should leave a motorbike licence a CV does not mention out of the percent', () => {
    // Arrange
    const cv = `Hồ Tâm${job}`;

    // Act
    const res = scoreCv({ cvText: cv, requirements: ['Có bằng lái xe máy', 'Biết Excel'], today: '2026-11-03' });

    // Assert
    expect(res.items[0]?.verdict).toBe('unknown');
    expect(res.items[0]?.counted).toBe(false);
  });
});

describe('certificates outside the dictionary', () => {
  it('should find the words of a certificate in another order', () => {
    // Arrange
    const cv = `Hồ Tâm\nCHỨNG CHỈ\nChứng chỉ an toàn lao động nhóm 3${job}`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ an toàn lao động');

    // Assert
    expect(got).toBe('met');
  });

  it('should say not met when a CV with a work history does not have it', () => {
    // Arrange
    const cv = `Hồ Tâm${job}`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ kiểm định nồi hơi');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not read "có thể" as asking for a card', () => {
    // Arrange
    const cv = `Hồ Tâm${job}`;

    // Act
    const got = verdict(cv, 'Có thể làm ca đêm');

    // Assert
    expect(got).toBe('unknown');
  });
});
