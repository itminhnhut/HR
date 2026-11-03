/**
 * Synthetic CVs for "Trợ Lý Giám Đốc". Fictional people and companies; labels and tiers were written before the
 * scorer was run on them (protocol in ./types.ts). "Today" for all dates is 2026-11-03.
 */
import type { JobEval, Label, LabelledCv } from './types.js';
import { ASSISTANT_SLUG } from './line-truth.js';

export type AssistantKey =
  'expForm' | 'eduForm' | 'degree' | 'roleExp' | 'bonusDomain' | 'partners' | 'soft' | 'english';

const KEYS: readonly AssistantKey[] = [
  'expForm',
  'eduForm',
  'degree',
  'roleExp',
  'bonusDomain',
  'partners',
  'soft',
  'english',
];

/** Labels in KEYS order; the organising line can never be judged from a CV. */
function labels(
  expForm: Label,
  eduForm: Label,
  degree: Label,
  roleExp: Label,
  bonusDomain: Label,
  partners: Label,
  english: Label,
): Record<AssistantKey, Label> {
  return { expForm, eduForm, degree, roleExp, bonusDomain, partners, soft: 'unknown', english };
}

const CVS: readonly LabelledCv<AssistantKey>[] = [
  {
    id: 'pa-01-director-assistant-mep-distributor',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `PHẠM THU TRANG
Trợ lý Giám đốc | 0911 000 201 | trang.pt@example.com
KINH NGHIỆM LÀM VIỆC
03/2022 - nay Trợ lý Giám đốc, Công ty CP Phân phối Thiết bị Cơ điện Việt Thắng
- Quản lý lịch làm việc của Giám đốc, soạn công văn, hợp đồng, báo giá bằng tiếng Việt và tiếng Anh
- Theo dõi dự án B2B trên CRM, làm việc với đối tác trong nước và hãng quốc tế tại châu Âu, Hàn Quốc
HỌC VẤN
Đại học Kinh tế Nam Bộ, 2017 - 2021. Chuyên ngành: Quản trị kinh doanh
NGOẠI NGỮ
Tiếng Anh: TOEIC 800, giao tiếp và viết email tốt`,
  },
  {
    id: 'pa-02-executive-secretary-building-materials',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `HOÀNG MAI CHI
KINH NGHIỆM LÀM VIỆC
Thư ký Điều hành
Tập đoàn Vật liệu Xây dựng Phú An
05/2021 - nay
• Hỗ trợ Tổng Giám đốc điều hành, ghi biên bản, theo dõi hạng mục sau họp
• Phụ trách quan hệ với đối tác trong nước và đối tác quốc tế từ Đức, Nhật
HỌC VẤN
Đại học Ngoại thương Phía Nam - Thương mại quốc tế (2016 - 2020)
NGOẠI NGỮ
IELTS 6.5 - giao tiếp tiếng Anh tốt`,
  },
  {
    id: 'pa-03-admin-coordinator-trade-law',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'unknown', 'met', 'met'),
    why: { bonusDomain: 'Công ty dịch vụ tài chính, không thuộc lĩnh vực được ưu tiên.' },
    text: `LÊ HOÀI AN
KINH NGHIỆM LÀM VIỆC
Điều phối Hành chính | Công ty CP Dịch vụ Tài chính Mặt Trời | 01/2023 - nay
- Điều phối hành chính giữa các phòng ban, tổ chức họp ban lãnh đạo
- Làm đầu mối với đối tác trong nước và đối tác nước ngoài, soạn hợp đồng
HỌC VẤN
Đại học Luật Phương Nam. Chuyên ngành: Luật thương mại quốc tế. 2017 - 2021
NGOẠI NGỮ
Tiếng Anh giao tiếp tốt, TOEIC 720`,
  },
  {
    id: 'pa-04-english-executive-assistant-b2b',
    kind: 'strong',
    form: 'en',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `MELISSA NGUYEN (NGUYEN NGOC MAI)
Executive Assistant to the Managing Director
WORK EXPERIENCE
Feb 2021 - Present: Executive Assistant to the Managing Director, Pacific Industrial Supply Co. (B2B distributor of technical products)
- Managed the Director's calendar, travel and board minutes
- Managed relationships with domestic and international partners in the EU and Korea
EDUCATION
Bachelor of Business Administration, Western City University, 2016 - 2020
LANGUAGES
English: fluent, IELTS 7.0`,
  },
  {
    id: 'pa-05-pdf-broken-lines',
    kind: 'strong',
    form: 'messy-pdf',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'unknown', 'met', 'met'),
    why: { bonusDomain: 'Công ty du lịch, không thuộc lĩnh vực được ưu tiên.' },
    text: `K I N H   N G H I Ệ M   L À M   V I Ệ C
Trợ lý
Giám đốc
Công ty CP Du lịch Hòa Bình Xanh
06/2023 –
nay
Sắp xếp lịch, chuẩn bị cuộc họp, quản lý quan hệ với đối tác trong
nước và đối tác quốc tế (Nhật, Thái).
TRẦN BẢO NGÂN  ·  ngan.tb@example.com
H Ọ C   V Ấ N
Đại học Kinh tế Nam Bộ
Chuyên ngành: Kinh tế
đối ngoại, 2018 – 2022
Trang 1/1
Tiếng Anh: TOEIC 750, giao tiếp tốt`,
  },
  {
    id: 'pa-06-no-diacritics-ceo-assistant',
    kind: 'strong',
    form: 'no-diacritics',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'met', 'met', 'met'),
    text: `DO THANH VAN
KINH NGHIEM LAM VIEC
Tro ly Tong Giam doc - Cong ty CP Thuong mai Ky thuat Dai Viet (phan phoi san pham ky thuat)
Thang 8/2021 - nay
Quan ly lich, bien ban hop; lam viec voi doi tac trong nuoc va quoc te
HOC VAN
Dai hoc Ngoai thuong Phia Nam, chuyen nganh Kinh te doi ngoai, 2016 - 2020
NGOAI NGU
Tieng Anh giao tiep tot, TOEIC 780`,
  },
  {
    id: 'pa-07-just-over-a-year',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'unknown', 'ambiguous', 'met'),
    why: {
      partners: 'Làm việc với đối tác trong nước; "có tham gia gặp đối tác nước ngoài" chưa hẳn là quản lý quan hệ.',
      bonusDomain: 'Công ty thực phẩm.',
    },
    text: `VƯƠNG KHÁNH LINH
KINH NGHIỆM LÀM VIỆC
09/2025 - nay Trợ lý Giám đốc, Công ty TNHH Thực phẩm Sạch Miền Tây
Lên lịch họp, soạn công văn, làm việc với đối tác trong nước; có tham gia gặp đối tác nước ngoài cùng Giám đốc.
HỌC VẤN
Học viện Ngoại giao Phương Nam, ngành Quan hệ quốc tế, 2019 - 2023
NGOẠI NGỮ
IELTS 6.0, giao tiếp tiếng Anh khá`,
  },
  {
    id: 'pa-08-secretary-eight-months',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('unmet', 'met', 'met', 'unmet', 'unknown', 'unmet', 'met'),
    text: `TÔ KIM NGÂN
KINH NGHIỆM LÀM VIỆC
01/2026 - 08/2026 Thư ký Điều hành, Công ty TNHH Dịch vụ Sao Việt. Ghi biên bản, sắp xếp lịch.
HỌC VẤN
Đại học Luật Phương Nam, chuyên ngành Luật thương mại, 2021 - 2025
NGOẠI NGỮ
Tiếng Anh: TOEIC 700`,
  },
  {
    id: 'pa-09-assistant-college-only',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'unmet', 'unmet', 'met', 'met', 'met', 'met'),
    text: `NGUYỄN HỒNG NHUNG
KINH NGHIỆM LÀM VIỆC
Trợ lý Giám đốc, Công ty TNHH Thiết bị Cơ điện Nam Long, 04/2022 - nay
Theo dõi đơn hàng B2B, quản lý quan hệ với đối tác trong nước và đối tác quốc tế.
HỌC VẤN
Cao đẳng Kinh tế Đối ngoại Sài Thành, ngành Quản trị văn phòng, 2018 - 2021
NGOẠI NGỮ
Tiếng Anh giao tiếp tốt, TOEIC 650`,
  },
  {
    id: 'pa-10-receptionist-admin',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'ambiguous', 'unknown', 'unmet', 'met'),
    why: { roleExp: 'Hành chính lễ tân gần với Điều phối Hành chính nhưng chưa hẳn cùng vị trí.' },
    text: `LÂM THỊ YẾN
KINH NGHIỆM LÀM VIỆC
Nhân viên Hành chính - Lễ tân
Công ty CP Bảo hiểm Trường An
07/2022 - nay
Tiếp khách, đặt phòng họp, quản lý văn phòng phẩm, chuyển công văn.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2018 - 2022
NGOẠI NGỮ
Tiếng Anh giao tiếp`,
  },
  {
    id: 'pa-11-sales-admin-b2b',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'unmet', 'met', 'ambiguous', 'met'),
    why: { partners: 'Trao đổi với nhà cung cấp nước ngoài qua email; "quản lý quan hệ" là chưa chắc.' },
    text: `MAI QUỲNH HOA
Sale Admin
KINH NGHIỆM LÀM VIỆC
06/2023 - nay Sale Admin, Công ty TNHH Kỹ thuật Vật tư Toàn Cầu (kinh doanh thương mại B2B)
Lập báo giá, theo dõi đơn hàng, email với nhà cung cấp nước ngoài và khách hàng trong nước.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kinh tế, 2019 - 2023
NGOẠI NGỮ
TOEIC 620, giao tiếp tiếng Anh tốt`,
  },
  {
    id: 'pa-12-assistant-english-language-major',
    kind: 'partial',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'ambiguous', 'met', 'unknown', 'met', 'met'),
    why: {
      degree: 'Ngôn ngữ Anh có được coi là "ngành liên quan" với vị trí trợ lý hay không tùy recruiter.',
      bonusDomain: 'Công ty giáo dục.',
    },
    text: `ĐỖ HỒNG PHÚC
KINH NGHIỆM LÀM VIỆC
Trợ lý Giám đốc - Công ty CP Giáo dục Quốc tế Bình Minh - 02/2022 - nay
Biên soạn công văn song ngữ, tháp tùng Giám đốc gặp đối tác trong nước và quốc tế, quản lý quan hệ với trường đối tác ở Úc.
HỌC VẤN
Đại học Ngoại ngữ Phương Nam, ngành Ngôn ngữ Anh, 2017 - 2021
NGOẠI NGỮ
Tiếng Anh thành thạo, IELTS 7.5`,
  },
  {
    id: 'pa-13-assistant-basic-english',
    kind: 'partial',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'met', 'met', 'met', 'unmet', 'unmet'),
    why: { partners: 'Chỉ đối tác trong nước.' },
    text: `HUỲNH THỊ LAN
KINH NGHIỆM LÀM VIỆC
08/2023 - nay Trợ lý Giám đốc, Công ty TNHH Vật liệu Xây dựng Hoàng Kim
Sắp xếp lịch, làm việc với đại lý và đối tác trong nước.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2019 - 2023
NGOẠI NGỮ
Tiếng Anh cơ bản`,
  },
  {
    id: 'pa-14-teaching-assistant',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unknown', 'unmet', 'met'),
    why: {
      expForm: '"Trợ giảng" là giáo dục, không phải trợ lý (R1).',
      degree: 'Sư phạm tiếng Anh, không liên quan.',
    },
    text: `QUÁCH MINH THƯ
KINH NGHIỆM LÀM VIỆC
2022 - nay Trợ giảng tiếng Anh, Trung tâm Anh ngữ Ngôi Sao. Hỗ trợ giáo viên, chấm bài.
HỌC VẤN
Đại học Sư phạm Phương Nam, chuyên ngành Sư phạm tiếng Anh, 2018 - 2022
NGOẠI NGỮ
Tiếng Anh: IELTS 7.0, thành thạo`,
  },
  {
    id: 'pa-15-hotel-receptionist',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'met'),
    why: { expForm: 'Lễ tân khách sạn: gần công việc văn phòng nhưng khác nghề (R1).' },
    text: `HÀ NGỌC TRÂM
KINH NGHIỆM LÀM VIỆC
06/2021 - nay Lễ tân, Khách sạn Biển Ngọc. Check-in, xử lý yêu cầu của khách nước ngoài.
HỌC VẤN
Cao đẳng Du lịch Sài Thành, Quản trị khách sạn, 2018 - 2021
NGOẠI NGỮ
Tiếng Anh giao tiếp tốt`,
  },
  {
    id: 'pa-16-shop-sales-assistant',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: { expForm: 'Trợ lý bán hàng cửa hàng (R1).', roleExp: 'Trợ lý cửa hàng, không phải Trợ lý Giám đốc.' },
    text: `CHU THỊ MƠ
KINH NGHIỆM LÀM VIỆC
2023 - nay Trợ lý bán hàng, Cửa hàng Mỹ phẩm Hoa Đào. Tư vấn khách, sắp xếp hàng trên kệ.
HỌC VẤN
Cao đẳng Thương mại Sài Thành, 2020 - 2023`,
  },
  {
    id: 'pa-17-legal-assistant',
    kind: 'near-miss',
    form: 'vi',
    tier: 'maybe',
    labels: labels('met', 'met', 'ambiguous', 'unmet', 'unknown', 'ambiguous', 'met'),
    why: {
      degree: 'Luật dân sự: gần Luật thương mại nhưng không đúng ngành.',
      partners: 'Làm việc với thân chủ trong và ngoài nước, không hẳn là đối tác của công ty.',
    },
    text: `BẠCH HẢI YẾN
KINH NGHIỆM LÀM VIỆC
Trợ lý luật sư, Văn phòng Luật sư Công Minh, 03/2022 - nay
Soạn hợp đồng, nghiên cứu hồ sơ, làm việc với thân chủ trong và ngoài nước.
HỌC VẤN
Đại học Luật Phương Nam, chuyên ngành Luật dân sự, 2018 - 2022
NGOẠI NGỮ
TOEIC 700, giao tiếp tiếng Anh tốt`,
  },
  {
    id: 'pa-18-sales-mentions-assistant-in-passing',
    kind: 'near-miss',
    form: 'vi',
    tier: 'no',
    labels: labels('met', 'met', 'met', 'unmet', 'met', 'unmet', 'unmet'),
    why: {
      expForm: 'Nhân viên kinh doanh B2B là nghề văn phòng gần đó (R1).',
      roleExp: 'Chỉ "phối hợp với Trợ lý Giám đốc", bản thân không giữ vị trí này.',
    },
    text: `NGUYỄN VĂN ĐẠT
KINH NGHIỆM LÀM VIỆC
Nhân viên kinh doanh, Công ty TNHH Vật liệu Xây dựng Tân Á, 09/2021 - nay
Bán hàng B2B cho đại lý trong tỉnh; phối hợp với Trợ lý Giám đốc gửi báo cáo tháng.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2017 - 2021`,
  },
  {
    id: 'pa-19-mechanical-engineer',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'unmet', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: { expForm: 'Kỹ sư bảo trì (R1).', bonusDomain: 'Bảo trì trong nhà máy thép, không phải lĩnh vực nêu trong tin.' },
    text: `TẠ QUANG HẢI
KINH NGHIỆM LÀM VIỆC
2020 - nay Kỹ sư bảo trì, Nhà máy Thép Nam Sông. Lập kế hoạch bảo trì máy cán.
HỌC VẤN
Đại học Kỹ thuật Miền Nam, Kỹ thuật cơ khí, 2015 - 2020
KỸ NĂNG
AutoCAD, Excel`,
  },
  {
    id: 'pa-20-nurse',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: { expForm: 'Điều dưỡng (R1).' },
    text: `LÊ THỊ HẠNH
KINH NGHIỆM LÀM VIỆC
03/2018 - nay Điều dưỡng viên, Bệnh viện Đa khoa Tâm An. Chăm sóc bệnh nhân khoa Nội.
HỌC VẤN
Cao đẳng Y tế Phương Nam, ngành Điều dưỡng, 2015 - 2018`,
  },
  {
    id: 'pa-21-general-accountant',
    kind: 'wrong-domain',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'met', 'ambiguous', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: {
      expForm: 'Kế toán (R1).',
      degree: 'Kế toán thuộc khối kinh tế: có recruiter coi là ngành liên quan.',
    },
    text: `PHAN THỊ THU
KINH NGHIỆM LÀM VIỆC
Kế toán tổng hợp, Công ty TNHH May Sài Thành, 01/2020 - nay
Hạch toán, kê khai thuế, làm báo cáo cho Giám đốc.
HỌC VẤN
Đại học Kinh tế Nam Bộ, chuyên ngành Kế toán, 2016 - 2020
KỸ NĂNG
MISA, Excel`,
  },
  {
    id: 'pa-22-cafe-waiter',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: { expForm: 'Phục vụ (R1).' },
    text: `TRẦN VĂN TÝ
KINH NGHIỆM
06/2024 - nay Phục vụ, Quán Cà Phê Góc Phố. Pha chế cơ bản, dọn bàn.
HỌC VẤN
Tốt nghiệp THPT Bình Minh, 2023`,
  },
  {
    id: 'pa-23-third-year-student',
    kind: 'non-fit',
    form: 'vi',
    tier: 'no',
    labels: labels('unmet', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'met'),
    why: { english: 'TOEIC 650, giao tiếp được.' },
    text: `DƯƠNG THỊ NGỌC
Sinh viên năm 3, Đại học Kinh tế Nam Bộ, chuyên ngành Quản trị kinh doanh
KINH NGHIỆM
06/2026 - 09/2026 Cộng tác viên sự kiện, Câu lạc bộ Sinh viên Năng động
HỌC VẤN
Đại học Kinh tế Nam Bộ, 2024 - nay
NGOẠI NGỮ
TOEIC 650, giao tiếp tiếng Anh tốt`,
  },
  {
    id: 'pa-24-stuffing-list-shipper',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'ambiguous'),
    why: {
      expForm: 'Shipper (R1).',
      roleExp: 'Từ khóa chép từ tin, lịch sử làm việc là giao hàng (R2).',
      partners: 'Chép từ tin (R2).',
      english: 'Một dòng tự khai (R2).',
    },
    text: `LÝ VĂN TÈO
KỸ NĂNG
Trợ lý Giám đốc, Thư ký Điều hành, Điều phối Hành chính, B2B, vật liệu xây dựng, thiết bị cơ điện
Quản lý quan hệ đối tác trong nước và quốc tế. Giao tiếp tiếng Anh tốt.
KINH NGHIỆM LÀM VIỆC
04/2022 - nay Nhân viên giao hàng, Công ty Giao Nhanh Sài Thành. Giao đơn bằng xe máy.
HỌC VẤN
THPT Bến Thành, 2021`,
  },
  {
    id: 'pa-25-stuffing-summary-driver',
    kind: 'stuffing',
    form: 'vi',
    tier: 'no',
    labels: labels('ambiguous', 'unmet', 'unmet', 'unmet', 'unknown', 'unmet', 'ambiguous'),
    why: {
      expForm: 'Tài xế (R1).',
      roleExp: 'Câu chép nguyên từ tin ở phần giới thiệu, không có công việc nào chứng minh (R2).',
      bonusDomain: 'Câu chép từ tin; không có công việc chứng minh, coi như không thể hiện.',
      partners: 'Chép từ tin (R2).',
      english: 'Chép từ tin (R2).',
    },
    text: `MA VĂN CƯỜNG
GIỚI THIỆU
Có 1 năm kinh nghiệm ở vị trí Trợ Lý Giám Đốc, Thư Ký Điều Hành.
Có kinh nghiệm trong lĩnh vực kinh doanh thương mại B2B, vật liệu xây dựng, thiết bị cơ điện.
Đã từng quản lý quan hệ với đối tác trong nước và quốc tế. Đọc hiểu và giao tiếp tiếng Anh tốt.
KINH NGHIỆM LÀM VIỆC
2019 - nay Tài xế xe tải, Công ty Vận tải Đại Lộc. Chở hàng tuyến TP.HCM - Cần Thơ.
HỌC VẤN
Tốt nghiệp THPT Long An, 2015
Bằng lái C`,
  },
  {
    id: 'pa-26-stuffing-english-barista',
    kind: 'stuffing',
    form: 'en',
    tier: 'no',
    labels: labels('ambiguous', 'unknown', 'unknown', 'unmet', 'unknown', 'unmet', 'unknown'),
    why: {
      expForm: 'Barista (R1).',
      eduForm: 'No education stated (c30).',
      degree: 'No education stated (c30).',
      roleExp: 'Keyword only (R2).',
      partners: 'Keyword only (R2).',
      english: 'CV in English, no level stated (R5).',
    },
    text: `HANNAH VO
Keywords: Executive Assistant, Director Assistant, Executive Secretary, B2B, partner management, deadlines, calendar
WORK EXPERIENCE
Jan 2022 - Present: Barista at Cloud Nine Coffee. Made drinks and served customers on weekends and weekdays.`,
  },
  {
    id: 'pa-27-objective-only-office-staff',
    kind: 'partial',
    form: 'vi',
    tier: 'no',
    labels: labels('unmet', 'met', 'met', 'unmet', 'unknown', 'unmet', 'unmet'),
    why: { roleExp: 'Chỉ mong muốn trở thành Trợ lý Giám đốc.' },
    text: `HÀN NHƯ Ý
MỤC TIÊU NGHỀ NGHIỆP
Mong muốn trở thành Trợ lý Giám đốc trong 3 năm tới.
KINH NGHIỆM LÀM VIỆC
02/2026 - 08/2026 Nhân viên hành chính, Công ty TNHH Dịch vụ Sao Mai. Lưu trữ hồ sơ, đặt văn phòng phẩm.
HỌC VẤN
Đại học Kinh tế Nam Bộ, Quản trị kinh doanh, 2021 - 2025`,
  },
  {
    id: 'pa-28-board-secretary-older-role',
    kind: 'strong',
    form: 'vi',
    tier: 'interview',
    labels: labels('met', 'met', 'met', 'met', 'unknown', 'met', 'met'),
    why: { bonusDomain: 'Ngân hàng, không thuộc lĩnh vực được ưu tiên.' },
    text: `CAO THỊ MINH CHÂU
KINH NGHIỆM LÀM VIỆC
Thư ký Điều hành Ban Giám đốc
Ngân hàng TMCP Phương Đông Á
06/2018 - 12/2024
Điều phối lịch họp Hội đồng, soạn nghị quyết, làm việc với đối tác trong nước và đối tác quốc tế.
HỌC VẤN
Đại học Ngoại thương Phía Nam, Thương mại quốc tế, 2014 - 2018
NGOẠI NGỮ
TOEIC 820, giao tiếp tiếng Anh tốt`,
  },
];

export const ASSISTANT_EVAL: JobEval<AssistantKey> = { slug: ASSISTANT_SLUG, short: 'Assistant', keys: KEYS, cvs: CVS };
