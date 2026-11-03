/**
 * Synthetic CVs for "Kỹ Sư Cơ Điện Lạnh (HVAC)". Fictional people and companies; labels and tiers were written
 * before the scorer was run on them (protocol in ./types.ts). "Today" for all dates is 2026-11-03.
 */
import type { JobEval, Label, LabelledCv } from './types.js';
import { HVAC_SLUG } from './line-truth.js';

export type HvacKey = 'expForm' | 'eduForm' | 'degree' | 'tools' | 'systems' | 'bonusExp' | 'english' | 'soft';

const KEYS: readonly HvacKey[] = ['expForm', 'eduForm', 'degree', 'tools', 'systems', 'bonusExp', 'english', 'soft'];

/** Labels in KEYS order; the soft line can never be judged from a CV. */
function labels(
  expForm: Label,
  eduForm: Label,
  degree: Label,
  tools: Label,
  systems: Label,
  bonusExp: Label,
  english: Label,
): Record<HvacKey, Label> {
  return { expForm, eduForm, degree, tools, systems, bonusExp, english, soft: 'unknown' };
}

const CVS: readonly LabelledCv<HvacKey>[] = [
  {
    id: 'hvac-01-design-engineer-to-presale',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `NGUYỄN HOÀNG LONG
Kỹ sư cơ điện lạnh | 0901 000 101 | long.nh@example.com
HỌC VẤN
2014 - 2019 Đại học Kỹ thuật Miền Nam
Kỹ sư chuyên ngành Kỹ thuật Nhiệt lạnh, tốt nghiệp loại Khá
KINH NGHIỆM LÀM VIỆC
08/2019 - 05/2023 Kỹ sư thiết kế MEP - Công ty CP Cơ điện Thành Nam (nhà thầu MEP)
- Đọc bản vẽ MEP, bóc khối lượng BOQ, kiểm tra spec kỹ thuật cho dự án bệnh viện, khách sạn
- Tính tải lạnh, chọn chiller, AHU, FCU; phối hợp hệ thống cấp thoát nước và PCCC
06/2023 - nay Kỹ sư pre-sale - Công ty TNHH Thiết bị Lạnh Đông Phương (nhà phân phối thiết bị HVAC)
- Lập bảng so sánh phương án, chuẩn bị datasheet, catalogue trình duyệt
KỸ NĂNG
AutoCAD, Revit MEP, Excel
NGOẠI NGỮ
Tiếng Anh: TOEIC 650, đọc hiểu tốt tài liệu kỹ thuật`,
  },
  {
    id: 'hvac-02-college-presale-distributor',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `TRẦN THỊ BÍCH NGỌC
Ngày sinh: 02/09/1998 - Gò Vấp, TP.HCM - ngoc.ttb@example.com
Mục tiêu: trở thành kỹ sư giải pháp cho hệ thống lạnh trung tâm.
KINH NGHIỆM
Kỹ thuật viên pre-sale
Công ty TNHH Phân phối Thiết bị Nhiệt Việt
07/2024 - nay
• Nhận BOQ, spec và bản vẽ từ phòng kinh doanh, tính chọn FCU, AHU, bơm
• Chuẩn bị hồ sơ kỹ thuật, so sánh với sản phẩm đối thủ trên Excel
• Vẽ sơ đồ nguyên lý bằng AutoCAD
• Làm việc với nhà thầu về hệ thống HVAC, cấp thoát nước và PCCC
HỌC VẤN
Cao đẳng Công nghệ Phương Nam (2019 - 2022)
Ngành: Công nghệ kỹ thuật Nhiệt lạnh
NGOẠI NGỮ
Tiếng Anh đọc hiểu datasheet, catalogue kỹ thuật`,
  },
  {
    id: 'hvac-03-english-mechanical-hvac-designer',
    kind: 'strong',
    form: 'en',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `PHAM QUOC BAO
HVAC Design Engineer | bao.pham@example.com
SUMMARY
Mechanical engineer with 5 years of experience in MEP design for hospitals and factories.
WORK EXPERIENCE
Sep 2021 - Present: HVAC Design Engineer, Southern MEP Contractors JSC
- Heat load calculation, chiller and VRF selection, duct sizing
- Read and check MEP shop drawings, prepare BOQ and technical specifications
- Coordinate with plumbing (water supply and drainage) and fire protection teams
EDUCATION
Bachelor of Engineering in Mechanical Engineering, Southern University of Technology, 2017 - 2021
SKILLS
AutoCAD, Revit, Excel, HAP
LANGUAGES
English: IELTS 6.5`,
  },
  {
    id: 'hvac-04-no-diacritics-chiller-engineer',
    kind: 'strong',
    form: 'no-diacritics',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `LE VAN TOAN
Dien thoai: 0902 000 104 - Email: toan.lv@example.com
KINH NGHIEM LAM VIEC
Ky su ky thuat - Cong ty TNHH Co dien lanh Hoang Gia (nha thau HVAC)
Thang 3/2020 - nay
- Doc hieu ban ve MEP, boc tach BOQ, doi chieu spec ky thuat
- Thiet ke he thong dieu hoa trung tam, ket hop cap thoat nuoc va PCCC
HOC VAN
Dai hoc Xay dung Mien Trung, 2015 - 2020
Chuyen nganh: Ky thuat Co so ha tang va Nhiet lanh
TIN HOC
AutoCAD thanh thao, Excel tot
NGOAI NGU
Tieng Anh doc hieu tai lieu ky thuat`,
  },
  {
    id: 'hvac-05-two-column-mixed-by-pdf',
    kind: 'strong',
    form: 'messy-pdf',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `VÕ MINH TRÍ                         KINH NGHIỆM LÀM VIỆC
Kỹ sư cơ điện                       Kỹ sư kỹ thuật dự án
0903 000 105                        Công ty CP Xây lắp Cơ điện Sao Mai (nhà thầu MEP)
tri.vm@example.com                  04/2021 – nay
HỌC VẤN                             • Đọc bản vẽ MEP, lập BOQ, kiểm tra spec thiết bị
Đại học Công nghiệp Phía Nam        • Thi công hệ thống HVAC, cấp thoát nước, PCCC
Chuyên ngành: Công nghệ             • Bàn giao hồ sơ hoàn công cho chủ đầu tư
kỹ thuật Nhiệt                      Trang 1/2
2016 – 2020
KỸ NĂNG
AutoCAD • Excel • Revit
NGOẠI NGỮ
Tiếng Anh: đọc hiểu tài liệu kỹ thuật, TOEIC 550`,
  },
  {
    id: 'hvac-06-electrical-engineer-mep-contractor',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `ĐẶNG THANH TÙNG
KINH NGHIỆM LÀM VIỆC
Kỹ sư thiết kế cơ điện | Công ty TNHH Giải pháp MEP Nam Việt | 01/2022 - nay
- Thiết kế và kiểm tra bản vẽ MEP cho tòa nhà văn phòng; lập BOQ, đọc spec
- Hiểu hệ thống HVAC, cấp thoát nước, PCCC khi phối hợp các bộ môn
HỌC VẤN
Kỹ sư Điện, Trường Đại học Điện lực Phương Đông, 2017 - 2021
KỸ NĂNG
AutoCAD, Excel, Dialux
TIẾNG ANH
Đọc hiểu tài liệu kỹ thuật tiếng Anh`,
  },
  {
    id: 'hvac-07-mechanical-ten-months-only',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'met', 'met', 'unmet', 'unknown', 'met'),
    why: { systems: 'Chỉ thể hiện HVAC, không có cấp thoát nước và PCCC (R3).' },
    text: `BÙI QUANG HUY
HỌC VẤN
Đại học Kỹ thuật Miền Nam, 2020 - 2025. Chuyên ngành: Kỹ thuật Cơ khí
KINH NGHIỆM LÀM VIỆC
10/2025 - 07/2026 Kỹ thuật viên - Công ty TNHH Điều hòa Trung tâm An Phát
- Đọc bản vẽ MEP và BOQ của công trình, hỗ trợ lắp đặt máy lạnh VRV
- Lập bảng khối lượng bằng Excel, chỉnh sửa bản vẽ AutoCAD
NGOẠI NGỮ
Tiếng Anh đọc hiểu tài liệu kỹ thuật`,
  },
  {
    id: 'hvac-08-vocational-vrv-installer',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'unmet', 'unmet', 'unmet', 'unmet', 'met', 'unmet'),
    why: { tools: 'Không có AutoCAD, Excel.', systems: 'Chỉ HVAC, không thể hiện cấp thoát nước, PCCC (R3).' },
    text: `LÝ VĂN PHÚC
Kỹ thuật viên lắp đặt điều hòa trung tâm
KINH NGHIỆM LÀM VIỆC
03/2022 - nay: Kỹ thuật viên lắp đặt, Công ty TNHH Cơ điện lạnh Tân Tiến (nhà thầu HVAC)
Lắp đặt, chạy thử hệ VRV và chiller giải nhiệt nước cho tòa nhà văn phòng. Làm theo bản vẽ thi công.
HỌC VẤN
Trung cấp nghề Kỹ thuật Máy lạnh và Điều hòa không khí, 2019 - 2021`,
  },
  {
    id: 'hvac-09-plumbing-engineer-little-hvac',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'met', 'ambiguous', 'met', 'met'),
    why: { systems: 'Vững cấp thoát nước, PCCC; HVAC chỉ "nắm nguyên lý": recruiter có thể coi đủ hoặc chưa đủ.' },
    text: `HỒ THỊ KIM OANH
KINH NGHIỆM LÀM VIỆC
Kỹ sư cấp thoát nước
Công ty CP Cơ điện Thành Đạt (nhà thầu MEP)
06/2022 - nay
- Thiết kế cấp thoát nước, chữa cháy; đọc bản vẽ MEP, lập BOQ, soát spec vật tư
- Phối hợp với nhóm HVAC, nắm nguyên lý hệ thống điều hòa không khí
HỌC VẤN
Đại học Xây dựng Mien Trung - Chuyên ngành Cấp thoát nước (2017 - 2021)
KỸ NĂNG
AutoCAD, Excel
NGOẠI NGỮ
TOEIC 500, đọc tài liệu kỹ thuật`,
  },
  {
    id: 'hvac-10-fresher-thesis-hvac',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'met', 'met', 'met', 'unknown', 'met'),
    text: `PHAN NHẬT MINH
Mới tốt nghiệp, chưa có kinh nghiệm làm việc chính thức
HỌC VẤN
Đại học Công nghiệp Phía Nam, 2022 - 2026. Chuyên ngành: Công nghệ kỹ thuật Nhiệt lạnh. Đã tốt nghiệp tháng 6/2026.
Đồ án tốt nghiệp: Thiết kế hệ thống HVAC, cấp thoát nước và PCCC cho tòa nhà 12 tầng; lập BOQ, đọc bản vẽ MEP.
THỰC TẬP
Thực tập sinh kỹ thuật, Công ty TNHH Cơ điện Minh Quân, 03/2026 - 06/2026
KỸ NĂNG
AutoCAD, Excel
NGOẠI NGỮ
Tiếng Anh: đọc hiểu tài liệu kỹ thuật chuyên ngành`,
  },
  {
    id: 'hvac-11-final-year-student',
    kind: 'partial',
    form: 'vi',
    tier: 'no',
    labels: labels('unmet', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { tools: 'Biết AutoCAD, Excel nhưng không thể hiện đọc bản vẽ MEP, BOQ (R3).' },
    text: `NGÔ GIA HÂN
Sinh viên năm cuối ngành Kỹ thuật Nhiệt, dự kiến tốt nghiệp 2027
HỌC VẤN
Đại học Kỹ thuật Miền Nam, 2023 - nay. Chuyên ngành: Kỹ thuật Nhiệt
KINH NGHIỆM
01/2026 - 09/2026 Gia sư toán tại nhà
KỸ NĂNG
AutoCAD cơ bản, Excel cơ bản`,
  },
  {
    id: 'hvac-12-appliance-repairer-vocational',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: {
      expForm: 'Có 6 năm nhưng là thợ sửa gia dụng, không phải nghề kỹ sư cơ điện (R1).',
      bonusExp: 'Vị trí kỹ thuật nhưng tại cửa hàng gia dụng, không phải công ty MEP/HVAC/nhà thầu.',
    },
    text: `DƯƠNG VĂN TÀI
Thợ sửa điện lạnh gia dụng
KINH NGHIỆM LÀM VIỆC
2020 - nay: Kỹ thuật viên sửa chữa, Cửa hàng Điện máy Tài Lộc
Sửa máy lạnh treo tường, tủ lạnh, máy giặt, lò vi sóng tại nhà khách hàng. Vệ sinh máy lạnh, nạp gas.
HỌC VẤN
Trung cấp nghề Điện dân dụng, 2017 - 2019`,
  },
  {
    id: 'hvac-13-appliance-repairer-college',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'met', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: {
      expForm: 'Bảo hành gia dụng, không phải nghề kỹ sư cơ điện (R1).',
      degree: 'Cao đẳng nghề Điện lạnh đúng ngành, dù nghề thực tế là sửa gia dụng.',
      bonusExp: 'Kỹ thuật viên ở trung tâm bảo hành gia dụng không phải công ty MEP/HVAC/nhà thầu/nhà phân phối thiết bị.',
    },
    text: `CHÂU MINH ĐỨC
KINH NGHIỆM LÀM VIỆC
Kỹ thuật viên bảo hành | Trung tâm Bảo hành Điện gia dụng Đại Phát | 05/2021 - nay
- Sửa chữa máy lạnh dân dụng, tủ lạnh, máy nước nóng cho hộ gia đình
- Nhập phiếu bảo hành vào Excel cơ bản
HỌC VẤN
Cao đẳng nghề Phương Nam - Ngành Kỹ thuật máy lạnh và điều hòa không khí (2018 - 2021)`,
  },
  {
    id: 'hvac-14-factory-electrician',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    tierDebatable: 'Đúng ngành Điện, kinh nghiệm thực tế: có recruiter cho vào "maybe".',
    labels: labels('met', 'met', 'met', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { bonusExp: 'Thợ điện nhà máy may, không phải công ty MEP/HVAC/nhà thầu.' },
    text: `HUỲNH ANH KIỆT
KINH NGHIỆM LÀM VIỆC
Thợ điện bảo trì, Công ty May mặc Thiên Hương, 09/2020 - nay
Bảo trì tủ điện, động cơ, thay thế thiết bị đóng cắt trong xưởng may.
HỌC VẤN
Cao đẳng Kỹ thuật Phương Nam. Ngành Điện công nghiệp. 2017 - 2020`,
  },
  {
    id: 'hvac-15-interior-drafter-autocad',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: {
      expForm: 'Họa viên nội thất, nghề khác hẳn kỹ sư cơ điện (R1).',
      tools: 'AutoCAD, Excel có nhưng chưa từng đọc bản vẽ MEP, BOQ (R3).',
      bonusExp: '"Thiết kế" ở đây là nội thất tại công ty nội thất.',
    },
    text: `MAI PHƯƠNG THẢO
Họa viên thiết kế nội thất
KINH NGHIỆM LÀM VIỆC
02/2022 - nay Họa viên, Công ty TNHH Nội thất Gỗ Việt
Triển khai bản vẽ nội thất căn hộ trên AutoCAD và 3ds Max, thống kê vật tư bằng Excel.
HỌC VẤN
Cao đẳng Mỹ thuật Ứng dụng Sài Thành, chuyên ngành Thiết kế nội thất, 2018 - 2021`,
  },
  {
    id: 'hvac-16-civil-qs-boq',
    kind: 'near-miss',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'ambiguous', 'unmet', 'unknown', 'met'),
    why: {
      degree: 'Kỹ thuật xây dựng công trình đúng nhóm "Kỹ thuật công trình".',
      tools: 'BOQ, AutoCAD, Excel mạnh nhưng bản vẽ kết cấu, kiến trúc chứ không phải MEP.',
      bonusExp: 'QS tại nhà thầu xây dựng: không phải vị trí kỹ thuật, pre-sale hay thiết kế; không thể hiện điểm cộng.',
    },
    text: `TRỊNH CÔNG VINH
Kỹ sư dự toán (QS)
KINH NGHIỆM LÀM VIỆC
07/2020 - nay Kỹ sư QS, Công ty CP Xây dựng Hưng Thịnh
- Bóc khối lượng, lập BOQ từ bản vẽ kết cấu và kiến trúc, đối chiếu spec vật liệu
HỌC VẤN
Đại học Xây dựng Miền Trung. Chuyên ngành: Kỹ thuật xây dựng công trình. 2015 - 2020
KỸ NĂNG
AutoCAD, Excel nâng cao
NGOẠI NGỮ
Tiếng Anh đọc hiểu`,
  },
  {
    id: 'hvac-17-software-developer',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unknown', 'met'),
    why: { expForm: '6 năm nhưng là lập trình (R1).' },
    text: `VŨ ĐÌNH KHANG
Lập trình viên backend
KINH NGHIỆM LÀM VIỆC
2020 - nay: Kỹ sư phần mềm, Công ty Công nghệ Sóng Xanh. Xây dựng API, viết tài liệu kỹ thuật.
HỌC VẤN
Đại học Công nghệ Phương Đông, Chuyên ngành Công nghệ thông tin, 2016 - 2020
KỸ NĂNG
Java, SQL, Docker, Excel
NGOẠI NGỮ
Tiếng Anh: TOEIC 800, đọc hiểu tài liệu kỹ thuật tốt`,
  },
  {
    id: 'hvac-18-chief-accountant',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { expForm: '8 năm nhưng là kế toán (R1).' },
    text: `LƯƠNG THỊ HỒNG
Kế toán trưởng
KINH NGHIỆM LÀM VIỆC
01/2018 - nay Kế toán trưởng, Công ty CP Thương mại Hưng Long. Lập báo cáo tài chính, quyết toán thuế.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kế toán, 2013 - 2017
KỸ NĂNG
Excel, Word, MISA`,
  },
  {
    id: 'hvac-19-cosmetics-sales-manager',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { expForm: 'Quản lý bán lẻ mỹ phẩm (R1).' },
    text: `TẠ NGỌC DIỆP
Quản lý cửa hàng mỹ phẩm
KINH NGHIỆM LÀM VIỆC
2019 - nay Quản lý chuỗi cửa hàng, Công ty TNHH Mỹ phẩm Hoa Sen. Đào tạo nhân viên, doanh số 3 tỷ/tháng.
HỌC VẤN
Đại học Kinh tế Nam Bộ - Quản trị kinh doanh - 2015 - 2019
KỸ NĂNG
Excel, PowerPoint, thuyết trình`,
  },
  {
    id: 'hvac-20-waiter-high-school',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { expForm: 'Phục vụ nhà hàng (R1).' },
    text: `ĐOÀN VĂN LỘC
KINH NGHIỆM LÀM VIỆC
06/2023 - nay Nhân viên phục vụ, Nhà hàng Biển Xanh. Order món, dọn bàn, thu ngân.
HỌC VẤN
Tốt nghiệp THPT Nguyễn Trãi, 2022
Sở thích: đá bóng, nghe nhạc, du lịch cùng bạn bè vào cuối tuần`,
  },
  {
    id: 'hvac-21-security-guard',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet'),
    why: { expForm: 'Bảo vệ (R1).' },
    text: `KIỀU VĂN SƠN
Nhân viên bảo vệ
KINH NGHIỆM
2017 - nay: Bảo vệ tòa nhà, Công ty Dịch vụ Bảo vệ Long Hải Nam. Trực ca, kiểm soát ra vào.
Từng tham gia tập huấn PCCC cơ sở theo quy định tòa nhà.
HỌC VẤN
Lớp 12/12, Trường THPT Lê Lợi, 2005`,
  },
  {
    id: 'hvac-22-stuffing-list-shipper',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'ambiguous'),
    why: {
      expForm: 'Shipper (R1).',
      tools: 'Chỉ chép từ tin, lịch sử làm việc là giao hàng (R2).',
      systems: 'Chỉ chép từ tin (R2).',
      english: 'Một dòng tự khai, không có gì mâu thuẫn (R2).',
    },
    text: `CAO VĂN NAM
KỸ NĂNG
HVAC, MEP, BOQ, spec kỹ thuật, AutoCAD, Excel, cấp thoát nước, PCCC, pre-sale, thiết kế, nhà thầu
Đọc hiểu tài liệu kỹ thuật tiếng Anh
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Nhân viên giao hàng, Công ty Chuyển phát Tốc Hành. Giao đơn nội thành TP.HCM bằng xe máy.
HỌC VẤN
THPT Trần Phú, tốt nghiệp 2021`,
  },
  {
    id: 'hvac-23-stuffing-summary-tour-guide',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unknown', 'ambiguous'),
    why: {
      expForm: 'Lịch sử làm việc là hướng dẫn du lịch, dòng "3 năm kinh nghiệm HVAC" không có việc nào chứng minh (R1, R2).',
      bonusExp: 'Câu chép từ tin ở phần giới thiệu không có công việc nào chứng minh; coi như không thể hiện.',
      english: 'Hướng dẫn viên có thể biết tiếng Anh, nhưng chỉ tự khai (R2).',
    },
    text: `TÔ THỊ MỸ LINH
GIỚI THIỆU
Có 3 năm kinh nghiệm HVAC. Từ 1 năm kinh nghiệm ở vị trí kỹ thuật, pre-sale, thiết kế tại công ty MEP, HVAC, nhà thầu.
Đọc hiểu bản vẽ MEP, BOQ, spec kỹ thuật; sử dụng được AutoCAD và Excel. Có hiểu biết về hệ thống HVAC, cấp thoát nước, PCCC.
Đọc hiểu tài liệu kỹ thuật tiếng Anh.
KINH NGHIỆM LÀM VIỆC
05/2021 - nay Hướng dẫn viên du lịch, Công ty Lữ hành Biển Đông. Dẫn tour Đà Lạt, Nha Trang.
HỌC VẤN
Cao đẳng Du lịch Sài Thành, ngành Hướng dẫn du lịch, 2018 - 2021`,
  },
  {
    id: 'hvac-24-stuffing-english-barista',
    kind: 'stuffing',
    form: 'en',
    tier: 'no',
    labels: labels('ambiguous', 'unknown', 'unknown', 'unmet', 'unmet', 'unknown', 'met'),
    why: {
      expForm: 'Barista (R1).',
      eduForm: 'CV không ghi học vấn (như fixture c30).',
      degree: 'CV không ghi học vấn.',
      english: 'CV viết hoàn toàn bằng tiếng Anh (R5).',
    },
    text: `DINH THI HOA
Keywords: HVAC, MEP, BOQ, AutoCAD, Excel, plumbing, fire protection, pre-sale, chiller, VRF, spec
WORK EXPERIENCE
Jan 2023 - Present: Barista at Green Bean Coffee. Made drinks, served customers, handled the cash desk.
Jun 2021 - Dec 2022: Cashier at Mini Mart 24. Worked with customers on the night shift.`,
  },
  {
    id: 'hvac-25-machine-design-wants-to-learn-hvac',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'unmet', 'unmet', 'unknown', 'met'),
    why: {
      tools: 'AutoCAD, Excel có, nhưng chưa làm bản vẽ MEP, BOQ (R3).',
      systems: 'CV tự ghi chưa có kinh nghiệm HVAC.',
    },
    text: `HÀ DUY KHÁNH
Chưa có kinh nghiệm về HVAC, mong muốn học thêm về hệ thống HVAC và cấp thoát nước.
KINH NGHIỆM LÀM VIỆC
08/2022 - nay Kỹ sư thiết kế máy, Công ty Cơ khí Chính xác Bình Minh. Thiết kế đồ gá, khuôn trên SolidWorks, AutoCAD.
HỌC VẤN
Đại học Công nghiệp Phía Nam, chuyên ngành Cơ khí chế tạo máy, 2018 - 2022
KỸ NĂNG
AutoCAD, SolidWorks, Excel
NGOẠI NGỮ
Tiếng Anh: TOEIC 600`,
  },
  {
    id: 'hvac-26-fire-protection-engineer',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `TRƯƠNG HẢI ĐĂNG
KINH NGHIỆM LÀM VIỆC
Kỹ sư MEP - Công ty TNHH Cơ điện PCCC An Toàn (nhà thầu cơ điện)
Tháng 5/2021 đến nay
Thiết kế và giám sát PCCC, cấp thoát nước; phối hợp hệ thống HVAC cho nhà máy và khách sạn.
Đọc bản vẽ MEP, lập BOQ, kiểm tra spec, vẽ AutoCAD, tổng hợp số liệu Excel.
HỌC VẤN
Đại học Kiến trúc Nam Bộ - Kỹ thuật công trình - 2016 - 2021
TIẾNG ANH
Đọc hiểu tài liệu kỹ thuật`,
  },
  {
    id: 'hvac-27-stated-years-no-dates',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `NGUYỄN KHẮC DUY
TÓM TẮT
Hơn 3 năm kinh nghiệm làm kỹ sư thiết kế hệ thống HVAC tại công ty MEP. Hiểu hệ thống cấp thoát nước, PCCC.
KINH NGHIỆM LÀM VIỆC
Kỹ sư thiết kế, Công ty CP Kỹ thuật Lạnh Trường Sa (công ty MEP)
Đọc bản vẽ MEP, bóc BOQ, soát spec thiết bị; vẽ AutoCAD, lập bảng tính Excel.
HỌC VẤN
Kỹ sư Điện lạnh, Đại học Kỹ thuật Miền Nam, tốt nghiệp năm 2022
NGOẠI NGỮ
Tiếng Anh đọc hiểu tài liệu kỹ thuật`,
  },
  {
    id: 'hvac-28-english-appliance-technician',
    kind: 'near-miss',
    form: 'en',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'met'),
    why: {
      expForm: 'Home appliance repair, not an engineering occupation (R1).',
      english: 'CV written entirely in English (R5).',
    },
    text: `TRAN DUC ANH
Home Appliance Repair Technician
WORK EXPERIENCE
Mar 2019 - Present: Technician at Bright Home Service. Repaired refrigerators, washing machines and split air conditioners for households. Handled customer complaints.
EDUCATION
Vocational certificate in Household Electrical Repair, City Vocational School, 2016 - 2018
SKILLS
Soldering, gas charging, customer care`,
  },
  {
    id: 'hvac-29-building-me-operator',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'ambiguous', 'met', 'ambiguous', 'unmet'),
    why: {
      tools: 'Đọc bản vẽ MEP, có AutoCAD cơ bản, Excel, nhưng không có BOQ, spec.',
      bonusExp: 'Vị trí kỹ thuật nhưng ở ban quản lý tòa nhà, không rõ có được coi là công ty MEP/HVAC không.',
    },
    text: `PHÙNG VĂN THỊNH
Kỹ thuật trưởng ca tòa nhà
KINH NGHIỆM LÀM VIỆC
11/2020 - nay Kỹ thuật viên M&E, Ban quản lý Tòa nhà Thành Công Tower
- Vận hành, bảo trì chiller, AHU, bơm cấp thoát nước, hệ thống PCCC của tòa nhà 25 tầng
- Đọc bản vẽ MEP hoàn công để xử lý sự cố; theo dõi số liệu vận hành bằng Excel, sửa bản vẽ AutoCAD cơ bản
HỌC VẤN
Cao đẳng Kỹ thuật Phương Nam, chuyên ngành Nhiệt lạnh, 2017 - 2020`,
  },
];

export const HVAC_EVAL: JobEval<HvacKey> = { slug: HVAC_SLUG, short: 'HVAC', keys: KEYS, cvs: CVS };
