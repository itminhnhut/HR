/** Clues around a phone or email that tell whose it is: the candidate's own, a company's, or another person's. */
import { fold } from './text.js';

export type Owner = 'personal' | 'company' | 'school' | 'unknown';

const PERSONAL = /(?:^|[^a-z])(?:ca nhan|personal|rieng|private|own)(?![a-z])/;
const COMPANY =
  /(?:^|[^a-z])(?:cong ty|cong viec|co quan|van phong|tong dai|tu van|company|office|work|business|cty)(?![a-z])/;
const SCHOOL = /(?:^|[^a-z])(?:truong|sinh vien|hoc sinh|school|student|university)(?![a-z])/;
const COMPANY_LINE =
  /(?:^|[^a-z])(?:cong ty|cty|kinh gui|phong nhan su|ban tuyen dung|tnhh|co phan|company|ltd|jsc|corp|inc|trung tam|phong kham|benh vien|chi nhanh|dai ly|cua hang|tu van tuyen sinh)(?![a-z])/;
const LETTERHEAD_REACH = 3;
const LETTERHEAD_FIELD =
  /^(?:dia chi|address|fax|mst|ma so thue|website|web|email|e-mail|dien thoai|dt|tel|phone|hotline)\b/;
/** A new field starts here inside a line: "|", "•", ";" or a column gap. */
const FIELD_BREAK = /\s*[|•;]\s*|\s{3,}/g;

/** Family, emergency and referee words; folded, so they also match a CV typed without tones. */
const OTHER_PERSON =
  /(?:^|[^a-z])(?:nguoi than|nguoi nha|phu huynh|gia dinh|khan cap|emergency|mother|father|spouse|wife|husband|parents?|guardian|relative|sibling|brother|sister|tham chieu|tham khao|xac nhan|nguoi gioi thieu|gioi thieu boi|referee|references?|nha tuyen dung|recruiter|headhunt\w*|staffing|nhan luc|nguoi dai dien|nguoi lien he|gui ho so|gui cv|nop ho so|ho ten (?:cha|me|bo|vo|chong))(?![a-z])/;
/** Written with tones: without them "mẹ"/"me" and "bố"/"bo" are ordinary letters. */
const KIN_TONED = /(?:^|[^\p{L}])(?:cha|mẹ|bố|vợ|chồng|anh trai|chị gái|em trai|em gái)(?![\p{L}])/u;
/** "SĐT mẹ:", "(me)", "Bo: …": the untoned family words that are safe only right next to a label. */
const KIN_FOLDED =
  /(?:sdt|dt|dien thoai|phone|so)\s+(?:cua\s+)?(?:me|bo|cha|vo|chong)(?![a-z])|\((?:me|bo|cha|vo|chong)\)|^(?:me|bo|cha|vo|chong)\s*:/;
/** "chị Thu", "Anh Tuấn", "Mr. Long": an honorific and a capitalized name, at the start of a phrase. */
const HONORIFIC_NAME =
  /(?:^|[:(,\-–]\s*)(?:[Aa]nh|[Cc]h[ịi]|[Ôô]ng|[Bb]à|[Cc]ô|[Cc]hú|[Tt]hầy|M[Rr]\.?|M[Rr][Ss]\.?|M[Ss]\.?|Miss)\s+\p{Lu}/u;
/** "Quản lý: …", "(quản lý)": a boss named as such. A job title alone ("Quản lý dự án – 09…") does not count. */
const BOSS_FIELD = /(?:^|[^a-z])(?:quan ly|truong phong|truong nhom|giam doc|sep|manager|supervisor|director)\s*[:)]/;

/** Who a value belongs to, judged from the words between its label and the value ("ĐT công ty:", "Email cá nhân:"). */
export function ownerOf(between: string): Owner {
  const folded = fold(between);
  if (PERSONAL.test(folded)) return 'personal';
  if (COMPANY.test(folded)) return 'company';
  return SCHOOL.test(folded) ? 'school' : 'unknown';
}

/** A line or field that talks about an employer ("Kính gửi: Phòng Nhân sự – Công ty …", "Công ty TNHH …"). */
export function isCompanyLine(folded: string): boolean {
  return COMPANY_LINE.test(folded);
}

/**
 * The field a value at `at` sits in: the text since the last "|", "•", ";" or column gap, gap before the value
 * ignored ("Phone:   0912…"). A value right after another value's gap starts a new cell, so its field is empty.
 */
export function fieldBefore(text: string, at: number): string {
  const before = text.slice(0, at);
  const trimmed = before.trimEnd();
  if (/[\d\p{L}]$/u.test(trimmed) && /\s{3,}$/.test(before) && /[\d.@]/.test(trimmed.slice(-12))) return '';
  let start = 0;
  for (const m of trimmed.matchAll(FIELD_BREAK)) start = (m.index ?? 0) + m[0].length;
  return trimmed.slice(start);
}

/** The words of this field point at someone other than the candidate: a relative, a referee, a boss, an agency. */
export function namesSomeoneElse(field: string): boolean {
  const folded = fold(field);
  return (
    OTHER_PERSON.test(folded) ||
    KIN_FOLDED.test(folded) ||
    KIN_TONED.test(field.toLowerCase()) ||
    HONORIFIC_NAME.test(field) ||
    BOSS_FIELD.test(folded)
  );
}

/** A name can start with "Anh" or "Chi", so a line only introduces that person together with a role or a remark. */
function isHonorificOnly(text: string): boolean {
  const folded = fold(text);
  const hasOtherClue = OTHER_PERSON.test(folded) || KIN_FOLDED.test(folded) || KIN_TONED.test(text.toLowerCase());
  return !hasOtherClue && !BOSS_FIELD.test(folded) && !/[-–(:,]/.test(text);
}

/** The line above introduces someone else and has no contact value of its own: "Mẹ: Trần Thị B" / "0912…". */
export function introducesSomeoneElse(text: string | undefined): boolean {
  if (text === undefined || /@|\d{3}/.test(text)) return false;
  return namesSomeoneElse(text) && !isHonorificOnly(text);
}

/**
 * This line belongs to a letterhead: straight above it stands an employer's name, with at most a few of the
 * employer's own fields in between ("Công ty TNHH Hưng Thịnh" / "Địa chỉ: …" / "ĐT: 0912…").
 */
export function introducesEmployer(lines: readonly { text: string; folded: string }[], i: number): boolean {
  for (let j = i - 1; j >= 0 && j >= i - LETTERHEAD_REACH; j -= 1) {
    const line = lines[j];
    if (!line) return false;
    if (!/@|\d{3}/.test(line.text) && isCompanyLine(line.folded)) return true;
    if (!LETTERHEAD_FIELD.test(line.folded)) return false;
  }
  return false;
}
