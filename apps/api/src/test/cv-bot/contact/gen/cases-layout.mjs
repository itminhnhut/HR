// Clean contact details in layouts real exports use. Traps here come from layout and extraction order only.
import { cv } from './helper.mjs';

const L = (id, tpl, fields, exp) => cv('layout', id, tpl, fields, exp);

export const LAYOUT_CASES = [
  // TopCV-style, one column
  L(
    'la-topcv-01',
    'topcvModern',
    {
      n: 'Đào Thị Kim Oanh',
      t: 'Chuyên viên tuyển dụng',
      ct: ['☎ 0387 216 540', '✉ kimoanh.dao96@gmail.com', '⌂ 18 Lê Văn Sỹ, Phú Nhuận'],
      ft: ['CV được tạo tại topcv.vn'],
    },
    ['Đào Thị Kim Oanh', '0387216540', 'kimoanh.dao96@gmail.com'],
  ),
  L(
    'la-topcv-02',
    'topcvModern',
    {
      n: 'NGHIÊM XUÂN TRƯỜNG',
      t: 'Kỹ sư cầu đường',
      ct: [
        'Điện thoại: 0912.604.388',
        'Email: nghiemtruong.cd@yahoo.com',
        'Ngày sinh: 02/11/1990',
        'Giới tính: Nam',
        'Địa chỉ: 7 ngõ 42 Trần Duy Hưng, Hà Nội',
      ],
    },
    ['Nghiêm Xuân Trường', '0912604388', 'nghiemtruong.cd@yahoo.com'],
  ),
  L(
    'la-topcv-03',
    'topcvModern',
    {
      n: 'Phí Thùy Dương',
      t: 'Nhân viên marketing',
      ct: ['0962 781 305', 'phithuyduong99@gmail.com', 'facebook.com/thuyduong.phi', 'Hải Phòng'],
    },
    ['Phí Thùy Dương', '0962781305', 'phithuyduong99@gmail.com'],
  ),
  L(
    'la-topcv-04',
    'topcvModern',
    {
      lang: 'en',
      n: 'Bach Thanh Tung',
      t: 'Backend Developer',
      ct: ['Phone: +84 349 860 217', 'Email: tung.bach.dev@outlook.com', 'github.com/bachtung', 'Da Nang, Vietnam'],
    },
    ['Bach Thanh Tung', '0349860217', 'tung.bach.dev@outlook.com'],
  ),
  L(
    'la-topcv-05',
    'topcvModern',
    {
      n: 'Tiêu Mỹ Linh',
      t: 'Trợ lý giám đốc',
      ct: ['☎ 0778 340 926', '✉ tieumylinh@gmail.com'],
      p: ['Tình trạng hôn nhân: Độc thân', 'Quốc tịch: Việt Nam'],
      ft: ['© topcv.vn – Tiếp lợi thế, nối thành công'],
    },
    ['Tiêu Mỹ Linh', '0778340926', 'tieumylinh@gmail.com'],
  ),

  // TopCV-style, two columns: contact and skills come out before the name
  L(
    'la-topcv2-01',
    'topcv2col',
    {
      n: 'Hứa Quốc Thịnh',
      t: 'Nhân viên kinh doanh',
      ct: ['☎ 0935 702 164', '✉ huaquocthinh@gmail.com', '⌂ 120 Hùng Vương, Đà Nẵng'],
    },
    ['Hứa Quốc Thịnh', '0935702164', 'huaquocthinh@gmail.com'],
  ),
  L(
    'la-topcv2-02',
    'topcv2col',
    {
      n: 'TÒNG THỊ PHÓNG',
      t: 'Giáo viên tiếng Anh',
      ct: ['Số ĐT: 0325 418 790', 'Mail: tongphong.ta@gmail.com', 'Ngày sinh: 15/06/1995'],
    },
    ['Tòng Thị Phóng', '0325418790', 'tongphong.ta@gmail.com'],
  ),
  L(
    'la-topcv2-03',
    'topcv2col',
    {
      n: 'Lã Hoàng Nam',
      t: 'Thiết kế đồ họa',
      ct: ['0888 263 591', 'lahoangnam.art@gmail.com', 'behance.net/lahoangnam'],
      breakAll: true,
    },
    ['Lã Hoàng Nam', '0888263591', 'lahoangnam.art@gmail.com'],
  ),
  L(
    'la-topcv2-04',
    'topcv2col',
    {
      lang: 'en',
      n: 'Mai Phuong Thao Vu',
      t: 'Business Analyst',
      ct: ['+84 901 337 482', 'thaovu.ba@gmail.com', 'linkedin.com/in/thaovu-ba'],
    },
    ['Mai Phuong Thao Vu', '0901337482', 'thaovu.ba@gmail.com'],
  ),
  L(
    'la-topcv2-05',
    'topcv2col',
    {
      n: 'Diệp Gia Bảo',
      t: 'Lập trình viên',
      ct: ['Tel: 0704.815.263', 'Email: diepgiabao.it@gmail.com', 'Quận 7, TP. Hồ Chí Minh'],
      ab: ['Đang tìm việc'],
    },
    ['Diệp Gia Bảo', '0704815263', 'diepgiabao.it@gmail.com'],
  ),

  // VietnamWorks-style export: site header, reference code, 4-column table
  L(
    'la-vnw-01',
    'vnwExport',
    {
      n: 'Đàm Quang Vinh',
      t: 'Trưởng Phòng Kinh Doanh',
      ct: ['Điện thoại: 0983 520 471', 'Email: damquangvinh@gmail.com', 'Địa chỉ: 25 Nguyễn Văn Cừ, Long Biên'],
      p: ['Ngày sinh: 23/08/1987', 'Quốc tịch: Việt Nam', 'Cấp bậc: Trưởng phòng'],
    },
    ['Đàm Quang Vinh', '0983520471', 'damquangvinh@gmail.com'],
  ),
  L(
    'la-vnw-02',
    'vnwExport',
    {
      n: 'Sầm Ngọc Anh',
      t: 'Kế Toán Tổng Hợp',
      ct: ['Di động: 0359 014 682', 'E-mail: samngocanh.kt@yahoo.com'],
      p: ['Giới tính: Nữ', 'Mức lương mong muốn: 15.000.000 VNĐ'],
    },
    ['Sầm Ngọc Anh', '0359014682', 'samngocanh.kt@yahoo.com'],
  ),
  L(
    'la-vnw-03',
    'vnwExport',
    {
      lang: 'en',
      brand: ['CANDIDATE PROFILE', 'Profile ID: 5520418', 'Updated: 03/10/2026'],
      n: 'Khong Minh Duc',
      t: 'Senior Accountant',
      ct: ['Mobile: +84 977 406 218', 'Email: khongminhduc@gmail.com', 'Address: 88 Tran Hung Dao, Hue'],
      p: ['Date of birth: 11/02/1989'],
    },
    ['Khong Minh Duc', '0977406218', 'khongminhduc@gmail.com'],
  ),
  L(
    'la-vnw-04',
    'vnwExport',
    {
      n: 'Thiều Bích Hằng',
      t: 'Nhân Viên Hành Chính',
      wanted: 1,
      ct: ['Điện thoại: 0816.273.940', 'Email: thieubichhang@gmail.com', 'Địa chỉ: Thành phố Vinh, Nghệ An'],
      p: ['Năm kinh nghiệm: 4'],
      ft: ['Hồ sơ được tải từ cổng việc làm – Hỗ trợ nhà tuyển dụng: 1900 6612 38'],
    },
    ['Thiều Bích Hằng', '0816273940', 'thieubichhang@gmail.com'],
  ),
  L(
    'la-vnw-05',
    'vnwExport',
    {
      n: 'Uông Đình Khôi',
      t: 'Kỹ Sư Cơ Khí',
      ct: ['Điện thoại: (+84) 868 195 037', 'Email: uongdinhkhoi@outlook.com'],
      p: ['Ngày sinh: 30/04/1992', 'Hôn nhân: Đã kết hôn', 'Địa chỉ: 3 Võ Thị Sáu, Biên Hòa'],
    },
    ['Uông Đình Khôi', '0868195037', 'uongdinhkhoi@outlook.com'],
  ),

  // Canva text boxes in layer order: the name can sit anywhere in the text
  L(
    'la-canva-01',
    'canvaAbs',
    {
      n: 'Vương Khánh Linh',
      t: 'Content Creator',
      ct: ['0394 620 871', 'vuongkhanhlinh@gmail.com', '@khanhlinh.writes', 'Quận 3, TP.HCM'],
    },
    ['Vương Khánh Linh', '0394620871', 'vuongkhanhlinh@gmail.com'],
  ),
  L(
    'la-canva-02',
    'canvaAbs',
    {
      n: 'TÀO MINH PHÚC',
      t: 'Graphic Designer',
      ct: ['Tel 0852 714 390', 'Mail taominhphuc@gmail.com', 'Web taominhphuc.example'],
    },
    ['Tào Minh Phúc', '0852714390', 'taominhphuc@gmail.com'],
  ),
  L(
    'la-canva-03',
    'canvaAbs',
    {
      lang: 'en',
      n: 'Nhan Tu Anh',
      t: 'Social Media Manager',
      ct: ['+84 912 870 356', 'tuanh.nhan@gmail.com', 'Hanoi'],
      order: ['exp', 'skills', 'edu', 'contact', 'summary', 'title', 'name'],
    },
    ['Nhan Tu Anh', '0912870356', 'tuanh.nhan@gmail.com'],
  ),
  L(
    'la-canva-04',
    'canvaAbs',
    {
      n: 'Cổ Hải Đăng',
      t: 'Nhiếp ảnh gia',
      ct: ['0799 310 628', 'cohaidang.photo@gmail.com'],
      order: ['title', 'contact', 'name', 'summary', 'exp', 'edu', 'skills'],
    },
    ['Cổ Hải Đăng', '0799310628', 'cohaidang.photo@gmail.com'],
  ),
  L(
    'la-canva-05',
    'canvaAbs',
    {
      n: 'Ôn Bảo Ngân',
      t: 'Chuyên viên PR',
      ct: ['SĐT: 0345 901 276', 'Email: onbaongan@yahoo.com'],
      order: ['skills', 'name', 'exp', 'contact', 'title', 'edu', 'summary'],
    },
    ['Ôn Bảo Ngân', '0345901276', 'onbaongan@yahoo.com'],
  ),
  L(
    'la-canva-06',
    'canvaAbs',
    {
      n: 'Kha Trúc Quỳnh',
      nameLines: ['Kha Trúc', 'Quỳnh'],
      t: 'Trang điểm chuyên nghiệp',
      ct: ['☎ 0763 482 019', '✉ khatrucquynh@gmail.com'],
      order: ['contact', 'name', 'title', 'summary', 'exp', 'edu', 'skills'],
    },
    ['Kha Trúc Quỳnh', '0763482019', 'khatrucquynh@gmail.com'],
  ),

  // Canva hero with a huge name, usually on two lines
  L(
    'la-hero-01',
    'canvaHero',
    {
      n: 'LẠC THIÊN ÂN',
      nameLines: ['LẠC', 'THIÊN ÂN'],
      t: 'Sales Executive',
      ct: ['0933 170 284', 'lacthienan@gmail.com', 'Cần Thơ'],
    },
    ['Lạc Thiên Ân', '0933170284', 'lacthienan@gmail.com'],
  ),
  L(
    'la-hero-02',
    'canvaHero',
    {
      n: 'Mẫn Nhật Hạ',
      hello: 'Xin chào!',
      t: 'Biên tập viên',
      ct: ['Phone: 0376 208 145', 'Email: mannhatha@gmail.com'],
    },
    ['Mẫn Nhật Hạ', '0376208145', 'mannhatha@gmail.com'],
  ),
  L(
    'la-hero-03',
    'canvaHero',
    {
      lang: 'en',
      n: 'Thach Ngoc Sang',
      hello: 'Hello, my name is',
      t: 'Tour Guide',
      ct: ['+84 356 742 810', 'sang.thach@gmail.com'],
    },
    ['Thach Ngoc Sang', '0356742810', 'sang.thach@gmail.com'],
  ),
  L(
    'la-hero-04',
    'canvaHero',
    { n: 'CHUNG MỸ DUYÊN', spaced: true, t: 'Lễ tân', ct: ['0827 519 360', 'chungmyduyen@gmail.com', 'Nha Trang'] },
    ['Chung Mỹ Duyên', '0827519360', 'chungmyduyen@gmail.com'],
  ),
  L(
    'la-hero-05',
    'canvaHero',
    {
      n: 'Bành Gia Hưng',
      nameLines: ['Bành', 'Gia', 'Hưng'],
      t: 'Đầu bếp',
      ct: ['SĐT 0924 086 713', 'banhgiahung@yahoo.com'],
    },
    ['Bành Gia Hưng', '0924086713', 'banhgiahung@yahoo.com'],
  ),

  // Word: centered plain page
  L(
    'la-word-01',
    'wordPlain',
    {
      font: 'Palatino',
      note: 'font lacks some Vietnamese glyphs',
      n: 'CÙ THỊ MƠ',
      t: 'Nhân viên kho',
      ct: ['Điện thoại: 0987 340 615 – Email: cuthimo@gmail.com', 'Địa chỉ: Thôn 3, xã Đông Hưng, Thái Bình'],
    },
    ['Cù Thị Mơ', '0987340615', 'cuthimo@gmail.com'],
  ),
  L(
    'la-word-02',
    'wordPlain',
    {
      font: 'Palatino',
      note: 'font lacks some Vietnamese glyphs',
      dt: 'CURRICULUM VITAE',
      n: 'Vi Văn Thắng',
      t: 'Lái xe',
      ct: ['Số điện thoại: 0338 625 017', 'Email: vivanthang.laixe@gmail.com'],
    },
    ['Vi Văn Thắng', '0338625017', 'vivanthang.laixe@gmail.com'],
  ),
  L(
    'la-word-03',
    'wordPlain',
    { dt: 'HỒ SƠ XIN VIỆC', n: 'Mã Thúy Vân', t: 'Thu ngân', ct: ['Tel:\t0702 917 438\tEmail:\tmathuyvan@gmail.com'] },
    ['Mã Thúy Vân', '0702917438', 'mathuyvan@gmail.com'],
  ),
  L(
    'la-word-04',
    'wordPlain',
    {
      lang: 'en',
      dt: 'RESUME',
      n: 'Do Khac Hieu',
      t: 'Civil Engineer',
      ct: ['Tel: (+84) 917 208 346 | E-mail: dokhachieu@gmail.com | 12 Le Loi, Quy Nhon'],
    },
    ['Do Khac Hieu', '0917208346', 'dokhachieu@gmail.com'],
  ),

  // Word table header
  L(
    'la-wtable-01',
    'wordTable',
    {
      boldLabels: true,
      n: 'Hoàng Phủ Minh Khôi',
      t: 'Chuyên viên pháp chế',
      ct: ['ĐT: 0908 613 275', 'Email: hoangphu.khoi@gmail.com', 'ĐC: 44 Cao Thắng, Quận 3'],
    },
    ['Hoàng Phủ Minh Khôi', '0908613275', 'hoangphu.khoi@gmail.com'],
  ),
  L(
    'la-wtable-02',
    'wordTable',
    { contactLeft: true, n: 'NÔNG THỊ THU', t: 'Y tá', ct: ['0343 790 621', 'nongthithu.yta@gmail.com', 'Cao Bằng'] },
    ['Nông Thị Thu', '0343790621', 'nongthithu.yta@gmail.com'],
  ),
  L(
    'la-wtable-03',
    'wordTable',
    {
      contactLeft: true,
      lang: 'en',
      n: 'Quan Bao Tram',
      t: 'HR Executive',
      ct: ['Mobile: 0931 475 802', 'Email: quanbaotram@gmail.com'],
    },
    ['Quan Bao Tram', '0931475802', 'quanbaotram@gmail.com'],
  ),
  L(
    'la-wtable-04',
    'wordTable',
    {
      boldLabels: true,
      n: 'Trà Thị Hồng Nhung',
      t: 'Dược sĩ',
      ct: ['Di động: 0869 234 170', 'Thư điện tử: trahongnhung@gmail.com'],
    },
    ['Trà Thị Hồng Nhung', '0869234170', 'trahongnhung@gmail.com'],
  ),

  // Three columns in several DOM orders
  L(
    'la-3col-01',
    'threeCol',
    { n: 'Lục Thanh Tâm', t: 'Quản lý dự án', ct: ['0921 640 738', 'lucthanhtam@gmail.com', 'Hà Đông, Hà Nội'] },
    ['Lục Thanh Tâm', '0921640738', 'lucthanhtam@gmail.com'],
  ),
  L(
    'la-3col-02',
    'threeCol',
    { cols: 'cab', n: 'BẾ VĂN SƠN', t: 'Kỹ thuật viên', ct: ['SĐT: 0398 105 762', 'Email: bevanson@gmail.com'] },
    ['Bế Văn Sơn', '0398105762', 'bevanson@gmail.com'],
  ),
  L(
    'la-3col-03',
    'threeCol',
    { cols: 'bca', n: 'Ưng Hoài Thương', t: 'Nhân viên bán hàng', ct: ['☎ 0836 720 941', '✉ unghoaithuong@yahoo.com'] },
    ['Ưng Hoài Thương', '0836720941', 'unghoaithuong@yahoo.com'],
  ),
  L(
    'la-3col-04',
    'threeCol',
    {
      cols: 'cba',
      lang: 'en',
      n: 'Tong Gia Khanh',
      t: 'Data Analyst',
      ct: ['+84 968 351 207', 'giakhanh.tong@gmail.com', 'github.com/gkhanh'],
    },
    ['Tong Gia Khanh', '0968351207', 'giakhanh.tong@gmail.com'],
  ),
  L(
    'la-3col-05',
    'threeCol',
    { cols: 'acb', n: 'Cấn Thị Thanh Hoa', t: 'Thư ký', ct: ['Tel 0946 208 571', 'canthanhhoa@gmail.com'] },
    ['Cấn Thị Thanh Hoa', '0946208571', 'canthanhhoa@gmail.com'],
  ),

  // Right sidebar: the contact block is the last thing in the text
  L(
    'la-right-01',
    'rightSide',
    { n: 'Giáp Văn Thuận', t: 'Giám sát công trình', ct: ['0379 846 120', 'giapvanthuan@gmail.com', 'Bắc Giang'] },
    ['Giáp Văn Thuận', '0379846120', 'giapvanthuan@gmail.com'],
  ),
  L(
    'la-right-02',
    'rightSide',
    {
      lang: 'en',
      n: 'Ly Hanh Nguyen',
      t: 'Product Owner',
      ct: ['Phone: 0909 142 683', 'Email: hanhnguyen.ly@gmail.com', 'LinkedIn: linkedin.com/in/hanhly'],
    },
    ['Ly Hanh Nguyen', '0909142683', 'hanhnguyen.ly@gmail.com'],
  ),
  L(
    'la-right-03',
    'rightSide',
    {
      n: 'LƯỜNG THỊ NGOAN',
      t: 'Nhân viên nhà hàng',
      ct: ['Điện thoại: 0332 907 164', 'Email: luongngoan98@gmail.com'],
    },
    ['Lường Thị Ngoan', '0332907164', 'luongngoan98@gmail.com'],
  ),

  // Vector icons in place of labels
  L(
    'la-icon-01',
    'iconRow',
    {
      n: 'Thi Thành Lợi',
      t: 'Chuyên viên IT Helpdesk',
      ct: ['0947 136 280', 'thithanhloi@gmail.com', '9 Hai Bà Trưng, Huế'],
    },
    ['Thi Thành Lợi', '0947136280', 'thithanhloi@gmail.com'],
  ),
  L(
    'la-icon-02',
    'iconRow',
    {
      stacked: true,
      n: 'ĐIÊU CHÍNH QUÂN',
      t: 'Kiến trúc sư',
      ct: ['0702 481 396', 'dieuchinhquan@outlook.com', 'Sơn La'],
    },
    ['Điêu Chính Quân', '0702481396', 'dieuchinhquan@outlook.com'],
  ),
  L(
    'la-icon-03',
    'iconRow',
    {
      lang: 'en',
      n: 'Xa Bao Long',
      t: 'DevOps Engineer',
      ct: ['0363 952 807', 'xabaolong@gmail.com', 'Ho Chi Minh City'],
    },
    ['Xa Bao Long', '0363952807', 'xabaolong@gmail.com'],
  ),
  L(
    'la-icon-04',
    'iconRow',
    {
      stacked: true,
      n: 'Mạch Tú Uyên',
      t: 'Nhân viên xuất nhập khẩu',
      ct: ['0853 671 024', 'machtuuyen@yahoo.com', 'Hải Dương'],
      ab: ['Vị trí ứng tuyển: Trưởng nhóm chứng từ'],
    },
    ['Mạch Tú Uyên', '0853671024', 'machtuuyen@yahoo.com'],
  ),

  // English ATS
  L(
    'la-ats-01',
    'atsEn',
    {
      lang: 'en',
      n: 'Trieu Anh Khoa',
      t: 'Software Engineer',
      ct: ['0976 520 318', 'khoa.trieu.dev@gmail.com', 'github.com/khoatrieu', 'Hanoi'],
    },
    ['Trieu Anh Khoa', '0976520318', 'khoa.trieu.dev@gmail.com'],
  ),
  L(
    'la-ats-02',
    'atsEn',
    {
      lang: 'en',
      n: 'NINH QUYNH CHI',
      t: 'Marketing Manager',
      ct: ['+84 395 108 276', 'chi.ninhq@outlook.com', 'Hai Phong'],
    },
    ['Ninh Quynh Chi', '0395108276', 'chi.ninhq@outlook.com'],
  ),
  L(
    'la-ats-03',
    'atsEn',
    {
      lang: 'en',
      n: 'Phung Duc Tri',
      t: 'Financial Controller',
      ct: ['Tel: 0914-360-285', 'Email: phungductri@gmail.com'],
    },
    ['Phung Duc Tri', '0914360285', 'phungductri@gmail.com'],
  ),

  // Vietnamese form with dotted leaders
  L(
    'la-form-01',
    'formDots',
    {
      form: [
        'Họ và tên: Thân Thị Thủy ............ Nam/Nữ: Nữ',
        'Sinh ngày: 12 tháng 03 năm 1993',
        'Nơi đăng ký hộ khẩu: Lạng Giang, Bắc Giang',
        'Điện thoại liên hệ: 0326 759 014',
        'Email: thanthithuy93@gmail.com',
      ],
    },
    ['Thân Thị Thủy', '0326759014', 'thanthithuy93@gmail.com'],
  ),
  L(
    'la-form-02',
    'formDots',
    {
      dt: 'BẢN KHAI LÝ LỊCH',
      form: [
        '1. Họ tên khai sinh: QUÀNG VĂN PÁO',
        '2. Ngày, tháng, năm sinh: 05/09/1988',
        '3. Dân tộc: Thái',
        '4. Số điện thoại: 0853.247.106',
        '5. Thư điện tử: quangvanpao88@gmail.com',
      ],
    },
    ['Quàng Văn Páo', '0853247106', 'quangvanpao88@gmail.com'],
  ),
  L(
    'la-form-03',
    'formDots',
    {
      dt: 'ĐƠN ỨNG TUYỂN',
      form: [
        'Tên tôi là: Lê Thị Xuân Mai',
        'Ứng tuyển vị trí: Nhân Viên Thu Mua',
        'Liên hệ: 0941 620 873',
        'Mail: lexuanmai.tm@gmail.com',
      ],
    },
    ['Lê Thị Xuân Mai', '0941620873', 'lexuanmai.tm@gmail.com'],
  ),
];
