/**
 * Last look at a requirement line the parser did not understand ("Theo dõi nhập - xuất - tồn, kiểm kê định kỳ"): do the
 * line's own words show up in what the candidate worked on or studied? A hit is only a hint for HR, so it says "đạt"
 * and never counts; a miss says nothing, because a CV can show the same work in other words.
 */
import type { EducationEntry } from './education.js';
import { workText, withoutOtherPeople } from './experience-jobs.js';
import type { ExperienceFacts } from './experience.js';
import { cleanLine, foldClean, type CvDoc, type CvLine } from './normalize.js';
import { findTerm, isAspiration, snippet } from './text-match.js';

const HINT_REASON = 'CV có câu có thể liên quan, HR kiểm tra lại';

/**
 * Half of the line's words, at least three of them, two on one line. Picked on half of the ads and checked on the other
 * half of eval-fresh: a third of the words or only two let in near-misses, where one word such as "nhà thuốc" answers.
 */
const MIN_SHARE = 0.5;
const MIN_COVERED = 3;
const MIN_ON_ONE_LINE = 2;
/** Fewer items than this are a sentence of duties ("Check-in, check-out, đặt phòng, thu ngân"), which must still read. */
const MIN_LIST_ITEMS = 6;
const MAX_WORDS_PER_LIST_ITEM = 3;
/** A longer line with a degree on it is a paragraph that also mentions one, not a study line. */
const MAX_STUDY_LINE_WORDS = 25;

/** Words that ask for something rather than say what: they do not tell one kind of work from another. */
const ASKING_PHRASES =
  /\b(?:thuc hien|tham gia|ho tro|phu trach|dam bao|dam nhan|lien quan|cong viec|nhiem vu|yeu cau|cap tren|su dung|thanh thao|thong thao|nam (?:ro|vung|chac|duoc|bat)|am hieu|hieu (?:biet|ro)|kien thuc|ky nang|kha nang|kinh nghiem|co the|quan ly|lam viec|chuyen nghiep|co ban|nang cao|hoac tuong tu|working knowledge)\b/g;
const FILLER_WORDS = new Set(
  (
    'va voi cho theo tai trong tren duoi khi de do nhung mot so nhu la co duoc se can phai khac cac cua biet hieu ' +
    'dung tot gioi ve o tu den hoac khong chua and or the of to for in on with as by at from'
  ).split(' '),
);

/** Lines setting a minimum: finding the words does not show the amount. */
const ASKS_AMOUNT =
  /\b\d+\s*\+?\s*(?:nam|thang|nguoi|nhan su|years?|months?|people)\b|\b(?:toi thieu|it nhat|tren|hon|tu|at least|over)\s+\d/;
/** Lines asking for a paper: "bằng lái" in a CV is not "bằng lái C", and doing the work is not holding the paper. */
const ASKS_PAPER =
  /\b(?:chung chi|chung nhan|giay (?:phep|xac nhan|to)|bang (?:lai|nghe|cap|tot nghiep|dai hoc|cao dang|trung cap)|the hanh nghe|licen[cs]e|certificate|certified|certification)\b/;

const UNSURE_WORDS = /\b(?:chua|khong|never|not|without)\b/;

