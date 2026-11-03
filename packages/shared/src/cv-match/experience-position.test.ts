import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

function judge(cvText: string, requirement: string): MatchItem {
  const item = scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0];
  if (!item) throw new Error('no item');
  return item;
}

describe('a line that asks for a position without saying "kinh nghiệm"', () => {
  it('should read "Tối thiểu N năm ở vị trí X hoặc Y" as an experience requirement', () => {
    // Arrange
    const cv = 'Mai Lan\n2018 - nay: Đội trưởng bảo trì, Công ty Thép Việt';

    // Act
    const got = judge(cv, 'Tối thiểu 3 năm ở vị trí đội trưởng bảo trì hoặc đội phó bảo trì');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should read "Ít nhất N năm làm X" as an experience requirement', () => {
    // Arrange
    const cv = 'Mai Lan\n2024 - nay: Thợ may mẫu, Xưởng Hoa Mai';

    // Act
    const got = judge(cv, 'Ít nhất 5 năm làm thợ may mẫu');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should read "Có N năm làm việc tại vị trí X" as an experience requirement', () => {
    // Arrange
    const cv = 'Mai Lan\n2020 - nay: Tổ trưởng in, Công ty Bao bì Việt';

    // Act
    const got = judge(cv, 'Có 2 năm làm việc tại vị trí tổ trưởng in');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should not read a commitment to stay as an experience requirement', () => {
    // Arrange
    const cv = 'Mai Lan\n2024 - nay: Thợ may mẫu, Xưởng Hoa Mai';

    // Act
    const got = judge(cv, 'Cam kết làm việc tối thiểu 2 năm');

    // Assert
    expect(got.reason).not.toContain('kinh nghiệm');
  });
});

describe('a position the dictionary does not know', () => {
  const line = 'Kinh nghiệm: Từ 1 năm ở vị trí điều vận viên hoặc phụ kho lạnh';

  it('should be met by a job with that title', () => {
    // Arrange
    const cv = '2021 - nay: Điều vận viên, Công ty Vận chuyển An Bình. Sắp xếp lịch xe.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should be unmet when every job states another title', () => {
    // Arrange
    const cv = '2021 - nay: Nhân viên kế toán, Công ty Vận chuyển An Bình. Hạch toán chi phí.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should not take a title for the position because it shares syllables with it', () => {
    // Arrange: "giáo viên" holds two of the three syllables of "giao dịch viên".
    const cv = '2021 - nay: Giáo viên tiếng Anh, Trung tâm Sao Mai. Soạn bài giảng.';

    // Act
    const got = judge(cv, 'Kinh nghiệm: Từ 1 năm ở vị trí giao dịch viên');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should stay open when the job names only the company', () => {
    // Arrange
    const cv = 'Mai Lan\nPacific Freight Company, Mar 2021 - Present. Plan truck routes and schedules.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should not take the name of the candidate for a role', () => {
    // Arrange
    const cv = 'Mai Lan\nCông ty Hoa Sen, từ 2020 đến nay. Sắp lịch xe, theo dõi tuyến.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí kế toán');

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should stay open when the title is written in another language', () => {
    // Arrange
    const cv = 'Mai Lan\nDispatcher, Pacific Freight, Mar 2021 - Present. Plan truck routes.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('unknown');
  });
});

describe('a position the dictionary knows and a title in another language', () => {
  it('should be unmet when the title is plainly another job', () => {
    // Arrange
    const cv = 'Mai Lan\nJan 2022 - Present: Barista at Cloud Nine Coffee. Made drinks.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí kế toán');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should be met when the title names the role in that language', () => {
    // Arrange
    const cv = 'Mai Lan\nJan 2022 - Present: Accountant at Cloud Nine Coffee.';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí kế toán');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('a title broken over two lines above the dates', () => {
  it('should read as one title', () => {
    // Arrange
    const cv = 'KINH NGHIỆM\nĐiều vận\nviên\n06/2023 - nay';

    // Act
    const got = judge(cv, 'Từ 1 năm ở vị trí điều vận viên');

    // Assert
    expect(got.verdict).toBe('met');
  });
});

describe('the rank a position names', () => {
  it('should be unmet for another rank in the same trade', () => {
    // Arrange: both are "kỹ sư", only one is the "trưởng" the line asks for.
    const cv = '2015 - nay: Kỹ sư cơ khí, Công ty Đóng tàu Hạ Long. Lập bản vẽ.';

    // Act
    const got = judge(cv, 'Tối thiểu 2 năm ở vị trí kỹ sư trưởng');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should not find the rank in the name of the employer', () => {
    // Arrange: "Trường" folds to the same word as "trưởng".
    const cv = '2015 - nay: Kế toán, Trường Cao đẳng Kỹ thuật Hạ Long.';

    // Act
    const got = judge(cv, 'Tối thiểu 2 năm ở vị trí kế toán trưởng');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should stay open for a foreign title in the same trade', () => {
    // Arrange
    const cv = 'Senior Engineer, Ha Long Shipyard, 2015 - Present. Draw plans.';

    // Act
    const got = judge(cv, 'Tối thiểu 2 năm ở vị trí kỹ sư trưởng');

    // Assert
    expect(got.verdict).toBe('unknown');
  });
});

describe('a position held at a kind of place', () => {
  const line = 'Kinh nghiệm: Từ 2 năm ở vị trí kế toán trong nhà máy sản xuất';

  it('should be met when the job shows the role and the place', () => {
    // Arrange
    const cv = '2020 - nay: Kế toán, Nhà máy Giấy Sông Lam. Hạch toán.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should stay open when the job shows the role but not the kind of place', () => {
    // Arrange
    const cv = '2020 - nay: Kế toán, Công ty Sông Lam. Hạch toán.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should be unmet when the job shows neither', () => {
    // Arrange
    const cv = '2020 - nay: Nhân viên bán hàng, Công ty Sông Lam.';

    // Act
    const got = judge(cv, line);

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should treat a slash as alternatives even for short role names', () => {
    // Arrange
    const cv = '2020 - nay: HR, Nhà máy Giấy Sông Lam.';

    // Act
    const got = judge(cv, 'Từ 2 năm ở vị trí HR/IT trong nhà máy sản xuất');

    // Assert
    expect(got.verdict).toBe('met');
  });
});
