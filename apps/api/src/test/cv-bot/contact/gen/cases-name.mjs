// Names: rare surnames, 2 and 5 words, Latin-first, no diacritics, in the page header, words that look like job titles
// or headings, other people's names first.
import { cv } from './helper.mjs';

const N = (id, tpl, fields, exp) => cv('name', id, tpl, fields, exp);

export const NAME_CASES = [
  // Two words
  N('nm-two-01', 'topcvModern', { n: 'Mã Lan', t: 'Nhân viên lễ tân', ct: ['0392 601 475', 'malan.letan@gmail.com'] }, [
    'Mã Lan',
    '0392601475',
    'malan.letan@gmail.com',
  ]),
  N('nm-two-02', 'topcv2col', { n: 'LÒ PẮN', t: 'Công nhân cơ khí', ct: ['0374 821 096', 'lopan.ck@gmail.com'] }, [
    'Lò Pắn',
    '0374821096',
    'lopan.ck@gmail.com',
  ]),
  N(
    'nm-two-03',
    'wordPlain',
    { n: 'Ung Vy', t: 'Tư vấn viên', ct: ['SĐT: 0795 230 648', 'Email: ungvy.tuvan@gmail.com'] },
    ['Ung Vy', '0795230648', 'ungvy.tuvan@gmail.com'],
  ),
  N(
    'nm-two-04',
    'canvaAbs',
    { n: 'Hầu Dính', t: 'Nhân viên giao hàng', ct: ['0832 519 764', 'haudinh.gh@gmail.com'] },
    ['Hầu Dính', '0832519764', 'haudinh.gh@gmail.com'],
  ),

  // Five words and more
  N(
    'nm-five-01',
    'topcvModern',
    { n: 'Nguyễn Phúc Bảo Châu Anh', t: 'Nhà báo', ct: ['0909 316 824', 'baochauanh.np@gmail.com'] },
    ['Nguyễn Phúc Bảo Châu Anh', '0909316824', 'baochauanh.np@gmail.com'],
  ),
  N(
    'nm-five-02',
    'topcv2col',
    { n: 'TÔN THẤT MINH QUANG HUY', t: 'Kỹ sư điện', ct: ['0368 247 910', 'minhquanghuy.tt@gmail.com'] },
    ['Tôn Thất Minh Quang Huy', '0368247910', 'minhquanghuy.tt@gmail.com'],
  ),
  N(
    'nm-five-03',
    'canvaHero',
    {
      n: 'CÔNG TẰNG TÔN NỮ HOA',
      nameLines: ['CÔNG TẰNG', 'TÔN NỮ HOA'],
      t: 'Giảng viên',
      ct: ['0918 402 763', 'ctnhoa.gv@gmail.com'],
    },
    ['Công Tằng Tôn Nữ Hoa', '0918402763', 'ctnhoa.gv@gmail.com'],
  ),
  N(
    'nm-five-04',
    'wordTable',
    { n: 'Trần Lê Nguyễn Thảo Vy', t: 'Kế toán viên', ct: ['0345 180 627', 'thaovy.tln@gmail.com'] },
    ['Trần Lê Nguyễn Thảo Vy', '0345180627', 'thaovy.tln@gmail.com'],
  ),
  N(
    'nm-five-05',
    'rightSide',
    {
      lang: 'novn',
      n: 'Hoang Phu Ngoc Bao Tram',
      t: 'Nhan vien hanh chinh',
      ct: ['0817 690 253', 'baotram.hp@gmail.com'],
    },
    ['Hoang Phu Ngoc Bao Tram', '0817690253', 'baotram.hp@gmail.com'],
  ),

  // Minority and very rare surnames
  N(
    'nm-rare-01',
    'vnwExport',
    { n: "KSOR H'BLIN", t: 'Nhân Viên Y Tế', ct: ['Điện thoại: 0386 702 519', 'Email: ksorhblin@gmail.com'] },
    ["Ksor H'Blin", '0386702519', 'ksorhblin@gmail.com'],
  ),
  N('nm-rare-02', 'topcvModern', { n: 'Y Bhim Niê', t: 'Hướng dẫn viên', ct: ['0777 362 041', 'ybhimnie@gmail.com'] }, [
    'Y Bhim Niê',
    '0777362041',
    'ybhimnie@gmail.com',
  ]),
  N(
    'nm-rare-03',
    'wordPlain',
    { n: 'Rơ Châm Hờ Nhiên', t: 'Giáo viên mầm non', ct: ['ĐT: 0335 847 120', 'Email: rocham.nhien@gmail.com'] },
    ['Rơ Châm Hờ Nhiên', '0335847120', 'rocham.nhien@gmail.com'],
  ),
  N(
    'nm-rare-04',
    'atsEn',
    { lang: 'en', n: 'Giang A Pao', t: 'Forest Ranger', ct: ['0859 104 736', 'giangapao@gmail.com'] },
    ['Giang A Pao', '0859104736', 'giangapao@gmail.com'],
  ),
  N('nm-rare-05', 'threeCol', { n: 'Sùng Thị Mỷ', t: 'Cán bộ xã', ct: ['0365 972 480', 'sungthimy@gmail.com'] }, [
    'Sùng Thị Mỷ',
    '0365972480',
    'sungthimy@gmail.com',
  ]),
  N('nm-rare-06', 'iconRow', { n: 'Danh Sóc Kha', t: 'Thợ điện', ct: ['0792 638 105', 'danhsockha@gmail.com'] }, [
    'Danh Sóc Kha',
    '0792638105',
    'danhsockha@gmail.com',
  ]),
  N(
    'nm-rare-07',
    'topcv2col',
    { n: 'Mùa Xuân Chi', t: 'Nhân viên nông nghiệp', ct: ['0827 340 196', 'muaxuanchi@gmail.com'] },
    ['Mùa Xuân Chi', '0827340196', 'muaxuanchi@gmail.com'],
  ),
  N('nm-rare-08', 'canvaAbs', { n: 'Khổng Tú Quyên', t: 'Ca sĩ', ct: ['0913 760 482', 'khongtuquyen@gmail.com'] }, [
    'Khổng Tú Quyên',
    '0913760482',
    'khongtuquyen@gmail.com',
  ]),

  // No diacritics, Latin-first (given name first), western forms
  N(
    'nm-latin-01',
    'atsEn',
    { lang: 'en', n: 'Thu Ha Pham', t: 'Project Coordinator', ct: ['0984 206 713', 'thuha.pham.work@gmail.com'] },
    ['Thu Ha Pham', '0984206713', 'thuha.pham.work@gmail.com'],
  ),
  N(
    'nm-latin-02',
    'canvaHero',
    { lang: 'en', n: 'Duc Minh Hoang', t: 'UX Designer', ct: ['0356 410 928', 'ducminh.hoang.ux@gmail.com'] },
    ['Duc Minh Hoang', '0356410928', 'ducminh.hoang.ux@gmail.com'],
  ),
  N(
    'nm-latin-03',
    'topcvModern',
    { lang: 'en', n: 'Vy Le', t: 'Account Executive', ct: ['0705 239 164', 'vy.le.ae@gmail.com'] },
    ['Vy Le', '0705239164', 'vy.le.ae@gmail.com'],
  ),
  N(
    'nm-latin-04',
    'wordPlain',
    {
      lang: 'en',
      n: 'NGUYEN, Van Toan',
      t: 'Mechanical Engineer',
      ct: ['Tel: 0962 408 175', 'Email: vantoan.ng@gmail.com'],
      nameConverted: true,
      note: 'surname, comma, given names: expected without the comma',
    },
    ['Nguyen Van Toan', '0962408175', 'vantoan.ng@gmail.com'],
  ),
  N(
    'nm-latin-05',
    'rightSide',
    { lang: 'en', n: 'Kevin Tran', t: 'Sales Manager', ct: ['0903 625 481', 'kevin.tran.sales@gmail.com'] },
    ['Kevin Tran', '0903625481', 'kevin.tran.sales@gmail.com'],
  ),
  N(
    'nm-latin-06',
    'iconRow',
    { n: 'Anna Lê Thảo', t: 'Chuyên viên đối ngoại', ct: ['0931 806 247', 'anna.lethao@gmail.com'] },
    ['Anna Lê Thảo', '0931806247', 'anna.lethao@gmail.com'],
  ),
  N(
    'nm-latin-07',
    'topcv2col',
    {
      lang: 'en',
      n: 'Thao-Vy Dang',
      t: 'Recruiter',
      ct: ['0334 720 186', 'thaovy.dang.hr@gmail.com'],
      note: 'hyphen kept as written',
    },
    ['Thao-Vy Dang', '0334720186', 'thaovy.dang.hr@gmail.com'],
  ),
  N(
    'nm-latin-08',
    'vnwExport',
    {
      lang: 'novn',
      n: 'TRINH THI NGOC DIEP',
      t: 'Nhan Vien Ke Toan',
      brand: ['HO SO UNG VIEN', 'Ma ho so: 7741029'],
      ct: ['Dien thoai: 0813 572 940', 'Email: ngocdiep.tt@gmail.com'],
    },
    ['Trinh Thi Ngoc Diep', '0813572940', 'ngocdiep.tt@gmail.com'],
  ),
  N(
    'nm-latin-09',
    'threeCol',
    { lang: 'novn', n: 'Luu Bao Khanh', t: 'Ky thuat vien', ct: ['0345 216 708', 'baokhanh.luu@gmail.com'] },
    ['Luu Bao Khanh', '0345216708', 'baokhanh.luu@gmail.com'],
  ),
  N(
    'nm-latin-10',
    'wordTable',
    { lang: 'novn', n: 'Mac Dinh Quy', t: 'Quan ly kho', ct: ['DT: 0975 643 180', 'Mail: dinhquy.mac@gmail.com'] },
    ['Mac Dinh Quy', '0975643180', 'dinhquy.mac@gmail.com'],
  ),
  N(
    'nm-latin-11',
    'canvaAbs',
    { lang: 'novn', n: 'CU THI HANG', t: 'Nhan vien spa', ct: ['0388 450 917', 'cuthihang@gmail.com'] },
    ['Cu Thi Hang', '0388450917', 'cuthihang@gmail.com'],
  ),

  // Prefixes around the name
  N(
    'nm-prefix-01',
    'atsEn',
    { lang: 'en', n: 'Mr. Tran Quoc Dung', t: 'Regional Director', ct: ['0986 271 503', 'quocdung.tran.rd@gmail.com'] },
    ['Tran Quoc Dung', '0986271503', 'quocdung.tran.rd@gmail.com'],
  ),
  N(
    'nm-prefix-02',
    'wordPlain',
    { n: 'ThS. Phạm Hồng Loan', t: 'Giảng viên kinh tế', ct: ['0916 503 748', 'hongloan.ths@gmail.com'] },
    ['Phạm Hồng Loan', '0916503748', 'hongloan.ths@gmail.com'],
  ),
  N(
    'nm-prefix-03',
    'wordTable',
    { n: 'KS. Đặng Công Thành', t: 'Kỹ sư xây dựng', ct: ['0342 816 075', 'congthanh.ks@gmail.com'] },
    ['Đặng Công Thành', '0342816075', 'congthanh.ks@gmail.com'],
  ),
  N(
    'nm-prefix-04',
    'canvaHero',
    {
      n: 'Lê Hoàng Yến',
      hello: 'Xin chào, tôi là',
      t: 'Thiết kế nội thất',
      ct: ['0708 924 316', 'hoangyen.noithat@gmail.com'],
    },
    ['Lê Hoàng Yến', '0708924316', 'hoangyen.noithat@gmail.com'],
  ),
  N(
    'nm-prefix-05',
    'wordPlain',
    { n: 'CV - Bùi Tuấn Kiệt', t: 'Nhân viên IT', ct: ['0869 301 572', 'tuankiet.bui.it@gmail.com'] },
    ['Bùi Tuấn Kiệt', '0869301572', 'tuankiet.bui.it@gmail.com'],
  ),
  N(
    'nm-prefix-06',
    'wordPlain',
    {
      n: 'CV_Nguyen_Hoai_Phuong',
      lang: 'novn',
      t: 'Nhan vien tham dinh',
      ct: ['0396 584 017', 'hoaiphuong.tham@gmail.com'],
      nameConverted: true,
      note: 'underscores in the visible title; a human reads the name',
    },
    ['Nguyen Hoai Phuong', '0396584017', 'hoaiphuong.tham@gmail.com'],
  ),
  N(
    'nm-prefix-07',
    'topcvModern',
    { n: 'Trương Minh Trí – Kế Toán Trưởng', ct: ['0947 026 381', 'minhtri.ktt@gmail.com'] },
    ['Trương Minh Trí', '0947026381', 'minhtri.ktt@gmail.com'],
  ),
  N(
    'nm-prefix-08',
    'wordPlain',
    { n: 'Hồ Lệ Quyên (Ms.)', t: 'Sales Admin', ct: ['0376 481 502', 'lequyen.ho@gmail.com'] },
    ['Hồ Lệ Quyên', '0376481502', 'lequyen.ho@gmail.com'],
  ),
  N(
    'nm-prefix-09',
    'wordPlain',
    { n: 'Họ và tên: NGÔ THANH TÙNG', t: 'Nhân viên kỹ thuật', ct: ['0912 750 346', 'ngothanhtung.kt@gmail.com'] },
    ['Ngô Thanh Tùng', '0912750346', 'ngothanhtung.kt@gmail.com'],
  ),

  // Name only in the page header or footer area
  N(
    'nm-header-01',
    'wordHeader',
    {
      hdr: 'Trịnh Bảo Châu',
      dt: 'SƠ YẾU LÝ LỊCH',
      t: 'Nhân viên hành chính nhân sự',
      ct: ['Điện thoại: 0983 417 260', 'Email: baochau.trinh@gmail.com'],
    },
    ['Trịnh Bảo Châu', '0983417260', 'baochau.trinh@gmail.com'],
  ),
  N(
    'nm-header-02',
    'wordHeader',
    {
      hdr: 'CV - Vũ Thị Hương Giang',
      t: 'Chuyên viên đào tạo',
      ct: ['0356 021 794', 'huonggiang.vu@gmail.com'],
      ftr: 'Trang 1',
    },
    ['Vũ Thị Hương Giang', '0356021794', 'huonggiang.vu@gmail.com'],
  ),
  N(
    'nm-header-03',
    'wordHeader',
    {
      lang: 'en',
      hdr: 'Curriculum Vitae of Le Khanh Toan',
      t: 'Supply Chain Planner',
      ct: ['Mobile: 0937 582 610', 'Email: khanhtoan.le.scp@gmail.com'],
    },
    ['Le Khanh Toan', '0937582610', 'khanhtoan.le.scp@gmail.com'],
  ),
  N(
    'nm-header-04',
    'wordHeader',
    {
      ftr: 'Đoàn Thu Thảo – 2026',
      dt: 'HỒ SƠ ỨNG TUYỂN',
      t: 'Chuyên viên tín dụng',
      ct: ['ĐT: 0795 180 324', 'Mail: thuthao.doan.td@gmail.com'],
      note: 'name only in the page footer',
    },
    ['Đoàn Thu Thảo', '0795180324', 'thuthao.doan.td@gmail.com'],
  ),
  N(
    'nm-header-05',
    'wordHeader',
    {
      hdr: 'Công ty Cổ phần Nhân lực Hoa Sen',
      n: 'Phan Anh Dũng',
      t: 'Trưởng ca sản xuất',
      ct: ['0868 349 072', 'anhdung.phan.sx@gmail.com'],
      note: "staffing agency's name in the page header",
    },
    ['Phan Anh Dũng', '0868349072', 'anhdung.phan.sx@gmail.com'],
  ),
  N(
    'nm-header-06',
    'wordHeader',
    {
      docTitle: 'CV Hà Quang Minh',
      dt: 'HỒ SƠ CÁ NHÂN',
      t: 'Kế toán công nợ',
      ct: ['0334 906 815', 'quangminh.ketoan@gmail.com'],
      note: 'name only in PDF metadata, not in the text layer',
    },
    [null, '0334906815', 'quangminh.ketoan@gmail.com'],
  ),

  // Names made of ordinary words: jobs, sections, places
  N(
    'nm-word-01',
    'topcvModern',
    { n: 'Nguyễn Văn Phòng', t: 'Nhân viên văn phòng', ct: ['0964 208 317', 'vanphong.nguyen@gmail.com'] },
    ['Nguyễn Văn Phòng', '0964208317', 'vanphong.nguyen@gmail.com'],
  ),
  N(
    'nm-word-02',
    'topcv2col',
    { n: 'TRẦN THỊ TRƯỜNG', t: 'Nghiên cứu thị trường', ct: ['0345 716 028', 'thitruong.tran@gmail.com'] },
    ['Trần Thị Trường', '0345716028', 'thitruong.tran@gmail.com'],
  ),
  N(
    'nm-word-03',
    'wordPlain',
    { font: 'Palatino', n: 'Phan Kế Toán', t: 'Kế toán tổng hợp', ct: ['0702 395 186', 'ketoan.phan@gmail.com'] },
    ['Phan Kế Toán', '0702395186', 'ketoan.phan@gmail.com'],
  ),
  N(
    'nm-word-04',
    'canvaAbs',
    { n: 'Mai Nhân Sự', t: 'Chuyên viên nhân sự', ct: ['0817 420 365', 'mainhansu@gmail.com'] },
    ['Mai Nhân Sự', '0817420365', 'mainhansu@gmail.com'],
  ),
  N(
    'nm-word-05',
    'canvaHero',
    { n: 'VŨ BẢO HIỂM', t: 'Tư vấn bảo hiểm', ct: ['0975 013 642', 'baohiem.vu@gmail.com'] },
    ['Vũ Bảo Hiểm', '0975013642', 'baohiem.vu@gmail.com'],
  ),
  N(
    'nm-word-06',
    'vnwExport',
    { n: 'Đoàn Thanh Niên', t: 'Cán Bộ Đoàn', ct: ['Điện thoại: 0398 620 417', 'Email: doanthanhnien.cb@gmail.com'] },
    ['Đoàn Thanh Niên', '0398620417', 'doanthanhnien.cb@gmail.com'],
  ),
  N('nm-word-07', 'threeCol', { n: 'Lâm Thiết Kế', t: 'Thiết kế web', ct: ['0932 574 806', 'lamthietke@gmail.com'] }, [
    'Lâm Thiết Kế',
    '0932574806',
    'lamthietke@gmail.com',
  ]),
  N('nm-word-08', 'wordTable', { n: 'Phạm Học Vấn', t: 'Giáo viên', ct: ['0869 742 051', 'hocvan.pham@gmail.com'] }, [
    'Phạm Học Vấn',
    '0869742051',
    'hocvan.pham@gmail.com',
  ]),
  N(
    'nm-word-09',
    'rightSide',
    { n: 'Bùi Kinh Doanh', t: 'Nhân viên kinh doanh', ct: ['0356 907 214', 'kinhdoanh.bui@gmail.com'] },
    ['Bùi Kinh Doanh', '0356907214', 'kinhdoanh.bui@gmail.com'],
  ),
  N(
    'nm-word-10',
    'iconRow',
    { n: 'Hồ Mục Tiêu', t: 'Quản lý chất lượng', ct: ['0784 216 390', 'muctieu.ho@gmail.com'] },
    ['Hồ Mục Tiêu', '0784216390', 'muctieu.ho@gmail.com'],
  ),
  N(
    'nm-word-11',
    'topcvModern',
    {
      n: 'Nguyễn Bình Dương',
      t: 'Nhân viên giao nhận',
      ct: ['0902 714 386', 'binhduong.ng@gmail.com'],
      ab: ['Bình Dương, Việt Nam'],
    },
    ['Nguyễn Bình Dương', '0902714386', 'binhduong.ng@gmail.com'],
  ),
  N(
    'nm-word-12',
    'atsEn',
    { lang: 'en', n: 'Le Van Thu', t: 'Office Clerk', ct: ['0921 350 847', 'levanthu.clerk@gmail.com'] },
    ['Le Van Thu', '0921350847', 'levanthu.clerk@gmail.com'],
  ),
  N(
    'nm-word-13',
    'wordPlain',
    { n: 'Kim Ngân Hà', t: 'Giao dịch viên ngân hàng', ct: ['0339 482 106', 'kimnganha.gdv@gmail.com'] },
    ['Kim Ngân Hà', '0339482106', 'kimnganha.gdv@gmail.com'],
  ),

  // Lines before the name that look like a name
  N(
    'nm-first-01',
    'wordPlain',
    { ab: ['KẾ TOÁN TỔNG HỢP'], n: 'Nguyễn Thị Lành', ct: ['0845 930 216', 'nguyenthilanh.kt@gmail.com'] },
    ['Nguyễn Thị Lành', '0845930216', 'nguyenthilanh.kt@gmail.com'],
  ),
  N(
    'nm-first-02',
    'wordPlain',
    { ab: ['Trợ Lý Giám Đốc'], n: 'Võ Thanh Phong', ct: ['0916 374 028', 'thanhphong.vo.tl@gmail.com'] },
    ['Võ Thanh Phong', '0916374028', 'thanhphong.vo.tl@gmail.com'],
  ),
  N(
    'nm-first-03',
    'wordPlain',
    { font: 'Palatino', ab: ['Nhân Viên Bán Hàng'], n: 'Đinh Thị Nở', ct: ['0363 208 549', 'dinhthino.bh@gmail.com'] },
    ['Đinh Thị Nở', '0363208549', 'dinhthino.bh@gmail.com'],
  ),
  N(
    'nm-first-04',
    'canvaAbs',
    {
      n: 'Lý Thu Trang',
      t: 'Thanh Toán Viên',
      ct: ['0797 516 304', 'thutrang.ly.tt@gmail.com'],
      order: ['title', 'name', 'contact', 'summary', 'exp', 'edu', 'skills'],
    },
    ['Lý Thu Trang', '0797516304', 'thutrang.ly.tt@gmail.com'],
  ),
  N(
    'nm-first-05',
    'topcvModern',
    {
      ab: ['Minh Long Logistics'],
      n: 'Đỗ Thị Hải',
      t: 'Nhân viên chứng từ',
      ct: ['0986 340 712', 'dothihai.ct@gmail.com'],
      note: 'company name in title case above the candidate',
    },
    ['Đỗ Thị Hải', '0986340712', 'dothihai.ct@gmail.com'],
  ),
  N(
    'nm-first-06',
    'wordPlain',
    {
      font: 'Palatino',
      ab: ['Hà Nội, ngày 20 tháng 9 năm 2026'],
      n: 'Trần Đại Nghĩa',
      t: 'Chuyên viên kiểm toán',
      ct: ['0912 605 437', 'dainghia.kt@gmail.com'],
    },
    ['Trần Đại Nghĩa', '0912605437', 'dainghia.kt@gmail.com'],
  ),
  N(
    'nm-first-07',
    'wordHeader',
    {
      ab: ['Thành Phố Hồ Chí Minh'],
      n: 'Tạ Quốc Bảo',
      t: 'Quản lý cửa hàng',
      ct: ['0325 790 184', 'quocbao.ta@gmail.com'],
    },
    ['Tạ Quốc Bảo', '0325790184', 'quocbao.ta@gmail.com'],
  ),
  N(
    'nm-first-08',
    'topcv2col',
    {
      ab: ['Phạm Thị Liên – Trưởng phòng Nhân sự', 'Công ty TNHH Thời Trang Lụa Hà', 'Người giới thiệu'],
      n: 'Nghiêm Hồng Sơn',
      t: 'Nhân viên may mẫu',
      ct: ['0702 136 485', 'hongson.nghiem@gmail.com'],
      note: "referrer's name in the sidebar, before the candidate",
    },
    ['Nghiêm Hồng Sơn', '0702136485', 'hongson.nghiem@gmail.com'],
  ),
  N(
    'nm-first-09',
    'wordPlain',
    {
      dt: 'GIỚI THIỆU BẢN THÂN',
      n: 'Ninh Thế Anh',
      t: 'Quản trị mạng',
      ct: ['0335 610 784', 'theanh.ninh.it@gmail.com'],
    },
    ['Ninh Thế Anh', '0335610784', 'theanh.ninh.it@gmail.com'],
  ),

  // Name elsewhere: labelled form, only in the signature, image only
  N(
    'nm-where-01',
    'formDots',
    {
      form: [
        'Họ tên cha: Ngô Văn Tám – Nghề nghiệp: Nông dân',
        'Họ tên mẹ: Trần Thị Hai',
        'Họ và tên: Ngô Bá Khá',
        'Điện thoại: 0855 407 321',
        'Email: ngobakha.work@gmail.com',
      ],
      note: "parents' names before the candidate's",
    },
    ['Ngô Bá Khá', '0855407321', 'ngobakha.work@gmail.com'],
  ),
  N(
    'nm-where-02',
    'wordPlain',
    {
      font: 'Palatino',
      dt: 'HỒ SƠ CÁ NHÂN',
      ct: ['Điện thoại: 0348 561 720', 'Email: hanhnguyen.kd@gmail.com'],
      after: ['Tôi xin cam đoan những lời khai trên là đúng sự thật.', 'Người khai', 'Lưu Hạnh Nguyên'],
      note: 'name only in the closing signature',
    },
    ['Lưu Hạnh Nguyên', '0348561720', 'hanhnguyen.kd@gmail.com'],
  ),
  N(
    'nm-where-03',
    'topcvModern',
    {
      imgName: 'Hoàng Tuấn Minh',
      t: 'Nhân viên phân tích',
      ct: ['0987 260 351', 'tuanminh.hoang.pt@gmail.com'],
      note: 'name is an image',
    },
    [null, '0987260351', 'tuanminh.hoang.pt@gmail.com'],
  ),
  N(
    'nm-where-04',
    'iconRow',
    {
      imgName: 'Tống Thùy Linh',
      t: 'Trưởng Phòng Kế Hoạch',
      ct: ['0836 104 275', 'thuylinh.tong.kh@gmail.com'],
      note: 'name is an image, title case job line remains',
    },
    [null, '0836104275', 'thuylinh.tong.kh@gmail.com'],
  ),
  N(
    'nm-where-05',
    'wordPlain',
    {
      dt: 'Hồ Sơ Năng Lực',
      t: 'Giám Sát Bán Hàng',
      ct: ['0966 725 408', 'giamsat.banhang.mt@gmail.com'],
      note: 'no name anywhere, only heading and job title in title case',
    },
    [null, '0966725408', 'giamsat.banhang.mt@gmail.com'],
  ),
  N(
    'nm-where-06',
    'coverThenCv',
    {
      n: 'Ngô Đức Anh',
      t: 'Chuyên viên tuyển dụng',
      ct: ['Điện thoại: 0978 613 025', 'Email: ducanh.ngo.hr@gmail.com'],
      letter: [
        'Kính gửi: Ông Lê Minh Phương – Trưởng phòng Nhân sự, Công ty CP Địa Ốc Phú Khang',
        'Hà Nội, ngày 02 tháng 10 năm 2026',
        'Tôi rất mong được phỏng vấn cho vị trí đang tuyển.',
        'Trân trọng,',
      ],
    },
    ['Ngô Đức Anh', '0978613025', 'ducanh.ngo.hr@gmail.com'],
  ),
  N(
    'nm-where-07',
    'coverThenCv',
    {
      n: 'Thái Minh Hiếu',
      t: 'Lập trình viên',
      ct: ['SĐT: 0347 825 610', 'Email: minhhieu.thai.dev@gmail.com'],
      letter: [
        'Kính gửi: Bà Hoàng Thị Yến, Giám đốc Nhân sự',
        'Email: tuyendung@maytrangsoft.example – Hotline: 0903 714 628',
        'Tôi tên là Thái Minh Hiếu, ứng tuyển vị trí lập trình viên.',
        'Trân trọng,',
        'Thái Minh Hiếu',
      ],
    },
    ['Thái Minh Hiếu', '0347825610', 'minhhieu.thai.dev@gmail.com'],
  ),
  N(
    'nm-where-08',
    'coverThenCv',
    {
      lang: 'en',
      n: 'Lam Bich Ngoc',
      t: 'Customer Support',
      ct: ['Tel: 0868 420 137', 'Email: bichngoc.lam.cs@gmail.com'],
      letter: [
        'Dear Mr. Pham Anh Tuan,',
        'Head of Talent, Seagull Shipping JSC',
        'careers@seagullship.example | 0918 630 275',
        'I am writing to apply for the support role.',
        'Yours sincerely,',
      ],
    },
    ['Lam Bich Ngoc', '0868420137', 'bichngoc.lam.cs@gmail.com'],
  ),
];
