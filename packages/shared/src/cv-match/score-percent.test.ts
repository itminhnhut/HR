import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';

const TODAY = '2026-11-03';

const ELECTRICIAN = `PHAN VĂN LỘC
Thợ điện
KINH NGHIỆM LÀM VIỆC
01/2018 - nay: Thợ điện, Công ty Xi măng Đồng Lâm
HỌC VẤN
Cao đẳng Kỹ thuật Huế, ngành Điện công nghiệp, 2014 - 2017`;

const JOB_SEEKER = `TRẦN THỊ HỒNG
Muốn tìm việc gần nhà, biết dùng Excel, đi làm được ngay sau Tết.`;

describe('percent over measurable lines', () => {
  const requirements = ['Từ 3 năm kinh nghiệm thợ điện', 'Cao đẳng trở lên', 'Có thẻ an toàn điện', 'Biết Excel'];

  it('should rank a tradesman missing one tool above a CV that only shows that tool', () => {
    // Act
    const strong = scoreCv({ cvText: ELECTRICIAN, requirements, today: TODAY });
    const weak = scoreCv({ cvText: JOB_SEEKER, requirements, today: TODAY });

    // Assert
    expect(strong.percent).toBe(50);
    expect(weak.percent).toBeNull();
  });

  it('should not let a line left open lift the percent', () => {
    // Arrange
    const cv = `NGUYỄN AN
KINH NGHIỆM
Nhân viên kinh doanh, Công ty Việt Hưng
03/2021 - nay
KỸ NĂNG
Excel`;

    // Act
    const res = scoreCv({
      cvText: cv,
      requirements: ['Từ 2 năm kinh nghiệm', 'Biết Excel', 'Tốt nghiệp Đại học'],
      today: TODAY,
    });

    // Assert
    expect(res.items.map((i) => i.verdict)).toEqual(['met', 'met', 'unknown']);
    expect(res.percent).toBe(67);
  });

  it('should give no percent when fewer than half of the measurable lines can be judged', () => {
    // Arrange
    const cv = `Lê Thị Bích
Hiện đang tìm việc làm ở quận Bình Thạnh, biết Word.`;

    // Act
    const res = scoreCv({
      cvText: cv,
      requirements: ['Từ 2 năm kinh nghiệm', 'Đại học trở lên', 'Tiếng Anh giao tiếp', 'Biết Word'],
      today: TODAY,
    });

    // Assert
    expect(res.percent).toBeNull();
  });

  it('should leave soft lines, bonuses and lines CVs do not state out of the percent', () => {
    // Arrange
    const requirementsWithExtras = [
      'Thành thạo Excel',
      'Cẩn thận, trung thực',
      'Biết Figma là lợi thế',
      'Có laptop riêng',
      'Có thể đi làm ngay',
    ];
    const cv = `Đỗ Minh Quân
KỸ NĂNG
Excel, Word
KINH NGHIỆM
2020 - nay: Nhân viên văn phòng, Công ty An Khang`;

    // Act
    const res = scoreCv({ cvText: cv, requirements: requirementsWithExtras, today: TODAY });

    // Assert
    expect(res.percent).toBe(100);
    expect(res.items.filter((i) => i.counted).map((i) => i.requirement)).toEqual(['Thành thạo Excel']);
  });

  it('should not count a bonus the CV shows as a requirement met', () => {
    // Arrange
    const cv = `Đỗ Minh Quân
KỸ NĂNG
Figma
KINH NGHIỆM
2020 - nay: Thiết kế, Công ty An Khang`;

    // Act
    const res = scoreCv({ cvText: cv, requirements: ['Thành thạo Excel', 'Biết Figma là lợi thế'], today: TODAY });

    // Assert
    expect(res.items[1]?.verdict).toBe('met');
    expect(res.percent).toBe(0);
  });

  it('should not count a line that always passes', () => {
    // Arrange
    const cv = `Đỗ Minh Quân
KINH NGHIỆM
2020 - nay: Thiết kế, Công ty An Khang`;

    // Act
    const res = scoreCv({ cvText: cv, requirements: ['Học vấn: Không yêu cầu', 'Biết Excel'], today: TODAY });

    // Assert
    expect(res.items[0]?.verdict).toBe('met');
    expect(res.percent).toBe(0);
  });

  it('should count a degree asked on the form and again in the requirements once', () => {
    // Arrange
    const cv = `Phạm Hà My
HỌC VẤN
Đại học Mở, chuyên ngành Du lịch, 2015 - 2019
KINH NGHIỆM
2019 - nay: Hướng dẫn viên, Công ty Lữ hành Sen Vàng`;

    // Act
    const res = scoreCv({
      cvText: cv,
      requirements: ['Học vấn: Đại học trở lên', 'Tốt nghiệp Đại học ngành Kế toán', 'Biết Excel'],
      today: TODAY,
    });

    // Assert
    expect(res.items.map((i) => i.verdict)).toEqual(['met', 'unmet', 'unmet']);
    expect(res.items[0]?.counted).toBe(false);
    expect(res.percent).toBe(0);
  });

  it('should keep the form line counted when no other line asks for a degree', () => {
    // Arrange
    const cv = `Phạm Hà My
HỌC VẤN
Đại học Mở, 2015 - 2019
KINH NGHIỆM
2019 - nay: Hướng dẫn viên, Công ty Lữ hành Sen Vàng`;

    // Act
    const res = scoreCv({ cvText: cv, requirements: ['Học vấn: Đại học trở lên', 'Biết Excel'], today: TODAY });

    // Assert
    expect(res.percent).toBe(50);
  });
});
