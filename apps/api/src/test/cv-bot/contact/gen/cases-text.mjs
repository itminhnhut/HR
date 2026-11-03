// Text-only cases: extraction artefacts Chrome cannot produce, fed straight to parseCvContact. They stand in for PDFs
// from other writers (icon fonts, legacy Vietnamese fonts, OCR layers, interleaved columns); the path is text → parser.

const T = (id, layout, text, exp, extra = {}) => ({
  focus: 'text',
  id,
  layout: `text: ${layout}`,
  lang: 'vi',
  text,
  exp,
  ...extra,
});

export const TEXT_CASES = [
  // Icon-font glyphs (private use area) in place of labels
  T(
    'tx-pua-01',
    'icon font',
    'Ngô Thanh Vân\nChuyên viên truyền thông\n\uf095 0376 180 942\n\uf0e0 thanhvan.ngo.tt@gmail.com\n\uf041 Quận 10, TP.HCM\nKINH NGHIỆM\nCông ty CP Địa Ốc Phú Khang 2021 – 2025',
    ['Ngô Thanh Vân', '0376180942', 'thanhvan.ngo.tt@gmail.com'],
  ),
  T(
    'tx-pua-02',
    'icon font',
    '\uf007   Phạm Đình Khiêm\n\uf095   +84 917 042 385\n\uf0e0   dinhkhiem.pham@gmail.com\n\uf0ac   dinhkhiem.example\nHỌC VẤN\nĐại học Sao Khuê',
    ['Phạm Đình Khiêm', '0917042385', 'dinhkhiem.pham@gmail.com'],
  ),
  T(
    'tx-pua-03',
    'icon font',
    '\ue900 0905 318 276 \ue901 quynh.tran.hr@gmail.com \ue902 Đà Nẵng\nTrần Như Quỳnh\nHR Executive',
    ['Trần Như Quỳnh', '0905318276', 'quynh.tran.hr@gmail.com'],
  ),

  // Word: ligatures, field codes, odd spaces
  T(
    'tx-word-01',
    'Word artefact',
    'Lê Thị Phương\nĐiện thoại: 0962 170 348\nEmail: lethiphuong.ﬁnance@gmail.com\nChuyên viên tài chính',
    ['Lê Thị Phương', '0962170348', 'lethiphuong.finance@gmail.com'],
    { emailConverted: true, note: 'fi ligature inside the address' },
  ),
  T(
    'tx-word-02',
    'Word artefact',
    'Trần Hữu Đạt\nĐiện thoại: 0348 216 750\nHYPERLINK "mailto:huudat.tran@gmail.com" huudat.tran@gmail.com\nKỹ sư phần mềm',
    ['Trần Hữu Đạt', '0348216750', 'huudat.tran@gmail.com'],
    { note: 'Word field code leaked into the text' },
  ),
  T(
    'tx-word-03',
    'Word artefact',
    'Hoàng Mỹ Linh\r\nĐiện thoại:\t0792\u00a0640\u00a0318\r\nEmail:\tmylinh\u200b.hoang@gmail.com\r\nNhân viên kinh doanh\r\n',
    ['Hoàng Mỹ Linh', '0792640318', 'mylinh.hoang@gmail.com'],
    { note: 'CRLF, tabs, no-break spaces, a zero-width space in the address' },
  ),
  T(
    'tx-word-04',
    'Word artefact',
    'Vũ Quốc Đạt\nDi động: 0918\u2011560\u2011274\nEmail: quoc\u00addat.vu@gmail.com\nKế toán',
    ['Vũ Quốc Đạt', '0918560274', 'quocdat.vu@gmail.com'],
    { note: 'non-breaking hyphens in the phone, soft hyphen in the address' },
  ),
  T(
    'tx-word-05',
    'Word artefact',
    'Nguyễn Ngọc Trâm\nSĐT: 0355–742–108\nEmail: ngoctram.ng@gmail.com\nThư ký',
    ['Nguyễn Ngọc Trâm', '0355742108', 'ngoctram.ng@gmail.com'],
    { note: 'en dashes in the phone' },
  ),

  // Text boxes broken into many fragments
  T(
    'tx-frag-01',
    'fragmented runs',
    'N G U Y Ễ N   T H Ị   H O A\n0 3 9 4   2 7 0   1 8 6\nthihoa . nguyen @ gmail . com',
    ['Nguyễn Thị Hoa', '0394270186', 'thihoa.nguyen@gmail.com'],
  ),
  T(
    'tx-frag-02',
    'fragmented runs',
    'Trần   Minh   Tuấn\nĐiện   thoại :   09 3 2 4 5 1 7 0 6\nE - mail :   minhtuan . tran @ gmail . com',
    ['Trần Minh Tuấn', '0932451706', 'minhtuan.tran@gmail.com'],
    { note: 'runs broken by kerning' },
  ),
  T(
    'tx-frag-03',
    'fragmented runs',
    'Phạ m Thị Quỳ nh\n08 69 12 54 07\nquynh.pham @ yahoo . com . vn',
    ['Phạm Thị Quỳnh', '0869125407', 'quynh.pham@yahoo.com.vn'],
    { note: 'split inside accented syllables' },
  ),

  // Columns merged line by line
  T(
    'tx-merge-01',
    'merged columns',
    'Lê Hữu Phước   KINH NGHIỆM LÀM VIỆC\nĐiện thoại: 0384 165 702   Công ty TNHH Bao Bì Sông Lam – Hotline 0909 241 763\nEmail: huuphuoc.le@gmail.com   Liên hệ: hr@songlampack.example\nHà Nội   Nhân viên kinh doanh',
    ['Lê Hữu Phước', '0384165702', 'huuphuoc.le@gmail.com'],
  ),
  T(
    'tx-merge-02',
    'merged columns',
    'KINH NGHIỆM LÀM VIỆC   Phan Thị Ngọc Lan\nCông ty CP Thực Phẩm Đồng Xanh – ĐT: 0936 180 247   0342 705 169\nEmail công ty: info@dongxanhfood.example   ngoclan.phan@gmail.com',
    ['Phan Thị Ngọc Lan', '0342705169', 'ngoclan.phan@gmail.com'],
    { note: 'company on the left of the same line' },
  ),
  T(
    'tx-merge-03',
    'merged columns',
    'NGƯỜI THAM CHIẾU   Đặng Hồng Sơn\nÔng Trần Văn Bách – 0913 276 480   Nhân viên kỹ thuật\nbach.tran@greenfield.example   0859 026 713\nhongson.dang.kt@gmail.com',
    ['Đặng Hồng Sơn', '0859026713', 'hongson.dang.kt@gmail.com'],
    { note: 'referee column on the left' },
  ),
  T(
    'tx-merge-04',
    'merged columns',
    'Vũ Minh Đăng SĐT 0986 204 517 Email minhdang.vu@gmail.com Địa chỉ 18 Trần Phú Hà Đông',
    ['Vũ Minh Đăng', '0986204517', 'minhdang.vu@gmail.com'],
    { note: 'whole contact block on one line, no separators' },
  ),

  // Legacy Vietnamese fonts and broken mapping: the text layer does not hold the real name
  T(
    'tx-legacy-01',
    'legacy font',
    'Nguyeãn Vaên Tuù\nÑieän thoaïi: 0912 406 735\nEmail: vantu.nguyen.vni@gmail.com\nKinh nghieäm laøm vieäc',
    [null, '0912406735', 'vantu.nguyen.vni@gmail.com'],
    { note: 'VNI font: name garbled; filling the garbage counts as a false fill' },
  ),
  T(
    'tx-legacy-02',
    'legacy font',
    'NguyÔn ThÞ Thu\n§iÖn tho¹i: 0347 180 526\nEmail: thuthu.tcvn@gmail.com\nKinh nghiÖm lµm viÖc',
    [null, '0347180526', 'thuthu.tcvn@gmail.com'],
    { note: 'TCVN3 font: name garbled' },
  ),
  T(
    'tx-legacy-03',
    'legacy font',
    'Tr?n Minh H?i\n?i?n tho?i: 0978 051 362\nEmail: minhhai.tr@gmail.com',
    [null, '0978051362', 'minhhai.tr@gmail.com'],
    { note: 'diacritics lost as question marks' },
  ),
  T(
    'tx-legacy-04',
    'legacy font',
    '(cid:78)(cid:103)(cid:117)(cid:121)(cid:101)(cid:110) (cid:65)(cid:110)\n(cid:48)(cid:57)(cid:49)(cid:50)\nKinh nghiem lam viec',
    [null, null, null],
    { note: 'no ToUnicode: only CID codes' },
  ),

  // OCR layer on top of a scan, with read errors: nothing wrong may be filled
  T(
    'tx-ocr-01',
    'OCR layer',
    'Nguyen Van Khanh\nDien thoai: 09l2 345 67B\nEmail: vankhanh.ng@gmai1.com',
    ['Nguyen Van Khanh', null, null],
    { note: 'OCR misread digits and domain: the number and address in the text are not the real ones' },
  ),
  T(
    'tx-ocr-02',
    'OCR layer',
    'CURRICULUM VITAE\nTran Thi Mai\nSDT: O9O3 714 268\nmai.tran@gmail.com',
    ['Tran Thi Mai', '0903714268', 'mai.tran@gmail.com'],
    { phoneConverted: true, note: 'letter O for zero: a human reads the number' },
  ),
  T(
    'tx-ocr-03',
    'OCR layer',
    'Scanned by CamScanner\nHo Ten: Le Van Hau\nDien thoai 0359 871 206\nScanned by CamScanner',
    ['Le Van Hau', '0359871206', null],
  ),

  // Very short or empty text
  T('tx-short-01', 'short text', '   \n \t ', [null, null, null]),
  T('tx-short-02', 'short text', 'Trang 1/1', [null, null, null]),
  T('tx-short-03', 'short text', '0912', [null, null, null]),
  T('tx-short-04', 'short text', 'Đặng Thế Phong', ['Đặng Thế Phong', null, null]),
  T('tx-short-05', 'short text', '0935 271 846', [null, '0935271846', null]),
  T('tx-short-06', 'short text', 'hanhphuc.trinh@gmail.com', [null, null, 'hanhphuc.trinh@gmail.com']),

  // Non-Latin scripts mixed in
  T(
    'tx-script-01',
    'other script',
    '阮文雄\nNguyễn Văn Hùng Cường\nĐiện thoại: 0916 307 482\nEmail: hungcuong.zh@gmail.com',
    ['Nguyễn Văn Hùng Cường', '0916307482', 'hungcuong.zh@gmail.com'],
    { note: 'name also in Chinese above' },
  ),
  T(
    'tx-script-02',
    'other script',
    'グエン・ティ・マイ\nNguyễn Thị Hạ Mai\n電話: 0394 180 672\nメール: hamai.jp@gmail.com',
    ['Nguyễn Thị Hạ Mai', '0394180672', 'hamai.jp@gmail.com'],
    { note: 'Japanese-style CV, labels in Japanese' },
  ),
];
