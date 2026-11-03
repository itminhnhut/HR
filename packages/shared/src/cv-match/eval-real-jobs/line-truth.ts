/**
 * What each real requirement line asks, written by reading the ad before running the parser on it.
 * The line text is checked against the saved job JSON by line-understanding.test.ts.
 */
import type { LineTruth } from './types.js';

export const HVAC_SLUG = 'ky-su-co-dien-lanh-hvac';
export const ASSISTANT_SLUG = 'tro-ly-giam-doc';
export const LOGISTICS_SLUG = 'nhan-vien-chung-tu-logistics-yeu-cau-kinh-nghiem-1-nam';
export const SALES_SLUG = 'sale-engineer';

const HVAC: readonly LineTruth[] = [
  { key: 'expForm', line: 'Kinh nghiệm: 1 năm', classes: ['experience'], bonus: 'none', minMonths: 12 },
  { key: 'eduForm', line: 'Học vấn: Cao đẳng trở lên', classes: ['education'], bonus: 'none', minEducationLevel: 3 },
  {
    key: 'degree',
    line: 'Tốt nghiệp Cao đẳng trở lên chuyên ngành Nhiệt lạnh, Cơ khí, Cấp thoát nước, Điện, Kỹ thuật công trình hoặc ngành liên quan.',
    classes: ['education'],
    bonus: 'none',
    minEducationLevel: 3,
    majors: ['nhiet lanh', 'co khi', 'cap thoat nuoc', 'dien', 'ky thuat cong trinh'],
    relatedMajorsAccepted: true,
  },
  {
    key: 'tools',
    line: 'Đọc hiểu bản vẽ MEP, BOQ, spec kỹ thuật; sử dụng được AutoCAD và Excel.',
    classes: ['skill'],
    bonus: 'none',
    skills: ['ban ve mep', 'boq', 'spec', 'autocad', 'excel'],
  },
  {
    key: 'systems',
    line: 'Có hiểu biết về hệ thống HVAC, cấp thoát nước, PCCC.',
    classes: ['skill'],
    bonus: 'none',
    skills: ['hvac', 'cap thoat nuoc', 'pccc'],
  },
  {
    key: 'bonusExp',
    line: 'Ưu tiên ứng viên có từ 1 năm kinh nghiệm ở vị trí kỹ thuật, pre-sale hoặc thiết kế tại công ty MEP, HVAC, nhà thầu, nhà phân phối thiết bị.',
    classes: ['experience'],
    bonus: 'whole',
    minMonths: 12,
    fieldCounts: ['ky su pre-sale nha phan phoi thiet bi hvac', 'ky su thiet ke cong ty mep'],
    fieldDoesNotCount: ['ky thuat vien sua tu lanh may giat dan dung', 'thiet ke do hoa cong ty quang cao'],
  },
  {
    key: 'english',
    line: 'Đọc hiểu tài liệu kỹ thuật tiếng Anh.',
    classes: ['language'],
    bonus: 'none',
    minEnglishLevel: 2,
  },
  { key: 'soft', line: 'Cẩn thận, tư duy logic, phối hợp tốt với các bộ phận.', classes: ['soft'], bonus: 'none' },
];

const ASSISTANT: readonly LineTruth[] = [
  { key: 'expForm', line: 'Kinh nghiệm: 1 năm', classes: ['experience'], bonus: 'none', minMonths: 12 },
  { key: 'eduForm', line: 'Học vấn: Đại học trở lên', classes: ['education'], bonus: 'none', minEducationLevel: 4 },
  {
    key: 'degree',
    line: 'Tốt nghiệp Đại học chuyên ngành Quản trị Kinh doanh, Kinh tế, Thương mại Quốc tế, Quan hệ Quốc tế, Luật thương mạihoặc ngành liên quan.',
    classes: ['education'],
    bonus: 'none',
    minEducationLevel: 4,
    majors: ['quan tri kinh doanh', 'kinh te', 'thuong mai quoc te', 'quan he quoc te', 'luat thuong mai'],
    relatedMajorsAccepted: true,
  },
  {
    key: 'roleExp',
    line: 'Từ 1 năm kinh nghiệm ở vị trí Trợ Lý Giám Đốc, Thư Ký Điều Hành hoặc Điều Phối Hành Chính.',
    classes: ['experience'],
    bonus: 'none',
    minMonths: 12,
    fieldCounts: ['tro ly giam doc', 'thu ky dieu hanh', 'dieu phoi hanh chinh'],
    fieldDoesNotCount: ['nhan vien phuc vu quan ca phe', 'nhan vien giao hang'],
  },
  {
    key: 'bonusDomain',
    line: 'Có kinh nghiệm trong lĩnh vực kinh doanh thương mại B2B, vật liệu xây dựng, thiết bị cơ điện hoặc phân phối sản phẩm kỹ thuật là ưu tiên.',
    classes: ['experience'],
    bonus: 'whole',
    fieldCounts: ['kinh doanh thuong mai b2b', 'vat lieu xay dung', 'thiet bi co dien', 'phan phoi san pham ky thuat'],
    fieldDoesNotCount: ['nhan vien phuc vu quan ca phe'],
  },
  {
    key: 'partners',
    line: 'Đã từng quản lý quan hệ với đối tác trong nước và quốc tế.',
    classes: ['experience'],
    bonus: 'none',
  },
  {
    key: 'soft',
    line: 'Kỹ năng tổ chức và quản lý thời gian xuất sắc — xử lý được nhiều nhiệm vụ song song trong môi trường deadline chặt.',
    classes: ['soft'],
    bonus: 'none',
  },
  {
    key: 'english',
    line: 'Khả năng viết và giao tiếp tiếng Việt chính xác, chuyên nghiệp; đọc hiểu và giao tiếp tiếng Anh tốt (cả viết và nói).',
    classes: ['language'],
    bonus: 'none',
    minEnglishLevel: 3,
  },
];

