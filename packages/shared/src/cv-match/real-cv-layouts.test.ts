import { describe, expect, it } from 'vitest';
import { scoreCv } from './score.js';

const TODAY = '2026-11-04';
const verdictOf = (cvText: string, requirement: string) =>
  scoreCv({ cvText, requirements: [requirement], today: TODAY }).items[0];

/** Layouts seen on real CVs (Canva and similar designs), with the names and companies changed. */
describe('jobs of a CV whose design scrambles the reading order', () => {
  const DATES_UNDER_EDUCATION = [
    'NHÂN VIÊN XUẤT NHẬP KHẨU',
    'KỸ NĂNG',
    'Tiếng Anh: đọc hiểu chứng từ, viết và phản hồi email',
    'Khai báo hải quan trên phần mềm Ecus',
    'KINH NGHIỆM',
    '0900000000',
    'HỌC VẤN',
    '2020 - 2024',
    'Trường Đại Học Mở',
    'Kinh Tế Quốc Tế',
    'Mong muốn được gia nhập công ty để tích lũy thêm kinh nghiệm thực tiễn.',
    '07/2024 - 07/2026',
    'CÔNG TY TNHH ABC',
    'Nhân viên chứng từ hàng xuất',
    'Lập, kiểm tra bộ chứng từ xuất khẩu (Invoice, Packing List, B/L).',
    'Khai báo hải quan trên phần mềm ECUS với khoảng 100 tờ khai / tháng.',
  ].join('\n');

  it('should find a job whose dates landed under "Học vấn"', () => {
    expect(verdictOf(DATES_UNDER_EDUCATION, 'Kinh nghiệm: 1 năm')?.verdict).toBe('met');
  });

  it('should not read the years of study as a job', () => {
    expect(verdictOf(DATES_UNDER_EDUCATION, 'Kinh nghiệm: 3 năm')?.verdict).toBe('unmet');
  });

  it('should leave open a line asking for a field, because the description may sit far from its dates', () => {
    const line = 'Tối thiểu 3 năm kinh nghiệm khai báo hải quan.';

    expect(verdictOf(DATES_UNDER_EDUCATION, line)?.verdict).toBe('unknown');
  });

  it('should find a language whose name wraps over two lines in a narrow column', () => {
    const cv = `${DATES_UNDER_EDUCATION}\nNgoại ngữ & Giao tiếp: Tiếng\nAnh thương mại (đọc hiểu bộ chứng từ)`;

    expect(
      verdictOf(
        cv.replace('Tiếng Anh: đọc hiểu chứng từ, viết và phản hồi email\n', ''),
        'Đọc hiểu tiếng Anh chuyên ngành',
      )?.verdict,
    ).toBe('met');
  });

  it('should keep the reading order when only a heading row and a contact row have wide gaps', () => {
    // Arrange
    const cv = [
      'Điện thoại: 0900000000   Email: a@example.com',
      'MỤC TIÊU NGHỀ NGHIỆP',
      'Ứng tuyển vị trí Nhân viên Chứng từ.',
      'HỌC VẤN   KINH NGHIỆM',
      '•   Trường: Đại học Sài Gòn',
      'Nhân viên Chứng từ Hàng xuất',
      'CÔNG TY TNHH GIAO NHẬN XYZ',
      '12/2023-04/2026',
      '•   Khai báo hải quan trên ECUS/VNACCS.',
      '•   Kiểm tra bộ chứng từ xuất nhập khẩu.',
    ].join('\n');

    // Act
    const item = verdictOf(cv, 'Tối thiểu 1 năm kinh nghiệm khai báo hải quan.');

    // Assert
    expect(item?.verdict).toBe('met');
  });

  it('should read what follows two headings set side by side as work, not as the objective', () => {
    // Arrange
    const cv = [
      'NHÂN VIÊN CHỨNG TỪ',
      'MỤC TIÊU NGHỀ NGHIỆP',
      'Mong muốn ứng tuyển vị trí Nhân viên Chứng từ.',
      'HỌC VẤN   KINH NGHIỆM',
      'Trường: Đại học Sài Gòn',
      'Nhân viên Chứng từ Hàng xuất',
      'CÔNG TY TNHH GIAO NHẬN XYZ',
      '12/2023-04/2026',
      'Tra cứu mã HS Code, khai báo hải quan trên ECUS/VNACCS.',
    ].join('\n');

    // Act
    const item = verdictOf(cv, 'Thành thạo khai báo hải quan điện tử (VNACCS/VCIS), tra cứu mã HS Code.');

    // Assert
    expect(item?.verdict).toBe('met');
  });

  it('should leave open a line asking for a field when several jobs ran together on one line', () => {
    // Arrange: titles, dates and companies of three jobs extracted as one line, so the sales years cannot be told apart.
    const cv = [
      'KINH NGHIỆM 10/2025 - 01/2026 03/2026 - 05/2026 01/2023 - 05/2026 Nhân viên Tư vấn TTS Chứng từ Xuất Nhập Khẩu Nhân viên Sales Công ty A Công ty B Công ty C',
      'Hỗ trợ khai báo hải quan dưới sự hướng dẫn của nhân viên phụ trách.',
      'Tư vấn và giới thiệu sản phẩm đến khách hàng.',
      'HỌC VẤN',
      'Đại học Kinh tế',
    ].join('\n');

    // Act
    const item = verdictOf(cv, 'Tối thiểu 1 năm kinh nghiệm khai báo hải quan.');

    // Assert
    expect(item?.verdict).toBe('unknown');
  });
});

describe('lines of "Mô tả công việc" that are not work', () => {
  const CV = 'KINH NGHIỆM\n01/2022 - 01/2024\nNhân viên kho, Công ty A\nKiểm kê hàng tồn kho hằng tháng.';
  const dutiesOf = (duties: string[]) =>
    scoreCv({ cvText: CV, requirements: [], duties, today: TODAY }).items.map((i) => i.requirement);

  it('should leave out a numbered title that has its duties under it', () => {
    const duty = 'Theo dõi tiến độ đơn hàng nhập khẩu';

    expect(dutiesOf(['1. Quản lý đơn hàng & vận chuyển nhập khẩu', duty])).toEqual([duty]);
  });

  it('should keep numbered lines when the whole list is numbered, as they are the duties', () => {
    const duties = ['1. Kiểm kê hàng tồn kho', '2. Báo cáo chênh lệch cho trưởng kho'];

    expect(dutiesOf(duties)).toEqual(duties);
  });

  it.each([
    'THỜI GIAN LÀM VIỆC',
    'Từ Thứ Hai - Thứ Sáu và 2 ngày thứ 7 trong tháng',
    'Giờ làm việc: 8h00 - 17h30, nghỉ trưa 1h30',
  ])('should leave out "%s"', (line) => {
    expect(dutiesOf([line])).toEqual([]);
  });
});
