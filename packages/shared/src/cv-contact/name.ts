/**
 * Finds the candidate's full name: a labelled value first, then a CV title ("CV - Nguyễn Văn An"), then a line the
 * email address confirms, otherwise a name-shaped line near the top.
 */
import { agreementWith } from './name-email.js';
import {
  isPlaceLine,
  isSurname,
  isVietnameseSyllable,
  MIDDLE_NAMES,
  startsWithCompoundSurname,
} from './name-lexicon.js';
import { headSegment, nameWords, segments, shapeName, titleCase, type NameShape } from './name-line.js';
import { fold, type ContactLine } from './text.js';

const NAME_LABEL =
  /(?:^|[^a-z])(?:(?:ho va ten|ho & ten|ho ten)(?: khai sinh)?|ten khai sinh|ten ung vien|ten day du|full name|fullname|candidate name|toi ten la|ten toi la|my name is)\s*:?\s*|(?:^|[|•,;]\s*|\s{2,})(?:ten|name|ung vien|candidate|applicant name|applicant)\s*:\s*/;
const NEXT_LABEL =
  /\s(?:ngay sinh|nam sinh|gioi tinh|email|e-mail|dien thoai|so dien thoai|sdt|dt|dia chi|address|phone|mobile|date of birth|dob|gender|que quan|quoc tich|tinh trang|vi tri|chuc danh|position|ung tuyen|tel|zalo)\b/;
/** "CV - Vũ Thị Giang", "Curriculum Vitae of Le Toan", "CV_Nguyen_Hoai_Phuong", "Hồ sơ của Trần An". */
const TITLE_PREFIX = /^(?:cv|curriculum vitae|resume|ho so|so yeu ly lich)(?:\s+(?:of|cua)\s+|\s*[-_:|]\s*)/;
/** Degrees and titles written before a name: "ThS. Phạm Hồng Loan", "KS. Đặng Công Thành". */
const DEGREE_PREFIX = /^(?:ThS|TS|KS|BS|CN|DS|GS|PGS|NCS)\.\s*/;
const HONORIFIC_PREFIX = /^(?:mr|mrs|ms|miss)\.?\s+/i;
/** "NGUYEN, Van Toan": family name in capitals, a comma, given names. */
const COMMA_FORM = /^(\p{Lu}+),\s+(\p{Lu}[\p{L} ]+)$/u;
const SIGNATURE_ABOVE =
  /(?:nguoi viet(?: ho so| don)?|nguoi lam don|tran trong|kinh thu|cam on|sincerely|regards)[\s.,:!]*$/;
const CLOSING_LINES = 2;
const TOP_LINES = 3;
const FIRST_PAGE_LINES = TOP_LINES * 3;

interface Candidate {
  shape: NameShape;
  tier: number;
  order: number;
  agrees: boolean;
}

function labelValue(line: ContactLine, next: ContactLine | undefined): string | null {
  const m = NAME_LABEL.exec(line.folded);
  if (!m) return null;
  const start = m.index + m[0].length;
  const rest = line.folded.slice(start);
  const cut = NEXT_LABEL.exec(rest);
  const value = line.text
    .slice(start, cut ? start + cut.index : undefined)
    .replace(/^\/[^:]{0,20}:/, '') // bilingual label: "Họ và tên / Full name: …"
    .trim();
  if (value.length > 0) return value;
  return next && !next.isHeading ? next.text : null;
}

function fromLabels(lines: readonly ContactLine[]): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.section === 'reference') continue;
    const value = labelValue(line, lines[i + 1]);
    const shape = value ? shapeName(headSegment(value)) : null;
    if (shape) return titleCase(shape.words);
  }
  return null;
}

/** A title names the file's owner, so its value must look like a Vietnamese name: "CV - Supply Chain" is not one. */
function fromTitles(lines: readonly ContactLine[]): string | null {
  for (const line of lines) {
    const m = line.section === 'reference' ? null : TITLE_PREFIX.exec(line.folded);
    if (!m) continue;
    const shape = shapeName(headSegment(line.text.slice(m[0].length).replace(/_/g, ' ')));
    if (shape && isSurname(shape.words[0] ?? '') && shape.words.every(isVietnameseSyllable)) {
      return titleCase(shape.words);
    }
  }
  return null;
}

/** The words on `count` lines from line `i`, for a name wrapped over lines: "Bành" / "Gia" / "Hưng". */
function wordsAcross(lines: readonly ContactLine[], i: number, count: number): string[] | null {
  const words: string[] = [];
  for (let j = i; j < i + count; j += 1) {
    const line = lines[j];
    if (!line || line.isHeading || isPlaceLine(line.text)) return null;
    const part = nameWords(headSegment(beforeContact(line.text)));
    if (!part) return null;
    words.push(...part);
  }
  return words;
}

