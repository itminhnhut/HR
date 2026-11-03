/**
 * Synthetic CVs for "Sales Engineer – Kỹ sư Kinh doanh Dự án M&E". Fictional people and companies; labels and tiers
 * were written before the scorer was run on them (protocol in ./types.ts). "Today" for all dates is 2026-11-03.
 */
import type { JobEval, Label, LabelledCv } from './types.js';
import { SALES_SLUG } from './line-truth.js';

export type SalesKey =
  'expForm' | 'eduForm' | 'salesExp' | 'degree' | 'drawings' | 'softComm' | 'english' | 'softAttitude';

const KEYS: readonly SalesKey[] = [
  'expForm',
  'eduForm',
  'salesExp',
  'degree',
  'drawings',
  'softComm',
  'english',
  'softAttitude',
];

/** Labels in KEYS order; the two soft lines can never be judged from a CV. */
function labels(
  expForm: Label,
  eduForm: Label,
  salesExp: Label,
  degree: Label,
  drawings: Label,
  english: Label,
): Record<SalesKey, Label> {
  return { expForm, eduForm, salesExp, degree, drawings, softComm: 'unknown', english, softAttitude: 'unknown' };
}

const CVS: readonly LabelledCv<SalesKey>[] = [
  {
    id: 'se-01-valve-sales-engineer',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `LÊ TRUNG KIÊN
Sales Engineer | 0933 000 401 | kien.lt@example.com
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Kỹ sư kinh doanh dự án, Công ty TNHH Van Công Nghiệp Đại Thắng
- Bán hàng dự án van - đường ống cho nhà thầu MEP, tư vấn thiết kế M&E
- Đọc bản vẽ M&E, BOQ, phân tích hồ sơ thầu; lập báo giá kỹ thuật - thương mại
HỌC VẤN
Đại học Kỹ thuật Miền Nam, 2016 - 2021. Chuyên ngành: Kỹ thuật Cơ khí
NGOẠI NGỮ
Tiếng Anh đọc hiểu catalogue, datasheet; TOEIC 550`,
  },
  {
    id: 'se-02-hvac-project-sales',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `NGUYỄN THÀNH ĐẠT
KINH NGHIỆM LÀM VIỆC
Kỹ sư bán hàng dự án HVAC
Công ty CP Thiết bị Lạnh Toàn Phát
06/2021 - nay
• Khai thác dự án khách sạn, nhà máy; làm việc với nhà thầu cơ điện
• Đọc bản vẽ M&E, bóc BOQ, chuẩn bị hồ sơ thầu và báo giá kỹ thuật
HỌC VẤN
Đại học Công nghiệp Phía Nam - Ngành Công nghệ kỹ thuật Nhiệt lạnh (2016 - 2020)
TIẾNG ANH
Đọc hiểu tốt datasheet kỹ thuật`,
  },
  {
    id: 'se-03-english-mep-valves',
    kind: 'strong',
    form: 'en',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `HOANG MINH QUAN
Sales Engineer - MEP Valves and Piping
WORK EXPERIENCE
May 2022 - Present: Sales Engineer, Delta Flow Solutions (industrial valves and piping for MEP projects)
- Project sales to MEP contractors and M&E consultants for hospitals and hotels
- Read M&E drawings, BOQ and tender documents; prepared technical and commercial quotations
EDUCATION
Bachelor of Engineering, Mechanical Engineering, Southern University of Technology, 2017 - 2021
LANGUAGES
English: IELTS 6.0`,
  },
  {
    id: 'se-04-pdf-merged-lines',
    kind: 'strong',
    form: 'messy-pdf',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `TRẦN ANH VŨ vu.ta@example.com 0933 000 404 KINH NGHIỆM LÀM VIỆC Kỹ sư bán hàng kỹ thuật, Công ty TNHH Thiết bị Công nghiệp Phú Sơn, 07/2023 – nay Bán hàng kỹ thuật thiết bị công nghiệp, van cho nhà máy và nhà thầu cơ điện (MEP). Đọc bản vẽ M&E, BOQ, hồ sơ thầu; lập báo giá kỹ thuật – thương mại. HỌC VẤN Đại học Kỹ thuật Miền Nam, chuyên ngành Kỹ thuật Cơ khí, 2018 – 2022 NGOẠI NGỮ Tiếng Anh đọc hiểu datasheet, TOEIC 500`,
  },
  {
    id: 'se-05-no-diacritics-plumbing-sales',
    kind: 'strong',
    form: 'no-diacritics',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `PHAM VAN HIEP
KINH NGHIEM LAM VIEC
Nhan vien kinh doanh ky thuat - Cong ty TNHH Duong ong Nuoc Sach
Thang 2/2022 - nay
Ban hang du an van, duong ong cho nha thau co dien (MEP) va chu dau tu.
Doc ban ve M&E, BOQ, ho so thau; lap bao gia ky thuat - thuong mai.
HOC VAN
Dai hoc Xay dung Mien Trung, chuyen nganh Cap thoat nuoc, 2016 - 2021
NGOAI NGU
Tieng Anh doc hieu datasheet ky thuat`,
  },
  {
    id: 'se-06-business-degree-pump-sales',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `ĐỖ HOÀNG YẾN
KINH NGHIỆM LÀM VIỆC
Trưởng nhóm kinh doanh dự án | Công ty CP Bơm và Van Hưng Vượng | 01/2020 - nay
Bán hàng dự án bơm, van cho nhà thầu MEP, tòa nhà; đọc bản vẽ M&E, BOQ, hồ sơ thầu; lập báo giá kỹ thuật - thương mại, đàm phán chốt đơn.
HỌC VẤN
Đại học Kinh tế Nam Bộ, ngành Quản trị kinh doanh, 2015 - 2019
NGOẠI NGỮ
Tiếng Anh: đọc hiểu catalogue, datasheet`,
  },
  {
    id: 'se-07-mep-engineer-no-sales',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'unmet', 'met', 'ambiguous', 'met'),
    why: {
      salesExp: 'Kỹ sư MEP, không có kinh nghiệm bán hàng.',
      drawings: 'Đọc bản vẽ, BOQ tốt; báo giá chỉ "hỗ trợ": chưa chắc đạt.',
    },
    text: `VĂN THẾ HÙNG
KINH NGHIỆM LÀM VIỆC
Kỹ sư MEP, Công ty CP Xây lắp Cơ điện Việt Long, 2021 - nay
Đọc bản vẽ M&E, bóc BOQ, chuẩn bị hồ sơ thầu; hỗ trợ phòng kinh doanh về báo giá.
HỌC VẤN
Đại học Kỹ thuật Miền Nam, chuyên ngành Kỹ thuật Cơ khí, 2016 - 2021
NGOẠI NGỮ
Tiếng Anh đọc hiểu datasheet`,
  },
  {
    id: 'se-08-sales-engineer-eight-months',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'unmet', 'met', 'met', 'met'),
    text: `TRỊNH HẢI NAM
KINH NGHIỆM LÀM VIỆC
01/2026 - 08/2026 Sales Engineer, Công ty TNHH Thiết bị HVAC Nam Phong
Bán hàng dự án HVAC, đọc bản vẽ M&E, BOQ, hồ sơ thầu, lập báo giá.
HỌC VẤN
Cao đẳng Kỹ thuật Phương Nam, ngành Nhiệt lạnh, 2021 - 2024
NGOẠI NGỮ
Tiếng Anh đọc hiểu catalogue`,
  },
  {
    id: 'se-09-bearings-sales-no-drawings',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'met', 'unmet', 'met'),
    why: {
      salesExp: 'Bán hàng kỹ thuật thiết bị công nghiệp đúng nhóm trong tin.',
      drawings: 'Có báo giá, không có bản vẽ M&E, BOQ, hồ sơ thầu (R3).',
    },
    text: `MAI TIẾN DŨNG
KINH NGHIỆM LÀM VIỆC
Nhân viên kinh doanh kỹ thuật, Công ty TNHH Vòng bi Công nghiệp Tân Á, 09/2023 - nay
Bán vòng bi, động cơ, thiết bị công nghiệp cho nhà máy; lập báo giá kỹ thuật - thương mại.
HỌC VẤN
Đại học Công nghiệp Phía Nam, Kỹ thuật cơ khí, 2018 - 2022
NGOẠI NGỮ
Tiếng Anh đọc hiểu catalogue`,
  },
  {
    id: 'se-10-vocational-mep-sales',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'unmet', 'met', 'unmet', 'met', 'met'),
    text: `TẠ VĂN KHOA
KINH NGHIỆM LÀM VIỆC
2021 - nay Nhân viên bán hàng dự án, Công ty TNHH Vật tư Cơ điện Sao Vàng
Bán hàng dự án vật tư MEP, đường ống cho nhà thầu; đọc bản vẽ M&E, BOQ, hồ sơ thầu; lập báo giá kỹ thuật - thương mại.
HỌC VẤN
Trung cấp Kỹ thuật Sài Thành, ngành Cơ khí, 2018 - 2020
NGOẠI NGỮ
Tiếng Anh đọc hiểu catalogue`,
  },
  {
    id: 'se-11-mep-sales-no-english-shown',
    kind: 'partial',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'unmet'),
    text: `HUỲNH ĐĂNG KHOA
KINH NGHIỆM LÀM VIỆC
Sales dự án M&E, Công ty CP Cơ điện Hải Âu, 02/2021 - nay
Bán hàng dự án van, đường ống; làm việc với nhà thầu MEP; đọc bản vẽ M&E, BOQ, hồ sơ thầu; lập báo giá kỹ thuật - thương mại.
HỌC VẤN
Đại học Xây dựng Miền Trung, chuyên ngành Cấp thoát nước, 2016 - 2020`,
  },
  {
    id: 'se-12-building-materials-project-sales',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'ambiguous', 'met', 'unmet', 'met'),
    why: {
      salesExp: 'Bán hàng dự án thật, nhưng là sơn, thép xây dựng, không phải các ngành nêu trong tin.',
      drawings: 'Có báo giá, không có bản vẽ M&E, BOQ (R3).',
    },
    text: `LỮ THANH TÙNG
KINH NGHIỆM LÀM VIỆC
Nhân viên kinh doanh dự án, Công ty CP Sơn và Thép Xây dựng Đại Việt, 05/2022 - nay
Chào giá sơn, thép cho nhà thầu xây dựng; lập báo giá.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2017 - 2021
NGOẠI NGỮ
Tiếng Anh đọc hiểu`,
  },
  {
    id: 'se-13-retail-air-conditioner-sales',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('met', 'met', 'unmet', 'met', 'unmet', 'unmet'),
    why: {
      expForm: 'Bán hàng là nghề gần với Sales Engineer (R1).',
      salesExp: 'Bán lẻ máy lạnh gia đình tại siêu thị, không phải bán hàng dự án hay kỹ thuật cho công trình.',
      degree: 'Quản trị kinh doanh khớp nhóm "Kinh doanh".',
    },
    text: `NINH THỊ THÙY
KINH NGHIỆM LÀM VIỆC
03/2021 - nay Tư vấn bán hàng máy lạnh, Siêu thị Điện máy Đại Thành
Tư vấn máy lạnh, tủ lạnh cho khách gia đình, đạt doanh số tháng.
HỌC VẤN
Cao đẳng Thương mại Sài Thành, ngành Quản trị kinh doanh, 2018 - 2021`,
  },
  {
    id: 'se-14-real-estate-broker',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('met', 'met', 'unmet', 'met', 'unmet', 'unmet'),
    why: { expForm: 'Bán hàng là nghề gần (R1).', salesExp: 'Sale bất động sản, không phải ngành nêu trong tin.' },
    text: `DƯƠNG TUẤN KIỆT
KINH NGHIỆM LÀM VIỆC
Chuyên viên kinh doanh bất động sản, Công ty CP Địa ốc Đông Sài Gòn, 2020 - nay
Bán căn hộ dự án, chăm sóc khách hàng, chốt đơn.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2016 - 2020`,
  },
  {
    id: 'se-15-insurance-telesales',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('met', 'met', 'unmet', 'met', 'unmet', 'unmet'),
    why: { expForm: 'Bán hàng là nghề gần (R1).', salesExp: 'Telesales bảo hiểm.' },
    text: `LÝ THỊ DIỄM
KINH NGHIỆM LÀM VIỆC
08/2022 - nay Nhân viên telesales, Công ty Bảo hiểm Nhân thọ Phú An. Gọi 100 cuộc/ngày, tư vấn gói bảo hiểm.
HỌC VẤN
Cao đẳng Thương mại Sài Thành, Quản trị kinh doanh, 2019 - 2022`,
  },
  {
    id: 'se-16-cosmetics-showroom-sales',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('met', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Bán hàng là nghề gần (R1).', salesExp: 'Bán lẻ mỹ phẩm.' },
    text: `HẠ THỊ KIỀU
KINH NGHIỆM LÀM VIỆC
2021 - nay Nhân viên bán hàng, Showroom Mỹ phẩm Thanh Xuân. Tư vấn khách, sắp xếp kệ, chốt đơn.
HỌC VẤN
Tốt nghiệp THPT Thủ Đức, 2020`,
  },
  {
    id: 'se-17-site-supervisor-me',
    kind: 'near-miss',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'unmet', 'met', 'unmet', 'unmet'),
    why: {
      salesExp: 'Giám sát thi công, không bán hàng.',
      drawings: 'Đọc bản vẽ M&E, BOQ nhưng không có hồ sơ thầu, báo giá (R3).',
    },
    text: `VÕ HOÀI PHONG
KINH NGHIỆM LÀM VIỆC
Giám sát thi công M&E, Công ty CP Xây lắp Sông Tiền, 03/2020 - nay
Giám sát lắp đặt đường ống, đọc bản vẽ M&E, đối chiếu BOQ.
HỌC VẤN
Cao đẳng Kỹ thuật Phương Nam, ngành Cơ khí, 2016 - 2019`,
  },
  {
    id: 'se-18-plumber',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Thợ ống nước (R1).' },
    text: `LẠI VĂN THẮNG
KINH NGHIỆM LÀM VIỆC
2018 - nay Thợ lắp đặt đường ống nước, Đội thi công Hùng Cường. Lắp ống PPR, van, đồng hồ nước.
HỌC VẤN
Trung cấp nghề Cấp thoát nước Sài Thành, 2015 - 2017`,
  },
  {
    id: 'se-19-machine-designer',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'met', 'unmet', 'met'),
    why: { expForm: 'Kỹ sư thiết kế máy, không bán hàng, không M&E (R1).' },
    text: `ĐÀO QUANG MINH
KINH NGHIỆM LÀM VIỆC
Kỹ sư thiết kế máy, Công ty Cơ khí Chính xác Bình Minh, 2021 - nay
Thiết kế đồ gá, khuôn trên SolidWorks.
HỌC VẤN
Đại học Kỹ thuật Miền Nam, chuyên ngành Cơ khí chế tạo máy, 2016 - 2021
NGOẠI NGỮ
Tiếng Anh đọc hiểu tài liệu kỹ thuật, TOEIC 600`,
  },
  {
    id: 'se-20-software-developer',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'met'),
    why: { expForm: 'Lập trình (R1).' },
    text: `QUÁCH ĐÌNH PHONG
KINH NGHIỆM LÀM VIỆC
2019 - nay Lập trình viên Java, Công ty Phần mềm Trường Sơn. Phát triển hệ thống ngân hàng.
HỌC VẤN
Đại học Công nghệ Phương Đông, chuyên ngành Công nghệ thông tin, 2015 - 2019
NGOẠI NGỮ
Tiếng Anh đọc hiểu tài liệu kỹ thuật, TOEIC 750`,
  },
  {
    id: 'se-21-primary-teacher',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Giáo viên (R1).' },
    text: `CÙ THỊ THANH
KINH NGHIỆM LÀM VIỆC
08/2017 - nay Giáo viên tiểu học, Trường Tiểu học Hòa Bình. Chủ nhiệm lớp 3.
HỌC VẤN
Đại học Sư phạm Phương Nam, Giáo dục tiểu học, 2013 - 2017`,
  },
  {
    id: 'se-22-accountant',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Kế toán (R1).' },
    text: `TRẦN THỊ THẢO
KINH NGHIỆM LÀM VIỆC
Kế toán công nợ, Công ty CP Cơ điện Lạnh Hùng Phát, 2020 - nay
Theo dõi công nợ, hóa đơn cho khách hàng và nhà thầu của công ty.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kế toán, 2016 - 2020`,
  },
  {
    id: 'se-23-waiter',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'unmet'),
    why: { expForm: 'Phục vụ (R1).' },
    text: `HOÀNG VĂN CÔNG
KINH NGHIỆM LÀM VIỆC
02/2023 - nay Nhân viên phục vụ, Nhà hàng Hải Sản Vũng Tàu. Bưng bê, dọn bàn.
HỌC VẤN
THPT Vũng Tàu, 2022`,
  },
  {
    id: 'se-24-stuffing-list-barber',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unmet', 'ambiguous'),
    why: {
      expForm: 'Thợ cắt tóc (R1).',
      salesExp: 'Từ khóa chép từ tin (R2).',
      drawings: 'Từ khóa chép từ tin (R2).',
      english: 'Tự khai (R2).',
    },
    text: `VŨ VĂN TUẤN
KỸ NĂNG
Bán hàng dự án, bán hàng kỹ thuật, cơ điện MEP, van, đường ống, HVAC, thiết bị công nghiệp
Đọc bản vẽ M&E, BOQ, hồ sơ thầu, lập báo giá kỹ thuật - thương mại
Tiếng Anh đọc hiểu catalogue, datasheet
KINH NGHIỆM LÀM VIỆC
2020 - nay Thợ cắt tóc, Salon Tóc Đẹp. Cắt, nhuộm tóc nam.
HỌC VẤN
THPT Hóc Môn, 2019`,
  },
  {
    id: 'se-25-stuffing-summary-makeup-artist',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unmet', 'ambiguous'),
    why: {
      expForm: 'Chuyên viên trang điểm (R1).',
      salesExp: 'Câu chép từ tin, không công việc nào chứng minh (R2).',
      drawings: 'Câu chép từ tin (R2).',
      english: 'Câu chép từ tin (R2).',
    },
    text: `NGỌC THỊ HUYỀN
GIỚI THIỆU
Có 3 năm kinh nghiệm bán hàng dự án, bán hàng kỹ thuật trong ngành cơ điện (MEP), van, đường ống, HVAC.
Đọc hiểu bản vẽ M&E, BOQ và hồ sơ thầu; biết lập báo giá kỹ thuật - thương mại.
Tiếng Anh đọc hiểu catalogue, datasheet kỹ thuật.
KINH NGHIỆM LÀM VIỆC
03/2021 - nay Chuyên viên trang điểm, Studio Áo Cưới Bạch Dương. Trang điểm cô dâu.
HỌC VẤN
Cao đẳng Văn hóa Nghệ thuật Sài Thành, ngành Thanh nhạc, 2017 - 2020`,
  },
  {
    id: 'se-26-stuffing-english-receptionist',
    kind: 'stuffing',
    form: 'en',
    tier: 'no',
    labels: labels('ambiguous', 'unknown', 'unmet', 'unknown', 'unmet', 'met'),
    why: {
      expForm: 'Spa receptionist (R1).',
      eduForm: 'No education stated (c30).',
      salesExp: 'Keyword only (R2).',
      degree: 'No education stated (c30).',
      drawings: 'Keyword only (R2).',
      english: 'CV written entirely in English (R5).',
    },
    text: `JENNY PHAM
Keywords: project sales, technical sales, MEP, valves, piping, HVAC, industrial equipment, M&E drawings, BOQ, tender, quotation
WORK EXPERIENCE
Apr 2023 - Present: Spa Receptionist at Lotus Spa. Greeted customers and handled bookings.`,
  },
  {
    id: 'se-27-fresher-says-no-technical-sales-yet',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'unmet', 'met', 'unmet', 'met'),
    why: { salesExp: 'CV tự ghi chưa có kinh nghiệm bán hàng kỹ thuật.', drawings: 'Không có hồ sơ thầu, báo giá (R3).' },
    text: `LÊ NHẬT HOÀNG
Mới tốt nghiệp, chưa có kinh nghiệm bán hàng kỹ thuật, mong muốn học thêm về bán hàng dự án HVAC.
THỰC TẬP
Thực tập sinh kỹ thuật, Công ty TNHH Điều hòa Phú Quý, 03/2026 - 06/2026. Đọc bản vẽ M&E.
HỌC VẤN
Đại học Kỹ thuật Miền Nam, chuyên ngành Nhiệt lạnh, 2021 - 2026. Đã tốt nghiệp.
NGOẠI NGỮ
Tiếng Anh đọc hiểu datasheet kỹ thuật`,
  },
  {
    id: 'se-28-project-sales-manager-hvac',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met'),
    text: `PHAN GIA HUY
KINH NGHIỆM LÀM VIỆC
Tháng 4/2018 đến nay: Trưởng phòng kinh doanh dự án, Công ty CP Thiết bị HVAC Liên Á
Quản lý nhóm bán hàng dự án HVAC cho bệnh viện, nhà máy; đọc bản vẽ M&E, BOQ, hồ sơ thầu; duyệt báo giá kỹ thuật - thương mại.
HỌC VẤN
Đại học Xây dựng Miền Trung, chuyên ngành Kỹ thuật xây dựng công trình, 2013 - 2018
NGOẠI NGỮ
TOEIC 700, đọc hiểu datasheet`,
  },
];

export const SALES_EVAL: JobEval<SalesKey> = { slug: SALES_SLUG, short: 'Sales Engineer', keys: KEYS, cvs: CVS };
