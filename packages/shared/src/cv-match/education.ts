/**
 * Education: ordered levels THPT < Trung cấp < Cao đẳng < Đại học < Thạc sĩ < Tiến sĩ, parsed from requirement lines
 * and from the CV's education entries. "Sinh viên năm 3" / "đang học" is not a completed degree.
 */
import type { EduLevel, EducationAtom } from './atoms.js';
import { findDates, findRanges } from './dates.js';
import { isRelatedOnly, synonymsOf } from './fields.js';
import { areSynonymMajors, isKnownMajor, isSameMajorName } from './majors.js';
import type { CvDoc, CvLine } from './normalize.js';
import { hasAnyTerm, originalOf } from './text-match.js';

export const LEVEL_NAMES: Record<EduLevel, string> = {
  1: 'THPT',
  2: 'Trung cấp',
  3: 'Cao đẳng',
  4: 'Đại học',
  5: 'Thạc sĩ',
  6: 'Tiến sĩ',
};

const COMMON_LEVEL_TERMS: [EduLevel, string[]][] = [
  [6, ['tien si', 'phd', 'ph.d', 'doctorate', 'doctor of philosophy']],
  [5, ['thac si', 'master', 'masters', 'mba', 'msc', 'm.sc', 'cao hoc']],
  [4, ['dai hoc', 'cu nhan', 'ky su', 'bachelor', 'bachelors', 'university', 'bsc', 'b.sc', 'dh']],
  [3, ['cao dang', 'college', 'associate degree']],
  [2, ['trung cap', 'vocational', 'trung cap nghe']],
  [
    1,
    [
      'thpt',
      'trung hoc pho thong',
      'cap 3',
      'cap iii',
      'lop 12',
      '12/12',
      'high school',
      'bo tuc',
      'tot nghiep pho thong',
    ],
  ],
];
/** "CI/CD" holds the letters of "CĐ"; it is not a degree. */
const NOT_A_LEVEL = /\b(?:ci\/cd|lao dong pho thong)\b/g;
const REQ_ONLY_TERMS: [EduLevel, string[]][] = [
  [3, ['cd']],
  [2, ['tc']],
  [1, ['pho thong']],
];
const CV_ONLY_TERMS: [EduLevel, string[]][] = [[4, ['hoc vien', 'academy', '大学']]];

function levelsIn(folded: string, side: 'req' | 'cv'): EduLevel[] {
  const extra = side === 'req' ? REQ_ONLY_TERMS : CV_ONLY_TERMS;
  // Abbreviations are only trusted in requirement lines; in a CV "CĐ"/"TC" are too ambiguous.
  const text = folded.replace(NOT_A_LEVEL, ' ');
  return [...COMMON_LEVEL_TERMS, ...extra].filter(([, terms]) => hasAnyTerm(text, terms)).map(([lvl]) => lvl);
}

const MAJOR_START =
  /\b(chuyen nganh|khoi nganh|nganh|major in|major|degree in|bachelor of|bachelor in|bachelors? of|master of|master in|ba in|bsc in|b\.sc\. in|mba in|cu nhan|ky su|thac si|tien si|(?<=(?:trung cap|cao dang|so cap) )nghe)\b\s*:?\s*/;
/** "có" ends a major; "Cơ khí", "cơ điện", "cơ sở" fold to the same two letters and do not. */
const MAJOR_STOP =
  /[.;()|\n]|\b(?:uu tien|co(?! (?:khi|dien|so|ban|hoc))|va co|tro len|at|truong|xep loai|loai|gpa)\b|\b\d/;
const MAJOR_SEPARATORS = /,|\/|(?<![a-z])hoac\b|(?<=[a-z])hoac\b|\bva\b|\bor\b|\band\b/;
const MAJOR_FILLER =
  /\b(cac|nganh|chuyen nganh|khoi|lien quan|tuong duong|phu hop|related|relevant|other|science in|arts in|engineering in)\b/g;