/** No heading, job or org word in these words, so they can stand as a whole name. */
function isCleanName(words: readonly string[]): boolean {
  return shapeName(words.join(' '))?.words.length === words.length;
}

/**
 * Is this what the address spells out? It may hold words that also mean something ("ketoan.phan": Phan Kế Toán),
 * but then the line must start with a family name; otherwise "giamsat.banhang" would make a job title a name.
 */
function isSpelledByEmail(words: readonly string[] | null, email: string): boolean {
  if (!words || words.length < 2 || words.length > 5 || !agreementWith(email, words).isFull) return false;
  if (words.some((w) => [...w].length < 2)) return false;
  if (isSurname(words[0] ?? '')) return true;
  return words.length >= 3 && isCleanName(words);
}

/**
 * "Người viết hồ sơ" / "Trân trọng" above, nothing below: a closing signature is not read as the candidate's name.
 * A cover letter's signature does count, because the CV's details follow it.
 */
function isSignature(lines: readonly ContactLine[], i: number): boolean {
  return i >= lines.length - CLOSING_LINES && SIGNATURE_ABOVE.test(lines[i - 1]?.folded ?? '');
}

/**
 * A line, or a name wrapped over up to three lines, that the email address spells out completely. Longest first
 * ("Kha Trúc" / "Quỳnh"), but a wrap must be clean: an address can go on after the name, "hoangmanhhung.khovan" above
 * a job title "Kho vận". One column of a merged line also counts: "KINH NGHIỆM   Phan Thị Lan".
 */
function fromEmail(lines: readonly ContactLine[], email: string | null): string | null {
  if (!email) return null;
  for (let i = 0; i < lines.length; i += 1) {
    if (isSignature(lines, i)) continue;
    const wrapped = [wordsAcross(lines, i, 3), wordsAcross(lines, i, 2)].filter((w) => w !== null && isCleanName(w));
    const columns = (lines[i]?.text ?? '').split(/\s{3,}/).map((c) => nameWords(headSegment(c)));
    const spelled = [...wrapped, wordsAcross(lines, i, 1), ...columns].find((w) => isSpelledByEmail(w, email));
    if (spelled) return titleCase(spelled);
  }
  return null;
}

function isVietnameseShaped(words: readonly string[]): boolean {
  return words.every(isVietnameseSyllable);
}

/**
 * 1 = family name first, 2 = family name later / lowercase near top, 3 = other first line the email backs up,
 * 0 = not a name. (4 = name-shaped line inside a reference block, the last resort.)
 */
function tierOf(shape: NameShape, order: number, agrees: boolean): number {
  const { words, nameCase } = shape;
  const vietnamese = isVietnameseShaped(words);
  const surnameFirst = (isSurname(words[0] ?? '') && vietnamese) || startsWithCompoundSurname(words);
  if (nameCase === 'lower') return surnameFirst && order < TOP_LINES ? 2 : 0;
  if (surnameFirst) return 1;
  if (vietnamese && words.length <= 4 && words.slice(1).some(isSurname) && order < FIRST_PAGE_LINES) return 2;
  return agrees && order < 2 && words.length <= 4 ? 3 : 0;
}

/** Can `first` be the first half of a name broken over two lines, given how many words the second half has? */
function isFirstHalf(words: readonly string[], second: readonly string[]): boolean {
  const secondCount = second.length;
  if (startsWithCompoundSurname([...words, ...second]) && secondCount <= 3) return true;
  if (!isSurname(words[0] ?? '') || secondCount > 3) return false;
  const last = fold(words[words.length - 1] ?? '');
  if (words.length === 1) return true;
  // "NGUYỄN THỊ" / "MAI ANH", or a compound family name: "ÂU DƯƠNG" / "BẢO TRÂM"; "Kha Trúc" / "Quỳnh" with one word.
  if (words.length === 2) return MIDDLE_NAMES.has(last) || isSurname(words[1] ?? '') || secondCount === 1;
  // "TÔN NỮ HOÀNG" / "BẢO CHÂU": three words only with a two-word second half.
  return words.length === 3 && secondCount === 2 && MIDDLE_NAMES.has(last);
}

/** "NGUYỄN THỊ" + "MAI ANH" → one name when the first half ends like a name's first half. */
function joinSplitName(first: ContactLine, second: ContactLine | undefined): NameShape | null {
  if (!second || second.section === 'reference' || second.isHeading) return null;
  const a = headSegment(first.text);
  const b = headSegment(second.text);
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  if (!isFirstHalf(aWords, bWords)) return null;
  const shape = shapeName(`${a} ${b}`);
  if (!shape || shape.words.length !== aWords.length + bWords.length) return null;
  const isVietnamese = isVietnameseShaped(shape.words) || startsWithCompoundSurname(shape.words);
  return isVietnamese && (shape.nameCase === 'caps' || aWords.length < 3) ? shape : null;
}

