/** Clues around a phone or email that tell whose it is: the candidate's own, or a company's. */
import { fold } from './text.js';

export type Owner = 'personal' | 'company' | 'unknown';

const PERSONAL = /(?:^|[^a-z])(?:ca nhan|personal|rieng|private|own)(?![a-z])/;
const COMPANY =
  /(?:^|[^a-z])(?:cong ty|cong viec|co quan|van phong|tong dai|hotline|company|office|work|business|cty)(?![a-z])/;
const COMPANY_LINE =
  /(?:^|[^a-z])(?:cong ty|cty|kinh gui|phong nhan su|ban tuyen dung|tnhh|co phan|company|ltd|jsc|corp|inc)(?![a-z])/;

/** Who a value belongs to, judged from the words between its label and the value ("ĐT công ty:", "Email cá nhân:"). */
export function ownerOf(between: string): Owner {
  const folded = fold(between);
  if (PERSONAL.test(folded)) return 'personal';
  if (COMPANY.test(folded)) return 'company';
  return 'unknown';
}

/** A line that talks about an employer ("Kính gửi: Phòng Nhân sự – Công ty …", "Công ty TNHH …"). */
export function isCompanyLine(folded: string): boolean {
  return COMPANY_LINE.test(folded);
}
