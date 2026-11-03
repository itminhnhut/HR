import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

const job = 'Mai Lan\n2020 - nay: Nhân viên, Công ty Thái Sơn.';

describe('the study written right after the level', () => {
  it.each([
    ['Cao đẳng Xây dựng, 2020', 'Chuyên ngành Xây dựng hoặc Kiến trúc'],
    ['Trung cấp Cơ khí, 2018', 'Chuyên ngành Cơ khí hoặc Tự động hóa'],
    ['Đại học Luật, 2019', 'Chuyên ngành Luật'],
    ['HỌC VẤN\nCĐ Marketing', 'Chuyên ngành Marketing hoặc Truyền thông'],
    ['HỌC VẤN\nĐH Kiến trúc Hà Nội, 2016', 'Tốt nghiệp ngành Kiến trúc'],
    ['Học vấn: Cao đẳng Kiến trúc, Trường Cao đẳng Xây dựng Số 1, 2019', 'Tốt nghiệp ngành Kiến trúc'],
  ])('should read "%s" as the major for "%s"', (education, line) => {
    // Act
    const got = verdict(`${job}\n${education}`, line);

    // Assert
    expect(got).toBe('met');
  });

  it('should be unmet when that study belongs to another known family', () => {
    // Act
    const got = verdict(`${job}\nĐại học Luật, 2019`, 'Chuyên ngành Thiết kế đồ họa hoặc Kiến trúc');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should be unmet when a later segment names the school, even for a study outside the dictionary', () => {
    // Act
    const got = verdict(
      `${job}\nTrung cấp Làm tóc, Trường Du lịch Đà Lạt, 2017`,
      'Chuyên ngành Kế toán hoặc Kiểm toán',
    );

    // Assert
    expect(got).toBe('unmet');
  });

  it('should stay open when the words after the level may be a school name it does not know', () => {
    // Act
    const got = verdict(`${job}\nCao đẳng Viễn Đông, 2018`, 'Chuyên ngành Kế toán hoặc Kiểm toán');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should take the major a later segment states over the name of the school', () => {
    // Act
    const got = verdict(`${job}\nĐại học Kinh tế, Kiến trúc, 2018`, 'Tốt nghiệp ngành Kiến trúc');

    // Assert
    expect(got).toBe('met');
  });

  it('should read a major on the line under the school', () => {
    // Arrange
    const cv = `${job}\nHọc vấn\nĐH Cần Thơ\nKiến trúc công trình\n2017-2021`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp ngành Kiến trúc');

    // Assert
    expect(got).toBe('met');
  });
});

describe('what follows the education entry on its line', () => {
  it.each(['Chưa có thẻ an toàn.', 'IELTS 5.5.', 'Chưa xin chứng chỉ hành nghề.'])(
    'should not read "%s" as the major',
    (tail) => {
      // Act
      const got = verdict(`${job}\nCao đẳng Xây dựng, 2021. ${tail}`, 'Chuyên ngành Xây dựng hoặc Kiến trúc');

      // Assert
      expect(got).toBe('met');
    },
  );
});

describe('a major stated in a later sentence of the entry', () => {
  it('should read it over the name of the school', () => {
    // Act
    const got = verdict(
      `${job}\nĐại học Luật Phương Nam. Chuyên ngành: Kiến trúc. 2017 - 2021`,
      'Tốt nghiệp ngành Kiến trúc',
    );

    // Assert
    expect(got).toBe('met');
  });
});

