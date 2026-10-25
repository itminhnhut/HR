/**
 * Fields of work / study ("bán hàng", "kế toán") and the words that show a CV job or degree belongs to them.
 */
import { findGroupHits, groupById } from './keywords.js';
import { fold } from './normalize.js';
import { hasAnyTerm } from './text-match.js';

const RAW_FIELDS: string[][] = [
  [
    'bán hàng',
    'sales',
    'sale',
    'kinh doanh',
    'business development',
    'tư vấn bán hàng',
    'telesales',
    'telesale',
    'bán lẻ',
    'retail',
    'cửa hàng',
    'showroom',
    'chốt đơn',
    'account executive',
    'phát triển thị trường',
    'salesman',
    'sales executive',
  ],
  ['kế toán', 'accounting', 'accountant', 'kế toán viên', 'kiểm toán', 'audit', 'auditor', 'bookkeeper'],
  [
    'marketing',
    'tiếp thị',
    'digital marketing',
    'content',
    'seo',
    'quảng cáo',
    'truyền thông',
    'brand',
    'social media',
  ],
  [
    'nhân sự',
    'hr',
    'human resources',
    'tuyển dụng',
    'recruitment',
    'recruiter',
    'c&b',
    'hành chính nhân sự',
    'talent acquisition',
  ],
  [
    'chăm sóc khách hàng',
    'cskh',
    'customer service',
    'customer support',
    'call center',
    'tổng đài',
    'tổng đài viên',
    'customer care',
  ],
  [
    'lập trình',
    'developer',
    'software engineer',
    'frontend',
    'front-end',
    'backend',
    'back-end',
    'fullstack',
    'full-stack',
    'lập trình viên',
    'programmer',
    'web developer',
    'software developer',
  ],
  ['thủ kho', 'kho hàng', 'nhân viên kho', 'quản lý kho', 'warehouse', 'kho vận', 'xuất nhập kho', 'logistics'],
  ['giao hàng', 'shipper', 'delivery', 'giao nhận', 'tài xế', 'driver', 'lái xe'],
  ['thiết kế', 'designer', 'design', 'đồ họa', 'graphic'],
  ['hành chính', 'admin', 'administrative', 'lễ tân', 'receptionist', 'thư ký', 'secretary', 'văn phòng'],
  ['xuất nhập khẩu', 'import export', 'chứng từ', 'customs', 'hải quan', 'logistics'],
  ['giáo viên', 'giảng dạy', 'teacher', 'tutor', 'gia sư', 'teaching', 'trợ giảng', 'giảng viên'],
  [
    'phục vụ',
    'waiter',
    'waitress',
    'nhà hàng',
    'restaurant',
    'f&b',
    'barista',
    'pha chế',
    'bartender',
    'quán cà phê',
    'cafe',
  ],
  ['bảo vệ', 'security guard', 'an ninh'],
  ['tài chính', 'finance', 'financial', 'ngân hàng', 'banking'],
  [
    'công nghệ thông tin',
    'cntt',
    'information technology',
    'khoa học máy tính',
    'computer science',
    'kỹ thuật phần mềm',
    'software engineering',
    'hệ thống thông tin',
    'information systems',
    'tin học',
  ],
  ['quản trị kinh doanh', 'qtkd', 'business administration', 'business management'],
  ['kiểm thử', 'tester', 'qa', 'qc', 'testing', 'test'],
  ['tư vấn', 'consultant', 'consulting', 'advisor', 'tư vấn viên'],
  ['quản lý', 'manager', 'management', 'trưởng nhóm', 'team lead', 'leader', 'giám sát', 'supervisor', 'trưởng phòng'],
  ['bất động sản', 'real estate', 'môi giới'],
  ['bảo hiểm', 'insurance'],
  ['điều dưỡng', 'y tá', 'nurse', 'nursing'],
];

const FIELDS: string[][] = RAW_FIELDS.map((list) => list.map(fold));

export interface FieldSpec {
  /** As HR wrote it, folded ("ban hang"). */
  label: string;
  /** Folded words that put a job or degree in this field. */
  terms: string[];
}

const FILLER =
  /\b(lam viec|cong viec|trong|linh vuc|nganh|nganh nghe|vi tri|o|lien quan den|lien quan toi|thuc te|chuyen mon|it nhat|toi thieu|tro len|nam|years?|of|in|the|as|a|an|field|role|position|related to|tuong ung)\b/g;

/** "Kinh nghiệm bán hàng" → field "bán hàng" with synonyms; null when nothing specific is left. */
export function buildField(phraseFolded: string): FieldSpec | null {
  const label = phraseFolded.replace(/[\d+]/g, ' ').replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (label.length < 2) return null;
  const terms = new Set<string>();
  for (const list of FIELDS) if (hasAnyTerm(label, list)) list.forEach((t) => terms.add(t));
  for (const hit of findGroupHits(label, 'req')) groupById(hit.groupId)?.terms.forEach((t) => terms.add(t));
  if (terms.size === 0) terms.add(label);
  return { label, terms: [...terms] };
}

/** "tương đương", "liên quan": a field HR did not name, which cannot be checked automatically. */
export function isRelatedOnly(phraseFolded: string): boolean {
  return /\b(tuong duong|lien quan|tuong tu|phu hop|trong nganh|cung nganh|relevant|related|similar|equivalent|in the (?:industry|field))\b/.test(
    phraseFolded,
  );
}

export function matchesField(folded: string, field: FieldSpec): boolean {
  return hasAnyTerm(folded, field.terms);
}