const LOGISTICS: readonly LineTruth[] = [
  { key: 'expForm', line: 'Kinh nghiệm: 1 năm', classes: ['experience'], bonus: 'none', minMonths: 12 },
  { key: 'eduForm', line: 'Học vấn: Cao đẳng trở lên', classes: ['education'], bonus: 'none', minEducationLevel: 3 },
  {
    key: 'degree',
    line: 'Tốt nghiệp Cao đẳng/Đại học ngành Logistics, Xuất nhập khẩu, Ngoại thương hoặc liên quan.',
    classes: ['education'],
    bonus: 'none',
    minEducationLevel: 3,
    majors: ['logistics', 'xuat nhap khau', 'ngoai thuong'],
    relatedMajorsAccepted: true,
  },
  {
    key: 'customsExp',
    line: 'Tối thiểu 1-2 năm kinh nghiệm làm thủ tục nhập khẩu, khai báo hải quan.',
    classes: ['experience'],
    bonus: 'none',
    minMonths: 12,
    fieldCounts: ['nhan vien khai bao hai quan hang nhap khau', 'phu trach thu tuc nhap khau'],
    fieldDoesNotCount: ['giao hang cho cong ty logistics', 'thu kho xuat nhap kho'],
  },
  {
    key: 'customsSkills',
    line: 'Thành thạo khai báo hải quan điện tử (VNACCS/VCIS), tra cứu mã HS Code, tính thuế nhập khẩu.',
    classes: ['skill'],
    bonus: 'none',
    skills: ['vnaccs', 'hs code', 'thue nhap khau'],
  },
  {
    key: 'incoterms',
    line: 'Hiểu biết về Incoterms và các phương thức thanh toán quốc tế (L/C, T/T...).',
    classes: ['skill'],
    bonus: 'none',
    skills: ['incoterms', 'l/c', 't/t'],
  },
  {
    key: 'english',
    line: 'Đọc hiểu tiếng Anh chuyên ngành (chứng từ, email với đối tác nước ngoài).',
    classes: ['language'],
    bonus: 'none',
    minEnglishLevel: 2,
  },
  {
    key: 'office',
    line: 'Thành thạo Word, Excel; biết phần mềm ERP/logistics là lợi thế.',
    classes: ['skill'],
    bonus: 'part',
    skills: ['word', 'excel'],
    bonusSkills: ['erp'],
  },
  { key: 'soft', line: 'Kỹ năng giao tiếp, đàm phán tốt.', classes: ['soft'], bonus: 'none' },
];

const SALES: readonly LineTruth[] = [
  { key: 'expForm', line: 'Kinh nghiệm: Từ 1 năm', classes: ['experience'], bonus: 'none', minMonths: 12 },
  { key: 'eduForm', line: 'Học vấn: Cao đẳng trở lên', classes: ['education'], bonus: 'none', minEducationLevel: 3 },
  {
    key: 'salesExp',
    line: 'Tối thiểu 1 năm kinh nghiệm bán hàng dự án hoặc bán hàng kỹ thuật trong ngành cơ điện (MEP), van – đường ống, HVAC hoặc thiết bị công nghiệp.',
    classes: ['experience'],
    bonus: 'none',
    minMonths: 12,
    fieldCounts: ['ky su ban hang du an van duong ong', 'ban hang ky thuat thiet bi cong nghiep hvac'],
    fieldDoesNotCount: ['ban my pham tai cua hang', 'tu van ban bao hiem', 'nhan vien kinh doanh bat dong san'],
  },
  {
    key: 'degree',
    line: 'Tốt nghiệp Cao đẳng/Đại học chuyên ngành Cơ khí, Nhiệt lạnh, Cấp thoát nước, Kỹ thuật xây dựng – công trình, Kinh doanh hoặc tương đương.',
    classes: ['education'],
    bonus: 'none',
    minEducationLevel: 3,
    majors: ['co khi', 'nhiet lanh', 'cap thoat nuoc', 'ky thuat xay dung', 'kinh doanh'],
    relatedMajorsAccepted: true,
  },
  {
    key: 'drawings',
    line: 'Đọc hiểu bản vẽ M&E, BOQ và hồ sơ thầu; biết lập báo giá kỹ thuật – thương mại.',
    classes: ['skill'],
    bonus: 'none',
    skills: ['ban ve m&e', 'boq', 'ho so thau', 'bao gia'],
  },
  {
    key: 'softComm',
    line: 'Giao tiếp, thuyết trình, đàm phán tốt và làm việc độc lập; chủ động xây dựng, duy trì quan hệ khách hàng.',
    classes: ['soft'],
    bonus: 'none',
  },
  {
    key: 'english',
    line: 'Tiếng Anh đọc hiểu catalogue, datasheet kỹ thuật.',
    classes: ['language'],
    bonus: 'none',
    minEnglishLevel: 2,
  },
  { key: 'softAttitude', line: 'Tác phong chuyên nghiệp, trung thực, cầu tiến.', classes: ['soft'], bonus: 'none' },
];

export const LINE_TRUTH: Readonly<Record<string, readonly LineTruth[]>> = {
  [HVAC_SLUG]: HVAC,
  [ASSISTANT_SLUG]: ASSISTANT,
  [LOGISTICS_SLUG]: LOGISTICS,
  [SALES_SLUG]: SALES,
};
