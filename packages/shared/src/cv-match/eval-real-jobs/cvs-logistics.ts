/**
 * Synthetic CVs for "Nhân Viên Chứng Từ - Logistics". Fictional people and companies; labels and tiers were written
 * before the scorer was run on them (protocol in ./types.ts). "Today" for all dates is 2026-11-03.
 */
import type { JobEval, Label, LabelledCv } from './types.js';
import { LOGISTICS_SLUG } from './line-truth.js';

export type LogisticsKey =
  'expForm' | 'eduForm' | 'degree' | 'customsExp' | 'customsSkills' | 'incoterms' | 'english' | 'office' | 'soft';

const KEYS: readonly LogisticsKey[] = [
  'expForm',
  'eduForm',
  'degree',
  'customsExp',
  'customsSkills',
  'incoterms',
  'english',
  'office',
  'soft',
];

/** Labels in KEYS order; the soft line can never be judged from a CV. */
function labels(
  expForm: Label,
  eduForm: Label,
  degree: Label,
  customsExp: Label,
  customsSkills: Label,
  incoterms: Label,
  english: Label,
  office: Label,
): Record<LogisticsKey, Label> {
  return { expForm, eduForm, degree, customsExp, customsSkills, incoterms, english, office, soft: 'unknown' };
}

const CVS: readonly LabelledCv<LogisticsKey>[] = [
  {
    id: 'log-01-documents-officer-forwarder',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `NGUYỄN THỊ THANH TÂM
Nhân viên chứng từ xuất nhập khẩu | 0922 000 301 | tam.ntt@example.com
KINH NGHIỆM LÀM VIỆC
04/2023 - nay Nhân viên chứng từ, Công ty TNHH Giao nhận Vận tải Biển Đông
- Khai báo hải quan điện tử trên VNACCS/VCIS cho hàng nhập khẩu, làm thủ tục thông quan
- Tra cứu mã HS Code, tính thuế nhập khẩu và thuế GTGT
- Kiểm tra bộ chứng từ: invoice, packing list, B/L, C/O; theo dõi thanh toán L/C, T/T; áp dụng Incoterms 2020
HỌC VẤN
Đại học Ngoại thương Phía Nam, 2018 - 2022. Chuyên ngành: Kinh doanh quốc tế - Ngoại thương
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ, viết email với đối tác nước ngoài; TOEIC 600
TIN HỌC
Word, Excel, ECUS5`,
  },
  {
    id: 'log-02-customs-declarant-college',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `TRẦN QUỐC VIỆT
KINH NGHIỆM LÀM VIỆC
Nhân viên khai báo hải quan
Công ty CP Logistics Cảng Xanh
08/2024 - nay
• Khai tờ khai nhập khẩu trên hệ thống VNACCS/VCIS, xử lý kiểm hóa
• Áp mã HS Code, tính thuế nhập khẩu
• Hiểu Incoterms, phương thức thanh toán L/C, T/T
HỌC VẤN
Cao đẳng Kinh tế Đối ngoại Sài Thành, ngành Logistics, 2020 - 2023
KỸ NĂNG
Thành thạo Word, Excel
Tiếng Anh: đọc hiểu chứng từ chuyên ngành`,
  },
  {
    id: 'log-03-english-import-export-officer',
    kind: 'strong',
    form: 'en',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `LE MINH CHAU
Import-Export Documentation Officer
WORK EXPERIENCE
Mar 2022 - Present: Import-Export Officer, Blue Ocean Trading Co.
- Prepared import procedures and customs declarations on VNACCS/VCIS
- Classified goods by HS Code and calculated import duty and VAT
- Checked invoices, packing lists and bills of lading; applied Incoterms; handled L/C and T/T payments
EDUCATION
Bachelor of Science in Logistics and Supply Chain Management, Western City University, 2017 - 2021
SKILLS
Word, Excel, SAP
LANGUAGES
English: TOEIC 750`,
  },
  {
    id: 'log-04-two-column-mixed-by-pdf',
    kind: 'strong',
    form: 'messy-pdf',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `PHẠM THU HÀ                     KINH NGHIỆM LÀM VIỆC
Nhân viên XNK                   Nhân viên xuất nhập khẩu
ha.pt@example.com               Công ty TNHH Thiết bị Kim Long
HỌC VẤN                         02/2023 – nay
Đại học Kinh tế Nam Bộ          • Làm thủ tục nhập khẩu, khai báo hải quan VNACCS/VCIS
Ngành: Xuất nhập khẩu           • Tra mã HS Code, tính thuế nhập khẩu
2018 – 2022                     • Kiểm tra L/C, T/T và điều kiện Incoterms
KỸ NĂNG                         Trang 1/2
Word • Excel
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ, email`,
  },
  {
    id: 'log-05-no-diacritics-customs',
    kind: 'strong',
    form: 'no-diacritics',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `HO VAN NAM
KINH NGHIEM LAM VIEC
Nhan vien thu tuc hai quan - Cong ty CP Xuat nhap khau Dai Duong
Thang 1/2022 - nay
Khai bao hai quan dien tu VNACCS/VCIS cho hang nhap khau, tra ma HS Code, tinh thue nhap khau.
Hieu Incoterms, thanh toan L/C, T/T.
HOC VAN
Dai hoc Giao thong Van tai Phia Nam, chuyen nganh Logistics, 2017 - 2021
KY NANG
Word, Excel
NGOAI NGU
Tieng Anh doc hieu chung tu`,
  },
  {
    id: 'log-06-import-procedures-at-manufacturer',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `ĐOÀN NGỌC ÁNH
KINH NGHIỆM LÀM VIỆC
Phụ trách thủ tục nhập khẩu | Công ty CP Dệt may Hoàng Long | 05/2022 - nay
- Mở tờ khai VNACCS/VCIS, xác định mã HS, tính thuế nhập khẩu và GTGT
- Làm việc với hãng tàu, forwarder; áp dụng Incoterms, thanh toán L/C và T/T
HỌC VẤN
Đại học Kinh tế Đối ngoại Miền Nam, ngành Kinh tế đối ngoại, 2017 - 2021
KỸ NĂNG
Tin học văn phòng: Word, Excel thành thạo
NGOẠI NGỮ
TOEIC 650`,
  },
  {
    id: 'log-07-forwarder-sales',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'unmet', 'unmet', 'met', 'met', 'met'),
    why: { customsExp: 'Bán cước, thủ tục hải quan do bộ phận Ops làm.' },
    text: `VÕ THANH SANG
KINH NGHIỆM LÀM VIỆC
Sales Logistics, Công ty TNHH Giao nhận Toàn Cầu, 03/2023 - nay
Chào cước tàu, cước air cho khách nhập khẩu; tư vấn Incoterms, phương thức L/C, T/T. Thủ tục hải quan do bộ phận Ops làm.
HỌC VẤN
Đại học Giao thông Vận tải Phía Nam, Logistics, 2018 - 2022
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Tiếng Anh giao tiếp, đọc email khách hàng`,
  },
  {
    id: 'log-08-export-documents-only',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'ambiguous', 'unmet', 'met', 'met', 'met'),
    why: {
      customsExp: 'Làm chứng từ xuất khẩu, hải quan do đại lý khai: có liên quan nhưng không đúng "thủ tục nhập khẩu".',
      customsSkills: 'Không tự khai VNACCS, không tra HS, không tính thuế nhập khẩu.',
    },
    text: `TRƯƠNG MỸ DUYÊN
KINH NGHIỆM LÀM VIỆC
Nhân viên chứng từ xuất khẩu
Công ty CP Thủy sản Cửu Long
07/2023 - nay
Lập invoice, packing list, xin C/O, kiểm tra B/L; đại lý hải quan phụ trách mở tờ khai.
Áp dụng Incoterms, theo dõi thanh toán L/C, T/T.
HỌC VẤN
Cao đẳng Kinh tế Đối ngoại Sài Thành, ngành Xuất nhập khẩu, 2019 - 2022
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ`,
  },
  {
    id: 'log-09-fresher-customs-internship',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'met', 'unmet', 'ambiguous', 'met', 'met', 'met'),
    why: { customsSkills: 'Có làm VNACCS, HS khi thực tập 4 tháng; "thành thạo" là chưa chắc.' },
    text: `LƯU GIA BẢO
Mới tốt nghiệp ngành Xuất nhập khẩu
THỰC TẬP
Thực tập sinh chứng từ, Công ty Đại lý Hải quan Tân Cảng, 03/2026 - 06/2026
Hỗ trợ khai tờ khai VNACCS/VCIS, tra mã HS Code, tính thử thuế nhập khẩu
HỌC VẤN
Cao đẳng Kinh tế Đối ngoại Sài Thành, ngành Xuất nhập khẩu, 2023 - 2026. Đã tốt nghiệp.
Môn học: Incoterms, thanh toán quốc tế L/C, T/T
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ`,
  },
  {
    id: 'log-10-customs-eight-months',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'met', 'unmet', 'met', 'met', 'met', 'met'),
    text: `NGÔ THỊ MỸ HẠNH
KINH NGHIỆM LÀM VIỆC
01/2026 - 08/2026 Nhân viên khai báo hải quan, Công ty TNHH Logistics Phú Mỹ
Khai VNACCS/VCIS hàng nhập khẩu, tra mã HS Code, tính thuế nhập khẩu, kiểm chứng từ L/C, T/T, Incoterms.
HỌC VẤN
Đại học Giao thông Vận tải Phía Nam, Logistics, 2021 - 2025
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ`,
  },
  {
    id: 'log-11-vocational-experienced-customs',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'unmet', 'unmet', 'met', 'met', 'met', 'met', 'met'),
    text: `LÊ HỮU PHƯỚC
KINH NGHIỆM LÀM VIỆC
Nhân viên thủ tục hải quan, Công ty Đại lý Hải quan Nam Hải, 2021 - nay
Làm thủ tục nhập khẩu, khai VNACCS/VCIS, tra mã HS Code, tính thuế nhập khẩu; biết Incoterms, L/C, T/T.
HỌC VẤN
Trung cấp Nghiệp vụ Xuất nhập khẩu Sài Thành, 2018 - 2020
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ`,
  },
  {
    id: 'log-12-experienced-customs-accounting-degree',
    kind: 'partial',
    form: 'vi',
    tier: 'interview',
    tierDebatable: 'Làm đúng nghề 4 năm nhưng sai ngành học: recruiter nghiêm về bằng cấp có thể loại.',
    labels: labels('met', 'met', 'unmet', 'met', 'met', 'met', 'met', 'met'),
    why: { degree: 'Kế toán không phải Logistics, XNK, Ngoại thương hay ngành liên quan rõ ràng.' },
    text: `BÙI THỊ KIM CHI
KINH NGHIỆM LÀM VIỆC
Nhân viên xuất nhập khẩu, Công ty TNHH Máy móc Thiên Phú, 10/2022 - nay
Làm thủ tục nhập khẩu, khai báo hải quan VNACCS/VCIS, tra mã HS Code, tính thuế nhập khẩu; Incoterms, L/C, T/T.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kế toán, 2017 - 2021
KỸ NĂNG
Word, Excel
NGOẠI NGỮ
Đọc hiểu chứng từ, email tiếng Anh`,
  },
  {
    id: 'log-13-shipper-high-school',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Shipper, không phải nghề chứng từ (R1).' },
    text: `HOÀNG VĂN BẢY
Shipper
KINH NGHIỆM LÀM VIỆC
2023 - nay Nhân viên giao hàng, Công ty Chuyển phát Nhanh Sao Bắc. Nhận đơn trên app, giao hàng nội thành, thu COD.
HỌC VẤN
Tốt nghiệp THPT Gò Vấp, 2022`,
  },
  {
    id: 'log-14-delivery-staff-logistics-degree',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: {
      expForm: 'Giao nhận tại công ty logistics nhưng chỉ giao hàng (R1).',
      customsExp: 'Làm ở công ty logistics, nhưng không làm hải quan.',
    },
    text: `TRẦN THANH NHÀN
KINH NGHIỆM LÀM VIỆC
Nhân viên giao nhận, Công ty CP Logistics Phương Nam, 06/2022 - nay
Giao hàng cho khách, ký nhận phiếu, sắp xếp đơn trên xe tải nhỏ.
HỌC VẤN
Cao đẳng Giao thông Sài Thành, ngành Logistics, 2019 - 2022`,
  },
  {
    id: 'log-15-warehouse-keeper',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'met'),
    why: {
      expForm: 'Thủ kho (R1).',
      degree: 'Quản trị kinh doanh không đúng ngành, "hoặc liên quan" có thể rộng.',
    },
    text: `PHÙNG THỊ NGA
Thủ kho
KINH NGHIỆM LÀM VIỆC
03/2020 - nay Thủ kho, Công ty TNHH Phân phối Hàng tiêu dùng Việt Mỹ
Xuất nhập kho, kiểm kê, nhập số liệu vào phần mềm WMS, báo cáo tồn kho bằng Excel, soạn biên bản trên Word.
HỌC VẤN
Cao đẳng Thương mại Sài Thành, ngành Quản trị kinh doanh, 2016 - 2019`,
  },
  {
    id: 'log-16-port-field-ops',
    kind: 'near-miss',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'met', 'ambiguous', 'unmet', 'unmet', 'unmet'),
    why: {
      customsExp: 'Trực tiếp làm thủ tục thông quan hàng nhập tại cảng là làm thủ tục nhập khẩu.',
      customsSkills: 'Thao tác thông quan hiện trường, có nhập tờ khai nhưng không thấy HS, tính thuế.',
    },
    text: `DƯƠNG MINH TRIẾT
KINH NGHIỆM LÀM VIỆC
Nhân viên Ops hiện trường, Công ty TNHH Giao nhận Cảng Việt, 01/2024 - nay
Làm thủ tục thông quan hàng nhập khẩu tại cảng, nộp tờ khai, đi kiểm hóa, lấy lệnh giao hàng.
HỌC VẤN
Cao đẳng Giao thông Sài Thành, ngành Logistics, 2020 - 2023`,
  },
  {
    id: 'log-17-accountant-documents-word-trap',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'met'),
    why: { expForm: 'Kế toán (R1).', customsExp: 'Chứng từ kế toán, không phải chứng từ XNK.' },
    text: `MẠC THỊ THƠM
Kế toán chứng từ
KINH NGHIỆM LÀM VIỆC
04/2021 - nay Kế toán chứng từ, Công ty TNHH Xây dựng Đông Á
Lập phiếu thu chi, kiểm hóa đơn chứng từ, kê khai thuế GTGT, nhập MISA.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kế toán, 2017 - 2021
KỸ NĂNG
Word, Excel, MISA`,
  },
  {
    id: 'log-18-international-purchasing',
    kind: 'near-miss',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'unmet', 'unmet', 'met', 'met', 'met'),
    why: { customsExp: 'Thủ tục hải quan do forwarder làm.', degree: 'Kinh doanh quốc tế đúng nhóm ngoại thương.' },
    text: `THÁI BẢO NGỌC
KINH NGHIỆM LÀM VIỆC
Nhân viên mua hàng quốc tế, Công ty CP Máy nông nghiệp Tân Phát, 02/2022 - nay
Đàm phán đơn hàng với nhà cung cấp nước ngoài theo Incoterms, mở L/C, T/T; forwarder làm thủ tục hải quan.
HỌC VẤN
Đại học Kinh tế Đối ngoại Miền Nam, ngành Kinh doanh quốc tế, 2017 - 2021
KỸ NĂNG
Word, Excel, SAP
NGOẠI NGỮ
TOEIC 700`,
  },
  {
    id: 'log-19-it-helpdesk',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'met', 'met'),
    why: { expForm: 'IT (R1).' },
    text: `LA QUỐC CƯỜNG
KINH NGHIỆM LÀM VIỆC
2021 - nay IT Helpdesk, Công ty CP Thương mại Điện tử Nhanh. Cài máy, hỗ trợ người dùng.
HỌC VẤN
Cao đẳng Công nghệ Phương Nam, ngành Công nghệ thông tin, 2018 - 2021
KỸ NĂNG
Word, Excel, Linux, SQL
NGOẠI NGỮ
Tiếng Anh đọc hiểu tài liệu`,
  },
  {
    id: 'log-20-retail-sales',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'met'),
    why: { expForm: 'Bán lẻ (R1).' },
    text: `HÀ THỊ PHƯỢNG
KINH NGHIỆM LÀM VIỆC
2020 - nay Nhân viên kinh doanh, Siêu thị Điện máy Đại Thành. Tư vấn bán hàng tại cửa hàng.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2016 - 2020
KỸ NĂNG
Word, Excel`,
  },
  {
    id: 'log-21-english-teacher',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'met', 'met'),
    why: { expForm: 'Giáo viên (R1).' },
    text: `TỐNG THANH TRÚC
KINH NGHIỆM LÀM VIỆC
08/2019 - nay Giáo viên tiếng Anh, Trường THCS Hòa Bình. Dạy tiếng Anh khối 8, 9.
HỌC VẤN
Đại học Sư phạm Phương Nam, Sư phạm tiếng Anh, 2015 - 2019
NGOẠI NGỮ
IELTS 7.5
KỸ NĂNG
Word, Excel`,
  },
  {
    id: 'log-22-truck-driver',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Tài xế (R1).' },
    text: `KHƯƠNG VĂN DŨNG
KINH NGHIỆM LÀM VIỆC
2018 - nay Tài xế xe container, Công ty Vận tải Cảng Sài Thành. Chở container từ cảng về kho khách.
HỌC VẤN
THPT Bình Chánh, 2010
Bằng lái FC`,
  },
  {
    id: 'log-23-waiter-student',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    text: `ĐINH NGỌC LAN
Sinh viên năm 2 Cao đẳng Thương mại Sài Thành, ngành Marketing
KINH NGHIỆM
03/2026 - nay Phục vụ bán thời gian, Quán Trà Sữa Mây
HỌC VẤN
Cao đẳng Thương mại Sài Thành, 2025 - nay`,
  },
  {
    id: 'log-24-stuffing-list-waiter',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'ambiguous', 'ambiguous'),
    why: {
      expForm: 'Phục vụ (R1).',
      customsSkills: 'Từ khóa chép từ tin (R2).',
      incoterms: 'Từ khóa chép từ tin (R2).',
      english: 'Tự khai (R2).',
      office: 'Công cụ văn phòng tự khai (R2).',
    },
    text: `VI THỊ TUYẾT
KỸ NĂNG
VNACCS/VCIS, HS Code, thuế nhập khẩu, khai báo hải quan, Incoterms, L/C, T/T, Word, Excel, ERP
Đọc hiểu tiếng Anh chuyên ngành
KINH NGHIỆM LÀM VIỆC
05/2022 - nay Nhân viên phục vụ, Nhà hàng Sông Quê. Bưng bê, dọn bàn.
HỌC VẤN
Tốt nghiệp THPT Tân Bình, 2021`,
  },
  {
    id: 'log-25-stuffing-summary-shipper',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'ambiguous', 'ambiguous'),
    why: {
      expForm: 'Shipper (R1).',
      customsExp: 'Câu chép nguyên từ tin, lịch sử làm việc là giao hàng (R2).',
      customsSkills: 'Câu chép từ tin (R2).',
      incoterms: 'Câu chép từ tin (R2).',
      english: 'Câu chép từ tin (R2).',
      office: 'Công cụ văn phòng tự khai (R2).',
    },
    text: `QUẢNG VĂN LÂM
GIỚI THIỆU
Có 2 năm kinh nghiệm làm thủ tục nhập khẩu, khai báo hải quan.
Thành thạo khai báo hải quan điện tử (VNACCS/VCIS), tra cứu mã HS Code, tính thuế nhập khẩu.
Hiểu biết về Incoterms và các phương thức thanh toán quốc tế (L/C, T/T).
Đọc hiểu tiếng Anh chuyên ngành. Thành thạo Word, Excel.
KINH NGHIỆM LÀM VIỆC
2022 - nay Shipper, Công ty Chuyển phát Hỏa Tốc. Giao hàng nội thành.
HỌC VẤN
Cao đẳng Du lịch Sài Thành, Quản trị nhà hàng, 2019 - 2022`,
  },
  {
    id: 'log-26-stuffing-english-cashier',
    kind: 'stuffing',
    form: 'en',
    tier: 'no',
    labels: labels('ambiguous', 'unknown', 'unknown', 'unmet', 'unmet', 'unmet', 'met', 'ambiguous'),
    why: {
      expForm: 'Cashier (R1).',
      eduForm: 'No education stated (c30).',
      degree: 'No education stated (c30).',
      customsExp: 'Keyword only (R2).',
      customsSkills: 'Keyword only (R2).',
      incoterms: 'Keyword only (R2).',
      english: 'CV written entirely in English (R5).',
      office: 'Self-declared office tools (R2).',
    },
    text: `KEVIN TRAN
Keywords: customs declaration, VNACCS, VCIS, HS Code, import duty, Incoterms, L/C, T/T, Word, Excel, ERP
WORK EXPERIENCE
Feb 2023 - Present: Cashier at Sunny Mart. Worked with customers and handled the cash desk.`,
  },
  {
    id: 'log-27-sales-admin-no-customs-yet',
    kind: 'partial',
    form: 'vi',
    tier: 'no',
    tierDebatable: 'Đúng ngành, có việc văn phòng, nhưng chưa từng khai hải quan: "maybe" hoặc "no" đều hợp lý.',
    labels: labels('met', 'met', 'met', 'unmet', 'unmet', 'unmet', 'unmet', 'met'),
    why: { customsExp: 'CV tự ghi chưa có kinh nghiệm khai báo hải quan.' },
    text: `HỒ KIM THOA
Chưa có kinh nghiệm khai báo hải quan, mong muốn học thêm về VNACCS và Incoterms.
KINH NGHIỆM LÀM VIỆC
05/2024 - nay Sale Admin, Công ty TNHH Vật tư Nông nghiệp Phú Điền. Lên đơn, theo dõi công nợ.
HỌC VẤN
Đại học Kinh tế Đối ngoại Miền Nam, ngành Ngoại thương, 2020 - 2024
KỸ NĂNG
Word, Excel`,
  },
  {
    id: 'log-28-customs-broker-five-years',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `ÔNG THIỆN NHÂN
Đại lý thủ tục hải quan - 5 năm kinh nghiệm khai báo hải quan
KINH NGHIỆM LÀM VIỆC
09/2021 - nay Nhân viên giao nhận chứng từ và khai hải quan, Công ty Đại lý Hải quan Đông Nam
Khai VNACCS/VCIS nhiều loại hình nhập khẩu; áp mã HS Code, tính thuế nhập khẩu; xử lý kiểm tra sau thông quan.
HỌC VẤN
Đại học Giao thông Vận tải Phía Nam, chuyên ngành Logistics, 2017 - 2021
Môn học: Incoterms, thanh toán quốc tế L/C, T/T
KỸ NĂNG
Word, Excel, ECUS5
NGOẠI NGỮ
Tiếng Anh đọc hiểu chứng từ, email`,
  },
];

export const LOGISTICS_EVAL: JobEval<LogisticsKey> = { slug: LOGISTICS_SLUG, short: 'Logistics', keys: KEYS, cvs: CVS };
