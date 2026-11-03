import { describe, expect, it } from 'vitest';
import type { EducationAtom } from './atoms.js';
import { parseRequirement } from './requirement.js';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

function educationAtom(requirement: string): EducationAtom | undefined {
  const atom = parseRequirement(requirement).atoms.find((a) => a.kind === 'education');
  return atom?.kind === 'education' ? atom : undefined;
}

const job = '\nKINH NGHIỆM\n2022 - nay Nhân viên, Công ty Thái Sơn';

describe('major lists', () => {
  it.each([
    ['Tốt nghiệp Cao đẳng ngành Cơ khí, Tự động hóa', ['co khi', 'tu dong hoa']],
    ['Đại học chuyên ngành Cơ điện, Điện tử', ['co dien', 'dien tu']],
    ['Tốt nghiệp Đại học ngành Kiến trúc, Cơ sở hạ tầng', ['kien truc', 'co so ha tang']],
    [
      'Tốt nghiệp Đại học ngành Xây dựng – công trình, Thủy lợi hoặc tương đương',
      ['xay dung - cong trinh', 'thuy loi'],
    ],
  ])('should read every major of "%s"', (line, majors) => {
    // Act
    const atom = educationAtom(line);

    // Assert
    expect(atom?.majors).toEqual(majors);
  });

  it('should still stop a major at "có"', () => {
    // Act
    const atom = educationAtom('Tốt nghiệp Đại học ngành Luật có chứng chỉ hành nghề');

    // Assert
    expect(atom?.majors).toEqual(['luat']);
  });

  it('should split a major glued to the next word', () => {
    // Act
    const atom = educationAtom('Tốt nghiệp Đại học ngành Xã hội họchoặc ngành liên quan');

    // Assert
    expect(atom?.majors).toEqual(['xa hoi hoc']);
    expect(atom?.majorRelatedOnly).toBe(true);
  });

  it('should read a CV major starting with "Cơ"', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Giao thông, chuyên ngành Cơ khí động lực, 2015 - 2019${job}`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp Đại học ngành Cơ khí');

    // Assert
    expect(got).toBe('met');
  });

  it('should keep the major when the words after it were wrapped onto the next line', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Giao thông\nChuyên ngành: Khoa học\nmáy tính, 2015 - 2019${job}`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp Đại học ngành Khoa học máy tính');

    // Assert
    expect(got).toBe('met');
  });
});

