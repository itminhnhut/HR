import { describe, expect, it } from 'vitest';
import { parseCvContact } from './index.js';

function nameOf(text: string): string | null {
  return parseCvContact(text).fullName;
}

describe('parseCvContact – full name from labels', () => {
  it.each([
    ['"Họ và tên:"', 'Họ và tên: Nguyễn Văn An\nNgày sinh: 01/01/1995', 'Nguyễn Văn An'],
    ['"Họ tên:" in capitals', 'HỌ TÊN: LÊ THỊ HOA', 'Lê Thị Hoa'],
    ['"Tên:"', 'Tên: Phạm Minh Tuấn', 'Phạm Minh Tuấn'],
    ['"Full name:"', 'Full name: Hoang Bao Ngoc', 'Hoang Bao Ngoc'],
    ['"Name:" with a foreign name', 'Name: Emily Watson', 'Emily Watson'],
    ['a lowercase labelled value', 'Họ và tên: trần quốc bảo', 'Trần Quốc Bảo'],
    ['a value on the next line', 'Họ và tên:\nĐỗ Thị Thu Trang', 'Đỗ Thị Thu Trang'],
    ['a bilingual label', 'Họ và tên / Full name:   Trần Thị Ngọc Ánh', 'Trần Thị Ngọc Ánh'],
    ['"Tôi tên là"', 'Xin chào! Tôi tên là Lâm Gia Bảo', 'Lâm Gia Bảo'],
    ['a table cell label without colon', 'Họ và tên     Ngô Thị Yến     Giới tính: Nữ', 'Ngô Thị Yến'],
    ['a label line joined with the next label', 'Họ và tên: Võ Thanh Tâm Ngày sinh: 02/09/1998', 'Võ Thanh Tâm'],
  ])('reads the value of %s', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it('should prefer the labelled name over a name-shaped line above it', () => {
    const text = 'Mai Linh Group\nHọ và tên: Bùi Thị Lan';
    expect(nameOf(text)).toBe('Bùi Thị Lan');
  });

  it('should not read "Tên công ty:" as a name label', () => {
    expect(nameOf('Tên công ty: Công ty TNHH Minh Phát')).toBeNull();
  });
});

describe('parseCvContact – full name from the header', () => {
  it.each([
    ['an ALL CAPS name', 'TRẦN VĂN HÙNG\nKế toán tổng hợp', 'Trần Văn Hùng'],
    ['a name without tones, never adding any', 'NGUYEN VAN AN\nSales Executive', 'Nguyen Van An'],
    ['a name under a CURRICULUM VITAE heading', 'CURRICULUM VITAE\nPhạm Thị Ngọc Ánh', 'Phạm Thị Ngọc Ánh'],
    ['a name under "HỒ SƠ XIN VIỆC"', 'HỒ SƠ XIN VIỆC\nĐặng Hữu Phước\nSĐT: 0912345678', 'Đặng Hữu Phước'],
    ['a name followed by the title after a dash', 'Trần Văn Hùng – Kế toán tổng hợp', 'Trần Văn Hùng'],
    ['a name followed by the title after a pipe', 'TRẦN VĂN HÙNG | Sales', 'Trần Văn Hùng'],
    ['a name followed by the title without separator', 'LÊ MINH KHOA KẾ TOÁN TRƯỞNG', 'Lê Minh Khoa'],
    ['a letter-spaced header', 'T R Ầ N  V Ă N  H Ù N G\nNhân viên kinh doanh', 'Trần Văn Hùng'],
    ['a name split over two lines', 'NGUYỄN THỊ\nMAI ANH\nNhân viên kinh doanh', 'Nguyễn Thị Mai Anh'],
    ['English order, kept as written', 'Hung Tran Van\nFrontend Developer', 'Hung Tran Van'],
    ['a foreign name as the first line', 'Emily Watson\nMarketing Executive\nemily@gmail.com', 'Emily Watson'],
    ['a decomposed (NFD) name', 'Nguye\u0302\u0303n Va\u0306n An'.normalize('NFD'), 'Nguyễn Văn An'],
    ['zero-width spaces inside the name', 'Lê\u200B Thị\u200B Hoa', 'Lê Thị Hoa'],
    ['non-breaking spaces between words', 'Lê\u00A0Thị\u00A0Hoa', 'Lê Thị Hoa'],
    ['fullwidth letters', 'ＮＧＵＹＥＮ ＶＡＮ ＡＮ', 'Nguyen Van An'],
    ['a word split by PDF extraction', 'Nguy ễn Văn An\nKế toán', 'Nguyễn Văn An'],
    ['a capital word split before its last letter', 'NGUYỄ N VĂN AN', 'Nguyễn Văn An'],
    ['a name with "Đ"', 'ĐINH THỊ ĐÀO', 'Đinh Thị Đào'],
    ['a name after a "CV -" prefix', 'CV - NGUYỄN VĂN AN', 'Nguyễn Văn An'],
    ['a name after an English honorific', 'Mr. Tran Minh Duc\nBusiness Analyst', 'Tran Minh Duc'],
    ['a name with a lowercase middle name', 'Nguyễn thị Hoa', 'Nguyễn Thị Hoa'],
  ])('reads %s', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it.each([
    ['CURRICULUM VITAE', 'CURRICULUM VITAE'],
    ['SƠ YẾU LÝ LỊCH', 'SƠ YẾU LÝ LỊCH'],
    ['THÔNG TIN CÁ NHÂN', 'THÔNG TIN CÁ NHÂN'],
    ['MỤC TIÊU NGHỀ NGHIỆP', 'MỤC TIÊU NGHỀ NGHIỆP'],
    ['KINH NGHIỆM LÀM VIỆC', 'KINH NGHIỆM LÀM VIỆC'],
    ['PERSONAL INFORMATION', 'PERSONAL INFORMATION'],
    ['a job title "Kế toán tổng hợp"', 'Kế toán tổng hợp'],
    ['a job title "Nhân viên kinh doanh"', 'Nhân viên kinh doanh'],
    ['a job title "Sales Executive"', 'Sales Executive'],
    ['a job title "Frontend Developer"', 'Frontend Developer'],
    ['a company name', 'Công Ty TNHH Minh Phát'],
    ['a school name', 'Trường Đại Học Bách Khoa'],
    ['a district in an address', 'Hoàng Mai, Hà Nội'],
    ['a reference person with an honorific', 'Ông Nguyễn Văn Bình'],
  ])('should not return %s as the name', (_case, text) => {
    expect(nameOf(text)).toBeNull();
  });

  it('should not return the reference person when the candidate name is missing', () => {
    const text = 'Email: an@gmail.com\nNGƯỜI THAM CHIẾU\nNguyễn Văn Bình\nTrưởng phòng kinh doanh\n0903123456';
    expect(nameOf(text)).toBeNull();
  });

  it('should pick the header name over a supervisor named later in work history', () => {
    const text = 'Lý Thu Hà\nKINH NGHIỆM LÀM VIỆC\nCông ty ABC\nQuản lý trực tiếp\nTrần Văn Lực';
    expect(nameOf(text)).toBe('Lý Thu Hà');
  });
});
