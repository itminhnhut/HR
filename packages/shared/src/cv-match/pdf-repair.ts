/**
 * Repairs what PDF text extraction does to a CV before it is read: letter-spaced headings, words hyphenated or split
 * over a break, date ranges broken across lines, two columns read side by side, a whole CV on one line.
 * Raw text in, raw lines out; only layout changes, the words stay as the candidate wrote them.
 */

/** Soft hyphen, zero-width characters, byte-order mark: invisible, and they split words when replaced by a space. */
export const INVISIBLE_CHARS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
/** Bullets some PDF fonts extract as private-use characters. */
const PRIVATE_USE = /[\uE000-\uF8FF]/g;

function isLetterSpaced(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 4) return false;
  const single = tokens.filter((t) => /^[\p{L}\p{N}][,.:;]?$/u.test(t)).length;
  return single / tokens.length >= 0.7;
}

function collapseCell(cell: string): string {
  if (!isLetterSpaced(cell)) return cell;
  return cell
    .trim()
    .split(/\s{2,}/)
    .map((word) => word.replace(/\s+/g, ''))
    .join(' ');
}

/**
 * "K I N H   N G H I Ệ M" → "KINH NGHIỆM"; "2 0 1 9" → "2019". Cell by cell, so that two headings side by side stay two
 * cells. Inside a letter-spaced line three spaces can be the gap between two words of one title; four part two cells.
 */
function collapseSpacing(line: string): string {
  const years = line.replace(/(?<![\d/.])([12]) (\d) (\d) (\d)(?!\d)/g, '$1$2$3$4');
  const gap = isLetterSpaced(years) ? /( {4,})/ : /( {3,})/;
  return years.split(gap).map(collapseCell).join('');
}

const ENDS_IN_WORD_HYPHEN = /\p{L}-$/u;
const ENDS_IN_OPEN_RANGE = /(?:^|\s)(?:\d{1,2}[/.-])?(?:19|20)\d{2}\s*[-–—~]$/;
const STARTS_A_RANGE_END = /^(?:nay|hiện tại|hiện nay|present|now|current|(?:\d{1,2}[/.-])?(?:19|20)\d{2}\b)/i;

/** Joins "Power-" + "Point" and "03/2021 –" + "nay". */
function joinBrokenLines(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const last = out[out.length - 1];
    if (last !== undefined && ENDS_IN_WORD_HYPHEN.test(last) && /^\p{L}/u.test(line)) {
      out[out.length - 1] = `${last.slice(0, -1)}${line}`;
    } else if (last !== undefined && ENDS_IN_OPEN_RANGE.test(last) && STARTS_A_RANGE_END.test(line)) {
      out[out.length - 1] = `${last} ${line}`;
    } else {
      out.push(raw);
    }
  }
  return out;
}

const COLUMN_GAP = /\S {3,}\S/;

const MIN_FLOWING_ROWS = 3;

interface Row {
  left: string;
  right: string;
  rightAt: number;
}

function rowOf(line: string): Row | null {
  const gap = / {3,}/.exec(line.trimEnd());
  if (!gap || gap.index === 0) return null;
  const rightAt = gap.index + gap[0].length;
  return { left: line.slice(0, gap.index), right: line.slice(rightAt), rightAt };
}

/** Rows lined up on one column whose text carries on from row to row: prose in a column, not a value set to the right. */
function isFlowingRun(rows: readonly Row[]): boolean {
  const labels = rows.filter((r) => r.left.trimEnd().endsWith(':')).length;
  return (
    rows.length >= MIN_FLOWING_ROWS &&
    labels * 2 <= rows.length &&
    rows.some((r) => /^\p{Ll}/u.test(r.right)) &&
    rows.every((r) => Math.abs(r.rightAt - (rows[0]?.rightAt ?? 0)) <= 2 && !/^[\d(]/.test(r.right))
  );
}

function hasFlowingColumn(lines: readonly string[]): boolean {
  let run: Row[] = [];
  for (const line of lines) {
    const row = rowOf(line);
    run = row ? [...run, row] : [];
    if (isFlowingRun(run)) return true;
  }
  return false;
}

/**
 * Two columns side by side, split into a left and a right stream, each read on its own. A wide gap alone proves nothing
 * ("Kế toán – Công ty X      03/2021 – nay" is a date set to the right): a heading must sit in one of the cells, or the
 * right column must read on from row to row.
 */
function splitColumns(lines: readonly string[], isHeading: (cell: string) => boolean): string[] {
  const gapped = lines.filter((l) => COLUMN_GAP.test(l));
  const hasHeadingCell = gapped.some((l) => l.trim().split(/ {3,}/).some(isHeading));
  if (gapped.length < 2 || (!hasHeadingCell && !hasFlowingColumn(lines))) return [...lines];
  const left: string[] = [];
  const right: string[] = [];
  for (const line of lines) {
    const gap = / {3,}/.exec(line.trimEnd());
    if (!gap) left.push(line);
    else if (gap.index === 0) right.push(line.trim());
    else {
      left.push(line.slice(0, gap.index));
      right.push(line.slice(gap.index).trim());
    }
  }
  return [...left, ...right];
}

const ENDS_A_THOUGHT = /[.:;!?]$/;

/** Text wrapped by the PDF: a line starting in lower case carries on the one before. Not for CVs typed in lower case. */
function joinWrappedLines(lines: readonly string[]): string[] {
  const starts = lines.map((l) => (/^\s*\p{L}/u.test(l) ? /^\s*\p{Lu}/u.test(l) : null)).filter((s) => s !== null);
  if (starts.filter(Boolean).length * 10 < starts.length * 6) return [...lines];
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const last = out[out.length - 1];
    const carriesOn =
      /^\p{Ll}/u.test(line) && last !== undefined && last.trim().length > 0 && !ENDS_A_THOUGHT.test(last.trim());
    if (carriesOn) out[out.length - 1] = `${last.trimEnd()} ${line}`;
    else out.push(raw);
  }
  return out;
}

