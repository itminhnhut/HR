/**
 * Work experience facts from a CV: date ranges of jobs with the lines describing each job, explicit statements
 * ("3 năm kinh nghiệm", "18 tháng bán hàng") and "chưa có kinh nghiệm".
 */
import { extractStated, type StatedYears } from './experience-stated.js';
import { extractJobs, type Job } from './experience-jobs.js';
import { unbackedLists, withoutListLines } from './experience-lists.js';
import { cvHeadline } from './experience-role.js';
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';

export type { StatedYears as ExplicitYears } from './experience-stated.js';
export type { Job } from './experience-jobs.js';

export interface ExperienceFacts {
  jobs: Job[];
  explicit: StatedYears[];
  /** Years stated only in a keyword list with nothing behind it: no proof, and nothing to rule out either. */
  listed: StatedYears[];
  /** The keyword lists themselves. */
  lists: CvLine[];
  /** Folded top lines of the CV: how the candidate describes the work they do. */
  headline: string;
  noExperience: CvLine | null;
  /** Lines describing work with no dates at all ("Nhân viên kho, Công ty X"). */
  undated: CvLine[];
  /** Those lines sit under a work-history heading, so what they leave out is really not there. */
  undatedIsSection: boolean;
  /** The CV has real sections with content, so a missing work history means there is none. */
  hasStructure: boolean;
}

const NO_EXPERIENCE =
  /\b(chua co|khong co|chua tung co|chua tung lam viec|chua di lam)\s+(?:nhieu\s+)?kinh nghiem\b|\bno (?:prior |previous |work |professional )?(?:work )?experience\b|\bchua tung di lam\b/;
const STRUCTURE_SECTIONS: ReadonlySet<SectionKind> = new Set([
  'education',
  'skills',
  'certificates',
  'languages',
  'summary',
  'projects',
  'activities',
]);
const LABEL_ONLY = /^[\p{L}\s]+:$/u;

function contentLines(doc: CvDoc): CvLine[] {
  return doc.lines.filter((l) => !l.isHeader && l.text.length > 0 && !LABEL_ONLY.test(l.text));
}

function undatedWork(doc: CvDoc, jobs: readonly Job[]): CvLine[] {
  if (jobs.length > 0) return [];
  const content = contentLines(doc);
  const inSection = content.filter((l) => l.section === 'experience');
  if (inSection.length > 0) return inSection;
  // No sections at all: a short CV whose body can only be describing work.
  return content.every((l) => l.section === 'none') ? content.slice(1) : [];
}

/** Collects all experience facts once per CV. */
export function extractExperience(doc: CvDoc, todayMonth: number | null): ExperienceFacts {
  const noExperience = doc.lines.find((l) => NO_EXPERIENCE.test(l.folded)) ?? null;
  const jobs = extractJobs(doc, todayMonth);
  const lists = unbackedLists(doc);
  const own = withoutListLines(doc, lists);
  const undated = undatedWork(own, jobs);
  const hasStructure = contentLines(doc).some((l) => STRUCTURE_SECTIONS.has(l.section));
  const firstJob = jobs.length > 0 ? Math.min(...jobs.map((j) => j.line.index)) : doc.lines.length;
  return {
    jobs,
    explicit: extractStated(own, jobs.length > 0),
    listed: extractStated({ ...doc, lines: lists }, false),
    lists,
    headline: cvHeadline(doc, firstJob).folded,
    noExperience,
    undated,
    undatedIsSection: undated.some((l) => l.section === 'experience'),
    hasStructure,
  };
}
