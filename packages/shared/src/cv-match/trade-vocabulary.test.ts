import { describe, expect, it } from 'vitest';
import { parseRequirement } from './requirement.js';
import { scoreCv } from './score.js';
import type { MatchVerdict } from './types.js';

function verdict(cvText: string, requirement: string): MatchVerdict | undefined {
  return scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0]?.verdict;
}

const FORWARDER = `TÔ HẢI ĐĂNG
KINH NGHIỆM LÀM VIỆC
02/2021 - nay Nhân viên xuất nhập khẩu, Công ty Vận tải Hòa Phong
Mở tờ khai trên ECUS, áp mã HS, làm C/O form D, theo dõi vận đơn và tín dụng thư
HỌC VẤN
Đại học Hàng hải, ngành Kinh tế vận tải, 2016 - 2020`;

const CHEF = `LÝ VĂN KHA
KINH NGHIỆM LÀM VIỆC
2019 - nay Đầu bếp, Nhà hàng Sóng Biển. Nấu món Việt, kiểm soát nguyên liệu.`;

const SITE_ENGINEER = `VŨ TIẾN DŨNG
KINH NGHIỆM LÀM VIỆC
05/2019 - nay Kỹ sư M&E, Công ty Xây lắp Trường Giang
Kiểm tra shop drawing, bóc khối lượng, giám sát lắp đặt điều hòa trung tâm và hệ thống chữa cháy
HỌC VẤN
Đại học Xây dựng, ngành Kỹ thuật điện, 2014 - 2019`;

describe('professional vocabulary', () => {
  it.each([
    ['Biết tra mã HS Code', FORWARDER, 'met'],
    ['Thành thạo khai báo VNACCS', FORWARDER, 'met'],
    ['Biết làm chứng từ C/O', FORWARDER, 'met'],
    ['Hiểu về thanh toán L/C', FORWARDER, 'met'],
    ['Đọc được bản vẽ MEP', SITE_ENGINEER, 'met'],
    ['Biết bóc tách BOQ', SITE_ENGINEER, 'met'],
    ['Có kiến thức về hệ thống PCCC', SITE_ENGINEER, 'met'],
    ['Hiểu hệ thống HVAC', SITE_ENGINEER, 'met'],
  ] as const)('should find "%s" in a CV using a synonym', (requirement, cv, want) => {
    // Act
    const got = verdict(cv, requirement);

    // Assert
    expect(got).toBe(want);
  });

  it.each(['Biết tra mã HS Code', 'Đọc được bản vẽ MEP', 'Hiểu về Incoterms', 'Biết làm báo cáo tài chính'])(
    'should say not met for "%s" when a CV with a real work history does not show it',
    (requirement) => {
      // Act
      const got = verdict(CHEF, requirement);

      // Assert
      expect(got).toBe('unmet');
    },
  );

  it('should not read a tax form as customs work', () => {
    // Arrange
    const cv = `Lê Mai
KINH NGHIỆM LÀM VIỆC
2021 - nay Kế toán, Công ty Sao Việt. Lập tờ khai thuế GTGT hằng tháng.`;

    // Act
    const got = verdict(cv, 'Biết khai báo hải quan');

    // Assert
    expect(got).toBe('unmet');
  });

  it('should judge each part of a line separately', () => {
    // Arrange
    const cv = `LÊ HUY
KINH NGHIỆM LÀM VIỆC
2021 - nay Kỹ sư, Công ty Cơ điện Tân Bình. Bóc khối lượng, làm BOQ cho công trình.
KỸ NĂNG
AutoCAD`;

    // Act
    const item = scoreCv({
      cvText: cv,
      requirements: ['Biết làm BOQ, hiểu hệ thống PCCC'],
      today: '2026-11-03',
    }).items[0];

    // Assert
    expect(item?.verdict).toBe('unmet');
    expect(item?.reason).toContain('PCCC');
    expect(item?.reason).toContain('Có BOQ');
  });

  it('should leave a line about a trade open on a CV too thin to say anything', () => {
    // Act
    const got = verdict('Nguyễn Thị Xuân, số điện thoại 0912345678, muốn đi làm', 'Biết đọc bản vẽ MEP');

    // Assert
    expect(got).toBe('unknown');
  });

  it('should not read a line about organising work as asking for SAP', () => {
    // Act
    const parsed = parseRequirement('Biết sắp xếp hồ sơ khoa học');

    // Assert
    expect(parsed.atoms).toEqual([]);
  });
});

describe('claims with nothing behind them', () => {
  it('should not accept a trade term listed under skills when the jobs are in another occupation', () => {
    // Arrange
    const cv = `KỸ NĂNG
Hải quan, HS Code, Incoterms, L/C
KINH NGHIỆM LÀM VIỆC
2020 - nay Thợ cắt tóc, Salon Mây Trắng. Cắt, uốn, nhuộm tóc.`;

    // Act
    const item = scoreCv({ cvText: cv, requirements: ['Hiểu về Incoterms'], today: '2026-11-03' }).items[0];

    // Assert
    expect(item?.verdict).toBe('unmet');
    expect(item?.reason).toContain('không liên quan');
  });

  it('should accept the same list from someone working in that occupation', () => {
    // Arrange
    const cv = `KỸ NĂNG
Hải quan, HS Code, Incoterms, L/C
KINH NGHIỆM LÀM VIỆC
2020 - nay Nhân viên chứng từ, Công ty Giao nhận Sông Hậu. Theo dõi lô hàng.`;

    // Act
    const got = verdict(cv, 'Hiểu về Incoterms');

    // Assert
    expect(got).toBe('met');
  });

  it('should accept a trade term in the skills of a graduate who studied that trade', () => {
    // Arrange
    const cv = `HỌC VẤN
Đại học Bách Khoa, chuyên ngành Kỹ thuật Nhiệt lạnh, 2019 - 2024
KỸ NĂNG
HVAC, AutoCAD`;

    // Act
    const got = verdict(cv, 'Có kiến thức HVAC');

    // Assert
    expect(got).toBe('met');
  });

  it('should keep an office tool in a skills list with no support in the jobs', () => {
    // Arrange
    const cv = `KỸ NĂNG
Excel, PowerPoint
KINH NGHIỆM LÀM VIỆC
2020 - nay Thợ cắt tóc, Salon Mây Trắng`;

    // Act
    const got = verdict(cv, 'Biết Excel');

    // Assert
    expect(got).toBe('met');
  });

  it('should keep a programming tool a developer lists but does not repeat in the job description', () => {
    // Arrange
    const cv = `SKILLS
Docker, Python, Redis
EXPERIENCE
2021 - Present Software Engineer, Green Fintech`;

    // Act
    const got = verdict(cv, 'Experience with Docker');

    // Assert
    expect(got).toBe('met');
  });
});
