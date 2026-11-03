import { describe, expect, it } from 'vitest';
import { parseRequirement } from './requirement.js';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

const job = '\nKINH NGHIỆM\n2022 - nay Nhân viên hành chính, Công ty Thái Sơn';

describe('CEFR levels', () => {
  it.each([
    ['Tiếng Anh: A2', 'Tiếng Anh B1 trở lên', 'unmet'],
    ['Tiếng Anh: B1', 'Tiếng Anh B1 trở lên', 'met'],
    ['Chứng chỉ tiếng Trung C1', 'Tiếng Trung B2', 'met'],
    ['Tiếng Pháp DELF A2', 'Tiếng Pháp B1', 'unmet'],
  ])('should compare "%s" with "%s"', (line, requirement, want) => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\n${line}${job}`;

    // Act
    const got = verdict(cv, requirement);

    // Assert
    expect(got).toBe(want);
  });

  it('should read a test score on the CEFR scale', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nIELTS 7.5${job}`;

    // Act
    const got = verdict(cv, 'Tiếng Anh C1');

    // Assert
    expect(got).toBe('met');
  });

  it('should compare the old national certificates', () => {
    // Arrange
    const cv = `Hồ Anh\nBẰNG CẤP\nBằng A tiếng Anh${job}`;

    // Act
    const got = verdict(cv, 'Có bằng C tiếng Anh');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not read a car licence B2 on another line as a language level', () => {
    // Arrange
    const cv = `Hồ Anh\nBằng lái B2\nNGOẠI NGỮ\nTiếng Anh A2${job}`;

    // Act
    const got = verdict(cv, 'Tiếng Anh B2');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('scores', () => {
  it('should ignore a target score', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nTOEIC 450. Mục tiêu đạt TOEIC 800 cuối năm.${job}`;

    // Act
    const got = verdict(cv, 'TOEIC 700');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should take the overall band, not a sub-score', () => {
    // Arrange
    const cv = `Hồ Anh\nIELTS: Overall 5.5 (Reading 7.5, Listening 6.5)${job}`;

    // Act
    const got = verdict(cv, 'IELTS 6.0');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should find a score written after a year', () => {
    // Arrange
    const cv = `Hồ Anh\nThi TOEIC tháng 3/2023 được 725 điểm${job}`;

    // Act
    const got = verdict(cv, 'TOEIC 700 trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should fail a low score of another test on an "or equivalent" line', () => {
    // Arrange
    const cv = `Hồ Anh\nChứng chỉ: TOEIC 350${job}`;

    // Act
    const got = verdict(cv, 'IELTS 6.5 hoặc tương đương');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should accept a high score of another test', () => {
    // Arrange
    const cv = `Hồ Anh\nTOEFL iBT 105${job}`;

    // Act
    const got = verdict(cv, 'IELTS 6.5 hoặc tương đương');

    // Assert
    expect(got).toBe('met');
  });

  it('should not accept a stated level when a certificate is what is asked', () => {
    // Arrange
    const cv = `Hồ Anh\nTiếng Anh lưu loát${job}`;

    // Act
    const got = verdict(cv, 'Có chứng chỉ TOEFL');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('mentions that are no evidence', () => {
  it.each(['2021 - nay Lễ tân, Trung tâm Hoa ngữ Đông Phương', '2021 - nay Lễ tân, Korean Town Center'])(
    'should not count an employer named for a language: %s',
    (line) => {
      // Arrange
      const cv = `Hồ Anh\nKINH NGHIỆM\n${line}`;

      // Act
      const chinese = verdict(cv, 'Biết tiếng Trung');
      const korean = verdict(cv, 'Biết tiếng Hàn');

      // Assert
      expect(chinese).toBe('unmet');
      expect(korean).toBe('unmet');
    },
  );

  it('should read a language the CV says is not known', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nTiếng Hàn: chưa biết${job}`;

    // Act
    const got = verdict(cv, 'Biết tiếng Hàn');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should count teaching a language as knowing it well', () => {
    // Arrange
    const cv = `Hồ Anh\nKINH NGHIỆM\n2019 - nay Giáo viên tiếng Nhật, Trường Ngoại ngữ Hà Đông`;

    // Act
    const got = verdict(cv, 'Tiếng Nhật giao tiếp tốt');

    // Assert
    expect(got).toBe('met');
  });
});

describe('several languages on one line', () => {
  it('should need every language joined by "và"', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nTiếng Hàn TOPIK 4${job}`;

    // Act
    const got = verdict(cv, 'Biết tiếng Hàn và tiếng Nhật');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should accept one of the languages joined by "hoặc"', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nTiếng Hàn TOPIK 4${job}`;

    // Act
    const got = verdict(cv, 'Biết tiếng Hàn hoặc tiếng Nhật');

    // Assert
    expect(got).toBe('met');
  });

  it('should read a list of bare language names', () => {
    // Arrange
    const cv = `Hồ Anh\nNGOẠI NGỮ\nTiếng Pháp B1${job}`;

    // Act
    const got = verdict(cv, 'Biết một trong các ngoại ngữ: Pháp, Đức');

    // Assert
    expect(got).toBe('met');
  });
});

describe('the level a line asks for', () => {
  it.each([
    ['Đọc hiểu và giao tiếp tiếng Hàn tốt', 3],
    ['Tiếng Hàn giao tiếp cơ bản', 1],
    ['Giao tiếp tiếng Hàn lưu loát', 4],
    ['Đọc hiểu tài liệu tiếng Hàn', 2],
  ])('should read "%s" as level %i', (line, level) => {
    // Act
    const atom = parseRequirement(line).atoms.find((a) => a.kind === 'language');

    // Assert
    expect(atom).toMatchObject({ minLevel: level });
  });
});

describe('a language named only in a list of keywords', () => {
  const dump = 'Từ khóa: kho, nhập xuất tồn, kiểm kê, FIFO, Excel, IELTS 6.5, tiếng Anh giao tiếp, trung thực';

  it('should leave the line open and counted', () => {
    // Arrange
    const cv = `Mai Lan\n${dump}\n2024 - nay: Phụ quán ăn.`;

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['IELTS 6.0 trở lên'], today: '2026-11-03' }).items[0];

    // Assert
    expect(got?.verdict).toBe('unknown');
    expect(got?.counted).toBe(true);
  });

  it('should go by what the rest of the CV states', () => {
    // Arrange
    const cv = `Mai Lan\n${dump}\n2024 - nay: Phụ quán ăn.\nNgoại ngữ: IELTS 4.0`;

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['IELTS 6.0 trở lên'], today: '2026-11-03' }).items[0];

    // Assert
    expect(got?.verdict).toBe('unmet');
  });

  it('should be met by a list the work stands behind', () => {
    // Arrange
    const cv = `Mai Lan\n${dump}\n2024 - nay: Thủ kho, Công ty A. Nhập xuất tồn, kiểm kê định kỳ.`;

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['IELTS 6.0 trở lên'], today: '2026-11-03' }).items[0];

    // Assert
    expect(got?.verdict).toBe('met');
  });
});

describe('a line asking to read well', () => {
  it('should be met by reading, without asking to converse', () => {
    // Arrange
    const cv = 'Mai Lan\n2020 - nay: Lập trình viên, Công ty A.\nTiếng Anh: đọc hiểu tài liệu';

    // Act
    const got = scoreCv({ cvText: cv, requirements: ['Đọc hiểu tốt tài liệu tiếng Anh'], today: '2026-11-03' })
      .items[0];

    // Assert
    expect(got?.verdict).toBe('met');
  });
});
