// Phones in every format one person might type them. Expected: own mobile as 0xxxxxxxxx.
import { cv } from './helper.mjs';

const TPLS = [
  'topcvModern',
  'topcv2col',
  'wordPlain',
  'canvaAbs',
  'threeCol',
  'rightSide',
  'iconRow',
  'wordTable',
  'canvaHero',
  'vnwExport',
  'atsEn',
];
let turn = 0;
const nextTpl = () => TPLS[turn++ % TPLS.length];

/** One format probe: `line` is what the CV prints, `want` what a human dials. */
const F = (id, name, line, email, want, extra = {}) =>
  cv(
    'phone',
    id,
    extra.tpl ?? nextTpl(),
    { n: name, t: 'Nhân viên kỹ thuật', ct: [line, `Email: ${email}`], ...extra },
    [name, want, email],
  );

/** The name in an expected value is the same as printed; use a converted-number marker for old 11-digit numbers. */
const OLD = (id, name, line, email, want, verbatim) =>
  F(id, name, line, email, want, {
    phoneConverted: true,
    alt: { phone: [verbatim] },
    note: 'old 11-digit number: the 2018 10-digit form is expected, the number as printed is accepted too',
  });

export const PHONE_CASES = [
  // International prefixes
  F('ph-intl-01', 'Lương Trọng Hiển', 'SĐT: +84 386 524 917', 'tronghien.luong@gmail.com', '0386524917'),
  F('ph-intl-02', 'Hà Mỹ Tâm', 'Điện thoại: +84397105264', 'mytam.ha.work@gmail.com', '0397105264'),
  F('ph-intl-03', 'Đặng Phú Quý', 'Tel: 84 97 318 6402', 'phuquy.dang@gmail.com', '0973186402'),
  F('ph-intl-04', 'Trần Mộng Thường', 'Di động: 84-703-118-264', 'mongthuong.tran@gmail.com', '0703118264'),
  F('ph-intl-05', 'Võ Tấn Lộc', 'Phone: 0084 936 207 518', 'tanloc.vo.work@gmail.com', '0936207518'),
  F('ph-intl-06', 'Trần Bảo Trâm', 'SĐT: (+84) 58 742 3190', 'baotram.tran58@gmail.com', '0587423190'),
  F('ph-intl-07', 'Phan Đình Lâm', 'ĐT: (84) 889 640 271', 'dinhlam.phan@gmail.com', '0889640271'),
  F('ph-intl-08', 'Ngô Xuân Nghi', 'Mobile: +84.91.355.2076', 'xuannghi.ngo@gmail.com', '0913552076'),
  F('ph-intl-09', 'Hoàng Trung Kiên', 'Tel: +84 (0)832 719 046', 'trungkien.hg@gmail.com', '0832719046'),
  F('ph-intl-10', 'Lê Thái Sơn', 'ĐT: +84 0 775 301 682', 'thaison.le.tech@gmail.com', '0775301682'),
  F('ph-intl-11', 'Bùi Yến Nhi', 'Số điện thoại: +840796114853', 'yennhi.bui.vn@gmail.com', '0796114853'),

  // Domestic groupings
  F('ph-group-01', 'Phạm Quang Hải', '039 428 1765', 'quanghai.pham21@gmail.com', '0394281765'),
  F('ph-group-02', 'Nguyễn Khánh Vân', '0845 162 907', 'khanhvan.ng@gmail.com', '0845162907'),
  F('ph-group-03', 'Vũ Đức Trọng', 'ĐT: 076.318.2945', 'ductrong.vu@gmail.com', '0763182945'),
  F('ph-group-04', 'Đỗ Hiền Lương', 'ĐT: 0909.417.236', 'hienluong.do@gmail.com', '0909417236'),
  F('ph-group-05', 'Hồ Tấn Tài', 'SĐT: (090) 417 5563', 'tantai.ho@gmail.com', '0904175563'),
  F('ph-group-06', 'Dương Thục Quyên', 'SĐT: (0378) 256 109', 'thucquyen.duong@gmail.com', '0378256109'),
  F('ph-group-07', 'Lê Trí Dũng', 'Tel: 098-231-7740', 'tridung.le@gmail.com', '0982317740'),
  F('ph-group-08', 'Trần Thu Sương', '09 64 28 17 35', 'thusuong.tran@gmail.com', '0964281735'),
  F('ph-group-09', 'Mai Hữu Phước', 'ĐT: 0355 84 96 12', 'huuphuoc.mai@gmail.com', '0355849612'),
  F('ph-group-10', 'Nguyễn Đăng Khoa', 'ĐT:0942680173', 'dangkhoa.ng.work@gmail.com', '0942680173'),
  F('ph-group-11', 'Cao Thùy Dung', 'Phone number - 0961 348 205', 'thuydung.cao@gmail.com', '0961348205'),
  F('ph-group-12', 'Tô Hoài Nam', 'Mobile:   0923 614 708 (gọi sau 18h)', 'hoainam.to@gmail.com', '0923614708'),
  F('ph-group-13', 'Trương Mỹ Lan Chi', 'ĐT: 0327\u00a0604\u00a0918', 'mylanchi.tr@gmail.com', '0327604918', {
    note: 'no-break spaces between the groups',
  }),
  F('ph-group-14', 'Đinh Gia Huy', 'SĐT: 0 8 6 7 3 1 9 5 2 4', 'giahuy.dinh.dt@gmail.com', '0867319524', {
    note: 'digits typed apart',
  }),
  F('ph-group-15', 'Lý Nhã Uyên', 'SĐT: ０７０５ ２１８ ４６３', 'nhauyen.ly@gmail.com', '0705218463', {
    note: 'full-width digits',
  }),

  // Old 11-digit numbers
  OLD('ph-old-01', 'Trần Tuấn Vũ', 'SĐT: 0166 241 8903', 'tuanvu.tran.old@gmail.com', '0362418903', '01662418903'),
  OLD('ph-old-02', 'Lê Thị Bích Thủy', 'ĐT: 0122.654.7180', 'bichthuy.le.old@gmail.com', '0776547180', '01226547180'),
  OLD(
    'ph-old-03',
    'Phạm Ngọc Sáng',
    'Mobile: +84 169 620 5481',
    'ngocsang.pham.old@gmail.com',
    '0396205481',
    '01696205481',
  ),
  OLD('ph-old-04', 'Hà Thanh Bình', '0168 927 4510', 'thanhbinh.ha.old@gmail.com', '0389274510', '01689274510'),
  OLD('ph-old-05', 'Nguyễn Hữu Tín', 'Tel: 0129-8830-417', 'huutin.ng.old@gmail.com', '0828830417', '01298830417'),

  // Landline beside mobile
  F('ph-land-01', 'Đặng Minh Thư', 'ĐT: (028) 3862 4417 – DĐ: 0934 508 261', 'minhthu.dang.hr@gmail.com', '0934508261'),
  F('ph-land-02', 'Vũ Tiến Đạt', 'Mobile: 0981 275 430 | Tel: 024 3728 6190', 'tiendat.vu.it@gmail.com', '0981275430'),
  F('ph-land-03', 'Bùi Hạnh Dung', '024.3562.8817 / 0356 902 174', 'hanhdung.bui@gmail.com', '0356902174'),
  F(
    'ph-land-04',
    'Hoàng Quốc Toản',
    'Tel: +84 28 3911 7042 · Cell: +84 817 360 295',
    'quoctoan.hoang@gmail.com',
    '0817360295',
  ),
  F('ph-land-05', 'Phan Thúy Nga', 'Điện thoại nhà: (0236) 382 6140', 'thuynga.phan@gmail.com', null, {
    note: 'only a home landline: README says mobile or null',
  }),
  F('ph-land-06', 'Nguyễn Trường Giang', 'ĐT cố định: 0283 910 4475', 'truonggiang.ng.kt@gmail.com', null, {
    note: 'only a landline; 028 3910 4475 written as 0283 910 4475 looks like a mobile group',
  }),

  // Two numbers of the candidate
  F('ph-two-01', 'Lê Bảo Long', '0916 402 785 / 0372 118 560', 'baolong.le.sale@gmail.com', '0916402785'),
  F(
    'ph-two-02',
    'Trần Ánh Nguyệt',
    'ĐT công việc: 0388 702 915; ĐT cá nhân: 0908 336 127',
    'anhnguyet.tran@gmail.com',
    '0908336127',
  ),
  F('ph-two-03', 'Đào Duy Tùng', 'Zalo: 0392 775 016', 'duytung.dao@gmail.com', '0392775016'),
  F('ph-two-04', 'Võ Thị Ngọc Hân', 'Zalo/Viber/Telegram: 0857.240.391', 'ngochan.vo@gmail.com', '0857240391'),
  F('ph-two-05', 'Hồ Sỹ Mạnh', 'Hotline: 0902 418 376', 'symanh.ho@gmail.com', '0902418376', {
    note: 'a freelancer labels his own mobile "Hotline"',
  }),

  // Wrapped or glued
  cv(
    'phone',
    'ph-glue-01',
    'wordPlain',
    {
      n: 'Hà Hoàng Long',
      t: 'Nhân viên kỹ thuật',
      ct: ['SĐT:0979420861Email:hoanglong.ha.kt@gmail.com'],
      note: 'phone and email glued on one line',
    },
    ['Hà Hoàng Long', '0979420861', 'hoanglong.ha.kt@gmail.com'],
  ),
  cv(
    'phone',
    'ph-glue-02',
    'topcv2col',
    {
      n: 'Nguyễn Tường Vi',
      t: 'Thư ký',
      ctHtml: '<div>Điện thoại: 0334<br>718 205</div><div>Email: tuongvi.ng.tk@gmail.com</div>',
      note: 'number wrapped mid-way',
    },
    ['Nguyễn Tường Vi', '0334718205', 'tuongvi.ng.tk@gmail.com'],
  ),
  cv(
    'phone',
    'ph-glue-03',
    'threeCol',
    {
      n: 'Trần Thế Hiển',
      t: 'Bảo trì',
      ctHtml: '<div>+84<br>964 170 825</div><div>thehien.tran.bt@gmail.com</div>',
      note: 'prefix on its own line',
    },
    ['Trần Thế Hiển', '0964170825', 'thehien.tran.bt@gmail.com'],
  ),

  // Numbers that are no real phone
  F('ph-bad-01', 'Lê Ngọc Diệp', 'SĐT: 0123 456 789', 'ngocdiep.le.mt@gmail.com', null, {
    note: 'template placeholder left in; 012x is no longer a mobile prefix',
  }),
  F('ph-bad-02', 'Nguyễn Công Danh', 'ĐT: 0912 345 67', 'congdanh.ng.td@gmail.com', null, {
    note: 'typo: one digit short',
  }),
  F('ph-bad-03', 'Trần Hải Triều', 'ĐT: 0987 654 3210', 'haitrieu.tran.td@gmail.com', null, {
    note: 'typo: 11 digits with a 09x prefix, no old 11-digit number looked like this',
  }),
  F('ph-bad-04', 'Phạm Hà My', 'SĐT: 09xx xxx 468', 'hamy.pham.td@gmail.com', null, { note: 'masked by the site' }),
  F('ph-bad-05', 'Đoàn Quý Mão', 'Phone: 0000 000 000', 'quymao.doan@gmail.com', null, { note: 'placeholder' }),
];
