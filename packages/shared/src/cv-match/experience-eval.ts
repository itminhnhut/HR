/**
 * Judges an experience requirement against the CV's experience facts. A field claim needs a job in that field, a
 * field the dictionary does not know stays open, and when in doubt the verdict is "unknown".
 */
import { result, type AtomResult, type ExperienceAtom } from './atoms.js';
import { formatMonths, totalMonths } from './dates.js';
import type { ExperienceFacts, ExplicitYears, Job } from './experience.js';
import { LIST_ONLY_REASON } from './experience-lists.js';
import { isPositionField, type PositionField } from './experience-req.js';
import { matchesField, matchesJob, type FieldSpec, type TermSet } from './fields.js';
import { fold } from './normalize.js';
import { joinEvidence, snippet } from './text-match.js';

function wanted(atom: ExperienceAtom): string {
  const field = atom.field && atom.field !== 'related' ? ` ${atom.field.label}` : '';
  return atom.minMonths <= 1 ? `có kinh nghiệm${field}` : `từ ${formatMonths(atom.minMonths)}${field}`;
}

function sumMonths(jobs: readonly Job[]): number {
  return totalMonths(jobs.map((j) => j.interval));
}

function jobEvidence(jobs: readonly Job[]): string | null {
  const longest = [...jobs].sort(
    (a, b) => b.interval.endMonth - b.interval.startMonth - (a.interval.endMonth - a.interval.startMonth),
  );
  return joinEvidence(
    longest.slice(0, 2).flatMap((j) => [...(j.title ? [snippet(j.title)] : []), snippet(j.line, j.interval)]),
  );
}

function bestExplicit(list: readonly ExplicitYears[]): ExplicitYears | null {
  return list.reduce<ExplicitYears | null>((best, e) => (best && best.months >= e.months ? best : e), null);
}

interface Tally {
  jobs: Job[];
  strong: number;
  withInterns: number;
  explicit: ExplicitYears | null;
}

function statedInField(facts: ExperienceFacts, field: FieldSpec, jobs: readonly Job[]): ExplicitYears[] {
  // A field claim above a job in another field proves nothing: the work history decides.
  if (facts.jobs.length > 0 && jobs.length === 0) return [];
  return facts.explicit.filter((e) => matchesField(e.tail.slice(0, 80), field));
}

/** "Trợ lý Giám đốc" works for a director: only a line asking for the assistant reads that title as the role. */
const WORKS_FOR = /\b(?:tro ly|thu ky|assistant to|secretary to)\b[^,\n]*/g;
const ASKS_ASSISTANT = /\b(?:tro ly|thu ky|assistant|secretary)\b/;

function isSetInRole(job: Job, field: FieldSpec, set: TermSet): boolean {
  const onlySet = { ...field, industry: null, alternatives: [[set]] };
  if (!set.titleOnly) return matchesField(job.blockFolded, onlySet);
  const asksAssistant = [...set.terms, ...set.loose].some((t) => ASKS_ASSISTANT.test(t));
  return matchesField(asksAssistant ? job.role : job.role.replace(WORKS_FOR, ' '), onlySet);
}

function isInPosition(job: Job, field: FieldSpec): boolean {
  if (field.industry && !matchesField(job.blockFolded, { ...field, alternatives: [[]] })) return false;
  return field.alternatives.some((sets) => sets.every((set) => isSetInRole(job, field, set)));
}

function isInField(job: Job, field: FieldSpec): boolean {
  return isPositionField(field) ? isInPosition(job, field) : matchesJob(job.head, job.blockFolded, field);
}

function tally(facts: ExperienceFacts, field: FieldSpec | null): Tally {
  const jobs = field ? facts.jobs.filter((j) => isInField(j, field)) : facts.jobs;
  return {
    jobs,
    strong: sumMonths(jobs.filter((j) => !j.isInternship)),
    withInterns: sumMonths(jobs),
    explicit: bestExplicit(field ? statedInField(facts, field, jobs) : facts.explicit),
  };
}

