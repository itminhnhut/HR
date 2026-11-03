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

describe('parseCvContact – words that are both a name and something else', () => {
  it.each([
    ['Thế, which is "the" without tones', 'Đoàn Thế Vinh', 'Đoàn Thế Vinh'],
    ['"The" in a CV without tones', 'Nguyen The Vinh', 'Nguyen The Vinh'],
    ['Quan, which is "quận" without tones', 'Hoang Quan Tu', 'Hoang Quan Tu'],
    ['Phuong, which is "phường" without tones', 'Tran Thi Phuong', 'Tran Thi Phuong'],
    ['Huyen, which is "huyện" without tones', 'Le Thi Huyen', 'Le Thi Huyen'],
    ['Tinh, which is "tỉnh" without tones', 'Vo Thanh Tinh', 'Vo Thanh Tinh'],
    ['a given name that is a heading word, after a firm middle name', 'Lê Hữu Bằng', 'Lê Hữu Bằng'],
    ['a family name with an apostrophe', "H'Nhi Bkrong Lan\nh.nhi.lan@gmail.com", null],
  ])('should treat %s correctly', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it.each([
    ['Phan Kế Toán', 'ketoan.phan91@gmail.com', 'Phan Kế Toán'],
    ['Lâm Thiết Kế', 'lamthietke@gmail.com', 'Lâm Thiết Kế'],
    ['Đinh Nhân Sự', 'nhansu.dinh@yahoo.com', 'Đinh Nhân Sự'],
  ])('should read %s when the email spells it out', (line, email, expected) => {
    expect(nameOf(`${line}\nChuyên viên\n${email}`)).toBe(expected);
  });

  it('should not take a placeholder initial for a name because the address spells it', () => {
    expect(nameOf('Trần Thị B\nNhân viên\ntranb@gmail.com')).toBeNull();
  });

  it('should leave such a name empty when nothing confirms it', () => {
    expect(nameOf('Phan Kế Toán\nChuyên viên')).toBeNull();
  });

  it('should not make a job title a name because the address spells it', () => {
    expect(nameOf('Giám Sát Kho Vận\ngiamsat.khovan.hn@gmail.com')).toBeNull();
  });

  it('should not take an address for a name when those letters sit inside other words', () => {
    expect(nameOf('Đặng Bá Thanh\nLê An\nthanhle.an@gmail.com')).toBe('Đặng Bá Thanh');
  });

  it('should not take the last word of a job title for a given name when the name ends in a middle name', () => {
    expect(nameOf('Lê Văn Kế Toán')).toBeNull();
  });
});

describe('parseCvContact – lines that only look like a name', () => {
  it.each([
    ['a heading in capitals', 'NĂNG LỰC\nTin học văn phòng'],
    ['a label with no value above another label', 'HỌ VÀ TÊN\nVỊ TRÍ ỨNG TUYỂN'],
    ['an English job title', 'Supply Chain Planner\nMobile: 0937 582 610'],
    ['a company after a job title', 'Assistant – Hung Thinh Trading Co., Ltd'],
    ['a two-word English heading', 'Key Achievements\nGrew sales by 20%'],
    ['a referee named in a sidebar', 'NGƯỜI THAM KHẢO\nPhạm Thị Mai'],
    ['text in an old VNI font', 'Nguyeãn Vaên Tuù\nÑieän thoaïi: 0912 406 735\nKinh nghieäm laøm vieäc'],
    ['text in an old TCVN3 font', 'NguyÔn ThÞ Thu\n§iÖn tho¹i: 0347 180 526\nKinh nghiÖm lµm viÖc'],
  ])('should leave the box empty with only %s', (_case, text) => {
    expect(nameOf(text)).toBeNull();
  });

  it('should read the phone and email of an old-font CV though the name is garbled', () => {
    const text = 'Nguyeãn Vaên Tuù\nÑieän thoaïi: 0912 406 735\nEmail: tu.nguyen.vni@gmail.com\nlaøm vieäc';

    expect(parseCvContact(text)).toEqual({ fullName: null, phone: '0912406735', email: 'tu.nguyen.vni@gmail.com' });
  });
});

describe('parseCvContact – where the name sits and how it is written', () => {
  it.each([
    [
      'a date-of-birth label after the value',
      '1. Họ tên khai sinh: LÒ VĂN PHÚC\n2. Ngày sinh: 01/02/1990',
      'Lò Văn Phúc',
    ],
    ['dot leaders after the labelled value', 'Họ và tên: Thân Quốc Việt ........ Nam/Nữ: Nam', 'Thân Quốc Việt'],
    ['a family name, comma, given names', 'PHAM, Quoc Dung\nEngineer', 'Pham Quoc Dung'],
    ['a degree before the name', 'ThS. Bùi Minh Châu\nGiảng viên', 'Bùi Minh Châu'],
    ['a CV title at the bottom of the page', 'Kế toán\nKinh nghiệm\nCV - Trịnh Thu Hà\nTrang 1', 'Trịnh Thu Hà'],
    ['a CV title in underscores', 'CV_Vo_Thanh_Long', 'Vo Thanh Long'],
    ['"Curriculum Vitae of"', 'Sales Manager\nCurriculum Vitae of Dang Ngoc Linh', 'Dang Ngoc Linh'],
    ['a phone after a column gap', 'Đỗ Quốc Khánh   0912 406 735', 'Đỗ Quốc Khánh'],
    ['a label after the name without separators', 'Hà Quốc Việt SĐT 0912 406 735 Email hqv@gmail.com', 'Hà Quốc Việt'],
    ['a label in the next column', 'Lý Ngọc Mai   Di động: 0912 406 735', 'Lý Ngọc Mai'],
    ['a name in three lines', 'Chung\nGia\nKhánh\nĐầu bếp', 'Chung Gia Khánh'],
    ['a name over two lines, one word below', 'Tô Ngọc\nBích\nNhân viên', 'Tô Ngọc Bích'],
    ['an ethnic-minority family name', 'Bế Thị Lan\nGiáo viên', 'Bế Thị Lan'],
    ['an Ê-đê name', 'Y Moan Ênuôl\nymoanenuol@gmail.com', 'Y Moan Ênuôl'],
    ['an icon-font glyph before the name', '\uE001 Phan Đức Long', 'Phan Đức Long'],
  ])('reads %s', (_case, text, expected) => {
    expect(nameOf(text)).toBe(expected);
  });

  it('should choose the line the email confirms over a person named earlier', () => {
    const text = 'Trương Thị Lành – Trưởng phòng\nCông ty Hưng Thịnh\nKhúc Hải Đăng\nhaidang.khuc@gmail.com';

    expect(nameOf(text)).toBe('Khúc Hải Đăng');
  });

  it('should not read a name only in the closing signature, even with an address that spells it', () => {
    const text = 'Nhân viên\nvinh.dao@gmail.com\nTrân trọng,\nĐào Vinh';

    expect(nameOf(text)).toBeNull();
  });

  it('should read the signature of a cover letter when the CV details follow it', () => {
    const text = 'THƯ XIN VIỆC\nTrân trọng,\nĐào Vinh An\nĐiện thoại: 0912 406 735\nEmail: vinhan.dao@gmail.com';

    expect(nameOf(text)).toBe('Đào Vinh An');
  });

  it('should read the name after a referee block, below the referee details', () => {
    const text = 'THAM CHIẾU\nAnh Long – Trưởng nhóm\n0912 406 735\nlong@hanoiwood.vn\nThạch Bảo Ngọc\nNhân viên';

    expect(nameOf(text)).toBe('Thạch Bảo Ngọc');
  });
});
