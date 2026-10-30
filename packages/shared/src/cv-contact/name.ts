/** Finds the candidate's full name: a labelled value first, otherwise a name-shaped line near the top. */
import { isPlaceLine, isSurname, MIDDLE_NAMES } from './name-lexicon.js';
import { headSegment, segments, shapeName, titleCase, type NameShape } from './name-line.js';
import { fold, type ContactLine } from './text.js';

const NAME_LABEL =
  /(?:^|[^a-z])(?:ho va ten|ho & ten|ho ten|ten ung vien|ten day du|full name|fullname|candidate name|toi ten la|ten toi la|my name is)\s*:?\s*|(?:^|[|•,;]\s*|\s{2,})(?:ten|name|ung vien|candidate|applicant name|applicant)\s*:\s*/;
const NEXT_LABEL =
  /\s(?:ngay sinh|nam sinh|gioi tinh|email|e-mail|dien thoai|so dien thoai|sdt|dt|dia chi|address|phone|mobile|date of birth|dob|gender|que quan|quoc tich|tinh trang|vi tri|chuc danh|position|ung tuyen|tel|zalo)\b/;
const MAX_SYLLABLE = 7;
const TOP_LINES = 3;

interface Candidate {
  shape: NameShape;
  tier: number;
  order: number;
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

function isShortVietnamese(words: readonly string[]): boolean {
  return words.every((w) => [...w].length <= MAX_SYLLABLE);
}

/**
 * 1 = surname first, 2 = surname later / lowercase near top, 3 = foreign-looking first line, 0 = not a name.
 * (4 = name-shaped line inside a reference block, the last resort.)
 */
function tierOf(shape: NameShape, order: number): number {
  const { words, nameCase } = shape;
  const vietnamese = isShortVietnamese(words);
  const surnameFirst = isSurname(words[0] ?? '') && vietnamese;
  if (nameCase === 'lower') return surnameFirst && order < TOP_LINES ? 2 : 0;
  if (surnameFirst) return 1;
  if (vietnamese && words.length <= 4 && words.slice(1).some(isSurname) && order < TOP_LINES * 3) return 2;
  return order < 2 && words.length <= 4 ? 3 : 0;
}

/** Can `first` be the first half of a name broken over two lines, given how many words the second half has? */
function isFirstHalf(words: readonly string[], secondCount: number): boolean {
  if (!isSurname(words[0] ?? '') || secondCount > 3) return false;
  const last = fold(words[words.length - 1] ?? '');
  if (words.length === 1) return true;
  // "NGUYỄN THỊ" / "MAI ANH", or a compound family name: "ÂU DƯƠNG" / "BẢO TRÂM".
  if (words.length === 2) return MIDDLE_NAMES.has(last) || isSurname(words[1] ?? '');
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
  if (!isFirstHalf(aWords, bWords.length)) return null;
  const shape = shapeName(`${a} ${b}`);
  if (!shape || shape.words.length !== aWords.length + bWords.length) return null;
  return shape.nameCase === 'caps' || aWords.length < 3 ? shape : null;
}

/**
 * Two-column PDFs put the sidebar first, so the main column's name can land right after a sidebar
 * "Người tham chiếu" block. An ALL-CAPS name there, after that block already listed a phone or email, is the header.
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

/** "CV - Nguyễn Văn An" / "Mr. Hung Tran": near the top, later segments and an English honorific are allowed. */
function shapeInLine(text: string, isTop: boolean): NameShape | null {
  const canScan = isTop && !/[\d@:]/.test(text);
  const parts = canScan ? segments(text).slice(0, 3) : [headSegment(text)];
  for (const part of parts) {
    const shape = shapeName(isTop ? part.replace(/^(?:mr|mrs|ms|miss)\.?\s+/i, '') : part);
    if (shape) return shape;
  }
  return null;
}

function candidateAt(lines: readonly ContactLine[], i: number, order: number): Candidate | null {
  const line = lines[i];
  if (!line || line.isHeading || isPlaceLine(line.text)) return null;
  const isReference = line.section === 'reference';
  if (isReference && !(line.text === line.text.toUpperCase() && isHeaderAfterReference(lines, i))) return null;
  const shape = joinSplitName(line, lines[i + 1]) ?? shapeInLine(line.text, order < TOP_LINES);
  if (!shape) return null;
  const tier = tierOf(shape, order);
  if (isReference) return tier === 1 ? { shape, tier: 4, order } : null;
  return tier > 0 ? { shape, tier, order } : null;
}

function fromHeader(lines: readonly ContactLine[]): string | null {
  const candidates: Candidate[] = [];
  let order = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.isHeading) continue;
    const candidate = candidateAt(lines, i, order);
    if (candidate) candidates.push(candidate);
    order += 1;
  }
  const first = candidates[0];
  if (first && first.order < TOP_LINES && first.tier <= 2) return titleCase(first.shape.words);
  const best = [...candidates].sort((x, y) => x.tier - y.tier || x.order - y.order)[0];
  return best ? titleCase(best.shape.words) : null;
}

/** The candidate's name in title case with tones kept as written, or null. */
export function findName(lines: readonly ContactLine[]): string | null {
  return fromLabels(lines) ?? fromHeader(lines);
}
