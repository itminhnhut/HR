/**
 * Families of studies, for "… hoặc ngành liên quan": a major is judged related when it sits in the same family as
 * one the ad names, unrelated when it sits in another known family, and left to HR when we do not know it.
 * Listed narrowest first: logistics studies are also business studies, but an ad asking for them does not take
 * every business degree.
 */
import { fold } from './normalize.js';
import { hasAnyTerm, hasTerm } from './text-match.js';

const RAW_FAMILIES: readonly (readonly string[])[] = [
  [
    'logistics',
    'xuất nhập khẩu',
    'ngoại thương',
    'kinh doanh quốc tế',
    'kinh tế đối ngoại',
    'thương mại quốc tế',
    'chuỗi cung ứng',
    'supply chain',
    'vận tải',
    'giao thông vận tải',
    'hàng hải',
    'international business',
    'international trade',
    'foreign trade',
  ],
  ['kế toán', 'kiểm toán', 'accounting', 'auditing'],
  ['tài chính', 'ngân hàng', 'finance', 'banking'],
  [
    'quản trị kinh doanh',
    'qtkd',
    'kinh tế',
    'kinh doanh',
    'thương mại',
    'quan hệ quốc tế',
    'luật thương mại',
    'luật kinh tế',
    'marketing',
    'quản trị văn phòng',
    'business',
    'business administration',
    'commerce',
    'economics',
    'international relations',
  ],
  ['luật', 'law', 'pháp luật'],
  [
    'công nghệ thông tin',
    'cntt',
    'khoa học máy tính',
    'kỹ thuật phần mềm',
    'hệ thống thông tin',
    'information technology',
    'computer science',
    'software engineering',
    'tin học',
  ],
  [
    'cơ khí',
    'nhiệt lạnh',
    'nhiệt',
    'điện',
    'điện lạnh',
    'điện tử',
    'điện công nghiệp',
    'cơ điện',
    'cấp thoát nước',
    'xây dựng',
    'công trình',
    'kỹ thuật',
    'công nghệ kỹ thuật',
    'tự động hóa',
    'máy lạnh',
    'kiến trúc',
    'mechanical',
    'electrical',
    'civil',
    'hvac',
    'engineering',
    'plumbing',
  ],
  [
    'y',
    'y khoa',
    'y học',
    'bác sĩ',
    'bác sĩ đa khoa',
    'y đa khoa',
    'y tế',
    'điều dưỡng',
    'dược',
    'nursing',
    'medicine',
    'pharmacy',
  ],
  ['sư phạm', 'giáo dục', 'mầm non', 'education', 'teaching'],
  ['ngôn ngữ', 'ngoại ngữ', 'tiếng anh', 'tiếng nhật', 'tiếng trung', 'tiếng hàn', 'tiếng pháp', 'linguistics'],
  ['thanh nhạc', 'âm nhạc', 'nghệ thuật', 'mỹ thuật', 'điện ảnh', 'sân khấu', 'music', 'fine arts'],
  ['du lịch', 'khách sạn', 'nhà hàng', 'hospitality', 'tourism'],
  ['nông nghiệp', 'thủy sản', 'lâm nghiệp', 'chăn nuôi', 'agriculture'],
  ['công nghệ thực phẩm', 'thực phẩm', 'food technology'],
  ['thiết kế nội thất', 'nội thất', 'thiết kế đồ họa', 'đồ họa', 'interior design', 'graphic design'],
  ['may', 'dệt may', 'thời trang', 'nghề may', 'fashion'],
];

const FAMILIES: readonly string[][] = RAW_FAMILIES.map((f) => f.map(fold));

/** Names of the same study. */
const SYNONYMS: readonly string[][] = [
  ['thương mại', 'commerce', 'trade'],
  ['kinh tế', 'economics'],
  ['kế toán', 'accounting'],
  ['tài chính', 'finance'],
  ['ngân hàng', 'banking'],
  ['quản trị kinh doanh', 'qtkd', 'business administration', 'business management'],
  [
    'ngoại thương',
    'kinh doanh quốc tế',
    'thương mại quốc tế',
    'kinh tế đối ngoại',
    'foreign trade',
    'international business',
    'international trade',
  ],
  ['logistics', 'chuỗi cung ứng', 'supply chain', 'quản lý chuỗi cung ứng'],
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
  ['điều dưỡng', 'nursing'],
  ['y', 'y khoa', 'y học', 'y đa khoa', 'bác sĩ đa khoa', 'bác sĩ', 'medicine'],
  ['dược', 'dược sĩ', 'dược học', 'pharmacy'],
  ['sư phạm mầm non', 'giáo dục mầm non', 'mầm non'],
  ['sư phạm', 'giáo dục', 'education'],
  ['cơ khí', 'mechanical', 'mechanical engineering'],
  ['điện', 'electrical', 'electrical engineering', 'điện công nghiệp', 'kỹ thuật điện'],
  ['xây dựng', 'civil engineering', 'construction'],
  ['marketing', 'tiếp thị'],
  ['truyền thông', 'communications', 'media', 'báo chí', 'journalism'],
  ['luật', 'law'],
].map((set) => set.map(fold));
/** Families close enough that only HR can tell whether the major fits: logistics, accounting, finance, business. */
const NEIGHBOURS: ReadonlySet<number> = new Set([0, 1, 2, 3]);