function metResult(t: Tally, atom: ExperienceAtom): AtomResult | null {
  const explicitMonths = t.explicit?.months ?? 0;
  const best = Math.max(t.strong, explicitMonths);
  if (best < atom.minMonths) return null;
  const merged =
    t.jobs.length > 1 && t.jobs.reduce((s, j) => s + j.interval.endMonth - j.interval.startMonth, 0) > t.withInterns;
  const fromJobs = t.strong >= explicitMonths;
  const evidence = fromJobs
    ? jobEvidence(t.jobs.filter((j) => !j.isInternship))
    : t.explicit
      ? snippet(t.explicit.line, t.explicit.span)
      : null;
  const note = fromJobs && merged ? ' (đã gộp các khoảng thời gian trùng nhau)' : '';
  return result('met', `CV có khoảng ${formatMonths(best)} kinh nghiệm${note}, yêu cầu ${wanted(atom)}`, evidence);
}

function undatedVerdict(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec | null): AtomResult {
  const hit = field ? facts.undated.find((l) => matchesField(l.folded, field)) : facts.undated[0];
  if (hit && atom.minMonths <= 1)
    return result('met', `CV có ghi công việc phù hợp, yêu cầu ${wanted(atom)}`, snippet(hit));
  if (!hit && field?.known && facts.undatedIsSection) {
    const quote = facts.undated[0];
    return result('unmet', `Không thấy công việc nào về ${field.label} trong CV`, quote ? snippet(quote) : null);
  }
  return result('unknown', 'CV không ghi rõ thời gian làm việc, HR xem trực tiếp', hit ? snippet(hit) : null);
}

/** The years, or the field for a line asking no years, are stated in a keyword list and nowhere else. */
function listOnly(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec | null): AtomResult | null {
  const claims = field ? facts.listed.filter((e) => matchesField(e.tail.slice(0, 80), field)) : facts.listed;
  const claim = bestExplicit(claims);
  if (claim && claim.months >= atom.minMonths)
    return result('unknown', LIST_ONLY_REASON, snippet(claim.line, claim.span));
  const named = field && atom.minMonths <= 1 ? facts.lists.find((l) => matchesField(l.folded, field)) : null;
  return named ? result('unknown', LIST_ONLY_REASON, snippet(named)) : null;
}

function noData(facts: ExperienceFacts, atom: ExperienceAtom): AtomResult | null {
  if (facts.jobs.length > 0 || facts.explicit.length > 0) return null;
  if (facts.noExperience) {
    return result('unmet', `CV ghi chưa có kinh nghiệm, yêu cầu ${wanted(atom)}`, snippet(facts.noExperience));
  }
  const field = atom.field === 'related' ? null : atom.field;
  const listed = listOnly(facts, atom, field);
  if (listed) return listed;
  if (facts.undated.length > 0) return undatedVerdict(facts, atom, field);
  if (facts.hasStructure) return result('unmet', `CV không có mục kinh nghiệm làm việc, yêu cầu ${wanted(atom)}`);
  return result('unknown', 'CV không ghi rõ thời gian làm việc, HR xem trực tiếp');
}

function overall(facts: ExperienceFacts): number {
  return Math.max(sumMonths(facts.jobs), bestExplicit(facts.explicit)?.months ?? 0);
}

/** A kind of place the dictionary does not know: the job's role fits and only HR can tell about the place. */
function roleFitsPlaceOpen(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec): boolean {
  if (!field.industry || field.industry.terms.length > 0) return false;
  return tally(facts, { ...field, industry: null }).strong >= atom.minMonths;
}

/** A job showing the specific part of a field without the general word: "chủ nhiệm lớp" without "giáo viên". */
function showsSpecificPart(facts: ExperienceFacts, field: FieldSpec): boolean {
  if (field.industry) return false;
  // One word proves nothing here: "dạy" in "dạy ở nước ngoài" is what every teacher does.
  const isPhrase = (s: TermSet) => [...s.terms, ...s.loose].some((t) => t.includes(' '));
  const specific = field.alternatives.flatMap((sets) => sets.slice(1)).filter(isPhrase);
  const parts = specific.map((s) => ({ ...field, alternatives: [[s]] }));
  return facts.jobs.some((j) => parts.some((part) => isInField(j, part)));
}

/** A title in another language shows the general word; the specific part can only be missing in the words of the line. */
function isForeignTitleInField(facts: ExperienceFacts, field: FieldSpec): boolean {
  const general = field.alternatives.filter((sets) => sets.length > 1).flatMap((sets) => sets.slice(0, 1));
  const parts = general.map((s) => ({ ...field, alternatives: [[s]] }));
  return facts.jobs.some((j) => j.isForeign && parts.some((part) => isInField(j, part)));
}

