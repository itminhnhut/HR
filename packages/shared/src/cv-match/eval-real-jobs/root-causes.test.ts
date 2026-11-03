/**
 * Smallest reproduction of each root cause found by the evaluation: a real ad line and a fictional CV, kept as ordinary
 * tests now that the causes are fixed; a few passing controls show which detail triggered the failure.
 */
import { describe, expect, it } from 'vitest';
import { parseRequirement } from '../requirement.js';
import { scoreCv } from '../score.js';
import type { MatchVerdict } from '../types.js';
import { EVAL_TODAY } from './metrics.js';

const HVAC_DEGREE =
  'Tốt nghiệp Cao đẳng trở lên chuyên ngành Nhiệt lạnh, Cơ khí, Cấp thoát nước, Điện, Kỹ thuật công trình hoặc ngành liên quan.';
const SALES_DEGREE =
  'Tốt nghiệp Cao đẳng/Đại học chuyên ngành Cơ khí, Nhiệt lạnh, Cấp thoát nước, Kỹ thuật xây dựng – công trình, Kinh doanh hoặc tương đương.';
const ROLE_EXPERIENCE = 'Từ 1 năm kinh nghiệm ở vị trí Trợ Lý Giám Đốc, Thư Ký Điều Hành hoặc Điều Phối Hành Chính.';
const CUSTOMS_EXPERIENCE = 'Tối thiểu 1-2 năm kinh nghiệm làm thủ tục nhập khẩu, khai báo hải quan.';
const SALES_EXPERIENCE =
  'Tối thiểu 1 năm kinh nghiệm bán hàng dự án hoặc bán hàng kỹ thuật trong ngành cơ điện (MEP), van – đường ống, HVAC hoặc thiết bị công nghiệp.';
const SYSTEMS = 'Có hiểu biết về hệ thống HVAC, cấp thoát nước, PCCC.';
const CUSTOMS_SKILLS = 'Thành thạo khai báo hải quan điện tử (VNACCS/VCIS), tra cứu mã HS Code, tính thuế nhập khẩu.';
const DOMAIN_BONUS =
  'Có kinh nghiệm trong lĩnh vực kinh doanh thương mại B2B, vật liệu xây dựng, thiết bị cơ điện hoặc phân phối sản phẩm kỹ thuật là ưu tiên.';
const OFFICE = 'Thành thạo Word, Excel; biết phần mềm ERP/logistics là lợi thế.';
const SPOKEN_ENGLISH =
  'Khả năng viết và giao tiếp tiếng Việt chính xác, chuyên nghiệp; đọc hiểu và giao tiếp tiếng Anh tốt (cả viết và nói).';

function verdict(requirement: string, cvText: string): MatchVerdict {
  const result = scoreCv({ cvText, requirements: [requirement], today: EVAL_TODAY });
  const item = result.items[0];
  if (!item) throw new Error('scoreCv returned no item');
  return item.verdict;
}

describe('major lists that contain "Cơ khí"', () => {
  it('should accept a mechanical engineering graduate on the HVAC degree line', () => {
    // Arrange
    const cv = `HỌC VẤN
Đại học Kỹ thuật Miền Nam, 2016 - 2020. Chuyên ngành: Cơ khí
KINH NGHIỆM LÀM VIỆC
08/2020 - nay Kỹ sư, Công ty Cơ điện Thành Nam`;

    // Act
    const got = verdict(HVAC_DEGREE, cv);

    // Assert
    expect(got).toBe('met');
  });

  it('should not accept a singing graduate on the Sales Engineer degree line', () => {
    // Arrange
    const cv = `HỌC VẤN
Cao đẳng Văn hóa Nghệ thuật Sài Thành, ngành Thanh nhạc, 2017 - 2020
KINH NGHIỆM LÀM VIỆC
03/2021 - nay Chuyên viên trang điểm, Studio Áo Cưới`;

    // Act
    const got = verdict(SALES_DEGREE, cv);

    // Assert
    expect(got).not.toBe('met');
  });
});

