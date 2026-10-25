/**
 * Entry point: scores a CV's text against the job's requirement lines. Pure (no I/O); when in doubt, "unknown".
 */
import type { Atom, AtomResult } from './atoms.js';
import { parseToday } from './dates.js';
import { extractEducation, type EducationEntry } from './education.js';
import { evaluateEducation } from './education-eval.js';
import { extractExperience, type ExperienceFacts } from './experience.js';
import { evaluateExperience } from './experience-eval.js';
import { evaluateAvailability } from './availability.js';
import { evaluateLanguage } from './language-eval.js';
import { evaluateLiteral } from './literal.js';
import { evaluateLicense } from './license.js';
import { buildCvDoc, type CvDoc } from './normalize.js';
import { parseRequirement, PREFERENCE_REASON } from './requirement.js';
import { evaluateKeywords, indexSkills, type SkillIndex } from './skills.js';
import { joinEvidence } from './text-match.js';
import type { CvMatchResult, MatchItem, ScoreInput } from './types.js';

/** Bump whenever scoring rules change so stored results get recomputed. */
export const CV_MATCH_VERSION = 1;

/** Fewer letters than this means the PDF has no usable text layer (scan, image, link). */
export const MIN_CV_LETTERS = 40;
export const UNREADABLE_REASON = 'Không đọc được chữ trong CV (ảnh scan hoặc link), HR xem trực tiếp';

interface CvContext {
  doc: CvDoc;
  experience: ExperienceFacts;
  education: EducationEntry[];
  skills: SkillIndex;
}

function buildContext(doc: CvDoc, today: string): CvContext {
  const todayMonth = parseToday(today);
  return {
    doc,
    experience: extractExperience(doc, todayMonth),
    education: extractEducation(doc, todayMonth),
    skills: indexSkills(doc),
  };
}

function evaluateAtom(atom: Atom, ctx: CvContext): AtomResult {
  switch (atom.kind) {
    case 'experience':
      return evaluateExperience(atom, ctx.experience);
    case 'education':
      return evaluateEducation(atom, ctx.education);
    case 'language':
      return evaluateLanguage(atom, ctx.doc);
    case 'license':
      return evaluateLicense(atom, ctx.doc);
    case 'keywords':
      return evaluateKeywords(atom, ctx.skills);
    case 'availability':
      return evaluateAvailability(ctx.doc);
    case 'literal':
      return evaluateLiteral(atom, ctx.doc);
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
  };
}

function scoreLine(requirement: string, ctx: CvContext): MatchItem {
  const parsed = parseRequirement(requirement);
  if (parsed.trivialReason) return { requirement, verdict: 'met', evidence: null, reason: parsed.trivialReason };
  if (parsed.atoms.length === 0) {
    return { requirement, verdict: 'unknown', evidence: null, reason: parsed.unknownReason ?? 'Không chấm được' };
  }
  const item = combine(
    requirement,
    parsed.atoms.map((atom) => evaluateAtom(atom, ctx)),
    parsed.softNote,
  );
  if (!parsed.preference) return item;
  // A bonus the CV does not show is not held against the candidate.
  return item.verdict === 'met'
    ? { ...item, reason: `Điểm cộng: ${item.reason}` }
    : { ...item, verdict: 'unknown', reason: `${PREFERENCE_REASON} (${item.reason})` };
}

/** round(100 * met / (met + unmet)); null when nothing could be judged. */
export function matchPercent(items: readonly MatchItem[]): number | null {
  const met = items.filter((i) => i.verdict === 'met').length;
  const unmet = items.filter((i) => i.verdict === 'unmet').length;
  return met + unmet === 0 ? null : Math.round((100 * met) / (met + unmet));
}

/** Scores a CV against requirement lines. */
export function scoreCv(input: ScoreInput): CvMatchResult {
  const doc = buildCvDoc(input.cvText);
  if (doc.letterCount < MIN_CV_LETTERS) {
    const items = input.requirements.map((requirement): MatchItem => ({
      requirement,
      verdict: 'unknown',
      evidence: null,
      reason: UNREADABLE_REASON,
    }));
    return { percent: null, items, version: CV_MATCH_VERSION };
  }
  const ctx = buildContext(doc, input.today);
  const items = input.requirements.map((r) => scoreLine(r, ctx));
  return { percent: matchPercent(items), items, version: CV_MATCH_VERSION };
}