function familyOf(major: string): number {
  return FAMILIES.findIndex((f) => hasAnyTerm(major, f));
}

export function isKnownMajor(major: string): boolean {
  return familyOf(major) >= 0;
}

export function isSameFamily(a: string, b: string): boolean {
  const family = familyOf(a);
  return family >= 0 && family === familyOf(b);
}

/** Two majors of different families that a recruiter would still weigh rather than rule out. */
export function isNeighbourFamily(a: string, b: string): boolean {
  return NEIGHBOURS.has(familyOf(a)) && NEIGHBOURS.has(familyOf(b));
}

/** A word of this length alone is too short to stand for a study inside a longer name: "Toán" in "Kế toán". */
const LEADS_ONE_WORD_MAJOR = /^(?:cong nghe|ky thuat|su pham|khoa hoc|cu nhan)\s/;

/** `short` opens `long`, or follows a word that only says what kind of study it is ("Công nghệ Sinh học"). */
function isOpeningOf(long: string, short: string): boolean {
  if (short.includes(' ')) return hasTerm(long, short);
  return long === short || long.startsWith(`${short} `) || (LEADS_ONE_WORD_MAJOR.test(long) && hasTerm(long, short));
}

/** Every word of the major in another order or with others between them: "Quản trị nhà hàng khách sạn". */
function hasAllWords(cvMajor: string, wanted: string): boolean {
  const words = wanted.split(' ');
  return words.length >= 3 && words.every((w) => hasTerm(cvMajor, w));
}

/** The CV's major and the wanted one name the same study by their words. */
export function isSameMajorName(cvMajor: string, wanted: string): boolean {
  return isOpeningOf(cvMajor, wanted) || isOpeningOf(wanted, cvMajor) || hasAllWords(cvMajor, wanted);
}

function restAfter(major: string, term: string): string {
  return major.replace(term, ' ').replace(/\s+/g, ' ').trim();
}

function termsIn(major: string, set: readonly string[]): string[] {
  return set.filter((t) => hasTerm(major, t)).sort((a, b) => a.length - b.length);
}

interface StudyParts {
  /** What is left of the major besides the words every name of the study shares ("tiểu học" of "giáo dục tiểu học"). */
  cv: string;
  wanted: string;
}

/** Each major split at the widest name of the study; null when the longest names leave nothing, so they are one study. */
function studyParts(cvMajor: string, wanted: string, set: readonly string[]): StudyParts | null {
  const cvTerms = termsIn(cvMajor, set);
  const wantedTerms = termsIn(wanted, set);
  const cvWidest = cvTerms[0];
  const wantedWidest = wantedTerms[0];
  if (cvWidest === undefined || wantedWidest === undefined) return { cv: cvMajor, wanted };
  const cvLongest = cvTerms[cvTerms.length - 1] ?? cvWidest;
  const wantedLongest = wantedTerms[wantedTerms.length - 1] ?? wantedWidest;
  if (restAfter(cvMajor, cvLongest) === '' && restAfter(wanted, wantedLongest) === '') return null;
  return { cv: restAfter(cvMajor, cvWidest), wanted: restAfter(wanted, wantedWidest) };
}

function setsHolding(a: string, b: string): (readonly string[])[] {
  return SYNONYMS.filter((set) => hasAnyTerm(a, set) && hasAnyTerm(b, set));
}

/** Both majors name the same study ("Thương mại" and "Commerce"), the specialism asked for included. */
export function areSynonymMajors(cvMajor: string, wanted: string): boolean {
  return setsHolding(cvMajor, wanted).some((set) => {
    const parts = studyParts(cvMajor, wanted, set);
    return parts === null || parts.wanted === '' || parts.wanted === parts.cv;
  });
}

/** The CV names the wide study and not the specialism asked for: "Sư phạm" for "Giáo dục Tiểu học". */
export function isWiderStudy(cvMajor: string, wanted: string): boolean {
  return setsHolding(cvMajor, wanted).some((set) => {
    const parts = studyParts(cvMajor, wanted, set);
    return parts !== null && parts.cv === '' && parts.wanted !== '';
  });
}
