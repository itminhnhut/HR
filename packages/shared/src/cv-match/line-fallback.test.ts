import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

const TODAY = '2026-11-03';

function judge(cvText: string, requirement: string): MatchItem {
  const item = scoreCv({ cvText, requirements: [requirement], today: TODAY }).items[0];
  if (!item) throw new Error('no item');
  return item;
}

const WORKED = (...duties: string[]) =>
  ['Trần Thị Mai', 'Kinh nghiệm làm việc', '03/2019 - nay: Nhân viên, Công ty TNHH Hoa Sen', ...duties].join('\n');

describe('hint for a line the parser did not understand', () => {
  it('should mark the line met as an uncounted hint and quote the work line when the work history covers it', () => {
    // Arrange
    const cv = WORKED('- Theo dõi nhập xuất tồn nguyên vật liệu, kiểm kê định kỳ cuối tháng');

    // Act
    const item = judge(cv, 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item).toMatchObject({ verdict: 'unknown', isHint: true, counted: false });
    expect(item.evidence).toContain('kiểm kê định kỳ');
    expect(item.reason).toContain('HR kiểm tra lại');
  });

  it('should read words spread over several work lines', () => {
    // Arrange
    const cv = WORKED('- Thiết kế menu theo mùa cho nhà hàng', '- Tính định lượng món ăn, cân đối chi phí nguyên liệu');

    // Act
    const item = judge(cv, 'Thiết kế menu, định lượng món ăn');

    // Assert
    expect(item).toMatchObject({ verdict: 'unknown', isHint: true });
  });

  it('should accept a study line as evidence', () => {
    // Arrange
    const cv = [
      'Trần Thị Mai',
      'Học vấn',
      '2016 - 2020: Đại học Nông Lâm, chuyên ngành Bảo vệ thực vật, nghiên cứu sâu bệnh cây lúa',
    ].join('\n');

    // Act
    const item = judge(cv, 'Nhận biết sâu bệnh trên cây lúa');

    // Assert
    expect(item).toMatchObject({ verdict: 'unknown', isHint: true });
    expect(item.evidence).toContain('sâu bệnh cây lúa');
  });

  it('should leave the line unknown, never unmet, when the CV has nothing like it', () => {
    // Arrange
    const cv = WORKED('- Giao hàng theo tuyến nội thành');

    // Act
    const item = judge(cv, 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item).toMatchObject({ verdict: 'unknown', counted: false, evidence: null });
    expect(item.isHint).toBeUndefined();
  });

  it('should leave the line unknown when the work history shows only a small part of it', () => {
    // Arrange
    const cv = WORKED('- Kiểm kê hàng hóa tại cửa hàng');

    // Act
    const item = judge(cv, 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item.verdict).toBe('unknown');
  });

  it.each([
    [
      'on its own line',
      '- nhập xuất tồn, nguyên vật liệu, kiểm kê định kỳ, FIFO, 5S, xe nâng, Excel, kho bãi, vận đơn',
    ],
    [
      'glued to the job line by extraction',
      'nhập xuất tồn, nguyên vật liệu, kiểm kê định kỳ, FIFO, 5S, xe nâng, Excel, kho bãi',
    ],
  ])('should give nothing for a comma-dense keyword list %s', (_where, dump) => {
    // Act
    const item = judge(WORKED(dump), 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item.verdict).toBe('unknown');
  });

  it('should still read a short list of duties in a job line', () => {
    // Arrange
    const cv = WORKED('- Lễ tân khách sạn. Check-in, check-out, đặt phòng, thu ngân.');

    // Act
    const item = judge(cv, 'Làm được check-in, check-out, đặt phòng');

    // Assert
    expect(item).toMatchObject({ verdict: 'unknown', isHint: true });
  });

  it('should give nothing for words pasted outside the work and study lines', () => {
    // Arrange
    const cv = [
      'Trần Thị Mai',
      'Theo dõi nhập xuất tồn nguyên vật liệu. Kiểm kê định kỳ.',
      'Kinh nghiệm làm việc',
      '2024 - nay: Phụ bán tạp hóa cho gia đình',
    ].join('\n');

    // Act
    const item = judge(cv, 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item.verdict).toBe('unknown');
  });

  it('should not read a work line that says the candidate does not know it', () => {
    // Arrange
    const cv = WORKED('- Chưa rõ quy trình nhập xuất tồn nguyên vật liệu, chưa làm kiểm kê định kỳ');

    // Act
    const item = judge(cv, 'Theo dõi nhập - xuất - tồn nguyên vật liệu, kiểm kê định kỳ');

    // Assert
    expect(item.verdict).toBe('unknown');
  });

  it('should keep the percent the same whether or not the hint is there', () => {
    // Arrange
    const cv = WORKED('- Thiết kế menu theo mùa', '- Tính định lượng món ăn', '- Báo cáo bằng Excel');
    const counted = ['Biết Excel', 'Biết Photoshop'];

    // Act
    const without = scoreCv({ cvText: cv, requirements: counted, today: TODAY });
    const withHint = scoreCv({
      cvText: cv,
      requirements: [...counted, 'Thiết kế menu, định lượng món ăn'],
      today: TODAY,
    });

    // Assert
    expect(withHint.items[2]).toMatchObject({ verdict: 'unknown', isHint: true });
    expect(withHint.percent).toBe(without.percent);
  });
});

