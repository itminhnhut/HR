/**
 * Work experience facts from a CV: date ranges of jobs (with the lines describing each job), explicit statements
 * ("3 năm kinh nghiệm", "3+ years of experience") and "chưa có kinh nghiệm".
 */
import { findRanges, type MonthInterval } from './dates.js';
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';
import type { Span } from './text-match.js';

export interface Job {
  interval: MonthInterval;
  line: CvLine;
  /** First line above the dates (job title / company) when there is one. */
  title: CvLine | null;
  /** Folded text of the job: title/company lines just above the dates, the date line and its description. */
  blockFolded: string;
  isInternship: boolean;
}

export interface ExplicitYears {
  months: number;
  line: CvLine;
  span: Span;
  /** Folded text right after the statement ("... kinh nghiệm bán hàng tại ..."), used to match a field. */
  tail: string;
}

export interface ExperienceFacts {
  jobs: Job[];
  explicit: ExplicitYears[];
  noExperience: CvLine | null;
}

const NOT_WORK_SECTIONS: ReadonlySet<SectionKind> = new Set([
  'education',
  'personal',
  'activities',
  'certificates',
  'references',
  'interests',
  'objective',
  'languages',
  'skills',
]);
const BIRTH =
  /\b(ngay sinh|nam sinh|sinh ngay|sinh nam|dob|d\.o\.b|date of birth|birth|born|ngay cap|cccd|cmnd|ngay thang nam sinh)\b/;
const SCHOOL =
  /\b(truong|dai hoc|university|college|thpt|cao dang|trung cap|hoc vien|academy|tot nghiep|sinh vien|khoa hoc|gpa|chuyen nganh)\b/;
const INTERNSHIP = /\b(thuc tap|thuc tap sinh|intern|internship|trainee)\b/;

function jobLines(doc: CvDoc): CvLine[] {
  const inSection = doc.lines.filter((l) => l.section === 'experience');
  if (inSection.some((l) => !BIRTH.test(l.folded) && findRanges(l.folded, null).length > 0)) return inSection;
  return doc.lines.filter((l) => !NOT_WORK_SECTIONS.has(l.section) && !SCHOOL.test(l.folded));
}

function isHeadCandidate(line: CvLine): boolean {
  return !line.isHeader && line.text.length < 80 && !/^[-*+]/.test(line.text);
}

function blockOf(lines: CvLine[], at: number, dateAt: ReadonlySet<number>): CvLine[] {
  const block: CvLine[] = [lines[at]];
  for (let i = at - 1; i >= Math.max(0, at - 2); i -= 1) {
    if (dateAt.has(i) || !isHeadCandidate(lines[i]) || lines[i].section !== lines[at].section) break;
    block.unshift(lines[i]);
  }
  for (let i = at + 1; i < lines.length && !dateAt.has(i) && !lines[i].isHeader; i += 1) {
    const next = lines[i + 1];
    const isNextHead = next !== undefined && dateAt.has(i + 1) && isHeadCandidate(lines[i]);
    if (isNextHead || lines[i].section !== lines[at].section) break;
    block.push(lines[i]);
  }
  return block;
}

function titleArea(block: CvLine[], dateLine: CvLine): string {
  const pos = block.indexOf(dateLine);
  return block
    .slice(0, pos + 2)
    .map((l) => l.folded)
    .join(' \n ');
}

function extractJobs(doc: CvDoc, todayMonth: number | null): Job[] {
  const lines = jobLines(doc).filter((l) => !BIRTH.test(l.folded));
  const ranges = lines.map((l) => findRanges(l.folded, todayMonth));
  const dateAt = new Set(ranges.flatMap((r, i) => (r.length > 0 ? [i] : [])));
  const jobs: Job[] = [];
  ranges.forEach((intervals, i) => {
    if (intervals.length === 0) return;
    const block = blockOf(lines, i, dateAt);
    const blockFolded = block.map((l) => l.folded).join(' \n ');
    const isInternship = INTERNSHIP.test(titleArea(block, lines[i]));
    const title = block[0] === lines[i] ? null : block[0];
    for (const interval of intervals) jobs.push({ interval, line: lines[i], title, blockFolded, isInternship });
  });
  return jobs;
}

const NUMBER = '(\\d+(?:[.,]\\d+)?)';
const QUALIFIER = '(?:(hon|tren|gan|khoang|over|more than|nearly|almost|about|around)\\s+)?';
const UNIT = '(nam|years?|yrs?|thang|months?)';
const STATEMENT_RES = [
  new RegExp(
    `${QUALIFIER}${NUMBER}\\s*\\+?\\s*${UNIT}\\s*\\+?\\s*(?:kinh nghiem|of (?:professional |work |relevant )?experience|experience)`,
    'g',
  ),
  new RegExp(`kinh nghiem(?: lam viec)?\\s*:\\s*${QUALIFIER}${NUMBER}\\s*\\+?\\s*${UNIT}`, 'g'),
];

function toMonths(qualifier: string | undefined, value: string, unit: string): number {
  const n = Number(value.replace(',', '.'));
  const months = /^(thang|month)/.test(unit) ? n : n * 12;
  // "gần 2 năm" / "almost 2 years" is a bit less than stated.
  return qualifier && /^(gan|nearly|almost)$/.test(qualifier) ? months - 1 : months;
}

function extractExplicit(doc: CvDoc): ExplicitYears[] {
  const out: ExplicitYears[] = [];
  for (const line of doc.lines) {
    if (line.section === 'education' || /\b(yeu cau|toi thieu|required)\b/.test(line.folded)) continue;
    for (const re of STATEMENT_RES) {
      re.lastIndex = 0;
      for (let m = re.exec(line.folded); m; m = re.exec(line.folded)) {
        const span = { start: m.index, end: m.index + m[0].length };
        const months = toMonths(m[1], m[2], m[3]);
        if (months > 0 && months < 45 * 12)
          out.push({ months, line, span, tail: line.folded.slice(span.end, span.end + 80) });
      }
    }
  }
  return out;
}

const NO_EXPERIENCE =
  /\b(chua co|khong co|chua tung co|chua tung lam viec|chua di lam)\s+(?:nhieu\s+)?kinh nghiem\b|\bno (?:prior |previous |work |professional )?(?:work )?experience\b|\bchua tung di lam\b/;

/** Collects all experience facts once per CV. */
export function extractExperience(doc: CvDoc, todayMonth: number | null): ExperienceFacts {
  const noExperience = doc.lines.find((l) => NO_EXPERIENCE.test(l.folded)) ?? null;
  return { jobs: extractJobs(doc, todayMonth), explicit: extractExplicit(doc), noExperience };
}