const INLINE_HEADERS =
  /(?<=\S )(KINH NGHIỆM(?: LÀM VIỆC)?|QUÁ TRÌNH CÔNG TÁC|HỌC VẤN|TRÌNH ĐỘ HỌC VẤN|KỸ NĂNG|NGOẠI NGỮ|CHỨNG CHỈ|MỤC TIÊU(?: NGHỀ NGHIỆP)?|WORK EXPERIENCE|EXPERIENCE|EDUCATION|SKILLS|LANGUAGES|CERTIFICATES|OBJECTIVE|KINH NGHIEM(?: LAM VIEC)?|HOC VAN|KY NANG|NGOAI NGU)(?= )/g;
const ONE_LINE_CV_LENGTH = 80;

/** A CV extracted as one long line still has its headings in capitals: they restore the sections. */
function splitInlineHeaders(line: string): string[] {
  if (line.length < ONE_LINE_CV_LENGTH) return [line];
  return line.replace(INLINE_HEADERS, '\n$1\n').split('\n');
}

const SPLIT_BRANDS = [
  'excel',
  'misa',
  'toeic',
  'ielts',
  'toefl',
  'powerpoint',
  'autocad',
  'photoshop',
  'illustrator',
  'python',
  'javascript',
  'marketing',
  'logistics',
];

function brandSplitPattern(word: string): string {
  const parts: string[] = [];
  for (let i = 2; i <= word.length - 2; i += 1) parts.push(`${word.slice(0, i)} ${word.slice(i)}`);
  return parts.join('|');
}

const BRAND_RE = new RegExp(
  `(?<![\\p{L}\\d])(?:${SPLIT_BRANDS.map(brandSplitPattern).join('|')})(?![\\p{L}\\d])`,
  'giu',
);
/** A syllable never starts with a dot-below vowel, so "nghi ệm" and "ngo ại" are one word. */
const DOT_BELOW_START = '[ạặậẹệịọộợụựỵ]';
const TONED_VOWEL = '[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]';
/** "th ạo", "H ọc", "m ềm": a fragment without a vowel cannot stand alone. */
const CONSONANT_FRAGMENT = new RegExp(
  `(?<![\\p{L}\\d])([bcdđghklmnpqrstvx]{1,3}|[BCDĐGHKLMNPQRSTVX][bcdđghklmnpqrstvx]{0,2}) (${TONED_VOWEL}[\\p{L}]*)`,
  'gu',
);
const DOT_BELOW_FRAGMENT = new RegExp(`(\\p{L}) (${DOT_BELOW_START}\\p{L}+)`, 'gu');

/** Joins words the PDF font split with a stray space. */
export function repairSplitWords(line: string): string {
  return line
    .replace(CONSONANT_FRAGMENT, '$1$2')
    .replace(DOT_BELOW_FRAGMENT, '$1$2')
    .replace(/(?<![\p{L}\d])(k[eế]) (to) ([aá]n)(?![\p{L}\d])/giu, '$1 $2$3')
    .replace(BRAND_RE, (m) => m.replace(' ', ''));
}

/** A font without a character map: extraction leaves "(cid:36)(cid:72)", codes and no words. */
const FONT_CODES = /\(cid:\d+\)/g;

const QUOTED_AD = /(?:tin tuy[eể]n d[uụ]ng|m[oô] t[aả] c[oô]ng vi[eệ]c|job description)(?: y[eê]u c[aầ]u)?\s*:.*$/i;

/** Text the candidate pasted from the ad ("Tin tuyển dụng yêu cầu: …") is no claim about the candidate. */
function dropQuotedAd(line: string): string {
  return line.replace(QUOTED_AD, '');
}

/** From raw PDF text to raw lines, layout repaired. */
export function repairLayout(cvText: string, isHeading: (cell: string) => boolean = () => false): string[] {
  const text = cvText
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_CHARS, '')
    .replace(FONT_CODES, ' ')
    .replace(PRIVATE_USE, '•')
    .replace(/[\u00A0\u2007\u202F]/g, ' ');
  const columns = splitColumns(text.split('\n').map(collapseSpacing), isHeading);
  return joinWrappedLines(joinBrokenLines(columns))
    .flatMap((l) => l.split(/(?=[•●▪■➢❖])/))
    .flatMap(splitInlineHeaders)
    .map((l) => repairSplitWords(dropQuotedAd(l)));
}
