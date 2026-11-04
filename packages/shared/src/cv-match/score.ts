/**
 * Entry point: scores a CV's text against the job's requirement lines. Pure (no I/O); when in doubt, "unknown".
 */
import type { Atom, AtomResult } from './atoms.js';
import { parseToday } from './dates.js';
import { dutyLines, scoreDuty } from './duties.js';
import { extractEducation, type EducationEntry } from './education.js';
import { evaluateEducation } from './education-eval.js';
import { extractExperience, type ExperienceFacts } from './experience.js';
import { evaluateExperience } from './experience-eval.js';
import { evaluateAvailability } from './availability.js';
import { workText } from './experience-jobs.js';
import { evaluateAnyLanguage, evaluateLanguage } from './language-eval.js';
import { hintFor, workAndStudyLines } from './line-fallback.js';
import { evaluateLiteral } from './literal.js';
import { evaluateLicense } from './license.js';
import { buildCvDoc, type CvDoc, type CvLine } from './normalize.js';
import { parseRequirement, PREFERENCE_REASON, UNPARSED_REASON } from './requirement.js';
import { evaluateKeywords, indexSkills, type CvEvidence, type SkillIndex } from './skills.js';
import { joinEvidence } from './text-match.js';
import type { CvMatchResult, MatchItem, ScoreInput } from './types.js';

/** Bump whenever scoring rules change so stored results get recomputed. */
export const CV_MATCH_VERSION = 5;

/** Fewer letters than this means the PDF has no usable text layer (scan, image, link). */
export const MIN_CV_LETTERS = 15;
export const UNREADABLE_REASON = 'Không đọc được chữ trong CV (ảnh scan hoặc link), HR xem trực tiếp';

interface CvContext {
  doc: CvDoc;
  experience: ExperienceFacts;
  education: EducationEntry[];
  skills: SkillIndex;
  workAndStudy: CvLine[];
}

function cvEvidence(experience: ExperienceFacts, education: readonly EducationEntry[]): CvEvidence {
  return {
    work: workText(experience.jobs),
    education: education.map((e) => e.folded).join(' \n '),
    hasJobs: experience.jobs.length > 0,
    substantive:
      experience.jobs.length > 0 ||
      experience.explicit.length > 0 ||
      experience.undatedIsSection ||
      experience.hasStructure,
  };
}

function buildContext(doc: CvDoc, today: string): CvContext {
  const todayMonth = parseToday(today);
  const experience = extractExperience(doc, todayMonth);
  const education = extractEducation(doc, todayMonth);
  return {
    doc,
    experience,
    education,
    skills: indexSkills(doc, cvEvidence(experience, education)),
    workAndStudy: workAndStudyLines(doc, experience, education),
  };
}

function evaluateAtom(atom: Atom, ctx: CvContext): AtomResult {
  switch (atom.kind) {
    case 'experience':
      return evaluateExperience(atom, ctx.experience);
    case 'education':
      return evaluateEducation(atom, ctx.education);
    case 'language':
      return evaluateLanguage(atom, ctx.doc, ctx.skills.evidence.substantive);
    case 'any-language':
      return evaluateAnyLanguage(atom, ctx.doc, ctx.skills.evidence.substantive);
    case 'license':
      return evaluateLicense(atom, ctx.doc, ctx.skills.evidence.substantive);
    case 'keywords':
      return evaluateKeywords(atom, ctx.skills);
    case 'availability':
      return evaluateAvailability(ctx.doc);
    case 'literal':
      return evaluateLiteral(atom, ctx.doc, ctx.experience.jobs.length > 0);
  }
}

/** Several atoms on one line: any unmet → unmet; all met → met; otherwise unknown. */
function combine(requirement: string, results: readonly AtomResult[], softNote: string | null): MatchItem {
  const unmet = results.filter((r) => r.verdict === 'unmet');
  const unknown = results.filter((r) => r.verdict === 'unknown');
  const verdict = unmet.length > 0 ? 'unmet' : unknown.length > 0 ? 'unknown' : 'met';
  const lead = verdict === 'unmet' ? unmet : verdict === 'unknown' ? unknown : results;
  const others = results.filter((r) => !lead.includes(r));
  const reasons = [...lead, ...others].map((r) => r.reason);
  if (softNote) reasons.push(softNote);
  return {
    requirement,
    verdict,
    evidence: joinEvidence(lead.flatMap((r) => (r.evidence ? [r.evidence] : []))),
    reason: reasons.join('; '),
    // Lines a CV normally does not state must not count against anyone.
    counted: verdict !== 'unknown' || !unknown.every((r) => r.askInInterview),
  };
}

function withBonusNote(item: MatchItem, bonus: readonly AtomResult[]): MatchItem {
  const shown = bonus.filter((r) => r.verdict === 'met');
  if (shown.length === 0) return item;
  return { ...item, reason: `${item.reason ?? ''}; Điểm cộng: ${shown.map((r) => r.reason).join('; ')}` };
}

