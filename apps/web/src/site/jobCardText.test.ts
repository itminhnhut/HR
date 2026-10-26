import { describe, expect, it } from 'vitest';
import { cardPerkChips, shortPlace } from './jobCardText';

describe('card perk chips', () => {
  it('should leave out benefits that repeat the salary', () => {
    // Arrange
    const perks = 'Lương cứng 12 – 18 triệu, xét tăng 2 lần/năm, Hoa hồng theo doanh số, không giới hạn';

    // Act
    const chips = cardPerkChips(perks);

    // Assert
    expect(chips).toEqual(['Hoa hồng theo doanh số']);
  });

  it('should keep a 13th-month salary, which is a perk and not the pay range', () => {
    expect(cardPerkChips('Lương 20 – 30 triệu, xét tăng mỗi năm, Lương tháng 13')).toEqual(['Lương tháng 13']);
  });

  it('should join insurance names into one chip', () => {
    expect(cardPerkChips('Hỗ trợ 4 triệu/tháng, BHXH, BHYT, BHTN đóng trên lương thực nhận')).toEqual([
      'BHXH · BHYT · BHTN',
    ]);
  });

  it('should show each benefit by its short name, never a cut-off sentence', () => {
    // Arrange
    const perks = 'Lương tháng 13, thưởng Tết theo kết quả, BHXH, BHYT, BHTN đóng trên lương thực nhận';

    // Act
    const chips = cardPerkChips(perks);

    // Assert
    expect(chips).toEqual(['Lương tháng 13', 'BHXH · BHYT · BHTN']);
    expect(chips.join('')).not.toContain('…');
  });

  it('should shorten a long benefit at its details and drop it when still too long', () => {
    expect(cardPerkChips('Thưởng nóng theo từng dự án hoàn thành xuất sắc')).toEqual(['Thưởng nóng']);
    expect(cardPerkChips('Được tham gia các chương trình đào tạo nội bộ hằng quý')).toEqual([]);
  });

  it('should be empty when every benefit is about the salary', () => {
    expect(cardPerkChips('Lương 10 – 12 triệu')).toEqual([]);
  });
});

describe('short place name', () => {
  it('should shorten Ho Chi Minh City so the card fact fits on one line', () => {
    expect(shortPlace('Gò Vấp, TP. Hồ Chí Minh')).toBe('Gò Vấp, TP.HCM');
    expect(shortPlace('Gò Vấp, Thành phố Hồ Chí Minh')).toBe('Gò Vấp, TP.HCM');
    expect(shortPlace('Gò Vấp, TP. HCM')).toBe('Gò Vấp, TP.HCM');
  });

  it('should leave other places as they are', () => {
    expect(shortPlace('Hải Châu, Đà Nẵng')).toBe('Hải Châu, Đà Nẵng');
  });
});
