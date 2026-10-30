/** Word lists for telling a person's name from headings, job titles, schools, companies and addresses. */
import { fold, hasDiacritics, wordList as list } from './text.js';

/** Splits a comma-separated phrase list. */
function phrases(text: string): string[] {
  return text
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Common Vietnamese family names, folded (so "Nguyễn" and "NGUYEN" both match). */
export const SURNAMES = new Set(
  list(`
  ba nguyen tran le pham hoang huynh phan vu vo dang bui do ho ngo duong ly dinh truong doan lam mai ta cao chau
  luu to ha trieu thai quach luong la tang kieu khuc khong ung vuong diep giang tieu mac lai phung nghiem tong
  thach au kha lo han chu ton ninh bach banh dao dam giap hua khuu lac man nham phi sam than thieu trinh vi
  chung lieu luc ong quan tat hau yen mach ngan trac van cu kim
`),
);

/** Middle names that end the first half of a name broken over two lines ("NGUYỄN THỊ" / "MAI ANH"). */
export const MIDDLE_NAMES = new Set(
  list(`
  nu that thi van duc huu ngoc minh thanh quang hoang xuan kim thu bao gia tuan hong thuy hai anh phuong cong dinh
  quoc trung tien nhu my dieu khanh thai tuong manh viet hoai bich diem tuyet cam lan mai ha trong dang
`),
);

/** Honorifics that start a reference person's line ("Ông Nguyễn Văn B"). Compared lowercase with tones. */
export const HONORIFICS = new Set(list('ông bà mr mrs ms miss dr thầy cô chị anh sir madam'));

/**
 * Multi-word phrases that never form a person's name (headings, job titles, schools, companies, places).
 * Written with tones: matched with tones when the line has them, folded otherwise.
 */
const STOP_PHRASES = phrases(`
  kế toán, nhân viên, kinh doanh, công ty, đại học, cao đẳng, trung cấp, trung học, học viện, hồ sơ, sơ yếu
  lý lịch, xin việc, thông tin, cá nhân, mục tiêu, nghề nghiệp, kinh nghiệm, làm việc, học vấn, kỹ năng
  kĩ năng, chuyên viên, trưởng phòng, phó phòng, giám đốc, quản lý, tổng hợp, hành chính, nhân sự, lập trình
  thực tập, trợ lý, thư ký, lễ tân, kỹ sư, giáo viên, điều dưỡng, bác sĩ, dược sĩ, chăm sóc, khách hàng
  bán hàng, thiết kế, đồ họa, xuất nhập, nhập khẩu, xuất khẩu, thu mua, sản xuất, chất lượng, kiểm toán
  tài chính, ngân hàng, giao dịch, tuyển dụng, đào tạo, phát triển, kiểm thử, phân tích, dữ liệu, thành phố
  sở thích, hoạt động, chứng chỉ, giải thưởng, dự án, ngoại ngữ, tham chiếu, giới thiệu, liên hệ, địa chỉ
  ngày sinh, giới tính, điện thoại, tư vấn, văn phòng, tin học, tiếng anh, tiếng nhật, tiếng trung, hà nội
  hồ chí minh, việt nam, đà nẵng, bảo vệ, tài xế, phục vụ, công nhân, kỹ thuật, vận hành, kho vận, ứng tuyển
  vị trí, chức danh, mong muốn, bản thân, tóm tắt, người tham, xác nhận, thông tin cá nhân, trường thpt
  cộng hòa, độc lập, hạnh phúc, xã hội, chủ nghĩa, cổ phần, trách nhiệm, hữu hạn, tập đoàn, chi nhánh
  trung tâm, quận, phường, huyện, tỉnh, thị xã
`);

/** Single words that never appear in a name. Vietnamese ones are compared with tones (so "toán" ≠ "Toàn"). */
const STOP_WORDS_TONED = list(`
  kế toán viên kinh nghiệm vấn mục sơ yếu lịch xin việc làm cá tin hệ địa chỉ điện thoại ngày giới tính sở
  thích chứng giải thưởng dự hoạt động ngoại ngữ tham chiếu phòng giám đốc trưởng trợ giáo bác dược dưỡng chăm
  sóc khách hàng bán thiết đồ xuất nhập khẩu mua kho vận sản chất lượng kiểm dịch tuyển dụng tạo triển thử
  phân tích dữ liệu nghề nghiệp chuyên quản học viện quận phường huyện tỉnh đường phố xã thôn ấp ngõ ngách hẻm
  số tổng ty những của và với các cho tại trong được là có không người tôi em cha mẹ bố vợ chồng con tháng
  hiện nay lớp ngành tiếng bằng cấp tên họ
`);

/** Words (folded, so also without tones) that are never part of a name: English headings and job titles, org words. */
const STOP_WORDS_FOLDED = list(`
  cv curriculum vitae resume profile objective experience education skills skill information personal contact
  summary references reference hobbies interests projects project certificates certifications awards languages
  about career details developer engineer manager executive sales marketing frontend backend fullstack
  designer accountant intern internship staff officer specialist assistant analyst tester leader lead director
  consultant coordinator administrator admin receptionist cashier teacher nurse doctor architect programmer
  software senior junior fresher head chief representative supervisor technician operator driver worker
  secretary company university college school academy institute ltd jsc tnhh corp corporation inc group bank
  street district ward city province road vietnam hanoi saigon hcmc hcm tp thpt thcs cp ctcp name full email
  phone mobile address gender birth date male female single married the and of for with in at me from english
  excel word office microsoft photoshop java python react javascript typescript node communication teamwork
  present customer service business development human resources accounting finance data web mobile it
  logistics hr qa qc pm ui ux seo content graphic design general application applicant candidate position job
  title cover letter page vnd usd
`);

/** Address words. With tones they are unambiguous; without, "phuong"/"quan"/"huyen" are also given names. */
const PLACE_TONED =
  /(?:^|[^\p{L}])(?:hà nội|tp|thành phố|quận|phường|huyện|tỉnh|thị xã|thị trấn|việt nam|hồ chí minh|đà nẵng|hải phòng|cần thơ|district|city|ward|street|province)(?![\p{L}])/u;
const PLACE_FOLDED =
  /(?:^|[^a-z])(?:ha noi|hanoi|tp|thanh pho|viet nam|vietnam|ho chi minh|hcm|da nang|district|city|ward|street|province)(?![a-z])/;

/** True when the line reads like an address ("Hoàng Mai, Hà Nội"). */
export function isPlaceLine(text: string): boolean {
  return hasDiacritics(text) ? PLACE_TONED.test(text.toLowerCase()) : PLACE_FOLDED.test(fold(text));
}

const PHRASES_TONED = STOP_PHRASES.map((p) => p.toLowerCase());
const PHRASES_FOLDED = STOP_PHRASES.map((p) => fold(p));
const WORDS_TONED = new Set(STOP_WORDS_TONED);
const WORDS_FOLDED = new Set(STOP_WORDS_FOLDED);

/** Index of the first word that starts a stop phrase or is a stop word; -1 when the words look clean. */
export function firstStopIndex(words: readonly string[], isToned: boolean): number {
  const lower = words.map((w) => w.toLowerCase());
  const folded = words.map((w) => fold(w));
  for (let i = 0; i < words.length; i += 1) {
    const w = lower[i] ?? '';
    const f = folded[i] ?? '';
    if (WORDS_FOLDED.has(f) || (isToned && WORDS_TONED.has(w))) return i;
    const tail = (isToned ? lower : folded).slice(i).join(' ');
    const stops = isToned ? PHRASES_TONED : PHRASES_FOLDED;
    if (stops.some((p) => `${tail} `.startsWith(`${p} `))) return i;
  }
  return -1;
}

export function isSurname(word: string): boolean {
  return SURNAMES.has(fold(word));
}
