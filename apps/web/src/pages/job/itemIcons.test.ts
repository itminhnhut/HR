import { describe, expect, it } from 'vitest';
import { benefitLook, requirementLook } from './itemIcons';

describe('job list item icons', () => {
  it('should give requirement lines an icon by their topic', () => {
    // Arrange / Act / Assert
    expect(requirementLook('Tối thiểu 1 năm kinh nghiệm bán hàng B2B').icon).toBe('briefcase');
    expect(requirementLook('Tốt nghiệp Cao đẳng trở lên').icon).toBe('cap');
    expect(requirementLook('Đọc hiểu tiếng Anh cơ bản').icon).toBe('globe');
    expect(requirementLook('Giao tiếp tốt, tự tin').icon).toBe('chat');
    expect(requirementLook('Sử dụng thành thạo Excel').icon).toBe('laptop');
  });

  it('should fall back to a check mark when no keyword matches', () => {
    expect(requirementLook('Ngoại hình ưa nhìn')).toEqual({ icon: 'check', color: 'emerald' });
  });

  it('should give benefit lines an icon by their topic', () => {
    expect(benefitLook('Lương tháng 13, thưởng Tết theo kết quả').icon).toBe('award');
    expect(benefitLook('BHXH, BHYT, BHTN đóng trên lương thực nhận').icon).toBe('shield');
    expect(benefitLook('Khám sức khoẻ định kỳ hằng năm').icon).toBe('heart');
    expect(benefitLook('Du lịch công ty hằng năm').icon).toBe('plane');
    expect(benefitLook('12 ngày phép năm').icon).toBe('calendar');
    expect(benefitLook('Nghỉ lễ, Tết theo luật').icon).toBe('calendar');
    expect(benefitLook('Cấp laptop làm việc').icon).toBe('laptop');
  });

  it('should not match a keyword inside another word', () => {
    // "le" (lễ) and "hoc" (học) are keywords, but only as whole words.
    expect(benefitLook('Môi trường chuyên nghiệp').icon).toBe('check');
  });
});
