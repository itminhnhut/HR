import { describe, expect, it } from 'vitest';
import { benefitGroupOf, groupBenefits } from './benefit-groups.js';

const SAMPLE = [
  'Lương cứng 12 – 18 triệu, xét tăng 2 lần/năm',
  'Hoa hồng theo doanh số, không giới hạn',
  'Lương tháng 13, thưởng Tết theo kết quả',
  'BHXH, BHYT, BHTN đóng trên lương thực nhận',
  'Bảo hiểm sức khỏe cho nhân viên chính thức',
  'Khám sức khỏe định kỳ mỗi năm',
  'Nghỉ phép năm theo luật, tăng theo thâm niên',
  'Nghỉ chủ nhật',
  'Nghỉ lễ, Tết theo luật',
  'Đào tạo sản phẩm và kỹ năng bán hàng',
  'Lộ trình lên Trưởng nhóm sau 1–2 năm',
  'Hỗ trợ học phí khóa học liên quan',
  'Du lịch công ty hằng năm',
  'Team building mỗi quý',
  'Cấp laptop và điện thoại công việc',
  'Phụ cấp đi lại, điện thoại',
];

describe('groupBenefits', () => {
  it('should sort a job’s benefits into themed groups, in a fixed order', () => {
    // Act
    const groups = groupBenefits(SAMPLE);

    // Assert
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['income', 3],
      ['insurance', 3],
      ['leave', 3],
      ['growth', 3],
      ['activities', 2],
      ['equipment', 2],
    ]);
    expect(groups[0]?.title).toBe('Thu nhập');
  });

  it('should keep pay items under income even when they mention Tết, and BHXH under insurance', () => {
    expect(benefitGroupOf('Lương tháng 13, thưởng Tết theo kết quả')).toBe('income');
    expect(benefitGroupOf('BHXH đóng trên lương thực nhận')).toBe('insurance');
    expect(benefitGroupOf('Nghỉ lễ, Tết theo luật')).toBe('leave');
  });

  it('should put anything unrecognised under "Khác", listed last', () => {
    const groups = groupBenefits([...SAMPLE, 'Văn phòng có máy pha cà phê']);

    expect(groups.at(-1)).toEqual({ key: 'other', title: 'Khác', items: ['Văn phòng có máy pha cà phê'] });
  });

  it('should not group a short list (it would only add headings)', () => {
    expect(groupBenefits(['Lương tháng 13', 'Du lịch hằng năm', 'Nghỉ chủ nhật'])).toEqual([]);
  });
});
