/**
 * Jobs of a CV: each date range with the job title and company around it and the description under it.
 * Titles and companies (`head`) are kept apart from the description (`body`), where another department or a colleague
 * may be named without being the candidate's own work.
 */
import { findRanges, type MonthInterval } from './dates.js';
import { cvHeadline, readRole, roleWithHeadline, roleWithLineBelow, type JobRole } from './experience-role.js';
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';

export interface Job extends JobRole {
  interval: MonthInterval;
  line: CvLine;
  /** First line above the dates (job title / company) when there is one. */
  title: CvLine | null;
  /** Folded title and company. */
  head: string;
  /** Folded text of the job: head and description, without mentions of other people's work. */
  blockFolded: string;
  isInternship: boolean;
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
/**
 * A school's name, not the bare word: "Trưởng phòng", "Công ty Trường Sơn" and "Hiện trường" fold to the same word.
 * Not a primary or middle school: a CV lists those as where the candidate teaches.
 */
const SCHOOL =
  /\b(truong (?:dai hoc|cao dang|trung cap|thpt|pho thong|chuyen|dh|cd)|dai hoc|university|college|thpt|cao dang|trung cap|hoc vien|academy|tot nghiep|sinh vien|khoa hoc|gpa|chuyen nganh|hoc sinh)\b/;
const WORK_AT_SCHOOL = /\b(giao vien|giang vien|tro giang|gia su|teacher|lecturer|bao ve|nhan vien|ke toan)\b/;
const INTERNSHIP = /\b(thuc tap(?! sinh ky nang)|thuc tap sinh(?! ky nang)|intern|internship|trainee)\b/;
const ORG_LINE = /\b(?:cong ty|cty|tap doan|ngan hang|benh vien|nha may|company|corp|ltd|jsc|inc)\b|\bco\.(?:\s|$)/;

function hasDates(line: CvLine, todayMonth: number | null): boolean {
  return !BIRTH.test(line.folded) && findRanges(line.folded, todayMonth).length > 0;
}

function isStudyLine(line: CvLine): boolean {
  return SCHOOL.test(line.folded) && !WORK_AT_SCHOOL.test(line.folded);
}

function jobLines(doc: CvDoc, todayMonth: number | null): CvLine[] {
  const inSection = doc.lines.filter((l) => l.section === 'experience');
  if (inSection.some((l) => hasDates(l, todayMonth))) return inSection;
  return doc.lines.filter((l) => !NOT_WORK_SECTIONS.has(l.section) && !isStudyLine(l));
}

function isHeadCandidate(line: CvLine): boolean {
  return !line.isHeader && line.text.length < 120 && !/^[-*+]/.test(line.text);
}

/** Only dates on the line: the title is on a neighbouring line. */
function isDateOnly(line: CvLine, intervals: readonly MonthInterval[]): boolean {
  let rest = line.folded;
  for (const iv of intervals) rest = rest.replace(line.folded.slice(iv.start, iv.end), ' ');
  return !/[a-z]{3,}/.test(rest.replace(/\b(tu|den|nay|from|to|thang|nam)\b/g, ' '));
}

interface JobBounds {
  headFrom: number;
  /** Title lines written under the dates ("Jan 2020 – Present" then "Software Engineer, Company"). */
  headTo: number;
}

function boundsOf(lines: readonly CvLine[], at: number, dateOnly: boolean, dateAt: ReadonlySet<number>): JobBounds {
  const sameSection = (i: number) => lines[i]?.section === lines[at]?.section;
  const above = (i: number) => i >= 0 && !dateAt.has(i) && sameSection(i) && isHeadCandidate(lines[i]);
  if (!dateOnly) {
    // The title is on the date line; a company line right above belongs to it too.
    const company = above(at - 1) && ORG_LINE.test(lines[at - 1].folded);
    return { headFrom: company ? at - 1 : at, headTo: at };
  }
  if (!above(at - 1)) {
    const below = lines[at + 1] !== undefined && !dateAt.has(at + 1) && isHeadCandidate(lines[at + 1]);
    return { headFrom: at, headTo: below ? at + 1 : at };
  }
  // Directly under the heading everything above the dates is the title, even broken over lines.
  for (const from of [at - 3, at - 2]) {
    if (from >= 0 && above(from) && above(from + 1) && (from === 0 || lines[from - 1]?.isHeader === true)) {
      return { headFrom: from, headTo: at };
    }
  }
  const twoAbove = above(at - 2) && (ORG_LINE.test(lines[at - 1].folded) || ORG_LINE.test(lines[at - 2].folded));
  return { headFrom: twoAbove ? at - 2 : at - 1, headTo: at };
}

const OTHER_PEOPLE =
  /\b(phoi hop(?: voi)?|ket hop voi|lam viec voi phong|bao cao (?:cho|len|ve)|ho tro (?:phong|bo phan|cho)|gui (?:cho|ve)|coordinated? with|collaborated? with|reported? to|liaised? with|supported)\b[^,;.\n]*/g;
/** "Thủ tục hải quan do bộ phận Ops làm", "forwarder làm thủ tục hải quan". */
const DONE_BY_OTHERS =
  /[^,;.\n]*\b(?:do (?:bo phan|phong|ben|doi tac|forwarder|nhan vien khac)[^,;.\n]*(?:lam|phu trach|xu ly)|forwarder lam|handled by)\b[^,;.\n]*/g;

/** "Không tham gia giảng dạy tại nước ngoài": a duty the CV says the candidate did not have. */
const NOT_DONE = /\b(?:khong|chua)\s+(?:tung\s+)?(?:tham gia|lam|phu trach|co)\b[^,;.\n]*/g;

/** Drops "phối hợp với phòng Kế toán …": naming a department is not working in it. */
export function withoutOtherPeople(folded: string): string {
  return folded.replace(DONE_BY_OTHERS, ' ').replace(NOT_DONE, ' ').replace(OTHER_PEOPLE, ' ');
}

function buildJobs(lines: readonly CvLine[], todayMonth: number | null): Job[] {
  const ranges = lines.map((l) => (BIRTH.test(l.folded) ? [] : findRanges(l.folded, todayMonth)));
  const dateAt = new Set(ranges.flatMap((r, i) => (r.length > 0 ? [i] : [])));
  const dated = [...dateAt];
  const bounds = new Map(dated.map((i) => [i, boundsOf(lines, i, isDateOnly(lines[i], ranges[i]), dateAt)]));
  return dated.flatMap((at, order) => {
    const own = bounds.get(at);
    if (!own) return [];
    const nextAt = dated[order + 1];
    const nextStart = nextAt === undefined ? lines.length : (bounds.get(nextAt)?.headFrom ?? nextAt);
    return jobsAt(lines, at, own, nextStart, ranges[at]);
  });
}

function jobsAt(
  lines: readonly CvLine[],
  at: number,
  bounds: JobBounds,
  nextStart: number,
  intervals: readonly MonthInterval[],
): Job[] {
  const headLines = lines.slice(bounds.headFrom, bounds.headTo + 1);
  const bodyLines: CvLine[] = [];
  for (let i = bounds.headTo + 1; i < nextStart; i += 1) {
    const isAdjacent = lines[i].index === lines[i - 1].index + 1;
    if (lines[i].isHeader || lines[i].section !== lines[at].section || !isAdjacent) break;
    bodyLines.push(lines[i]);
  }
  const head = headLines.map((l) => withoutOtherPeople(l.folded)).join(' \n ');
  const body = bodyLines.map((l) => withoutOtherPeople(l.folded)).join(' \n ');
  const blockFolded = `${head} \n ${body}`;
  const title = bounds.headFrom < at ? lines[bounds.headFrom] : (lines[bounds.headTo] ?? null);
  const shown = title === lines[at] ? null : title;
  const firstBody = bodyLines[0]?.folded ?? '';
  const isInternship = INTERNSHIP.test(head) || INTERNSHIP.test(firstBody);
  return intervals.map((interval) => ({
    ...roleWithLineBelow(readRole(headLines, lines[at], interval), bodyLines[0]),
    interval,
    line: lines[at],
    title: shown,
    head,
    blockFolded,
    isInternship,
  }));
}

/** Date lines stacked in one block, their jobs in another below: extraction read a table column by column. */
function pairDetachedDates(lines: readonly CvLine[], todayMonth: number | null, jobs: readonly Job[]): Job[] {
  const stack = jobs.filter((j) => isDateOnly(j.line, [j.interval]));
  if (stack.length < 2 || stack.length !== jobs.length) return [...jobs];
  const last = stack[stack.length - 1]?.line.index ?? 0;
  const titles = lines.filter(
    (l) => l.index > last && !hasDates(l, todayMonth) && ORG_LINE.test(l.folded) && !l.isHeader,
  );
  if (titles.length !== stack.length) return [...jobs];
  return stack.map((job, i) => {
    const title = titles[i];
    if (!title) return job;
    const role = readRole([title], job.line, job.interval);
    return { ...job, ...role, title, head: title.folded, blockFolded: title.folded };
  });
}

/** Jobs naming only their company are read with the line that says what the candidate does. */
function withHeadline(doc: CvDoc, jobs: readonly Job[]): Job[] {
  const first = Math.min(...jobs.map((j) => j.line.index));
  const headline = cvHeadline(doc, first);
  if (headline.folded.length === 0) return [...jobs];
  return jobs.map((job) => {
    if (job.hasTitle) return job;
    const role = roleWithHeadline(job, headline);
    return {
      ...job,
      ...role,
      head: `${job.head} \n ${headline.folded}`,
      blockFolded: `${job.blockFolded} \n ${headline.folded}`,
    };
  });
}

/** Jobs of the CV, in reading order. */
export function extractJobs(doc: CvDoc, todayMonth: number | null): Job[] {
  const lines = jobLines(doc, todayMonth).filter((l) => !BIRTH.test(l.folded));
  return withHeadline(doc, pairDetachedDates(doc.lines, todayMonth, buildJobs(lines, todayMonth)));
}

/** Lines that belong to a job: what a CV shows in its work history rather than merely claims. */
export function workText(jobs: readonly Job[]): string {
  return [...new Set(jobs.map((j) => j.blockFolded))].join(' \n ');
}
