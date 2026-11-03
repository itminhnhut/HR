// Several addresses, mailto, wrapped, spaced, uppercase. Expected: the candidate's own, lowercase.
import { cv } from './helper.mjs';

const TPLS = [
  'wordPlain',
  'topcvModern',
  'topcv2col',
  'rightSide',
  'threeCol',
  'canvaAbs',
  'wordTable',
  'canvaHero',
  'vnwExport',
];
let turn = 0;
const nextTpl = () => TPLS[turn++ % TPLS.length];

/** `lines` is what the CV prints in its contact block. */
const E = (id, name, phone, lines, email, extra = {}) =>
  cv('email', id, extra.tpl ?? nextTpl(), { n: name, t: 'Nhân viên hành chính', ct: lines, ...extra }, [
    name,
    phone,
    email,
  ]);

export const EMAIL_CASES = [
  // Several addresses
  E(
    'em-many-01',
    'Võ Đăng Quang',
    '0382 640 915'.replace(/ /g, ''),
    ['ĐT: 0382 640 915', 'Email công việc: quang.vo@thienanco.example', 'Email cá nhân: dangquang.vo91@gmail.com'],
    'dangquang.vo91@gmail.com',
  ),
  E(
    'em-many-02',
    'Lý Thanh Thảo',
    '0945170362',
    ['0945 170 362', 'Email: thanhthao.ly.vp@gmail.com', 'Work: thao.ly@vietphatlog.example'],
    'thanhthao.ly.vp@gmail.com',
  ),
  E(
    'em-many-03',
    'Hồ Minh Châu',
    '0817250493',
    ['0817 250 493', 'Company email: minhchau.ho@maytrangsoft.example', 'Personal email: chauho.personal@outlook.com'],
    'chauho.personal@outlook.com',
    { lang: 'en' },
  ),
  E(
    'em-many-04',
    'Phan Gia Linh',
    '0962504713',
    ['0962 504 713', 'Email trường: 20110456@sv.hoaphuong.edu.example', 'Email: gialinh.phan@yahoo.com'],
    'gialinh.phan@yahoo.com',
  ),
  E(
    'em-many-05',
    'Tạ Hữu Nghĩa',
    '0356281047',
    ['0356 281 047', 'huunghia.ta@gmail.com / huunghia.ta@outlook.com'],
    'huunghia.ta@gmail.com',
    {
      alt: { email: ['huunghia.ta@outlook.com'] },
      note: 'two own addresses, no label: first expected, second accepted',
    },
  ),
  E(
    'em-many-06',
    'Mai Quốc Khánh',
    '0703142865',
    ['0703 142 865', 'Email: quockhanh.mai.vp@gmail.com'],
    'quockhanh.mai.vp@gmail.com',
    {
      tpl: 'rightSide',
      j: ['Email công ty: info@hoanglongco.example', 'Liên hệ: support@hoanglongco.example'],
      note: 'company addresses in the main column, before the contact block',
    },
  ),
  E('em-many-07', 'Trần Thị Kiều', '0398571206', ['0398 571 206', 'kieu.tran.vp@gmail.com'], 'kieu.tran.vp@gmail.com', {
    tpl: 'topcv2col',
    rf: ['Bà Nguyễn Thị Lý – Trưởng phòng', 'Email: ly.nguyen@phukhangland.example'],
    note: "referee's address comes out before the name",
  }),
  E('em-many-08', 'Đỗ Bình An', '0935460187', ['0935 460 187'], null, {
    tpl: 'wordPlain',
    rf: ['Anh Trần Văn Sỹ – Trưởng nhóm', 'Email: sy.tran@luahafashion.example'],
    note: 'only the referee has an address',
  }),
  E('em-many-09', 'Lê Hải Nam', '0772046183', ['0772 046 183'], null, {
    tpl: 'rightSide',
    j: ['Gửi hồ sơ về: hr@hailuaco.example', 'Liên hệ công ty: lienhe@hailuaco.example'],
    note: 'only company addresses',
  }),
  E(
    'em-many-10',
    'Hoàng Thúy Hiền',
    '0327640581',
    ['0327 640 581', 'Email: thuyhien@phukhangland.example'],
    'thuyhien@phukhangland.example',
    { note: 'own work address only' },
  ),
  E(
    'em-many-11',
    'Vi Đức Hạnh',
    '0918206475',
    ['0918 206 475', 'Email: 19520481@sv.saokhue.edu.example'],
    '19520481@sv.saokhue.edu.example',
    { note: 'school address only' },
  ),
  E('em-many-12', 'Trần Tuệ Minh', '0868570214', ['0868 570 214', 'contact@tuemin.example'], 'contact@tuemin.example', {
    note: 'own personal domain',
  }),

  // mailto
  E(
    'em-mailto-01',
    'Ung Tiến Phát',
    '0342590718',
    ['0342 590 718', 'mailto:tienphat.ung@gmail.com'],
    'tienphat.ung@gmail.com',
  ),
  E('em-mailto-02', 'Lê Như Ý', '0853147260', ['0853 147 260', 'Email: MAILTO:NHUY.LE@GMAIL.COM'], 'nhuy.le@gmail.com'),
  cv(
    'email',
    'em-mailto-03',
    'wordPlain',
    {
      n: 'Đặng Lan Hương',
      t: 'Biên dịch',
      ctHtml: '<div>0917 482 603</div><div><a href="mailto:lanhuong.dang@gmail.com">Gửi email cho tôi</a></div>',
      note: 'address only in the link target, not in the text layer',
    },
    ['Đặng Lan Hương', '0917482603', null],
  ),
  cv(
    'email',
    'em-mailto-04',
    'topcvModern',
    {
      n: 'Nghiêm Thị Hải',
      t: 'Biên tập',
      ctHtml: '<div>0359 702 148</div><div><a href="mailto:ignore.this@gmail.com">haihiem.bt@gmail.com</a></div>',
      note: 'visible text and link differ; a human reads the visible one',
    },
    ['Nghiêm Thị Hải', '0359702148', 'haihiem.bt@gmail.com'],
  ),

  // Across lines
  cv(
    'email',
    'em-wrap-01',
    'topcv2col',
    {
      n: 'Nguyễn Hoàng Thiên Kim',
      t: 'Điều hành tour',
      ctHtml: '<div>0394 150 728</div><div>nguyenhoangthienkim.dulich<br>@gmail.com</div>',
    },
    ['Nguyễn Hoàng Thiên Kim', '0394150728', 'nguyenhoangthienkim.dulich@gmail.com'],
  ),
  cv(
    'email',
    'em-wrap-02',
    'threeCol',
    {
      n: 'Trương Thành Công',
      t: 'Nhân viên kinh doanh',
      ctHtml: '<div>0907 361 548</div><div>truongthanhcong.kinh<br>doanh2019@gmail.com</div>',
    },
    ['Trương Thành Công', '0907361548', 'truongthanhcong.kinhdoanh2019@gmail.com'],
  ),
  cv(
    'email',
    'em-wrap-03',
    'wordTable',
    {
      n: 'Mai Phương Trinh',
      t: 'Marketing',
      ctHtml: '<div>0764 218 035</div><div>maiphuongtrinh.vn@gma<br>il.com</div>',
    },
    ['Mai Phương Trinh', '0764218035', 'maiphuongtrinh.vn@gmail.com'],
  ),
  cv(
    'email',
    'em-wrap-04',
    'canvaAbs',
    {
      n: 'Lý Tiểu Long Vân',
      t: 'Thiết kế',
      ctHtml: '<div>0322 805 417</div><div>tieulongvan.design@<br>outlook.com</div>',
    },
    ['Lý Tiểu Long Vân', '0322805417', 'tieulongvan.design@outlook.com'],
  ),
  cv(
    'email',
    'em-wrap-05',
    'topcv2col',
    {
      n: 'Phạm Thị Hồng Nhung',
      t: 'Giao dịch viên',
      breakAll: true,
      ct: ['0975 208 164', 'phamthihongnhung.giaodichvien2021@gmail.com'],
      note: 'CSS breaks the long address anywhere',
    },
    ['Phạm Thị Hồng Nhung', '0975208164', 'phamthihongnhung.giaodichvien2021@gmail.com'],
  ),
  cv(
    'email',
    'em-wrap-06',
    'threeCol',
    {
      cols: 'bca',
      n: 'Hoàng Mạnh Hùng',
      t: 'Kho vận',
      breakAll: true,
      ctHtml: '<div>0348 921 760</div><div>Email:</div><div>hoangmanhhung.khovan</div><div>@yahoo.com.vn</div>',
    },
    ['Hoàng Mạnh Hùng', '0348921760', 'hoangmanhhung.khovan@yahoo.com.vn'],
  ),

  // Spaces and uppercase
  E('em-space-01', 'Vi Thị Lan', '0985316740', ['0985 316 740', 'thilan.vi @ gmail.com'], 'thilan.vi@gmail.com'),
  E(
    'em-space-02',
    'Hoàng Nhật Nam',
    '0373620918',
    ['0373 620 918', 'h o a n g . n a m @ g m a i l . c o m'],
    'hoang.nam@gmail.com',
  ),
  E('em-space-03', 'Đào Minh Quân', '0796402185', ['0796 402 185', 'minh.quan @gmail .com'], 'minh.quan@gmail.com'),
  E('em-space-04', 'Bạch Tuyết Mai', '0924508671', ['0924 508 671', 'tuyet.mai[at]gmail.com'], 'tuyet.mai@gmail.com', {
    emailConverted: true,
  }),
  E(
    'em-space-05',
    'Giáp Thanh Bình',
    '0839017264',
    ['0839 017 264', 'binh.giap (at) yahoo.com'],
    'binh.giap@yahoo.com',
    { emailConverted: true },
  ),
  E(
    'em-space-06',
    'Lục Ngọc Diệp',
    '0354720619',
    ['0354 720 619', 'ngoc.diep.luc at gmail dot com'],
    'ngoc.diep.luc@gmail.com',
    { emailConverted: true },
  ),
  E(
    'em-space-07',
    'Lã Trường Giang',
    '0906182537',
    ['0906 182 537', 'TRUONGGIANG.LA@GMAIL.COM'],
    'truonggiang.la@gmail.com',
  ),
  E(
    'em-space-08',
    'Cao Phương Uyên',
    '0784061325',
    ['0784 061 325', 'Email: PhuongUyen.Cao@Outlook.com'],
    'phuonguyen.cao@outlook.com',
  ),
  E('em-space-09', 'Bạch Thanh Bình', '0327185046', ['0327 185 046', 'thanh.bach@gmail,com'], 'thanh.bach@gmail.com', {
    emailConverted: true,
    note: 'comma typed instead of the dot',
  }),
  E(
    'em-space-10',
    'Hoàng Hải Yến',
    '0912640375',
    ['0912 640 375', 'Email: hai.yen92@gmail.com.'],
    'hai.yen92@gmail.com',
  ),
  E('em-space-11', 'Mã Linh Đan', '0345708162', ['0345 708 162', '<linh.ma@yahoo.com>'], 'linh.ma@yahoo.com'),
  E('em-space-12', 'Tô Trung Kiên', '0869305714', ['0869 305 714', 'kien.to+jobs@gmail.com'], 'kien.to+jobs@gmail.com'),
  E(
    'em-space-13',
    'Khổng Anh Tú',
    '0705926183',
    ['0705 926 183', 'anh-tu.khong@outlook.com'],
    'anh-tu.khong@outlook.com',
  ),
  E('em-space-14', 'Ngô Hà Thu', '0386240195', ['0386 240 195', 'hoa.ngo＠gmail.com'], 'hoa.ngo@gmail.com', {
    emailConverted: true,
    note: 'full-width at sign',
  }),
  cv(
    'email',
    'em-space-15',
    'wordPlain',
    {
      n: 'Thạch Thị Huệ',
      t: 'Kế toán',
      ct: ['SĐT: 0916 038 572', 'Email:hue.thach@gmail.comĐịa chỉ:12 Lê Lợi, Sóc Trăng'],
      note: 'next label glued to the address',
    },
    ['Thạch Thị Huệ', '0916038572', 'hue.thach@gmail.com'],
  ),
  E(
    'em-space-16',
    'Lương Tú Anh',
    '0394570126',
    ['0394 570 126', 'tuanh.luong@hotmail.com'],
    'tuanh.luong@hotmail.com',
  ),
  E(
    'em-space-17',
    'Đinh Hải Phong',
    '0833120694',
    ['0833 120 694', 'haiphong.dinh@icloud.com'],
    'haiphong.dinh@icloud.com',
  ),

  // Phone digits inside an address
  E(
    'em-digit-01',
    'Vũ Hoàng Ánh',
    '0386014275',
    ['0386 014 275', '0916480273.ha@gmail.com'],
    '0916480273.ha@gmail.com',
    { note: 'address starts with other digits; the labelled phone differs' },
  ),
  E('em-digit-02', 'Trần Quỳnh Như', null, ['0916480275@gmail.com'], '0916480275@gmail.com', {
    note: 'the address is a mobile number; no phone listed, so phone stays null (judgement call)',
  }),

  // Lookalikes and placeholders
  E(
    'em-none-01',
    'Phạm Tú Oanh',
    '0918730254',
    ['0918 730 254', 'Instagram: @tuoanh.design', 'medium.com/@tuoanh'],
    null,
    { note: 'handles only' },
  ),
  E(
    'em-none-02',
    'Đặng Tuấn Tài',
    '0347201856',
    ['0347 201 856', 'Telegram: @tuantai92', 'Skype: live:tuantai92'],
    null,
  ),
  E('em-none-03', 'Trần Ngọc Bích', '0902457316', ['0902 457 316', 'Email: email@gmail.com'], null, {
    note: 'template placeholder left in',
  }),
  E('em-none-04', 'Lê Duy Khánh', '0352407189', ['0352 407 189', 'Email: yourname@gmail.com'], null, {
    note: 'template placeholder left in',
  }),
  E('em-none-05', 'Nguyễn Hữu Bằng', null, ['SĐT: 09******418', 'Email: h***g@gmail.com'], null, {
    note: 'contact masked by the site; nothing usable',
  }),
  E('em-none-06', 'Võ Kim Chi', '0816203749', ['0816 203 749', 'Email: kimchi.vo.vp'], null, {
    note: 'incomplete address',
  }),
  E('em-foot-01', 'Phạm Thanh Lam', '0962073148', ['0962 073 148'], 'thanhlam.pham@gmail.com', {
    tpl: 'wordPlain',
    ft: ['Mọi liên hệ xin gửi về: thanhlam.pham@gmail.com'],
    note: 'address only in the closing line',
  }),
];