describe('a line opening with the major', () => {
  it('should be unmet for a CV that stops at high school', () => {
    // Act
    const got = verdict(`${job}\nTốt nghiệp THPT, 2019`, 'Chuyên ngành Xây dựng hoặc Kiến trúc');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should be unmet for a CV below high school', () => {
    // Act
    const got = verdict(`${job}\nHọc hết lớp 9.`, 'Chuyên ngành Xây dựng hoặc Kiến trúc');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('a line asking for students of a major', () => {
  const line = 'Sinh viên năm cuối ngành Kiến trúc';

  it('should be met by a student of that major', () => {
    // Act
    const got = verdict(`${job}\nĐại học Xây dựng, ngành Kiến trúc, đang học năm 4`, line);

    // Assert
    expect(got).toBe('met');
  });

  it('should be unmet for a student of another major', () => {
    // Act
    const got = verdict(`${job}\nĐại học Xây dựng, ngành Kế toán, đang học năm 4`, line);

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('a student naming the major apart from the school', () => {
  const cv = 'Mai Lan\nSinh viên năm 3, ngành Kiến trúc\nTrường Đại học Xây dựng (dự kiến tốt nghiệp 06/2028)';

  it('should read the major from the student line', () => {
    // Act
    const got = verdict(cv, 'Sinh viên năm 3, năm 4 ngành Kiến trúc');

    // Assert
    expect(got).toBe('met');
  });

  it('should still not give that student the degree', () => {
    // Act
    const got = verdict(cv, 'Bằng đại học trở lên');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('alternatives named with their level', () => {
  it('should read "Cao đẳng X hoặc Đại học X" as X, not as one long major', () => {
    // Act
    const got = verdict(`${job}\nĐại học Xây dựng Hà Nội, 2021`, 'Tốt nghiệp Cao đẳng Xây dựng hoặc Đại học Xây dựng');

    // Assert
    expect(got).toBe('met');
  });
});

describe('majors that only look alike', () => {
  it('should not read "Kế toán" as "Toán"', () => {
    // Act
    const got = verdict(`${job}\nĐại học Kinh tế, Kế toán, 2018`, 'Tốt nghiệp ngành Toán');

    // Assert
    expect(got).not.toBe('met');
  });

  it('should read "Toán ứng dụng" as "Toán"', () => {
    // Act
    const got = verdict(`${job}\nĐại học Khoa học, Toán ứng dụng, 2018`, 'Tốt nghiệp ngành Toán');

    // Assert
    expect(got).toBe('met');
  });

  it('should read "Công nghệ Sinh học" as "Sinh học"', () => {
    // Act
    const got = verdict(`${job}\nĐại học Cần Thơ, Công nghệ Sinh học, 2022`, 'Tốt nghiệp ngành Sinh học');

    // Assert
    expect(got).toBe('met');
  });

  it('should be unmet for a teaching degree in another subject', () => {
    // Act
    const got = verdict(
      `${job}\nCử nhân Sư phạm Lịch sử, Đại học Vinh, 2021`,
      'Tốt nghiệp chuyên ngành Giáo dục Địa lý',
    );

    // Assert
    expect(got).toBe('unmet');
  });

  it('should still accept the same subject under the other name for teaching', () => {
    // Act
    const got = verdict(
      `${job}\nCử nhân Sư phạm Mầm non, Đại học Vinh, 2021`,
      'Tốt nghiệp chuyên ngành Giáo dục Mầm non',
    );

    // Assert
    expect(got).toBe('met');
  });

  it('should still accept any teaching degree for a line asking only for teaching', () => {
    // Act
    const got = verdict(`${job}\nCử nhân Sư phạm Lịch sử, Đại học Vinh, 2021`, 'Tốt nghiệp ngành Sư phạm');

    // Assert
    expect(got).toBe('met');
  });

  it('should stay open when the CV shows the wide field but not the specialism asked for', () => {
    // Act
    const got = verdict(`${job}\nĐại học Sư phạm, 2021`, 'Tốt nghiệp chuyên ngành Giáo dục Địa lý');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should accept the words of the major with another word between them', () => {
    // Act
    const got = verdict(`${job}\nCao đẳng Quản trị Nhà hàng Khách sạn, 2021`, 'Chuyên ngành Quản trị khách sạn');

    // Assert
    expect(got).toBe('met');
  });

  it('should be unmet for a sibling trade in the same family', () => {
    // Act
    const got = verdict(`${job}\nTrung cấp Cơ khí, 2018`, 'Chuyên ngành Điện công nghiệp');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should be unmet for a narrower study of the same word that is not the one named', () => {
    // Act
    const got = verdict(`${job}\nTrung cấp Điện lạnh, 2017`, 'Chuyên ngành Điện công nghiệp');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('a major written in another language', () => {
  it('should stay open when it cannot be compared with the line', () => {
    // Act
    const got = verdict(`${job}\nBA Museum Studies, Hue University, 2020`, 'Chuyên ngành Du lịch');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should be unmet when it belongs to another known family', () => {
    // Act
    const got = verdict(`${job}\nBachelor of Law, Hue University, 2020`, 'Chuyên ngành Du lịch');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('levels written in ways the entry reader missed', () => {
  it.each([
    ['Education: THCS', 'unmet'],
    ['Trình độ: lớp 9.', 'unmet'],
    ['Học vấn: Trung học cơ sở', 'unmet'],
  ])('should read "%s" as below high school', (education, expected) => {
    // Act
    const got = verdict(`${job}\n${education}`, 'Học vấn: Tốt nghiệp THPT trở lên');

    // Assert
    expect(got).toBe(expected);
  });

  it('should find a vocational diploma without an education heading', () => {
    // Act
    const got = verdict(`${job}\nVocational Diploma, Business Administration, 2020`, 'Học vấn: Trung cấp trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should read levels separated by a slash on one line', () => {
    // Act
    const got = verdict(
      `${job}\nTrung cấp nấu ăn 2011 / Chứng chỉ nghề nấu ăn / Giấy xác nhận 2025`,
      'Học vấn: Trung cấp trở lên',
    );

    // Assert
    expect(got).toBe('met');
  });

  it('should keep the finished degree beside the one still in progress on a line', () => {
    // Act
    const got = verdict(
      `${job}\nĐại học Dược, dự kiến tốt nghiệp 2027. Bằng hiện có: Trung cấp Dược 2022.`,
      'Học vấn: Trung cấp trở lên',
    );

    // Assert
    expect(got).toBe('met');
  });

  it('should still call the higher degree unfinished on that line', () => {
    // Act
    const got = verdict(
      `${job}\nĐại học Dược, dự kiến tốt nghiệp 2027. Bằng hiện có: Trung cấp Dược 2022.`,
      'Học vấn: Đại học trở lên',
    );

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not count a degree written into a list of keywords', () => {
    // Arrange
    const dump =
      'Từ khóa: kiến trúc, AutoCAD, Revit, bản vẽ, đại học kiến trúc, 5 năm kinh nghiệm, chứng chỉ hành nghề';
    const cv = `Mai Lan\n${dump}\nCông việc: 2025 - nay, phụ bán hàng.\nHọc vấn: THPT`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp ngành Kiến trúc');

    // Assert
    expect(got).toBe('unmet');
  });
});
