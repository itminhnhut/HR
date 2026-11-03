/** Finds the candidate's own mobile number in CV lines. */
import {
  fieldBefore,
  introducesEmployer,
  introducesSomeoneElse,
  isCompanyLine,
  namesSomeoneElse,
  ownerOf,
  type Owner,
} from './context.js';
import { isPlaceLine } from './name-lexicon.js';
import { scanPhones, type PhoneMatch } from './phone-scan.js';
import { fold, type ContactLine } from './text.js';

/** Labels (folded) that introduce a phone. Icons stay as written. */
const PHONE_LABEL =
  /(?:^|[^a-z])(?:so dien thoai|dien thoai|so dt|sdt|dtdd|dt|di dong|didong|mobile|mob|cell|phone|telephone|tel|so may|lien lac|lh|zalo|viber|whatsapp|telegram|hotline|lien he|contact|hp)(?![a-z])|(?:^|[^a-z])[tmp]\s*:|[☎✆📞📱☏]/g;
/** Labels whose number is not a phone: ID card, tax code, bank account, salary, postal code, certificate, fax… */
const OTHER_LABEL =
  /(?:^|[^a-z])(?:cccd|cmnd|cmt|can cuoc|chung minh|mst|ma so thue|tax|stk|so tai khoan|tai khoan|account|bank|ngan hang|passport|ho chieu|mssv|ma sinh vien|student id|bhxh|bao hiem|ma nv|ma nhan vien|fax|luong|salary|thu nhap|zip|postal|ma buu chinh|toeic|ielts|toefl|trf|certi ?fi ?cate|cert|chung chi|so hieu|giay phep|license|so the|the sinh vien|ma so|ma lop|ma hoc vien|ma hv|ma khach|ma kh|ma don|ma hd|ma ho so|ma the|ma du thi|so hop dong|hop dong|don hang|invoice|so tien|doanh so|doanh thu)(?![a-z])/g;
const HOTLINE = /(?:^|[^a-z])hotline(?![a-z])/;
const MONEY_AFTER = /^\s*(?:d|vnd|dong|usd|\$|tr|trieu|k|m)(?![a-z])/;
/** Addresses and links hold digits that are not phones, also without "www.": "facebook.com/0916420735". */
const EMAIL_OR_URL =
  /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+|(?:https?:\/\/|www\.)\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/\S*/gi;
/** "O9O3 714 268": an OCR layer's capital O for zero, read only on a line labelled as a phone. */
const LETTER_O_NUMBER = /(^|[^\p{L}\d])([O\d][O\d .-]{8,})(?![\p{L}\d])/gu;
/** A label cut by the line end: "ĐT cá" / "nhân: 0908 336 127". */
const WRAPPED_LABEL_TAIL = /^\p{Ll}[\p{L} ]{0,15}:/u;
/** "0937 204 681 (mother)", "0912 345 678 – chị Lan". */
const SUFFIX_OF_PERSON = /^\s*(?:\([^)]{1,30}\)|[-–]\s*\p{L}[^|•;]{0,30})/u;
const LABEL_REACH = 25;
/** A line that is only a free-mail address: a number right beside it is a contact block, wherever it landed. */
const FREE_MAIL_LINE = /^(?:e-?mail\s*:?\s*)?\S+\s*(?:@|\(at\)|\[at\])\s*(?:gmail|yahoo|outlook|hotmail|icloud)\.\S+$/i;

interface PhoneHit {
  phone: string;
  line: ContactLine;
  isLabelled: boolean;
  isHotline: boolean;
  isEmployerField: boolean;
  isSomeoneElse: boolean;
  /** No words of its own around it: alone on the line or between separators ("Hà Nội | 0912…"). */
  isStandalone: boolean;
  isBesideFreeMail: boolean;
  owner: Owner;
}

interface Context {
  kind: 'phone' | 'other' | 'none';
  owner: Owner;
  isHotline: boolean;
}

function lastMatch(text: string, pattern: RegExp): { start: number; end: number } | null {
  let last: { start: number; end: number } | null = null;
  for (const m of text.matchAll(pattern)) last = { start: m.index ?? 0, end: (m.index ?? 0) + m[0].length };
  return last;
}

/**
 * Which label, if any, owns the number: the closest one before it on the same line. A number in the next column
 * ("ĐT: 0936 180 247   0342 705 169") is not covered by the label of the number before it.
 */
function contextBefore(prefix: string): Context {
  const field = prefix.replace(/^.*\d\s{2,}/s, '').replace(/\s+/g, ' ');
  const folded = fold(field);
  const phone = lastMatch(folded, PHONE_LABEL);
  const other = lastMatch(folded, OTHER_LABEL);
  if (other && (!phone || other.end > phone.end)) return { kind: 'other', owner: 'unknown', isHotline: false };
  if (!phone || folded.length - phone.end > LABEL_REACH) return { kind: 'none', owner: 'unknown', isHotline: false };
  const tail = field.slice(phone.start);
  return { kind: 'phone', owner: ownerOf(tail), isHotline: HOTLINE.test(fold(tail)) };
}

