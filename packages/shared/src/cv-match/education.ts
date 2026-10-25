/**
 * Education: ordered levels THPT < Trung cấp < Cao đẳng < Đại học < Thạc sĩ < Tiến sĩ, parsed from requirement lines
 * and from the CV's education entries. "Sinh viên năm 3" / "đang học" is not a completed degree.
 */
import type { EduLevel, EducationAtom } from './atoms.js';
import { findDates, findRanges } from './dates.js';
import { buildField, isRelatedOnly } from './fields.js';
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
const REQ_ONLY_TERMS: [EduLevel, string[]][] = [
  [3, ['cd']],
  [2, ['tc']],
  [1, ['pho thong']],
];
const CV_ONLY_TERMS: [EduLevel, string[]][] = [[4, ['hoc vien', 'academy']]];

function levelsIn(folded: string, side: 'req' | 'cv'): EduLevel[] {
  const extra = side === 'req' ? REQ_ONLY_TERMS : CV_ONLY_TERMS;
  // Abbreviations are only trusted in requirement lines; in a CV "CĐ"/"TC" are too ambiguous.
  const text = folded.replace(/\blao dong pho thong\b/g, ' ');
  return [...COMMON_LEVEL_TERMS, ...extra].filter(([, terms]) => hasAnyTerm(text, terms)).map(([lvl]) => lvl);
}

const MAJOR_START =
  /\b(chuyen nganh|khoi nganh|nganh|major in|major|degree in|bachelor of|master of|cu nhan|ky su)\b\s*:?\s*/;
const MAJOR_STOP = /[.;()|\n]|\s-\s|\b(?:uu tien|co|va co|tro len|at|truong|xep loai|loai|gpa)\b|\b\d/;

function majorsOf(folded: string): { majors: string[]; relatedOnly: boolean } {
  const m = MAJOR_START.exec(folded);
  if (!m) return { majors: [], relatedOnly: false };
  const phrase = folded.slice(m.index + m[0].length).split(MAJOR_STOP)[0];
  const parts = phrase
    .split(/,|\/|\bhoac\b|\bva\b|\bor\b|\band\b/)
    .map((p) =>
      p.replace(/\b(cac|nganh|chuyen nganh|khoi|lien quan|tuong duong|phu hop|related|relevant|other)\b/g, ' ').trim(),
    )
    .filter((p) => /[a-z]{2,}/.test(p) && levelsIn(p, 'req').length === 0);
  return { majors: parts, relatedOnly: isRelatedOnly(phrase) };
}

export type EducationParse = { kind: 'atom'; atom: EducationAtom } | { kind: 'none'; reason: string } | null;

/** Education atom of a requirement line; `labelled` = line starts with "Học vấn:" / "Bằng cấp:". */
export function parseEducationRequirement(folded: string, labelled: boolean): EducationParse {
  if (/\blao dong pho thong\b/.test(folded) || (labelled && /\bkhong (yeu cau|can|bat buoc)\b/.test(folded))) {
    return { kind: 'none', reason: 'Tin không yêu cầu bằng cấp' };
  }
  const levels = levelsIn(folded, 'req');
  const { majors, relatedOnly } = majorsOf(folded);
  const graduation = /\b(tot nghiep|bang|degree|hoc van)\b/.test(folded) || labelled;
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
}

const SCHOOL_CONTEXT =
  /\b(truong|dai hoc|university|college|cao dang|trung cap|thpt|hoc vien|academy|tot nghiep|bang|degree|bachelor|master|cu nhan|ky su|thac si)\b/;
const IN_PROGRESS =
  /\b(dang hoc|dang theo hoc|chua tot nghiep|du kien tot nghiep|expected|nam cuoi|sinh vien nam|nam thu \d|currently studying|bo hoc|in progress|dang la sinh vien|undergraduate student|final year|year \d student)\b/;
const STUDENT_NOW =
  /\b(sinh vien nam (?:\d|nhat|hai|ba|tu|cuoi)|dang la sinh vien|dang hoc (?:dai hoc|cao dang|nam)|currently (?:a )?student|undergraduate student|final year student|year \d student)\b/;
const GRADUATED = /\b(da tot nghiep|graduated|tot nghiep (?:loai|nam|thang|\d))\b/;

function educationLines(doc: CvDoc): CvLine[] {
  const section = doc.lines.filter((l) => l.section === 'education');
  if (section.length > 0) return section;
  return doc.lines.filter((l) => l.section !== 'experience' && SCHOOL_CONTEXT.test(l.folded));
}

function entryWindow(lines: CvLine[], i: number): CvLine[] {
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length && j <= i + 2 && levelsIn(lines[j].folded, 'cv').length === 0; j += 1) {
    out.push(lines[j]);
  }
  return out;
}

function isCompleted(folded: string, todayMonth: number | null, studentNow: boolean): boolean {
  if (IN_PROGRESS.test(folded)) return false;
  if (findRanges(folded, todayMonth).some((r) => r.ongoing)) return false;
  const todayYear = todayMonth === null ? null : Math.floor(todayMonth / 12);
  if (todayYear !== null && findDates(folded).some((d) => d.year > todayYear)) return false;
  return !(studentNow && !GRADUATED.test(folded));
}

/** Education entries found in the CV. */
export function extractEducation(doc: CvDoc, todayMonth: number | null): EducationEntry[] {
  const lines = educationLines(doc);
  const studentNow = doc.lines.some((l) => STUDENT_NOW.test(l.folded));
  const entries: EducationEntry[] = [];
  lines.forEach((line, i) => {
    const levels = levelsIn(line.folded, 'cv');
    if (levels.length === 0) return;
    const window = entryWindow(lines, i);
    const folded = window.map((l) => l.folded).join(' \n ');
    const text = window.map((l) => l.text).join(' \n ');
    const level = Math.max(...levels) as EduLevel;
    entries.push({ level, completed: isCompleted(folded, todayMonth, studentNow && level >= 3), line, folded, text });
  });
  return entries;
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
    const explicit = majorsOf(e.folded).majors;
    return explicit.length > 0 ? explicit : implicitMajors(e.line.folded);
  });
}

const NOT_A_MAJOR =
  /\b(truong|hoc vien|university|college|school|academy|campus|co so|chi nhanh|gpa|xep loai|loai|tot nghiep|bang|hoc bong|ha noi|tp\.? ?hcm|hcm|ho chi minh|sai gon|da nang|can tho|hai phong|hue|viet nam|vietnam)\b|:/;

/** "Đại học Ngân hàng – Tài chính – Ngân hàng (2017 – 2021)": the parts after the school name are the major. */
function implicitMajors(lineFolded: string): string[] {
  return lineFolded
    .split(/\s-\s|[|,;]/)
    .map((seg) =>
      seg
        .replace(/\([^)]*\)|[\d/.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((seg) => seg.length >= 3 && seg.length <= 50 && /[a-z]{2,}/.test(seg))
    .filter((seg) => levelsIn(seg, 'cv').length === 0 && !NOT_A_MAJOR.test(seg));
}

/** A CV major in the CV's own wording. */
export function cvMajorLabel(entries: readonly EducationEntry[], major: string): string {
  const entry = entries.find((e) => e.folded.includes(major));
  return entry ? originalOf(entry.text, major) : major;
}

export function majorMatches(cvMajor: string, wanted: string): boolean {
  if (cvMajor.includes(wanted) || wanted.includes(cvMajor)) return true;
  const field = buildField(wanted);
  return field !== null && hasAnyTerm(cvMajor, field.terms);
}
