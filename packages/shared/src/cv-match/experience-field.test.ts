import { describe, expect, it } from 'vitest';
import type { ExperienceAtom } from './atoms.js';
import { parseRequirement } from './requirement.js';
import { scoreCv } from './score.js';
import type { MatchItem } from './types.js';

function judge(cvText: string, requirement: string): MatchItem {
  const item = scoreCv({ cvText, requirements: [requirement], today: '2026-11-03' }).items[0];
  if (!item) throw new Error('no item');
  return item;
}

function fieldOf(requirement: string): ExperienceAtom['field'] {
  const atom = parseRequirement(requirement).atoms.find((a) => a.kind === 'experience');
  return atom?.kind === 'experience' ? atom.field : null;
}

describe('experience lines naming several fields', () => {
  it('should accept any of the roles a line lists, not only the first', () => {
    // Arrange
    const cv = `KINH NGHIỆM
Thư ký Ban Giám đốc, Tập đoàn Sơn Hải
04/2022 - nay`;

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm làm Trợ lý Giám đốc hoặc Thư ký Giám đốc');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should accept an English job title for a Vietnamese field', () => {
    // Arrange
    const cv = `EXPERIENCE
Mar 2020 - Present: Procurement Officer, Delta Foods`;

    // Act
    const got = judge(cv, 'Từ 3 năm kinh nghiệm thu mua');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it('should need the industry as well as the role when a line names both', () => {
    // Arrange
    const shop = `KINH NGHIỆM
2019 - nay Nhân viên bán hàng, Cửa hàng Giày Thành Công`;
    const trade = `KINH NGHIỆM
2019 - nay Nhân viên kinh doanh, Công ty Thiết bị Công nghiệp Việt Đức`;
    const line = 'Từ 2 năm kinh nghiệm bán hàng trong ngành thiết bị công nghiệp';

    // Act
    const inShop = judge(shop, line);
    const inTrade = judge(trade, line);

    // Assert
    expect(inShop.verdict).toBe('unmet');
    expect(inTrade.verdict).toBe('met');
  });

  it('should read the job title and company before the duties', () => {
    // Arrange
    const cv = `KINH NGHIỆM
Kế toán viên
Công ty TNHH Sao Biển
01/2019 - 12/2023`;

    // Act
    const got = judge(cv, 'Có 3 năm kinh nghiệm kế toán');

    // Assert
    expect(got.verdict).toBe('met');
    expect(got.evidence).toContain('Kế toán viên');
  });

  it('should leave a field the dictionary does not know open rather than failing it', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2019 - nay Nhân viên hiện trường, Công ty Đo đạc Thành Long`;

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm trắc địa thủy văn');

    // Assert
    expect(got.verdict).toBe('unknown');
  });

  it('should fail a known field the work history does not show', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2019 - nay Thợ cắt tóc, Salon Mây Trắng`;

    // Act
    const got = judge(cv, 'Từ 1 năm kinh nghiệm kế toán');

    // Assert
    expect(got.verdict).toBe('unmet');
  });
});

describe('words the old parser cut', () => {
  it.each([
    ['Từ 1 năm kinh nghiệm tư vấn bảo hiểm', 'tư vấn bảo hiểm'],
    ['Từ 2 năm kinh nghiệm cơ khí', 'cơ khí'],
    ['Có 3 năm kinh nghiệm sửa chữa ô tô', 'sửa chữa ô tô'],
    ['Từ 1 năm kinh nghiệm bán hàng B2B', 'bán hàng B2B'],
    ['Từ 1 năm kinh nghiệm quản lý dự án', 'quản lý dự án'],
  ])('should keep the whole field name in "%s" and show it in the reason', (requirement, shown) => {
    // Arrange
    const cv = `KINH NGHIỆM
2024 - 2024 Nhân viên phục vụ, Quán Ngon`;

    // Act
    const got = judge(cv, requirement);

    // Assert
    expect(got.reason).toContain(shown);
  });

  it('should not lose a field whose first word looks like a filler', () => {
    // Act
    const field = fieldOf('Từ 2 năm kinh nghiệm tài chính');

    // Assert
    expect(field).toMatchObject({ label: 'tài chính' });
  });
});

describe('stated years', () => {
  it('should not take a field claim above a job in another field', () => {
    // Arrange
    const cv = `TÓM TẮT
Có 3 năm kinh nghiệm kế toán tổng hợp.
KINH NGHIỆM
2023 - nay Tài xế, Công ty Vận tải Hòa Bình. Chở hàng liên tỉnh.`;

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm kế toán');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should accept a stated field when there are no dated jobs to contradict it', () => {
    // Arrange
    const cv = `TÓM TẮT
Hơn 4 năm kinh nghiệm chăm sóc khách hàng tại tổng đài ngân hàng.`;

    // Act
    const got = judge(cv, 'Từ 3 năm kinh nghiệm chăm sóc khách hàng');

    // Assert
    expect(got.verdict).toBe('met');
  });

  it("should not read the employer's years as the candidate's", () => {
    // Arrange
    const cv = `KINH NGHIỆM
06/2026 - nay Nhân viên, Tập đoàn Hoa Sen, doanh nghiệp có 30 năm kinh nghiệm sản xuất tôn`;

    // Act
    const got = judge(cv, 'Từ 5 năm kinh nghiệm');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should read years written in words and durations next to a role', () => {
    // Arrange
    const words = `TÓM TẮT
Hai năm kinh nghiệm làm lễ tân khách sạn.`;
    const role = `Hoàng Văn Tư, phụ bếp 3 năm tại quán ăn, học hết lớp 12, điện thoại 0912000111.`;

    // Act
    const stated = judge(words, 'Từ 2 năm kinh nghiệm lễ tân');
    const short = judge(role, 'Từ 2 năm kinh nghiệm làm bếp');

    // Assert
    expect(stated.verdict).toBe('met');
    expect(short.verdict).toBe('met');
  });

  it('should not read a warranty as experience', () => {
    // Arrange
    const cv = `Nhân viên kỹ thuật điện lạnh
Tư vấn gói bảo hành 3 năm cho khách hàng`;

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm');

    // Assert
    expect(got.verdict).toBe('unknown');
  });
});

describe('work for or with others', () => {
  it('should not count a department the candidate merely worked with', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2019 - nay Nhân viên kho, Công ty Bia Sao Việt
Kiểm hàng; làm việc với phòng Nhân sự về chấm công, báo cáo cho Kế toán trưởng`;

    // Act
    const accounting = judge(cv, 'Có kinh nghiệm kế toán');
    const hr = judge(cv, 'Có kinh nghiệm nhân sự');

    // Assert
    expect(accounting.verdict).toBe('unmet');
    expect(hr.verdict).toBe('unmet');
  });

  it('should not count work a CV says somebody else does', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2020 - nay Nhân viên bán hàng, Công ty Giao nhận Biển Xanh
Chào giá cho khách; thủ tục hải quan do bộ phận chứng từ phụ trách`;

    // Act
    const got = judge(cv, 'Có kinh nghiệm khai báo hải quan');

    // Assert
    expect(got.verdict).toBe('unmet');
  });
});

describe('management experience', () => {
  it('should read it from the job title, not from a duty', () => {
    // Arrange
    const clerk = `KINH NGHIỆM
2019 - nay Nhân viên hành chính, Công ty An Phú
Quản lý lịch họp, quản lý hồ sơ nhân viên`;
    const lead = `KINH NGHIỆM
2019 - nay Trưởng nhóm kinh doanh, Công ty An Phú`;

    // Act
    const asClerk = judge(clerk, 'Từ 2 năm kinh nghiệm quản lý');
    const asLead = judge(lead, 'Từ 2 năm kinh nghiệm quản lý');

    // Assert
    expect(asClerk.verdict).toBe('unmet');
    expect(asLead.verdict).toBe('met');
  });

  it('should not read an assistant to a director as a director', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2019 - nay Trợ lý Giám đốc, Công ty An Phú`;

    // Act
    const got = judge(cv, 'Từ 2 năm kinh nghiệm quản lý');

    // Assert
    expect(got.verdict).toBe('unmet');
  });
});

describe('job boundaries and dates', () => {
  it('should not give a job the duties of the job above it', () => {
    // Arrange
    const cv = `KINH NGHIỆM
10/2025 - nay: Chuyên viên tuyển dụng, Công ty Việt Tín
Đăng tin, sàng lọc hồ sơ
01/2019 - 09/2025: Nhân viên kho, Công ty Thực phẩm Ngọc Hà
Nhập xuất hàng`;

    // Act
    const got = judge(cv, 'Từ 3 năm kinh nghiệm tuyển dụng');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should not let "Trưởng" or a company called Trường erase a job in a CV without headings', () => {
    // Arrange
    const manager = `Lâm Hữu Phước
Trưởng ca sản xuất, Công ty Dệt Thành Công, 03/2019 - nay`;
    const company = `Lâm Hữu Phước
2020 - nay Nhân viên giao hàng, Công ty Trường Thịnh`;

    // Act
    const asManager = judge(manager, 'Từ 2 năm kinh nghiệm');
    const atCompany = judge(company, 'Từ 2 năm kinh nghiệm');

    // Assert
    expect(asManager.verdict).toBe('met');
    expect(atCompany.verdict).toBe('met');
  });

  it('should still leave school years out of work in a CV without headings', () => {
    // Arrange
    const cv = `Lâm Hữu Phước
2016 - 2020 Trường Đại học Nha Trang
2024 - nay Nhân viên giao hàng, Công ty Trường Thịnh`;

    // Act
    const got = judge(cv, 'Từ 4 năm kinh nghiệm');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it.each([
    ['Từ năm 2015 đến năm 2019: Lái xe, Công ty Hải Âu', 'Từ 4 năm kinh nghiệm', 'met'],
    ['Từ 06/2022: Lái xe, Công ty Hải Âu', 'Từ 4 năm kinh nghiệm', 'met'],
    ['Lái xe tại Công ty Hải Âu since 2021', 'Từ 5 năm kinh nghiệm', 'met'],
  ])('should read the dates in "%s"', (line, requirement, want) => {
    // Arrange
    const cv = `KINH NGHIỆM\n${line}`;

    // Act
    const got = judge(cv, requirement);

    // Assert
    expect(got.verdict).toBe(want);
  });

  it('should say not met when a CV has real sections but no work at all', () => {
    // Arrange
    const cv = `HỌC VẤN
Đại học Sài Gòn, ngành Văn học, 2021 - 2025
KỸ NĂNG
Word, viết bài`;

    // Act
    const got = judge(cv, 'Từ 1 năm kinh nghiệm');

    // Assert
    expect(got.verdict).toBe('unmet');
  });

  it('should accept any work for a form line naming no field', () => {
    // Arrange
    const cv = `KINH NGHIỆM
2021 - nay Thợ cắt tóc, Salon Mây Trắng`;

    // Act
    const got = judge(cv, 'Kinh nghiệm: 2 năm');

    // Assert
    expect(got.verdict).toBe('met');
  });
});