/** Content words of a folded line, in order. */
function contentWords(folded: string): string[] {
  const asked = folded.replace(ASKING_PHRASES, ' ');
  const words = asked.match(/[a-z0-9+#]+/g) ?? [];
  return words.filter((w) => !FILLER_WORDS.has(w) && w.length >= 2 && /[a-z]/.test(w));
}

/** Whether words can answer the line at all. */
function isAnswerableByWords(folded: string): boolean {
  return !ASKS_AMOUNT.test(folded) && !ASKS_PAPER.test(folded);
}

/** "FIFO, 5S, xe nâng, Excel, kho bãi, …": short items and many of them. A dump is a list, however the words read. */
function isKeywordList(folded: string): boolean {
  const items = folded.split(/[,|]/).filter((item) => /[a-z0-9]/.test(item));
  if (items.length < MIN_LIST_ITEMS) return false;
  const words = items.flatMap((item) => item.match(/[a-z0-9+#]+/g) ?? []);
  return words.length / items.length <= MAX_WORDS_PER_LIST_ITEM;
}

/** One sentence as a statement of work: nothing from a dump or a wish, and nothing after a denial. */
function statedInSentence(sentence: string): string {
  if (isKeywordList(sentence) || isAspiration(sentence)) return '';
  const unsure = UNSURE_WORDS.exec(sentence);
  return unsure ? sentence.slice(0, unsure.index) : sentence;
}

/** What a line says the candidate did. PDF extraction can glue a dump to a job line, so this goes sentence by sentence. */
function statedPart(folded: string): string {
  return withoutOtherPeople(folded)
    .split(/[.;!?]+(?:\s|$)/)
    .map(statedInSentence)
    .join(' . ');
}

const wordCount = (folded: string): number => (folded.match(/[a-z0-9+#]+/g) ?? []).length;

function isWorkLine(line: CvLine, work: string, undatedInSection: boolean): boolean {
  if (work.includes(withoutOtherPeople(line.folded).trim())) return true;
  return line.section === 'projects' || (undatedInSection && line.section === 'experience');
}

function isStudyLine(line: CvLine, entries: readonly EducationEntry[]): boolean {
  if (line.section === 'education') return true;
  return entries.some((e) => e.line === line) && wordCount(line.folded) <= MAX_STUDY_LINE_WORDS;
}

/** The lines saying what the candidate worked on or studied; a skills list or a paste above the jobs is not one. */
export function workAndStudyLines(
  doc: CvDoc,
  experience: ExperienceFacts,
  education: readonly EducationEntry[],
): CvLine[] {
  const work = workText(experience.jobs);
  return doc.lines.filter(
    (line) => !line.isHeader && (isWorkLine(line, work, experience.undatedIsSection) || isStudyLine(line, education)),
  );
}

interface Overlap {
  /** Distinct content words of the requirement. */
  total: number;
  /** Those found anywhere in the lines. */
  covered: number;
  /** Those found on the single best line. */
  onOneLine: number;
  /** The best line and the first of its words, for the quote. */
  line: CvLine | null;
  firstWord: string | null;
}

/** Counts the requirement's content words across the lines. */
function overlapOf(folded: string, lines: readonly CvLine[]): Overlap {
  const asked = [...new Set(contentWords(folded))];
  const perLine = lines.map((line) => {
    const said = new Set(contentWords(statedPart(line.folded)));
    return { line, shared: asked.filter((w) => said.has(w)) };
  });
  const covered = new Set(perLine.flatMap((entry) => entry.shared));
  const best = perLine.reduce<(typeof perLine)[number] | null>(
    (top, entry) => (entry.shared.length > (top?.shared.length ?? 0) ? entry : top),
    null,
  );
  return {
    total: asked.length,
    covered: covered.size,
    onOneLine: best?.shared.length ?? 0,
    line: best?.line ?? null,
    firstWord: best?.shared[0] ?? null,
  };
}

function isHit(overlap: Overlap): boolean {
  return (
    overlap.covered >= MIN_COVERED &&
    overlap.onOneLine >= MIN_ON_ONE_LINE &&
    overlap.covered / overlap.total >= MIN_SHARE
  );
}

interface LineHint {
  evidence: string;
  reason: string;
}

/** The hint for a line the parser did not understand, or null when its words are not in the work and study lines. */
export function hintFor(requirement: string, lines: readonly CvLine[]): LineHint | null {
  const folded = foldClean(cleanLine(requirement));
  if (!isAnswerableByWords(folded)) return null;
  const overlap = overlapOf(folded, lines);
  if (!isHit(overlap) || !overlap.line) return null;
  const span = overlap.firstWord ? findTerm(overlap.line.folded, overlap.firstWord)[0] : undefined;
  return { evidence: snippet(overlap.line, span), reason: HINT_REASON };
}