describe('"hoặc ngành liên quan"', () => {
  const line = 'Tốt nghiệp Đại học ngành Xây dựng, Cơ khí hoặc ngành liên quan';

  it('should accept a major of the same family', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Đà Nẵng, chuyên ngành Kỹ thuật điện, 2015 - 2019${job}`;

    // Act
    const got = verdict(cv, line);

    // Assert
    expect(got).toBe('met');
  });

  it('should reject a major of a clearly different family', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Đà Nẵng, chuyên ngành Thanh nhạc, 2015 - 2019${job}`;

    // Act
    const got = verdict(cv, line);

    // Assert
    expect(got).toBe('unmet');
  });

  it('should leave a major we do not know to HR', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Đà Nẵng, chuyên ngành Hải dương học, 2015 - 2019${job}`;

    // Act
    const got = verdict(cv, line);

    // Assert
    expect(got).toBe('unknown');
  });
});

describe('degree mentions', () => {
  it.each(['Tôi không có bằng đại học, học nghề từ gia đình.', 'Chưa có bằng cao đẳng.'])(
    'should not read "%s" as a degree',
    (sentence) => {
      // Arrange
      const cv = `Bùi Hải\nGIỚI THIỆU\n${sentence}${job}`;

      // Act
      const got = verdict(cv, 'Cao đẳng trở lên');

      // Assert
      expect(got).toBe('unmet');
    },
  );

  it('should not read a relative as the candidate', () => {
    // Arrange
    const cv = `Bùi Hải\nGIỚI THIỆU\nChị tôi là thạc sĩ, bố là bác sĩ. Tôi tốt nghiệp lớp 12.${job}`;

    // Act
    const got = verdict(cv, 'Thạc sĩ trở lên');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not read a short course held at a university as a degree', () => {
    // Arrange
    const cv = `Bùi Hải\nHỌC VẤN\nTốt nghiệp THPT Kim Liên\nKhóa học ngắn hạn Excel tại Đại học Bách Khoa${job}`;

    // Act
    const got = verdict(cv, 'Đại học trở lên');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should keep a university whose name holds the words "Khoa học"', () => {
    // Arrange
    const cv = `Bùi Hải\nHỌC VẤN\nĐại học Khoa học Tự nhiên, ngành Hóa học, 2014 - 2018${job}`;

    // Act
    const got = verdict(cv, 'Đại học trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should not read the class a teacher teaches as the teacher left school at that class', () => {
    // Arrange
    const cv = `KINH NGHIỆM\n2015 - nay Giáo viên, Trường Tiểu học Kim Đồng. Chủ nhiệm lớp 4.\nHỌC VẤN\nĐại học Sư phạm Vinh, 2011 - 2015`;

    // Act
    const got = verdict(cv, 'Đại học trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should read a schooling that stopped below high school as not met', () => {
    // Arrange
    const cv = `Bùi Hải\nHọc vấn: 10/12${job}`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp THPT');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('majors named after the level', () => {
  it.each([
    ['Tốt nghiệp Đại học Luật', ['luat']],
    ['Tốt nghiệp Cao đẳng Điều dưỡng trở lên', ['dieu duong']],
  ])('should read "%s" as asking for a major', (line, majors) => {
    // Act
    const atom = educationAtom(line);

    // Assert
    expect(atom?.majors).toEqual(majors);
  });

  it('should not take a school name after the level for a major', () => {
    // Act
    const atom = educationAtom('Tốt nghiệp Đại học Bách Khoa');

    // Assert
    expect(atom?.majors).toEqual([]);
  });

  it('should tell a pharmacist from a physician at a shared school', () => {
    // Arrange
    const cv = `HỌC VẤN\nDược sĩ, Đại học Y Dược Huế, 2012 - 2017${job}`;

    // Act
    const pharmacy = verdict(cv, 'Tốt nghiệp Đại học Dược');
    const medicine = verdict(cv, 'Tốt nghiệp Đại học ngành Y');

    // Assert
    expect(pharmacy).toBe('met');
    expect(medicine).toBe('unmet');
  });

  it('should read the abbreviation CĐ in a CV education section', () => {
    // Arrange
    const cv = `HỌC VẤN\nCĐ Sư phạm Bến Tre, 2015 - 2018${job}`;

    // Act
    const got = verdict(cv, 'Cao đẳng trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should treat English and Vietnamese names of a major as the same', () => {
    // Arrange
    const cv = `EDUCATION\nBachelor of Economics, Monash University, 2015 - 2018${job}`;

    // Act
    const got = verdict(cv, 'Tốt nghiệp Đại học chuyên ngành Kinh tế');

    // Assert
    expect(got).toBe('met');
  });
});

describe('a study still in progress', () => {
  it('should not call a graduate "still studying" because a later date sits nearby', () => {
    // Arrange
    const cv = `HỌC VẤN\nCao đẳng Công Thương, đã tốt nghiệp năm 2018${job}`;

    // Act
    const got = verdict(cv, 'Cao đẳng trở lên');

    // Assert
    expect(got).toBe('met');
  });

  it('should read an open-ended study as not finished', () => {
    // Arrange
    const cv = `HỌC VẤN\nĐại học Công Thương, 2023 - nay${job}`;

    // Act
    const got = verdict(cv, 'Đại học trở lên');

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('a line that only names the major', () => {
  const cv = (degree: string) =>
    ['Nguyễn Văn A', 'Học vấn', `Đại học Kinh tế TP.HCM (2016 - 2020) ${degree}`, 'Kinh nghiệm làm việc', 'Công ty ABC'].join('\n');
  const verdict = (requirement: string, degree: string) =>
    scoreCv({ cvText: cv(degree), requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;

  it('should be met by a degree in one of the majors', () => {
    expect(verdict('Chuyên ngành Tài chính, Ngân hàng, Kế toán hoặc Kinh tế', 'Cử nhân Kế toán')).toBe('met');
  });

  it('should be unmet by a degree in another field', () => {
    expect(verdict('Chuyên ngành Thiết kế đồ họa hoặc Mỹ thuật công nghiệp', 'Cử nhân Kế toán')).toBe('unmet');
  });

  it('should not read knowing an industry as a degree', () => {
    expect(verdict('Am hiểu ngành logistics', 'Cử nhân Kế toán')).not.toBe('met');
    const parsed = parseRequirement('Am hiểu ngành logistics').atoms.map((a) => a.kind);
    expect(parsed).not.toContain('education');
  });
});