describe('lines the hint must not answer', () => {
  it.each([
    ['a willingness', 'Sẵn sàng trực đêm, làm việc theo ca', 'Trực đêm và làm việc theo ca tại khoa nội'],
    ['an agreement', 'Chấp nhận đi tỉnh dài ngày, chạy đêm', 'Đi tỉnh dài ngày, chạy đêm tuyến miền Trung'],
    ['a capacity to work a schedule', 'Có thể làm việc theo ca', 'Làm việc theo ca sáng chiều tối'],
    [
      'a clean record',
      'Không có tiền án, không vi phạm giao thông nghiêm trọng',
      'Xử lý vi phạm giao thông cho đội xe',
    ],
    ['a trait', 'Tận tâm, nhẹ nhàng với người bệnh', 'Tận tâm, nhẹ nhàng với người bệnh tại khoa nhi'],
    ['a licence', 'Có bằng lái xe C', 'Lái xe tải giao hàng, có bằng lái'],
    ['a certificate', 'Có giấy xác nhận kiến thức an toàn thực phẩm', 'Kiểm tra an toàn thực phẩm, kiến thức bếp'],
    ['a trade paper', 'Có bằng nghề hoặc chứng chỉ nghề nấu ăn', 'Phụ trách nấu ăn cho bếp ăn công nghiệp, nghề bếp'],
    ['a minimum of years', 'Tối thiểu 2 năm ở vị trí bếp phó hoặc bếp trưởng', 'Bếp phó, nhà hàng Hoa Sen'],
    ['a minimum of people', 'Quản lý được đội bếp từ 10 người', 'Quản lý đội bếp 3 người'],
  ])('should give no hint for %s, whatever the work lines say', (_what, requirement, duty) => {
    // Act
    const item = judge(WORKED(`- ${duty}`), requirement);

    // Assert
    expect(item.isHint).toBeUndefined();
  });

  it('should not turn a bonus line into a hint', () => {
    // Arrange
    const cv = WORKED('- Theo dõi nhập xuất tồn nguyên vật liệu');

    // Act
    const item = judge(cv, 'Ưu tiên theo dõi nhập xuất tồn nguyên vật liệu');

    // Assert
    expect(item.isHint).toBeUndefined();
  });
});

describe('knowledge lines are not personal conditions', () => {
  it.each([
    'Nắm rõ tiêu chuẩn chất lượng ISO trong xưởng may',
    'Nắm được quy trình chăm sóc khách hàng',
    'Nắm chắc nghiệp vụ thuế',
  ])('should not call "%s" a personal condition', (requirement) => {
    // Act
    const item = judge(WORKED('- Giao hàng theo tuyến'), requirement);

    // Assert
    expect(item.reason ?? '').not.toContain('Điều kiện cá nhân');
  });

  it('should not read "thực phẩm tươi sống" as an age', () => {
    // Act
    const item = judge(WORKED('- Giao hàng theo tuyến'), 'Am hiểu bảo quản thực phẩm tươi sống');

    // Assert
    expect(item.reason ?? '').not.toContain('Điều kiện cá nhân');
  });

  it.each([
    'Nam',
    'Nữ',
    '- Nữ',
    'Nam, 25 - 35 tuổi',
    'Nam giới cao từ 1m70',
    'Nam/Nữ',
    'Nam nữ đều được',
    'Nữ, ngoại hình ưa nhìn',
    'Nam hoặc nữ',
    'Tuổi: 25 - 35',
    'Dưới 35 tuổi',
    'Độ tuổi từ 22 đến 30',
  ])('should still call "%s" a personal condition', (requirement) => {
    // Act
    const item = judge(WORKED('- Giao hàng theo tuyến'), requirement);

    // Assert
    expect(item.reason).toContain('Điều kiện cá nhân');
  });
});
