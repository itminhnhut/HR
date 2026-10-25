/**
 * Requirement wording that cannot be judged from a CV: personality / soft skills, preferences ("ưu tiên"),
 * and personal conditions (gender, age, place, shifts, health) that HR confirms in the interview.
 */

const SOFT =
  /\b(giao tiep|chu dong|chiu (?:duoc )?ap luc|ap luc cong viec|trung thuc|can than|ti mi|ty mi|lam viec nhom|teamwork|nhiet tinh|ham hoc hoi|hoc hoi|trach nhiem|kien nhan|sang tao|tu duy|ky nang mem|nhanh nhen|cham chi|cham chiu|ky luat|linh hoat|thai do|dam me|deo dai|giong noi|than thien|vui ve|hoa dong|chiu kho|cau tien|tu tin|thuyet phuc|dam phan|quan ly thoi gian|giai quyet van de|lanh dao|doc lap|nang dong|nang no|trung thanh|kheo leo|logic|phan tich|to chuc|sap xep|chinh xac|tinh than|nhay ben|kha nang|y thuc|lich su|chuyen nghiep|communication|proactive|responsible|hard[- ]?working|detail[- ]oriented|attention to detail|problem[- ]solving|leadership|attitude|passion|passionate|willing|eager|independent|creative|honest|team player|self[- ]motivated)\b/;

const PERSONAL =
  /\b(nam\s*\/\s*nu|nu\s*\/\s*nam|gioi tinh|chi tuyen (?:nu|nam)|tuoi|do tuoi|age|sinh song|cu tru|o gan|gan cong ty|khu vuc|ho khau|living in|ca xoay|lam ca|xoay ca|cuoi tuan|toan thoi gian|ban thoi gian|full[- ]?time|part[- ]?time|tang ca|di cong tac|cong tac xa|overtime|shift|onsite|suc khoe|chieu cao|can nang|ngoai hinh|cam ket|gan bo|lau dai|thoi gian|lam viec tai|di lam ngay|nhan viec ngay)\b|^\s*(?:nam|nu)\b(?!\s*\d)/;

const PREFERENCE_START = /^\s*(?:[-*+]\s*)?(uu tien|preferred|nice to have|bonus|plus)\b/;
const PREFERENCE_ANY =
  /\b(la (?:mot )?(?:loi the|diem cong|uu the)|is a plus|is an advantage|preferred|nice to have|se la loi the)\b/;

/** "Ưu tiên …", "… là lợi thế", "… is a plus": not mandatory, so not scored. */
export function isPreference(folded: string): boolean {
  return PREFERENCE_START.test(folded) || PREFERENCE_ANY.test(folded);
}

/** Text before a trailing "ưu tiên …" clause, which only states a bonus. */
export function mandatoryPart(folded: string): string {
  const m = /[,;.(]?\s*\buu tien\b/.exec(folded);
  return m ? folded.slice(0, m.index) : folded;
}

/** The line with its "ưu tiên" / "là lợi thế" wording removed, leaving what is preferred. */
export function withoutPreferenceWords(folded: string): string {
  return folded
    .replace(PREFERENCE_ANY, ' ')
    .replace(/\b(uu tien|ung vien|bonus|plus)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function softWords(folded: string): string[] {
  const out: string[] = [];
  const re = new RegExp(SOFT.source, 'g');
  for (let m = re.exec(folded); m; m = re.exec(folded)) out.push(m[0]);
  return out;
}

export function isPersonalCondition(folded: string): boolean {
  return PERSONAL.test(folded);
}