/** Words of the line cannot be missed in a title in another language, unless a known role shows in it by other names. */
function isTitleOpen(job: Job, field: PositionField): boolean {
  if (!job.hasTitle) return true;
  if (!job.isForeign) return false;
  const shown = (sets: readonly TermSet[]) => sets[0] !== undefined && isSetInRole(job, field, sets[0]);
  return field.hasUnknownRole || field.alternatives.some(shown);
}

/** The CV calls the candidate that, though no job says so: "Tài xế xe tải nặng" above "Tài xế, Công ty X". */
function isCalledSo(facts: ExperienceFacts, field: FieldSpec): boolean {
  return matchesField(facts.headline, { ...field, industry: null });
}

function isFieldOpen(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec): boolean {
  if (roleFitsPlaceOpen(facts, atom, field) || isCalledSo(facts, field)) return true;
  if (isPositionField(field)) return facts.jobs.some((j) => isTitleOpen(j, field));
  return !field.known || showsSpecificPart(facts, field) || isForeignTitleInField(facts, field);
}

function fieldShortfall(facts: ExperienceFacts, atom: ExperienceAtom, field: FieldSpec, t: Tally): AtomResult {
  const total = overall(facts);
  const hasFieldEvidence = t.jobs.length > 0 || t.explicit !== null;
  const got = Math.max(t.strong, t.explicit?.months ?? 0);
  const evidence = jobEvidence(t.jobs) ?? jobEvidence(facts.jobs);
  if (hasFieldEvidence) {
    const reason = `CV có khoảng ${formatMonths(got)} kinh nghiệm ${field.label} (tổng ${formatMonths(total)}), yêu cầu ${wanted(atom)}`;
    return result('unmet', reason, evidence);
  }
  if (isFieldOpen(facts, atom, field)) {
    return result(
      'unknown',
      `Chưa rõ công việc trong CV có thuộc mảng ${field.label} không, HR xem trực tiếp`,
      evidence,
    );
  }
  const reason = `Không thấy công việc nào về ${field.label} trong CV (tổng ${formatMonths(total)} kinh nghiệm), yêu cầu ${wanted(atom)}`;
  return result('unmet', reason, evidence);
}

function relatedVerdict(facts: ExperienceFacts, atom: ExperienceAtom): AtomResult {
  const total = overall(facts);
  const evidence = jobEvidence(facts.jobs);
  if (total < atom.minMonths)
    return result('unmet', `CV ghi ${formatMonths(total)} kinh nghiệm, yêu cầu ${wanted(atom)}`, evidence);
  return result('unknown', `CV có ${formatMonths(total)} kinh nghiệm, HR xem có đúng vị trí liên quan không`, evidence);
}

/** An internship counts when the line itself asks for one. */
function asksForInternship(atom: ExperienceAtom): boolean {
  return atom.field !== null && atom.field !== 'related' && /\b(thuc tap|intern)/.test(fold(atom.field.label));
}

/** Experience requirement verdict. */
export function evaluateExperience(atom: ExperienceAtom, facts: ExperienceFacts): AtomResult {
  const empty = noData(facts, atom);
  if (empty) return empty;
  if (atom.field === 'related') return relatedVerdict(facts, atom);
  const field = atom.field;
  const t = tally(facts, field);
  const counted = asksForInternship(atom) ? { ...t, strong: t.withInterns } : t;
  const met = metResult(counted, atom);
  if (met) return met;
  if (t.withInterns >= atom.minMonths) {
    return result(
      'unknown',
      `Đủ ${formatMonths(t.withInterns)} nếu tính cả thực tập, yêu cầu ${wanted(atom)}`,
      jobEvidence(t.jobs),
    );
  }
  if (field) return fieldShortfall(facts, atom, field, t);
  const evidence = jobEvidence(facts.jobs) ?? (t.explicit ? snippet(t.explicit.line, t.explicit.span) : null);
  return result('unmet', `CV ghi ${formatMonths(overall(facts))} kinh nghiệm, yêu cầu ${wanted(atom)}`, evidence);
}
