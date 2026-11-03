// Other numbers and people near the contact block. Wrong fills are the dangerous outcome here.
import { cv } from './helper.mjs';

const X = (id, tpl, fields, exp) => cv('noise', id, tpl, fields, exp);

export const NOISE_CASES = [
  // Company hotline, candidate present
  X(
    'no-hot-01',
    'rightSide',
    {
      n: 'Nguyễn Đức Thọ',
      t: 'Nhân viên giao nhận',
      j: ['Hotline công ty: 0908 225 176'],
      ct: ['0379 516 240', 'ducto.nguyen.gn@gmail.com'],
    },
    ['Nguyễn Đức Thọ', '0379516240', 'ducto.nguyen.gn@gmail.com'],
  ),
  X(
    'no-hot-02',
    'wordPlain',
    {
      ab: ['CÔNG TY TNHH GỖ VIỆT MỘC – ĐT: 0903 118 642 – Fax: 028 3930 6621'],
      n: 'Trần Hồng Quân',
      t: 'Thủ kho',
      ct: ['Di động: 0345 802 917', 'Email: hongquan.tran.tk@gmail.com'],
      note: 'company letterhead above the candidate',
    },
    ['Trần Hồng Quân', '0345802917', 'hongquan.tran.tk@gmail.com'],
  ),
  X(
    'no-hot-03',
    'canvaAbs',
    {
      n: 'Lê Thị Thanh Xuân',
      t: 'Điều dưỡng',
      j: ['Phòng khám Thiên Thảo – Hotline 1900 6824 17 – 0931 660 248'],
      ct: ['0762 405 139', 'thanhxuan.le.dd@gmail.com'],
      order: ['exp', 'name', 'title', 'summary', 'edu', 'skills', 'contact'],
    },
    ['Lê Thị Thanh Xuân', '0762405139', 'thanhxuan.le.dd@gmail.com'],
  ),
  X(
    'no-hot-04',
    'vnwExport',
    {
      n: 'Đặng Hoài An',
      t: 'Tổng Đài Viên',
      ab: ['Liên hệ nhà tuyển dụng qua hotline: 0916 204 753'],
      ct: ['Di động: 0398 240 716', 'Email: hoaian.dang.td@gmail.com'],
      note: 'site hotline above the name',
    },
    ['Đặng Hoài An', '0398240716', 'hoaian.dang.td@gmail.com'],
  ),
  // Company hotline, no candidate phone
  X(
    'no-hot-05',
    'topcvModern',
    {
      n: 'Phạm Công Luận',
      t: 'Nhân viên kỹ thuật',
      j: ['Hotline công ty: 0909 310 476'],
      ct: ['congluan.pham.kt@gmail.com'],
    },
    ['Phạm Công Luận', null, 'congluan.pham.kt@gmail.com'],
  ),
  X(
    'no-hot-06',
    'atsEn',
    {
      lang: 'en',
      n: 'Ta Minh Hanh',
      t: 'Receptionist',
      j: ['Company phone: 0937 815 420'],
      ct: ['minhhanh.ta@gmail.com'],
    },
    ['Ta Minh Hanh', null, 'minhhanh.ta@gmail.com'],
  ),
  X(
    'no-hot-07',
    'wordPlain',
    {
      n: 'Hoàng Ngọc Thạch',
      t: 'Giám sát',
      j: ['SĐT công ty: 0983 702 615; Quản lý: anh Tân'],
      ct: ['Email: ngocthach.hoang@gmail.com'],
    },
    ['Hoàng Ngọc Thạch', null, 'ngocthach.hoang@gmail.com'],
  ),

  // Staffing agency letterhead
  X(
    'no-agent-01',
    'wordPlain',
    {
      ab: ['Hồ sơ giới thiệu bởi Công ty Nhân lực Sao Mai', 'Hotline: 0909 412 760 – tuyendung@saomaihr.example'],
      n: 'Vũ Thanh Bình',
      t: 'Trưởng phòng dự án',
      note: 'agency contacts; candidate contacts withheld',
    },
    ['Vũ Thanh Bình', null, null],
  ),
  X(
    'no-agent-02',
    'wordPlain',
    {
      ab: [
        'Hồ sơ giới thiệu bởi Công ty Nhân lực Bắc Hà',
        'Liên hệ: chị Thu – 0934 862 170 – thu.nguyen@bachahr.example',
      ],
      n: 'Lương Thị Hiền',
      t: 'Kế toán trưởng',
      ct: ['Di động: 0342 690 815', 'Email: hien.luong.ktt@gmail.com'],
    },
    ['Lương Thị Hiền', '0342690815', 'hien.luong.ktt@gmail.com'],
  ),

  // Tax code, ID numbers
  X(
    'no-id-01',
    'topcvModern',
    {
      n: 'Đỗ Hoàng Việt',
      t: 'Kế toán thuế',
      p: ['MST: 0318 425 796'],
      ct: ['hoangviet.do.ktt@gmail.com'],
      note: '10-digit tax code that looks like a mobile, no phone',
    },
    ['Đỗ Hoàng Việt', null, 'hoangviet.do.ktt@gmail.com'],
  ),
  X(
    'no-id-02',
    'wordPlain',
    {
      n: 'Nguyễn Thị Thu Cúc',
      t: 'Kế toán',
      ct: ['Mã số thuế cá nhân: 0376 182 940', 'Điện thoại: 0917 438 205', 'Email: thucuc.ng.kt@gmail.com'],
    },
    ['Nguyễn Thị Thu Cúc', '0917438205', 'thucuc.ng.kt@gmail.com'],
  ),
  X(
    'no-id-03',
    'vnwExport',
    {
      n: 'Trần Việt Anh',
      t: 'Chuyên Viên Thuế',
      ct: ['Email: vietanh.tran.thue@gmail.com', 'Mã số thuế: 0107845263-001'],
      note: 'company-branch tax code, no phone',
    },
    ['Trần Việt Anh', null, 'vietanh.tran.thue@gmail.com'],
  ),
  X(
    'no-id-04',
    'formDots',
    {
      form: ['Họ và tên: Hoàng Thị Mai Hoa', 'CCCD: 079 196 008 412', 'Email: maihoa.hoang@gmail.com'],
      note: '12-digit ID, no phone',
    },
    ['Hoàng Thị Mai Hoa', null, 'maihoa.hoang@gmail.com'],
  ),
  X(
    'no-id-05',
    'formDots',
    {
      form: [
        'Họ và tên: Lâm Tuấn Anh',
        'Số CCCD: 038201004917 cấp ngày 12/03/2021',
        'Điện thoại: 0356 470 182',
        'Email: tuananh.lam.td@gmail.com',
      ],
      note: 'ID glued as 12 digits right before the phone',
    },
    ['Lâm Tuấn Anh', '0356470182', 'tuananh.lam.td@gmail.com'],
  ),
  X(
    'no-id-06',
    'topcv2col',
    {
      n: 'Dương Hồng Hạnh',
      t: 'Nhân viên ngân hàng',
      ct: ['CMND: 036 185 002', 'Tel: 0868 217 490', 'dhonghanh.nh@gmail.com'],
      note: '9-digit old ID card before the phone',
    },
    ['Dương Hồng Hạnh', '0868217490', 'dhonghanh.nh@gmail.com'],
  ),
  X(
    'no-id-07',
    'wordTable',
    {
      n: 'Phan Xuân Trường',
      t: 'Bảo vệ',
      ct: ['Số CCCD: 0912 0108 6423', 'xuantruong.phan.bv@gmail.com'],
      note: 'a 12-digit ID grouped 4-4-4, starting with 0912, no phone',
    },
    ['Phan Xuân Trường', null, 'xuantruong.phan.bv@gmail.com'],
  ),
  X(
    'no-id-08',
    'threeCol',
    {
      n: 'Nguyễn Hải Sơn',
      t: 'Phiên dịch',
      ct: ['Hộ chiếu: C0912345', 'BHXH: 0798 206 431', 'haison.ng.pd@gmail.com'],
      note: '10-digit social-insurance number, no phone',
    },
    ['Nguyễn Hải Sơn', null, 'haison.ng.pd@gmail.com'],
  ),
  X(
    'no-id-09',
    'canvaHero',
    {
      n: 'Trần Thị Mỹ Hạnh',
      t: 'Sinh viên năm cuối',
      ct: ['MSSV: 0916 082 347', 'myhanh.tran.sv@gmail.com'],
      note: 'student number shaped like a mobile, no phone',
    },
    ['Trần Thị Mỹ Hạnh', null, 'myhanh.tran.sv@gmail.com'],
  ),
  X(
    'no-id-10',
    'canvaHero',
    {
      n: 'Đỗ Minh Nhật',
      t: 'Sinh viên',
      ct: ['MSSV: 0906 415 382', 'SĐT: 0325 170 948', 'minhnhat.do.sv@gmail.com'],
      note: 'student number before the real phone',
    },
    ['Đỗ Minh Nhật', '0325170948', 'minhnhat.do.sv@gmail.com'],
  ),

  // Bank accounts
  X(
    'no-bank-01',
    'topcvModern',
    {
      n: 'Phạm Hoàng Phúc',
      t: 'Nhân viên thu ngân',
      p: ['STK: 0987 615 204 – Ngân hàng Hoa Mai'],
      ct: ['hoangphuc.pham.tn@gmail.com'],
      note: 'bank account shaped like a mobile, no phone',
    },
    ['Phạm Hoàng Phúc', null, 'hoangphuc.pham.tn@gmail.com'],
  ),
  X(
    'no-bank-02',
    'wordPlain',
    {
      n: 'Trần Khánh Hòa',
      t: 'Thủ quỹ',
      ct: ['Số tài khoản: 0071 0034 56789', 'Điện thoại: 0394 806 217', 'Email: khanhhoa.tran.tq@gmail.com'],
    },
    ['Trần Khánh Hòa', '0394806217', 'khanhhoa.tran.tq@gmail.com'],
  ),
  X(
    'no-bank-03',
    'topcv2col',
    {
      n: 'Bùi Quang Vinh',
      t: 'Cộng tác viên',
      ct: ['Tài khoản ngân hàng: 0351 000 829', 'Điện thoại: 0912 063 748', 'quangvinh.bui.ctv@gmail.com'],
      note: 'account before the phone, both 10 digits',
    },
    ['Bùi Quang Vinh', '0912063748', 'quangvinh.bui.ctv@gmail.com'],
  ),

  // Dates and other digits
  X(
    'no-date-01',
    'wordPlain',
    {
      n: 'Lê Thành Đạt',
      t: 'Kỹ thuật viên',
      ct: ['Ngày sinh: 09/03/1994', 'Email: thanhdat.le.ktv@gmail.com'],
      note: 'date of birth, no phone',
    },
    ['Lê Thành Đạt', null, 'thanhdat.le.ktv@gmail.com'],
  ),
  X(
    'no-date-02',
    'topcvModern',
    {
      n: 'Ngô Tuyết Mai',
      t: 'Nhân viên kho',
      ct: ['Sinh ngày 09.08.1996', 'tuyetmai.ngo.kho@gmail.com'],
      p: ['Thời gian làm việc: 03/2018 – 09/2020, 09/2020 – 03/2023'],
      note: 'no phone, dates run together',
    },
    ['Ngô Tuyết Mai', null, 'tuyetmai.ngo.kho@gmail.com'],
  ),
  X(
    'no-date-03',
    'vnwExport',
    {
      n: 'Hoàng Bảo Lâm',
      t: 'Quản Lý Bán Hàng',
      ct: ['Email: baolam.hoang.bh@gmail.com'],
      p: ['Doanh số 2025: 3.920.000.000 đồng', 'Thời gian: 0912/2019 – 0306/2021'],
      note: 'revenue and odd dates, no phone',
    },
    ['Hoàng Bảo Lâm', null, 'baolam.hoang.bh@gmail.com'],
  ),
  X(
    'no-date-04',
    'iconRow',
    {
      n: 'Trịnh Xuân Nam',
      t: 'Nhân viên sản xuất',
      ct: ['xuannam.trinh.sx@gmail.com', 'Số 0912/34/56 đường Tô Ký, Quận 12'],
      note: 'address digits, no phone',
    },
    ['Trịnh Xuân Nam', null, 'xuannam.trinh.sx@gmail.com'],
  ),
  X(
    'no-date-05',
    'atsEn',
    {
      lang: 'en',
      n: 'Vo Hoang Yen',
      t: 'Translator',
      ct: ['hoangyen.vo.tr@gmail.com'],
      p: ['TOEIC certificate no. 0856 731 204', 'IELTS TRF 0368742195'],
      note: 'certificate numbers shaped like mobiles, no phone',
    },
    ['Vo Hoang Yen', null, 'hoangyen.vo.tr@gmail.com'],
  ),
  X(
    'no-date-06',
    'topcv2col',
    {
      n: 'Thái Bảo Trung',
      t: 'Nhân viên IT',
      ct: ['facebook.com/0916420735', 'linkedin.com/in/bao-trung-0983710245', 'baotrung.thai.it@gmail.com'],
      note: 'digits inside links, no phone',
    },
    ['Thái Bảo Trung', null, 'baotrung.thai.it@gmail.com'],
  ),

  // Referees
  X(
    'no-ref-01',
    'topcv2col',
    {
      n: 'Trần Thanh Tùng',
      t: 'Nhân viên bán hàng',
      rf: ['Ông Phan Đức Mạnh – Trưởng phòng', 'ĐT: 0913 662 847', 'Email: manh.pd@anphatco.example'],
      ct: ['Di động: 0385 410 926', 'thanhtung.tran.bh@gmail.com'],
    },
    ['Trần Thanh Tùng', '0385410926', 'thanhtung.tran.bh@gmail.com'],
  ),
  X(
    'no-ref-02',
    'topcv2col',
    {
      n: 'Nguyễn Thị Ánh',
      t: 'Nhân viên bán hàng',
      rf: ['Bà Lê Thu Hà – Giám đốc', '0986 720 513', 'thuha.le@songlampack.example'],
      note: 'only the referee has contact details',
    },
    ['Nguyễn Thị Ánh', null, null],
  ),
  X(
    'no-ref-03',
    'canvaAbs',
    {
      n: 'Dương Tiến Mạnh',
      t: 'Nhân viên kinh doanh',
      rf: ['Anh Tuấn (quản lý): 0902 516 378'],
      ct: ['tienmanh.duong.kd@gmail.com'],
      order: ['refs', 'name', 'title', 'contact', 'summary', 'exp', 'edu', 'skills'],
      note: 'unlabelled manager line first, no candidate phone',
    },
    ['Dương Tiến Mạnh', null, 'tienmanh.duong.kd@gmail.com'],
  ),
  X(
    'no-ref-04',
    'rightSide',
    {
      lang: 'en',
      n: 'Hoang Tuan Kiet',
      t: 'Sales Lead',
      rf: ['Ms. Tran My Linh, Director', 'Phone: 0918 306 472', 'Email: mylinh.tran@greenfield.example'],
      ct: ['Phone: 0369 150 742', 'Email: tuankiet.hoang.sl@gmail.com'],
      note: 'referee directly after the candidate',
    },
    ['Hoang Tuan Kiet', '0369150742', 'tuankiet.hoang.sl@gmail.com'],
  ),
  X(
    'no-ref-05',
    'threeCol',
    {
      cols: 'cba',
      n: 'Phạm Mạnh Cường',
      t: 'Tài xế',
      rf: ['Người xác nhận: Vũ Văn Lực – Đội trưởng – 0975 482 106'],
      ct: ['manhcuong.pham.tx@gmail.com'],
      note: 'referee first; no candidate phone',
    },
    ['Phạm Mạnh Cường', null, 'manhcuong.pham.tx@gmail.com'],
  ),
  X(
    'no-ref-06',
    'wordTable',
    {
      n: 'Đinh Tuấn Tú',
      t: 'Nhân viên bảo trì',
      ct: ['SĐT: 0836 410 275', 'Tham khảo: chị Lan – 0907 351 648', 'tuantu.dinh.bt@gmail.com'],
      note: 'referee phone in the same cell as the candidate phone',
    },
    ['Đinh Tuấn Tú', '0836410275', 'tuantu.dinh.bt@gmail.com'],
  ),
  X(
    'no-ref-07',
    'wordPlain',
    {
      n: 'Bùi Anh Thư',
      t: 'Hành chính',
      ct: ['Liên hệ xác nhận: chị Hoa 0913 275 640', 'Điện thoại: 0793 186 402', 'Email: anhthu.bui.hc@gmail.com'],
      note: 'referee phone before own phone, in the contact block',
    },
    ['Bùi Anh Thư', '0793186402', 'anhthu.bui.hc@gmail.com'],
  ),

  // Family and emergency contacts
  X(
    'no-fam-01',
    'formDots',
    {
      form: [
        'Họ và tên: Trịnh Quang Khải',
        'Điện thoại người thân (mẹ): 0983 410 526',
        'Số điện thoại: 0347 602 918',
        'Email: quangkhai.trinh@gmail.com',
      ],
    },
    ['Trịnh Quang Khải', '0347602918', 'quangkhai.trinh@gmail.com'],
  ),
  X(
    'no-fam-02',
    'formDots',
    {
      form: [
        'Họ tên cha: Trịnh Văn Long – ĐT: 0912 870 354',
        'Họ và tên: Trịnh Thị Thanh Vân',
        'Email: thanhvan.trinh@gmail.com',
      ],
      note: "only the father's phone",
    },
    ['Trịnh Thị Thanh Vân', null, 'thanhvan.trinh@gmail.com'],
  ),
  X(
    'no-fam-03',
    'topcvModern',
    {
      n: 'Võ Minh Tâm',
      t: 'Nhân viên kho',
      ct: ['Liên hệ khẩn cấp (vợ): 0908 713 462', 'Điện thoại: 0332 840 617', 'minhtam.vo.kho@gmail.com'],
    },
    ['Võ Minh Tâm', '0332840617', 'minhtam.vo.kho@gmail.com'],
  ),
  X(
    'no-fam-04',
    'atsEn',
    {
      lang: 'en',
      n: 'Le Quynh Mai',
      t: 'Barista',
      ct: ['Emergency contact: 0937 204 681 (mother)', 'quynhmai.le.ba@gmail.com'],
      note: 'emergency contact only',
    },
    ['Le Quynh Mai', null, 'quynhmai.le.ba@gmail.com'],
  ),

  // Other noise beside the contact block
  X(
    'no-misc-01',
    'wordTable',
    {
      n: 'Trần Đình Hòa',
      t: 'Nhân viên kỹ thuật',
      ct: ['Fax: 028 3930 6621', 'Tel công ty: 028 3930 6620', 'dinhhoa.tran.kt@gmail.com'],
      note: 'company fax and office line, no own phone',
    },
    ['Trần Đình Hòa', null, 'dinhhoa.tran.kt@gmail.com'],
  ),
  X(
    'no-misc-02',
    'canvaHero',
    {
      n: 'Vũ Thị Ngân',
      t: 'Gia sư',
      j: ['Trung tâm Ánh Dương – tư vấn tuyển sinh: 0869 240 713'],
      ct: ['Di động: 0705 360 142', 'thingan.vu.gs@gmail.com'],
    },
    ['Vũ Thị Ngân', '0705360142', 'thingan.vu.gs@gmail.com'],
  ),
];
