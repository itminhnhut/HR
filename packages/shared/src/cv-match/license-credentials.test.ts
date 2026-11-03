import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

const job = 'Mai Lan\n2020 - nay: Thợ hàn, Công ty Thép Việt. Hàn kết cấu.';

describe('a credential a line asks for', () => {
  it.each([
    ['Có chứng chỉ hành nghề kiến trúc', 'Chứng chỉ hành nghề kiến trúc số 12/2021'],
    ['Có chứng chỉ hành nghề kiến trúc còn hiệu lực', 'Chứng chỉ hành nghề kiến trúc, cấp 2021'],
    ['Có giấy xác nhận kiến thức an toàn bức xạ', 'Giấy xác nhận kiến thức an toàn bức xạ, 2024'],
    ['Có giấy chứng nhận an toàn bức xạ', 'Giấy xác nhận kiến thức an toàn bức xạ, 2024'],
    ['Có bằng nghề hoặc chứng chỉ nghề hàn', 'Chứng chỉ nghề hàn bậc 3/7'],
    ['Có bằng nghề hoặc chứng chỉ nghề hàn', 'Bằng nghề hàn, 2016'],
    ['Có chứng chỉ giám sát thi công', 'Certificate: Chứng chỉ giám sát thi công'],
  ])('should be met for "%s" when the CV states "%s"', (line, held) => {
    // Act
    const got = verdict(`${job}\n${held}`, line);

    // Assert
    expect(got).toBe('met');
  });

  it('should be met by a vocational degree in the trade for a trade paper', () => {
    // Act
    const got = verdict(`${job}\nTrung cấp nghề Hàn, 2016`, 'Có bằng nghề hoặc chứng chỉ nghề hàn');

    // Assert
    expect(got).toBe('met');
  });

  it('should stay open for a vocational degree in other words', () => {
    // Act
    const got = verdict(`${job}\nCao đẳng Kỹ thuật cắt gọt kim loại, 2016`, 'Có bằng nghề hoặc chứng chỉ nghề hàn');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should be unmet for the practice certificate of another profession, known or not', () => {
    // Act
    const got = verdict(`${job}\nChứng chỉ hành nghề hộ sinh, 2022`, 'Có chứng chỉ hành nghề điều dưỡng');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should leave a paper the vocabulary knows to its own names', () => {
    // Act
    const got = verdict(`${job}\nChứng chỉ vận hành xe nâng hàng, 2022`, 'Có chứng chỉ lái xe nâng');

    // Assert
    expect(got).toBe('met');
  });

  it('should read CCHN as the practice certificate', () => {
    // Act
    const got = verdict(`${job}\nĐã có CCHN kiến trúc năm 2023`, 'Có chứng chỉ hành nghề kiến trúc');

    // Assert
    expect(got).toBe('met');
  });

  it('should be met by the bare certificate when the CV works in that trade', () => {
    // Arrange
    const cv = 'Mai Lan\nKiến trúc sư\n2019 - nay: Kiến trúc sư, Công ty A.\nCCHN còn hạn.';

    // Act
    const got = verdict(cv, 'Có chứng chỉ hành nghề kiến trúc');

    // Assert
    expect(got).toBe('met');
  });

  it('should stay open for the bare certificate when nothing shows the trade', () => {
    // Arrange
    const cv = `${job}\nChứng chỉ hành nghề số 123`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ hành nghề kiến trúc');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should be unmet when the certificate is for another known field', () => {
    // Arrange
    const cv = `${job}\nChứng chỉ hành nghề điều dưỡng`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ hành nghề dược');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should stay open when a certificate of the same form names something unknown', () => {
    // Arrange
    const cv = `${job}\nChứng chỉ nghề kỹ thuật chế biến cơm niêu`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ nghề nấu ăn');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should stay open for a certificate written in English it cannot compare', () => {
    // Arrange
    const cv = `${job}\nWelding practice certificate, 2020`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ nghề hàn');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should stay open when the name appears only as a duty', () => {
    // Arrange
    const cv = 'Mai Lan\n2020 - nay: Nhân viên an toàn, Công ty A. Đánh giá viên nội bộ ISO 9001.';

    // Act
    const got = verdict(cv, 'Có chứng chỉ đánh giá viên nội bộ');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should be unmet when a CV with real content does not mention it', () => {
    // Act
    const got = verdict(job, 'Có giấy xác nhận kiến thức an toàn bức xạ');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should stay open when the CV holds too little text to tell', () => {
    // Act
    const got = verdict('Mai Lan, xin chào anh chị', 'Có chứng chỉ hành nghề kiến trúc');

    // Assert
    expect(got).toBe('unknown');
  });

  it.each([
    'Chưa có chứng chỉ hành nghề kiến trúc',
    'Chưa xin chứng chỉ hành nghề.',
    'Chứng chỉ hành nghề kiến trúc đã hết hạn năm 2022',
    'Chứng chỉ hành nghề kiến trúc: đã thi đạt, đang xử lý hồ sơ, dự kiến nhận tháng 12/2026.',
    'Đang học chứng chỉ hành nghề kiến trúc',
  ])('should be unmet when the CV says "%s"', (statement) => {
    // Act
    const got = verdict(`${job}\n${statement}`, 'Có chứng chỉ hành nghề kiến trúc');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should leave a credential only a list of keywords names open and counted', () => {
    // Arrange
    const dump =
      'Từ khóa: kiến trúc, AutoCAD, Revit, bản vẽ, chứng chỉ hành nghề kiến trúc, đại học kiến trúc, 5 năm kinh nghiệm';
    const cv = `Mai Lan\n${dump}\nCông việc: 2025 - nay, phụ bán hàng.\nHọc vấn: THPT`;

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['Có chứng chỉ hành nghề kiến trúc'], today: '2026-11-03' })
      .items[0];

    // Assert
    expect(got?.verdict).toBe('unknown');
    expect(got?.counted).toBe(true);
  });

  it('should read an abbreviation made of the initials of what is asked', () => {
    // Arrange
    const cv = `${job}\nGiấy xác nhận kiến thức ATBX, 2024`;

    // Act
    const got = verdict(cv, 'Có giấy xác nhận kiến thức an toàn bức xạ');

    // Assert
    expect(got).toBe('met');
  });

  it('should not read "có thể" as asking for a card', () => {
    // Act
    const got = verdict(job, 'Có thể an tâm làm ca đêm');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should leave a one-word certificate such as a product exam to the name search', () => {
    // Arrange
    const cv = `${job}\nChứng chỉ PMP 2021`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ PMP');

    // Assert
    expect(got).toBe('met');
  });

  it('should keep treating a language certificate as a language line', () => {
    // Arrange
    const cv = `${job}\nChứng chỉ TOEIC 600`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ TOEIC 500');

    // Assert
    expect(got).toBe('met');
  });
});

describe('a driving licence written apart from the words for driving', () => {
  it.each(['Bằng hạng C1 (cấp lại năm 2025)', 'Bằng C còn hạn'])(
    'should read "%s" as the licence class',
    (statement) => {
      // Act
      const got = verdict(`${job}\n${statement}`, 'Có bằng lái xe hạng C trở lên');

      // Assert
      expect(got).not.toBe('unknown');
    },
  );

  it('should read a licence listed under languages but not a language paper there', () => {
    // Arrange
    const licence = `${job}\nNGOẠI NGỮ\nTOEIC 600, Bằng lái xe hạng B2`;
    const language = `${job}\nNGOẠI NGỮ\nBằng B1`;

    // Act
    const hasLicence = verdict(licence, 'Có bằng lái xe B2');
    const hasLanguagePaper = verdict(language, 'Có bằng lái xe B1');

    // Assert
    expect(hasLicence).toBe('met');
    expect(hasLanguagePaper).toBe('unmet');
  });

  it('should read the class on the line under a "Bằng lái:" label', () => {
    // Arrange
    const cv = `Mai Lan\nBằng lái:\nHạng C\n2020 - nay: Tài xế, Công ty A.`;

    // Act
    const got = verdict(cv, 'Có bằng lái xe hạng C trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should be unmet for an expired licence', () => {
    // Arrange
    const cv = `${job}\nBằng C hết hạn tháng 3/2025, đang làm thủ tục cấp lại.`;

    // Act
    const got = verdict(cv, 'Có bằng lái xe hạng C trở lên còn hạn');

    // Assert
    expect(got).toBe('unmet');
  });

  const dump = 'Lái xe, bằng lái xe hạng C, còn hạn, tuyến đường, chạy đêm, đi tỉnh, THPT, 5 năm kinh nghiệm';

  it('should leave a licence only a list of keywords names open and counted', () => {
    // Arrange
    const cv = `Mai Lan\n${dump}\nCông việc thực tế: 2025 - nay, phụ quán ăn.`;

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['Có bằng lái xe hạng C trở lên'], today: '2026-11-03' }).items[0];

    // Assert
    expect(got?.verdict).toBe('unknown');
    expect(got?.counted).toBe(true);
  });

  it('should be unmet when the rest of the CV says the licence is not held', () => {
    // Arrange
    const cv = `Mai Lan\n${dump}\nCông việc thực tế: 2025 - nay, phụ quán ăn, chưa có bằng lái ô tô.`;

    // Act
    const got = verdict(cv, 'Có bằng lái xe hạng C trở lên');

    // Assert
    expect(got).toBe('unmet');
  });
});