describe('experience lines that name several roles or a trade', () => {
  it('should count an executive secretary on the assistant role line', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
Thư ký Điều hành, Tập đoàn Vật liệu Xây dựng Phú An
05/2021 - nay
Ghi biên bản, theo dõi hạng mục sau họp của Tổng Giám đốc`;

    // Act
    const got = verdict(ROLE_EXPERIENCE, cv);

    // Assert
    expect(got).toBe('met');
  });

  it('should count a customs declarant on the customs experience line', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
Nhân viên khai báo hải quan, Công ty Logistics Cảng Xanh
08/2024 - nay
Khai tờ khai nhập khẩu trên hệ thống VNACCS/VCIS`;

    // Act
    const got = verdict(CUSTOMS_EXPERIENCE, cv);

    // Assert
    expect(got).toBe('met');
  });

  it('should not count cosmetics shop selling as sales in the M&E trade', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
2021 - nay Nhân viên bán hàng, Showroom Mỹ phẩm Thanh Xuân
Tư vấn khách, sắp xếp kệ, chốt đơn hằng ngày cho khách đến cửa hàng`;

    // Act
    const got = verdict(SALES_EXPERIENCE, cv);

    // Assert
    expect(got).not.toBe('met');
  });

  it('should not count a job that only mentions a colleague in the wanted role', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
Nhân viên kinh doanh, Công ty Vật liệu Xây dựng Tân Á, 09/2021 - nay
Bán hàng cho đại lý; phối hợp với Trợ lý Giám đốc gửi báo cáo tháng`;

    // Act
    const got = verdict(ROLE_EXPERIENCE, cv);

    // Assert
    expect(got).not.toBe('met');
  });
});

describe('the word "trường" on the line holding the only date range', () => {
  const salesManager = (dates: string) => `KINH NGHIỆM LÀM VIỆC
Trưởng phòng kinh doanh dự án, Công ty Thiết bị HVAC Liên Á, ${dates}
Bán hàng dự án HVAC cho bệnh viện, nhà máy`;

  it('should read the work history of a head of department who still holds the job', () => {
    // Act
    const got = verdict('Kinh nghiệm: Từ 1 năm', salesManager('04/2018 - nay'));

    // Assert
    expect(got).toBe('met');
  });

  it('should read the work history of a head of department who has left the job', () => {
    // Act
    const got = verdict('Kinh nghiệm: Từ 1 năm', salesManager('04/2018 - 12/2024'));

    // Assert
    expect(got).toBe('met');
  });

  it('should read the work history of a current employee of a company named "Trường Sơn"', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
2019 - nay Lập trình viên Java, Công ty Phần mềm Trường Sơn
Phát triển hệ thống cho khách hàng trong và ngoài nước`;

    // Act
    const got = verdict(SALES_EXPERIENCE, cv);

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('keyword stuffing', () => {
  const shipper = `KỸ NĂNG
HVAC, cấp thoát nước, PCCC, VNACCS, Incoterms
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Nhân viên giao hàng, Công ty Chuyển phát Tốc Hành. Giao đơn nội thành bằng xe máy.`;

  it('should not treat a term that only sits in a skills list as knowledge of the trade', () => {
    // Act
    const got = verdict(SYSTEMS, shipper);

    // Assert
    expect(got).not.toBe('met');
  });

  it('should not let a summary sentence copied from the ad outweigh the work history', () => {
    // Arrange
    const cv = `GIỚI THIỆU
Có 2 năm kinh nghiệm làm thủ tục nhập khẩu, khai báo hải quan.
KINH NGHIỆM LÀM VIỆC
2022 - nay Shipper, Công ty Chuyển phát Hỏa Tốc. Giao hàng nội thành.`;

    // Act
    const got = verdict(CUSTOMS_EXPERIENCE, cv);

    // Assert
    expect(got).not.toBe('met');
  });

  it('should judge a line about trade skills against a CV that clearly has none', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
05/2022 - nay Nhân viên phục vụ, Nhà hàng Sông Quê. Bưng bê, dọn bàn cho khách.`;

    // Act
    const got = verdict(CUSTOMS_SKILLS, cv);

    // Assert
    expect(got).toBe('unmet');
  });
});