function scoreLine(requirement: string, ctx: CvContext): MatchItem {
  const parsed = parseRequirement(requirement);
  if (parsed.trivialReason) {
    return { requirement, verdict: 'met', evidence: null, reason: parsed.trivialReason, counted: false };
  }
  if (parsed.atoms.length === 0) {
    const reason = parsed.unknownReason ?? 'Không chấm được';
    const hint = reason === UNPARSED_REASON ? hintFor(requirement, ctx.workAndStudy) : null;
    if (hint) return { requirement, verdict: 'unknown', ...hint, counted: false, isHint: true };
    const section = reason === PREFERENCE_REASON ? ({ section: 'preferred' } as const) : {};
    return { requirement, verdict: 'unknown', evidence: null, reason, counted: false, ...section };
  }
  const item = combine(
    requirement,
    parsed.atoms.map((atom) => evaluateAtom(atom, ctx)),
    parsed.softNote,
  );
  if (!parsed.preference) {
    return withBonusNote(
      item,
      parsed.bonusAtoms.map((atom) => evaluateAtom(atom, ctx)),
    );
  }
  // A bonus the CV does not show is not held against the candidate, and a bonus it shows is not a requirement.
  return item.verdict === 'met'
    ? { ...item, reason: `Điểm cộng: ${item.reason}`, counted: false, section: 'preferred' }
    : {
        ...item,
        verdict: 'unknown',
        reason: `${PREFERENCE_REASON} (${item.reason})`,
        counted: false,
        section: 'preferred',
      };
}

/** A line of the job's "Ưu tiên" field reads as "Ưu tiên …" would in the requirements, and shows as HR wrote it. */
function scorePreferred(line: string, ctx: CvContext): MatchItem {
  const item = scoreLine(`Ưu tiên ${line}`, ctx);
  const hint = item.reason === PREFERENCE_REASON ? hintFor(line, ctx.workAndStudy) : null;
  if (hint) return { ...item, requirement: line, ...hint, isHint: true };
  return { ...item, requirement: line };
}

/**
 * Share of the measurable requirements the CV shows: a line the CV leaves open counts as not shown, so it cannot lift
 * the percent. Soft lines, bonuses and lines CVs do not normally state are left out. With fewer than half of the
 * measurable lines judged there is no percent: "chưa đủ dữ liệu".
 */
export function matchPercent(items: readonly MatchItem[]): number | null {
  const counted = items.filter((i) => i.counted);
  const met = counted.filter((i) => i.verdict === 'met').length;
  const judged = counted.filter((i) => i.verdict !== 'unknown').length;
  if (judged === 0 || judged * 2 < counted.length) return null;
  return Math.round((100 * met) / counted.length);
}

function levelOnlyLine(atoms: readonly Atom[]): number | null {
  const only = atoms.length === 1 ? atoms[0] : null;
  return only?.kind === 'education' && only.majors.length === 0 ? only.minLevel : null;
}

/**
 * One fact counts once: "Học vấn: Cao đẳng trở lên" from the form says no more than a line next to it that asks for
 * the same or a higher degree, so it stays on the list but only that line counts.
 */
function countEducationOnce(items: readonly MatchItem[]): MatchItem[] {
  const parsed = items.map((i) => parseRequirement(i.requirement).atoms);
  return items.map((item, i) => {
    const level = levelOnlyLine(parsed[i] ?? []);
    if (level === null) return item;
    const covered = parsed.some(
      (atoms, j) =>
        j !== i &&
        atoms.some(
          (a) =>
            a.kind === 'education' &&
            a.minLevel !== null &&
            a.minLevel >= level &&
            (a.majors.length > 0 || a.minLevel > level || j > i),
        ),
    );
    return covered ? { ...item, counted: false } : item;
  });
}

/** How many of the job's bonuses ("Ưu tiên") the CV shows. */
export const bonusCount = (items: readonly MatchItem[]): number =>
  items.filter((item) => item.section === 'preferred' && item.verdict === 'met').length;

/** Scores a CV against requirement lines. */
export function scoreCv(input: ScoreInput): CvMatchResult {
  const doc = buildCvDoc(input.cvText);
  const duties = dutyLines(input.duties ?? []);
  const preferred = input.preferred ?? [];
  if (doc.letterCount < MIN_CV_LETTERS) {
    const unread = (requirement: string): MatchItem => ({
      requirement,
      verdict: 'unknown',
      evidence: null,
      reason: UNREADABLE_REASON,
      counted: false,
    });
    const items = [
      ...input.requirements.map(unread),
      ...duties.map((d): MatchItem => ({ ...unread(d), section: 'duties' })),
      ...preferred.map((p): MatchItem => ({ ...unread(p), section: 'preferred' })),
    ];
    return { percent: null, items, version: CV_MATCH_VERSION };
  }
  const ctx = buildContext(doc, input.today);
  const items = countEducationOnce(input.requirements.map((r) => scoreLine(r, ctx)));
  return {
    percent: matchPercent(items),
    items: [
      ...items,
      ...duties.map((d) => scoreDuty(d, doc, ctx.skills)),
      ...preferred.map((p) => scorePreferred(p, ctx)),
    ],
    version: CV_MATCH_VERSION,
  };
}