function majorPhrase(folded: string, side: 'req' | 'cv'): { phrase: string } | null {
  // "chuyên ngành" says it most clearly; "cử nhân", "kỹ sư" only hint at it.
  const clear = /\b(?:chuyen nganh|khoi nganh|nganh)\b\s*:?\s*/.exec(folded);
  const m = clear ?? MAJOR_START.exec(folded);
  if (!m) return null;
  const phrase = folded.slice(m.index + m[0].length).split(MAJOR_STOP)[0] ?? '';
  // In a CV a dash separates the major from the school; in an ad it joins "xây dựng – công trình".
  return { phrase: side === 'cv' ? (phrase.split(/\s-\s/)[0] ?? '') : phrase };
}

function majorParts(phrase: string): string[] {
  return phrase
    .split(MAJOR_SEPARATORS)
    .map((p) => p.replace(MAJOR_FILLER, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => /[a-z]{1,}/.test(p) && (p.length >= 2 || p === 'y') && levelsIn(p, 'req').length === 0);
}

function majorsOf(folded: string, side: 'req' | 'cv'): { majors: string[]; relatedOnly: boolean } {
  const m = majorPhrase(folded, side);
  if (!m) return { majors: [], relatedOnly: false };
  return { majors: majorParts(m.phrase), relatedOnly: isRelatedOnly(m.phrase) };
}

const LEVEL_WORDS = 'dai hoc|cao dang|trung cap|thac si|tien si|cu nhan';
const AFTER_LEVEL = new RegExp(
  `\\b(?:${LEVEL_WORDS})\\s+((?!tro len|chuyen nganh|nganh)[a-z][a-z ]+?)(?=\\s*(?:tro len|$|[,.;()]))`,
);
const LEADING_LEVEL = new RegExp(`^(?:hoac\\s+)?(?:${LEVEL_WORDS})\\s+`);

/** "Có bằng sư phạm": a degree named by its major alone. */
function namedDegree(folded: string): string[] {
  const words = /\bbang\s+([a-z ]+?)\s*(?:tro len|$|[,.;()])/.exec(folded)?.[1]?.trim();
  return words && isKnownMajor(words) && !/^(?:lai|cap|chung|[a-z]\s)/.test(words) ? [words] : [];
}

/**
 * "Tốt nghiệp Đại học Dược", "Cao đẳng Sư phạm Mầm non trở lên": the words after the level name the major.
 * "Cao đẳng Dược hoặc Đại học Dược" names it twice.
 */
function majorAfterLevel(folded: string): string[] {
  const m = AFTER_LEVEL.exec(folded);
  const words = (m?.[1] ?? '').split(/\bhoac\b/).map((w) => w.trim().replace(LEADING_LEVEL, ''));
  return [...new Set(words.filter((w) => w.length > 0 && isKnownMajor(w)))];
}

export type EducationParse = { kind: 'atom'; atom: EducationAtom } | { kind: 'none'; reason: string } | null;

/** Education atom of a requirement line; `labelled` = line starts with "Học vấn:" / "Bằng cấp:". */
export function parseEducationRequirement(folded: string, labelled: boolean): EducationParse {
  if (
    /\blao dong pho thong\b/.test(folded) ||
    (labelled && /\bkhong (yeu cau|can|bat buoc)\b/.test(folded)) ||
    /\bkhong (yeu cau|can|bat buoc)\s+(bang cap|hoc van|trinh do|bang dai hoc)\b/.test(folded)
  ) {
    return { kind: 'none', reason: 'Tin không yêu cầu bằng cấp' };
  }
  const levels = levelsIn(folded, 'req');
  const parsed = majorsOf(folded, 'req');
  const relatedOnly = parsed.relatedOnly;
  const majors = parsed.majors.length > 0 ? parsed.majors : [...majorAfterLevel(folded), ...namedDegree(folded)];
  // A line opening on the major or on students of it asks for that study; "am hiểu ngành X" asks for knowledge of it.
  const graduation =
    /\b(tot nghiep|bang|degree|hoc van)\b|^\W*(?:chuyen nganh|khoi nganh|nganh|sinh vien)\b/.test(folded) || labelled;
  if (levels.length === 0 && (majors.length === 0 || !graduation)) return null;
  const minLevel = levels.length > 0 ? (Math.min(...levels) as EduLevel) : null;
  return {
    kind: 'atom',
    atom: { kind: 'education', minLevel, majors, majorLabels: majors, majorRelatedOnly: relatedOnly },
  };
}

export interface EducationEntry {
  level: EduLevel;
  completed: boolean;
  line: CvLine;
  /** Folded text of the entry (its line and the lines describing it). */
  folded: string;
  /** Same window in original wording (same length as `folded`). */
  text: string;
  /** The CV says the candidate has no degree: not a level, but a clear answer. */
  noDegree?: boolean;
}

const SCHOOL_CONTEXT =
  /\b(truong|dai hoc|university|college|cao dang|trung cap|thpt|hoc vien|academy|tot nghiep|bang|degree|diploma|vocational|bachelor|master|cu nhan|ky su|thac si|大学)\b|大学/;
const IN_PROGRESS =
  /\b(dang hoc|dang theo hoc|chua tot nghiep|du kien tot nghiep|expected|nam cuoi|sinh vien nam|nam thu \d|currently studying|bo hoc|in progress|dang la sinh vien|undergraduate student|final year|year \d student)\b/;
const STUDENT_NOW =
  /\b(sinh vien nam (?:\d|nhat|hai|ba|tu|cuoi)|dang la sinh vien|dang hoc (?:dai hoc|cao dang|nam)|currently (?:a )?student|undergraduate student|final year student|year \d student)\b/;
const GRADUATED = /\b(da tot nghiep|graduated|tot nghiep (?:loai|nam|thang|\d))\b/;
/** Below high school: "Lớp 9/12", "Học lớp 11", "Học vấn: 9/12". */
const BELOW_HIGH_SCHOOL =
  /(?<![\d/.])(?:[1-9]|1[01])\/12(?![\d/])|^\W*(?:(?:hoc van|trinh do(?: hoc van)?|education)\s*:?\s*)?(?:lop (?:[1-9]|1[01])\b|thcs\b|trung hoc co so\b)|(?<!day )\b(?:hoc het|hoc|het) lop (?:[1-9]|1[01])\b/;
/** A clearly stated education fact, wherever it sits on the page. */
const STATED_EDUCATION = /^\W*(?:hoc van\b|trinh do\b|tot nghiep\b|hoc het lop\b|hoc lop\b|lop \d)/;
/** A clause that names a level without giving it to the candidate. */
const NOT_THE_CANDIDATE =
  /^\W*(?:khong|chua)\b.*\b(?:bang|hoc|tot nghiep)\b|\b(?:khong co bang|chua co bang|khong hoc|khong tot nghiep|no degree)\b|^\W*(?:bo|me|cha|anh|chi|em trai|em gai|chong|vo|father|mother|brother|sister)(?: em| toi| minh| cua toi| cua em)?\s+(?:la|co|lam|is|has)\b/;
/** A course held at a school is no degree from it. */
const SHORT_COURSE =
  /\b((?<!dai hoc |vien )khoa hoc(?! (?:xa hoi|tu nhien|may tinh|ky thuat|du lieu|cong nghe))|ngan han|short course|workshop|hoc bong|scholarship|so cap nghe|chung chi|certificate)\b/;
const SAYS_NO_DEGREE = /\b(?:khong co bang|chua co bang|khong hoc|khong tot nghiep|no degree)\b/;

function clauseStates(clause: string): boolean {
  return !NOT_THE_CANDIDATE.test(clause) && !SHORT_COURSE.test(clause);
}

/** The line with clauses about other people, missing degrees and short courses blanked. A spaced slash parts clauses. */
function ownClauses(folded: string): string {
  return folded
    .split(/(\s\/\s)/)
    .map((part) => part.replace(/[^,;.]+/g, (clause) => (clauseStates(clause) ? clause : ' '.repeat(clause.length))))
    .join('');
}

function isEducationLine(line: CvLine, hasSection: boolean): boolean {
  if (line.section === 'education') return true;
  if (STATED_EDUCATION.test(line.folded) || BELOW_HIGH_SCHOOL.test(line.folded) || SAYS_NO_DEGREE.test(line.folded)) {
    return true;
  }
  return !hasSection && line.section !== 'experience' && SCHOOL_CONTEXT.test(line.folded);
}

function educationLines(doc: CvDoc): CvLine[] {
  const hasSection = doc.lines.some((l) => l.section === 'education');
  return doc.lines.filter((l) => isEducationLine(l, hasSection));
}

function cvLevels(line: CvLine): EduLevel[] {
  const own = ownClauses(line.folded);
  const levels = levelsIn(own, 'cv');
  if (line.section === 'education' && /(?:^|[\s,(])ĐH(?=\s)/.test(line.text)) levels.push(4);
  if (line.section === 'education' && /(?:^|[\s,(])CĐ(?=\s)/.test(line.text)) levels.push(3);
  return levels;
}

function entryWindow(lines: CvLine[], i: number): CvLine[] {
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length && j <= i + 2 && cvLevels(lines[j]).length === 0; j += 1) {
    if (lines[j].index === (lines[j - 1]?.index ?? -2) + 1) out.push(lines[j]);
  }
  return out;
}

function isCompleted(folded: string, todayMonth: number | null, studentNow: boolean): boolean {
  if (IN_PROGRESS.test(folded)) return false;
  if (GRADUATED.test(folded)) return true;
  if (findRanges(folded, todayMonth).some((r) => r.ongoing)) return false;
  const todayYear = todayMonth === null ? null : Math.floor(todayMonth / 12);
  if (todayYear !== null && findDates(folded).some((d) => d.year > todayYear)) return false;
  return !studentNow;
}

/** Sentences of a line that each name a level: "Đại học Dược, dự kiến 2027. Bằng hiện có: Trung cấp Dược 2022." */
function ownSentences(line: CvLine): CvLine[] {
  const spans = [...line.folded.matchAll(/[^.]+(?:\.(?!\s)[^.]*)*/g)];
  const sentences = spans.map((m) => ({
    ...line,
    folded: line.folded.slice(m.index, m.index + m[0].length),
    text: line.text.slice(m.index, m.index + m[0].length),
  }));
  const withLevel = sentences.filter((s) => cvLevels(s).length > 0);
  return withLevel.length > 1 ? withLevel : [];
}

function entryOf(line: CvLine, window: readonly CvLine[], today: number | null, studentNow: boolean): EducationEntry {
  const folded = window.map((l) => l.folded).join(' \n ');
  const text = window.map((l) => l.text).join(' \n ');
  const level = Math.max(...cvLevels(line)) as EduLevel;
  return { level, completed: isCompleted(folded, today, studentNow && level >= 3), line, folded, text };
}

/** "Sinh viên năm 3, ngành Kiến trúc": a study under way, whose major may be stated nowhere else. */
function studentEntries(doc: CvDoc): EducationEntry[] {
  const lines = doc.lines.filter(
    (l) => STUDENT_NOW.test(l.folded) && /\bnganh\b/.test(l.folded) && cvLevels(l).length === 0,
  );
  return lines.map((line) => ({ level: 3, completed: false, line, folded: line.folded, text: line.text }));
}

/** Education entries found in the CV. */
export function extractEducation(doc: CvDoc, todayMonth: number | null): EducationEntry[] {
  const lines = educationLines(doc);
  const studentNow = doc.lines.some((l) => STUDENT_NOW.test(l.folded));
  const entries = lines.flatMap((line, i): EducationEntry[] => {
    if (cvLevels(line).length === 0) {
      const noDegree = SAYS_NO_DEGREE.test(line.folded);
      const isBelow = noDegree || BELOW_HIGH_SCHOOL.test(ownClauses(line.folded));
      return isBelow ? [{ level: 1, completed: false, line, folded: line.folded, text: line.text, noDegree }] : [];
    }
    const sentences = ownSentences(line);
    if (sentences.length > 0) return sentences.map((s) => entryOf(s, [s], todayMonth, studentNow));
    return [entryOf(line, entryWindow(lines, i), todayMonth, studentNow)];
  });
  return [...entries, ...studentEntries(doc)];
}

/** Highest completed level; a student in higher education has at least finished THPT. */
export function highestCompleted(entries: readonly EducationEntry[]): EducationEntry | 'implied-thpt' | null {
  const done = entries.filter((e) => e.completed).sort((a, b) => b.level - a.level);
  if (done.length > 0) return done[0];
  return entries.some((e) => e.level >= 2) ? 'implied-thpt' : null;
}

/** Major phrases written in the CV's education entries ("Chuyên ngành: Kế toán"). */
export function cvMajors(entries: readonly EducationEntry[]): string[] {
  return entries.flatMap((e) => {
    const explicit = majorsOf(e.folded, 'cv').majors;
    return explicit.length > 0 ? explicit : implicitMajors(e);
  });
}

const NOT_A_MAJOR =
  /\b(truong|hoc vien|university|college|school|academy|campus|co so|chi nhanh|gpa|xep loai|loai|tot nghiep|bang|hoc bong|ha noi|tp\.? ?hcm|hcm|ho chi minh|sai gon|da nang|can tho|hai phong|hue|viet nam|vietnam|diploma|ielts|toeic|chung chi)\b|:/;
/** Inline headings and the short forms of a level, which only an education line can read as one. */
const ENTRY_LABEL = /^\W*(?:hoc van|trinh do(?: hoc van)?|education|bang cap)\s*:\s*/;
const CV_LEVEL_SHORT = /^\W*(?:cd|dh)\s+/;
const LEVEL_THEN_STUDY = /^\W*(?:cao dang|trung cap|dai hoc)\s+(.+)$/;
const NAMES_A_SCHOOL = /\btruong\b/;

/** What follows the entry on its line is another fact: "Cao đẳng Dược, 2026. Chưa có chứng chỉ hành nghề." */
function firstSentence(folded: string): string {
  return folded.split(/\.\s/)[0] ?? folded;
}

function segmentsOf(lineFolded: string): string[] {
  return firstSentence(lineFolded)
    .replace(ENTRY_LABEL, '')
    .split(/\s-\s|[|,;]/)
    .map((seg) =>
      seg
        .replace(/\([^)]*\)|[\d/.]+/g, ' ')
        .replace(CV_LEVEL_SHORT, 'cao dang ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((seg) => seg.length >= 3 && seg.length <= 50 && /[a-z]{2,}/.test(seg));
}

/**
 * "Cao đẳng Hộ sinh, Trường Cao đẳng Y tế": a school named later, so the first level names the study. Alone the words
 * after a level may be the school's name ("Cao đẳng Viễn Đông"), so only a study the dictionary knows is read.
 */
function studyOfLevel(segments: readonly string[]): string[] {
  const first = segments[0] ?? '';
  const study = LEVEL_THEN_STUDY.exec(first)?.[1]?.trim();
  if (!study) return [];
  const namesSchoolLater = segments.slice(1).some((seg) => levelsIn(seg, 'cv').length > 0 || NAMES_A_SCHOOL.test(seg));
  return namesSchoolLater || isKnownMajor(study) ? [study] : [];
}

/** "Đại học Ngân hàng TP.HCM – Tài chính – Ngân hàng (2017 – 2021)": the parts after the school name are the major. */
function majorsOnLine(lineFolded: string): string[] {
  const segments = segmentsOf(lineFolded);
  const stated = segments.filter((seg) => levelsIn(seg, 'cv').length === 0 && !NOT_A_MAJOR.test(seg));
  return stated.length > 0 ? stated : studyOfLevel(segments);
}

function implicitMajors(entry: EducationEntry): string[] {
  const own = majorsOnLine(entry.line.folded);
  const named = own.filter(isKnownMajor);
  if (named.length > 0 || entry.line.section !== 'education') return own;
  // Under an education heading the major may sit on the line under the school.
  const below = entry.folded
    .split(' \n ')
    .slice(1)
    .flatMap((l) => segmentsOf(l).filter((seg) => !NOT_A_MAJOR.test(seg) && levelsIn(seg, 'cv').length === 0));
  return below.length > 0 ? [...below, ...own] : own;
}

/** A CV major in the CV's own wording. */
export function cvMajorLabel(entries: readonly EducationEntry[], major: string): string {
  const entry = entries.find((e) => e.folded.includes(major));
  return entry ? originalOf(entry.text, major) : major;
}

export function majorMatches(cvMajor: string, wanted: string): boolean {
  if (isSameMajorName(cvMajor, wanted)) return true;
  return areSynonymMajors(cvMajor, wanted) || hasAnyTerm(cvMajor, synonymsOf(wanted));
}
