// No contact details at all, image-only pages, blank forms, long files, restricted files.
import { cv } from './helper.mjs';
import { encryptedPdf } from './raw-pdf.mjs';

const Z = (id, tpl, fields, exp) => cv('none', id, tpl, fields, exp);

const SCAN = {
  ct: ['Điện thoại: 0939 482 017', 'Email: scan.hoso@gmail.com'],
  t: 'Nhân viên kế toán',
  unreadable: true,
  note: 'image only: text layer is empty',
};

export const NONE_CASES = [
  // Name but no contact
  Z('zz-nocontact-01', 'wordPlain', { n: 'Trần Thanh Hiền', t: 'Nhân viên kinh doanh' }, [
    'Trần Thanh Hiền',
    null,
    null,
  ]),
  Z(
    'zz-nocontact-02',
    'topcvModern',
    { n: 'NGUYỄN THỊ THÙY LINH', t: 'Kế toán viên', ct: ['Địa chỉ: 15 Lạch Tray, Hải Phòng'] },
    ['Nguyễn Thị Thùy Linh', null, null],
  ),
  Z('zz-nocontact-03', 'canvaAbs', { n: 'Cao Minh Đức', t: 'Thiết kế đồ họa', ct: ['behance.net/caominhduc'] }, [
    'Cao Minh Đức',
    null,
    null,
  ]),
  Z('zz-nocontact-04', 'atsEn', { lang: 'en', n: 'Lam Thuy Tien', t: 'Office Manager', ct: ['Da Lat, Vietnam'] }, [
    'Lam Thuy Tien',
    null,
    null,
  ]),
  Z(
    'zz-nocontact-05',
    'topcv2col',
    { n: 'Hồ Văn Khải', t: 'Thợ hàn', p: ['Ngày sinh: 04/07/1985', 'Chiều cao: 170 cm', 'Cân nặng: 65 kg'] },
    ['Hồ Văn Khải', null, null],
  ),
  Z('zz-nocontact-06', 'threeCol', { n: 'Đỗ Mai Phương', t: 'Sinh viên năm cuối', p: ['GPA: 3.42/4.00'] }, [
    'Đỗ Mai Phương',
    null,
    null,
  ]),

  // Contact only, or nothing at all
  Z(
    'zz-noname-01',
    'iconRow',
    { t: 'Lái xe tải', ct: ['0345 906 271', 'taixe.haidang@gmail.com'], note: 'no name in the text' },
    [null, '0345906271', 'taixe.haidang@gmail.com'],
  ),
  Z(
    'zz-noname-02',
    'wordPlain',
    {
      dt: 'CURRICULUM VITAE',
      t: 'Sales Representative',
      lang: 'en',
      ct: ['0792 106 348', 'nguyenvanan8899@gmail.com'],
      note: 'name appears only inside the address',
    },
    [null, '0792106348', 'nguyenvanan8899@gmail.com'],
  ),
  Z('zz-empty-01', 'wordPlain', { dt: 'KINH NGHIỆM LÀM VIỆC', note: 'experience page only' }, [null, null, null]),
  Z(
    'zz-empty-02',
    'wordPlain',
    { lang: 'en', dt: 'WORK EXPERIENCE', t: 'Project Manager', note: 'experience page only, English' },
    [null, null, null],
  ),
  Z(
    'zz-empty-03',
    'formDots',
    {
      form: [
        'Họ và tên: ...............................',
        'Ngày sinh: ...../...../........',
        'Điện thoại: .........................',
        'Email: ................................',
      ],
      note: 'blank form',
    },
    [null, null, null],
  ),
  Z(
    'zz-empty-04',
    'formDots',
    {
      dt: 'MẪU CV',
      form: ['HỌ VÀ TÊN', 'VỊ TRÍ ỨNG TUYỂN', 'Số điện thoại', 'Email', 'Địa chỉ'],
      note: 'template with its labels only',
    },
    [null, null, null],
  ),
  Z(
    'zz-empty-05',
    'wordPlain',
    { dt: 'GIẤY CHỨNG NHẬN', t: 'Hoàn thành khóa đào tạo An Toàn Lao Động', note: 'a certificate, no person named' },
    [null, null, null],
  ),

  // Scanned, image only
  Z('zz-scan-01', 'scan', { ...SCAN, n: 'Lưu Quang Vũ' }, [null, null, null]),
  Z('zz-scan-02', 'scan', { ...SCAN, n: 'Trần Thu Trang', scanPages: 2 }, [null, null, null]),
  Z('zz-scan-03', 'scan', { ...SCAN, n: 'Phan Quốc Hưng', lang: 'en' }, [null, null, null]),
  Z(
    'zz-scan-04',
    'scan',
    {
      ...SCAN,
      n: 'Hoàng Thu Thủy',
      unreadable: false,
      scanFooter: 'Scanned by CamScanner',
      note: 'image plus a scanner stamp in the text layer',
    },
    [null, null, null],
  ),
  Z(
    'zz-scan-05',
    'scan',
    {
      ...SCAN,
      n: 'Mai Thế Hiển',
      unreadable: false,
      scanFooter: 'Quét bằng Máy Quét Nhanh',
      note: 'scanner stamp in title case',
    },
    [null, null, null],
  ),
  Z(
    'zz-scan-06',
    'scan',
    { ...SCAN, n: 'Đoàn Bích Ngọc', unreadable: false, scanFooter: 'Trang 1/1', note: 'page number only' },
    [null, null, null],
  ),

  // Long files
  Z(
    'zz-long-01',
    'wordPlain',
    { pages: 3, n: 'Phạm Trung Khôi', t: 'Giám đốc dự án', ct: ['0903 481 276', 'trungkhoi.pham.gd@gmail.com'] },
    ['Phạm Trung Khôi', '0903481276', 'trungkhoi.pham.gd@gmail.com'],
  ),
  Z(
    'zz-long-02',
    'wordPlain',
    {
      pages: 18,
      n: 'Lê Hoài Vũ',
      t: 'Kiến trúc trưởng',
      after: ['Liên hệ: 0987 205 364', 'Email: hoaivu.le.kt@gmail.com'],
      minPages: 7,
      phoneConverted: true,
      emailConverted: true,
      note: 'contact only on the last page, beyond the 6 pages pdfText reads',
    },
    ['Lê Hoài Vũ', '0987205364', 'hoaivu.le.kt@gmail.com'],
  ),
  Z(
    'zz-long-03',
    'topcvModern',
    {
      pages: 2,
      n: 'Vũ Thị Yên',
      t: 'Trưởng phòng hành chính',
      ct: ['0334 620 197', 'thiyen.vu.hc@gmail.com'],
      rf: ['Ông Bùi Đại Thắng – Tổng giám đốc', '0913 407 625', 'thang.bui@songlampack.example'],
    },
    ['Vũ Thị Yên', '0334620197', 'thiyen.vu.hc@gmail.com'],
  ),

  // Owner-restricted: opens without a password, so the text is readable
  {
    focus: 'none',
    id: 'zz-restricted-01',
    tpl: 'raw',
    layout: 'owner-restricted PDF',
    lang: 'vi',
    raw: encryptedPdf(['Cu Hoang Thach', 'Ke toan vien', 'SDT: 0396 251 840', 'Email: hoangthach.cu@gmail.com'], {
      userPassword: '',
      ownerPassword: 'chu-so-huu',
    }),
    note: 'RC4 40-bit, empty user password',
    exp: ['Cu Hoang Thach', '0396251840', 'hoangthach.cu@gmail.com'],
  },
];