/** "Bành" / "Gia" / "Hưng": a hero layout with one word on each line. */
function joinThreeLines(lines: readonly ContactLine[], i: number): NameShape | null {
  const [first, second, third] = [lines[i], lines[i + 1], lines[i + 2]];
  if (!first || !second || !third || third.section === 'reference' || third.isHeading) return null;
  if (!isSurname(first.text) || [first, second, third].some((l) => /\s/.test(l.text))) return null;
  const shape = shapeName(`${first.text} ${second.text} ${third.text}`);
  return shape?.words.length === 3 && isVietnameseShaped(shape.words) ? shape : null;
}

/**
 * Two-column PDFs put the sidebar first, so the main column's name can land right after a sidebar
 * "Người tham chiếu" block. A name there, after that block already listed a phone or email, is the header.
 */
function isHeaderAfterReference(lines: readonly ContactLine[], i: number): boolean {
  let j = i - 1;
  let hasContact = false;
  for (; j >= 0; j -= 1) {
    const line = lines[j];
    if (!line || line.section !== 'reference') break;
    if (line.isHeading) return hasContact;
    hasContact = hasContact || /\d{3}|@/.test(line.text);
  }
  return false;
}

/** Cuts a name off what follows it on the line: "Lý Thu Trang   0797…", "Vũ Minh Đăng SĐT 0986…". */
function beforeContact(text: string): string {
  const gap = /^(.+?)\s{2,}[+(\d]/.exec(text);
  if (gap?.[1]) return gap[1];
  if (!/\d|@/.test(text)) return text;
  const label = NEXT_LABEL.exec(fold(text));
  return label ? text.slice(0, label.index) : text;
}

function withoutTitle(part: string, isTop: boolean): string {
  const degreeFree = part.replace(DEGREE_PREFIX, '');
  return isTop ? degreeFree.replace(HONORIFIC_PREFIX, '') : degreeFree;
}

/** "CV - Nguyễn Văn An" / "Mr. Hung Tran": near the top, later segments and an English honorific are allowed. */
function shapeInLine(text: string, isTop: boolean): NameShape | null {
  const head = beforeContact(text);
  const comma = COMMA_FORM.exec(head);
  if (comma && isSurname(comma[1] ?? '')) return shapeName(`${comma[1] ?? ''} ${comma[2] ?? ''}`);
  const canScan = isTop && !/[\d@:]/.test(head);
  const parts = canScan ? segments(head).slice(0, 3) : [headSegment(head)];
  for (const part of parts) {
    const shape = shapeName(withoutTitle(part, isTop));
    if (shape) return shape;
  }
  return null;
}

function candidateAt(lines: readonly ContactLine[], i: number, order: number, email: string | null): Candidate | null {
  const line = lines[i];
  if (!line || line.isHeading || isPlaceLine(line.text) || isSignature(lines, i)) return null;
  const isReference = line.section === 'reference';
  if (isReference && !isHeaderAfterReference(lines, i)) return null;
  const shape =
    joinThreeLines(lines, i) ?? joinSplitName(line, lines[i + 1]) ?? shapeInLine(line.text, order < TOP_LINES);
  if (!shape) return null;
  const agreement = agreementWith(email, shape.words);
  const agrees = agreement.count >= 2;
  const tier = tierOf(shape, order, agreement.count >= 1);
  if (isReference) return tier === 1 ? { shape, tier: 4, order, agrees } : null;
  return tier > 0 ? { shape, tier, order, agrees } : null;
}

function fromHeader(lines: readonly ContactLine[], email: string | null): string | null {
  const candidates: Candidate[] = [];
  let order = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.isHeading) continue;
    const candidate = candidateAt(lines, i, order, email);
    if (candidate) candidates.push(candidate);
    order += 1;
  }
  const confirmed = candidates.find((c) => c.agrees && c.tier < 4);
  if (confirmed) return titleCase(confirmed.shape.words);
  const first = candidates[0];
  if (first && first.order < TOP_LINES && first.tier <= 2) return titleCase(first.shape.words);
  const best = [...candidates].sort((x, y) => x.tier - y.tier || x.order - y.order)[0];
  return best ? titleCase(best.shape.words) : null;
}

/** The candidate's name in title case with tones kept as written, or null. The email helps tell it from other lines. */
export function findName(lines: readonly ContactLine[], email: string | null = null): string | null {
  return fromLabels(lines) ?? fromTitles(lines) ?? fromEmail(lines, email) ?? fromHeader(lines, email);
}