describe('bonus wording', () => {
  it('should read a line ending in "là ưu tiên" as a bonus', () => {
    // Act
    const parsed = parseRequirement(DOMAIN_BONUS);

    // Assert
    expect(parsed.preference).toBe(true);
  });

  it('should keep Word and Excel mandatory when only the clause after the semicolon is a bonus', () => {
    // Arrange
    const cv = `KỸ NĂNG
Photoshop, Canva
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Nhân viên thiết kế, Công ty Quảng cáo Sao Mai. Thiết kế banner.`;

    // Act
    const got = verdict(OFFICE, cv);

    // Assert
    expect(got).toBe('unmet');
  });

  it('should give "met" to a CV with Word and Excel even when it has no ERP', () => {
    // Arrange
    const cv = `KỸ NĂNG
Word, Excel
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Nhân viên chứng từ, Công ty Giao nhận Biển Đông. Kiểm tra bộ chứng từ.`;

    // Act
    const got = verdict(OFFICE, cv);

    // Assert
    expect(got).toBe('met');
  });
});

describe('words that fold into a tool name', () => {
  it('should not read "sắp xếp" as knowing SAP', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
06/2022 - nay Nhân viên giao nhận, Công ty Logistics Phương Nam. Sắp xếp đơn hàng trên xe.`;

    // Act
    const got = verdict('Biết sử dụng ERP', cv);

    // Assert
    expect(got).not.toBe('met');
  });
});

describe('English wanted for speaking', () => {
  it('should read "đọc hiểu và giao tiếp tiếng Anh tốt" as a speaking requirement', () => {
    // Act
    const atom = parseRequirement(SPOKEN_ENGLISH).atoms.find((a) => a.kind === 'language');

    // Assert
    expect(atom).toMatchObject({ minLevel: 3 });
  });

  it('should not take a CV merely written in English as proof of speaking well', () => {
    // Arrange
    const cv = `WORK EXPERIENCE
Jan 2022 - Present: Barista at Cloud Nine Coffee. Made drinks and served customers on weekends and weekdays.`;

    // Act
    const got = verdict(SPOKEN_ENGLISH, cv);

    // Assert
    expect(got).toBe('unknown');
  });
});

describe('text as PDF extraction can deliver it', () => {
  const studiesAsWork = (heading: string) => `KINH NGHIỆM LÀM VIỆC
Nhân viên kinh doanh, 01/2026 - 06/2026
${heading}
Đại học Kinh tế Nam Bộ
Chuyên ngành: Kinh tế
đối ngoại, 2018 – 2022`;

  it('should not read study dates as work when the heading letters are spaced out', () => {
    // Act
    const got = verdict('Kinh nghiệm: 1 năm', studiesAsWork('H Ọ C   V Ấ N'));

    // Assert
    expect(got).toBe('unmet');
  });

  it('should not read study dates as work under a normal heading', () => {
    // Act
    const got = verdict('Kinh nghiệm: 1 năm', studiesAsWork('HỌC VẤN'));

    // Assert
    expect(got).toBe('unmet');
  });

  it('should read a current job whose date range is broken across two lines', () => {
    // Arrange
    const cv = `KINH NGHIỆM LÀM VIỆC
Trợ lý Giám đốc, Công ty CP Du lịch Hòa Bình Xanh
06/2023 –
nay
Sắp xếp lịch, chuẩn bị cuộc họp của Giám đốc`;

    // Act
    const got = verdict('Kinh nghiệm: 1 năm', cv);

    // Assert
    expect(got).toBe('met');
  });

  it('should not call a graduate "still studying" when a PDF yields one long line', () => {
    // Arrange
    const cv =
      'TRẦN ANH VŨ KINH NGHIỆM LÀM VIỆC Kỹ sư bán hàng, Công ty Phú Sơn, 07/2023 – nay Bán thiết bị công nghiệp. HỌC VẤN Đại học Kỹ thuật Miền Nam, chuyên ngành Cơ khí, 2018 – 2022';

    // Act
    const got = verdict('Học vấn: Cao đẳng trở lên', cv);

    // Assert
    expect(got).toBe('met');
  });
});