/** "Điện thoại" / "Phone:" alone on the line above (sidebars put the label above the value). */
function isLabelLine(line: ContactLine | undefined): boolean {
  if (!line) return false;
  const bare = line.folded.replace(/[\s:.\-]+$/, '').trim();
  return bare.length <= 20 && lastMatch(bare, PHONE_LABEL)?.end === bare.length;
}

function readLetterO(text: string): string {
  return text.replace(LETTER_O_NUMBER, (whole: string, before: string, number: string) =>
    number.replace(/\D/g, '').length >= 5 ? before + number.replace(/O/g, '0') : whole,
  );
}

/** Text to scan: emails/URLs blanked; "Điện thoại: 0346" + next line "718 520" glued back together. */
function scanText(line: ContactLine, next: ContactLine | undefined): string {
  const endsWithPhone = scanPhones(line.text).some((m) => m.end === line.text.length);
  const wrapped = next && /\d$/.test(line.text) && !endsWithPhone ? /^[\d .-]+/.exec(next.text) : null;
  const text = wrapped ? `${line.text} ${wrapped[0]}` : line.text;
  const blanked = text.replace(EMAIL_OR_URL, (m) => ' '.repeat(m.length));
  return lastMatch(line.folded, PHONE_LABEL) ? readLetterO(blanked) : blanked;
}

/** The end of the line above, when this line starts with the rest of a label cut by the line end. */
function labelStart(above: ContactLine | undefined, text: string): string {
  if (!above || !WRAPPED_LABEL_TAIL.test(text)) return '';
  return `${fieldBefore(above.text, above.text.length)} `;
}

/** Nothing but separators or a place before it: "Hà Nội, 0912…" yes, "Doanh số 0912…" no. */
function isOnItsOwn(prefix: string, field: string): boolean {
  if (/\s{3,}$/.test(prefix)) return true;
  const tail = field.split(/[-–,:/()]/).pop() ?? '';
  return !/\p{L}/u.test(tail) || isPlaceLine(tail);
}

function hitAt(lines: readonly ContactLine[], i: number, text: string, m: PhoneMatch): PhoneHit | null {
  const line = lines[i];
  if (!line || MONEY_AFTER.test(fold(text.slice(m.end)))) return null;
  const above = lines[i - 1];
  const prefix = text.slice(0, m.start);
  const context = contextBefore(labelStart(above, text) + prefix);
  if (context.kind === 'other') return null;
  const field = fieldBefore(text, m.start);
  const suffix = SUFFIX_OF_PERSON.exec(text.slice(m.end))?.[0] ?? '';
  const labelAbove = prefix.trim().length === 0 && isLabelLine(above);
  const owner = labelAbove && above ? ownerOf(above.text) : context.owner;
  const isBesideFreeMail = FREE_MAIL_LINE.test(lines[i + 1]?.text ?? '') || FREE_MAIL_LINE.test(above?.text ?? '');
  return {
    phone: m.phone,
    line,
    isLabelled: context.kind === 'phone' || labelAbove,
    isHotline: context.isHotline,
    isEmployerField: isCompanyLine(fold(field)) || (!isBesideFreeMail && introducesEmployer(lines, i)),
    isSomeoneElse: namesSomeoneElse(field) || namesSomeoneElse(suffix) || introducesSomeoneElse(above?.text),
    isStandalone: isOnItsOwn(prefix, field),
    isBesideFreeMail,
    owner,
  };
}

function hitsInLine(lines: readonly ContactLine[], i: number, line: ContactLine): PhoneHit[] {
  const text = scanText(line, lines[i + 1]);
  return scanPhones(text).flatMap((m) => hitAt(lines, i, text, m) ?? []);
}

/**
 * Lower is better; null = not the candidate's. "ĐT cá nhân" > labelled > unlabelled. Never counted: a number that
 * names someone else or an employer, one marked as a company's or a school's, a "Hotline" in work history, and a
 * number with no label inside a sentence, or in work history unless it sits beside the candidate's free-mail address.
 */
function rank(hit: PhoneHit): number | null {
  const isWork = hit.line.section === 'work';
  if (hit.isSomeoneElse || hit.isEmployerField) return null;
  if (hit.owner === 'company' || hit.owner === 'school') return null;
  if (hit.isHotline && isWork) return null;
  if (!hit.isLabelled && (!hit.isStandalone || (isWork && !hit.isBesideFreeMail))) return null;
  const label = hit.owner === 'personal' ? 0 : hit.isLabelled && !hit.isHotline ? 1 : 2;
  return label + (isWork ? 3 : 0);
}

/** The candidate's mobile as 0xxxxxxxxx, or null. Numbers in reference sections belong to someone else. */
export function findPhone(lines: readonly ContactLine[]): string | null {
  let best: { hit: PhoneHit; rank: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.section === 'reference') continue;
    for (const hit of hitsInLine(lines, i, line)) {
      const r = rank(hit);
      if (r !== null && (!best || r < best.rank)) best = { hit, rank: r };
    }
  }
  return best ? best.hit.phone : null;
}
