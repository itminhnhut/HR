/**
 * Reads a "Mô tả công việc" line: did the candidate's work history show this job? A duty is what the hire will do,
 * not a condition, so these lines only inform HR and never enter the percent. A CV silent about a duty or about a
 * tool it names stays open instead of "không đạt": on the blind set 102 of 118 such verdicts were wrong.
 */
import type { Atom, AtomResult, KeywordAtom } from './atoms.js';
import { cleanLine, foldClean, type CvDoc, type CvLine } from './normalize.js';
import { parseRequirement } from './requirement.js';
import { evaluateKeywords, type SkillIndex } from './skills.js';
import { isAspirationAt, snippet } from './text-match.js';
import type { MatchItem } from './types.js';

/** Words every duty uses: they say nothing about which work it is. */
const FILLER_WORDS = new Set(
  (
    'thuc hien tham gia ho tro phu trach dam bao dam nhan cac cac cua va voi cho theo tai trong tren duoi khi de do ' +
    'nhung mot so nhu la co duoc se can phai khac lien quan cong viec nhiem vu yeu cau cap tren giao ' +
    'and or the of to for in on with as by at from'
  ).split(' '),
);

/** Share of the duty's word pairs one work line must repeat, and the fewest pairs that can count as a match. */
const MIN_SHARE = 0.5;
const MIN_PAIRS = 2;

const WORK_SECTIONS: ReadonlySet<CvLine['section']> = new Set(['experience', 'projects']);

const SILENT_REASON = 'Không thấy việc tương tự trong phần kinh nghiệm của CV, HR hỏi thêm khi phỏng vấn';

function wordPairs(folded: string): string[] {
  const words = (folded.match(/[a-z0-9+#]+/g) ?? []).filter((w) => !FILLER_WORDS.has(w));
  return [...new Set(words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`))];
}

function closestWorkLine(pairs: readonly string[], doc: CvDoc): { line: CvLine; share: number; shared: number } | null {
  if (pairs.length === 0) return null;
  const judged = doc.lines
    .filter((line) => WORK_SECTIONS.has(line.section) && !line.isHeader && !isAspirationAt(line.folded, 0))
    .map((line) => {
      const own = new Set(wordPairs(line.folded));
      const shared = pairs.filter((p) => own.has(p)).length;
      return { line, shared, share: shared / pairs.length };
    });
  return judged.reduce<(typeof judged)[number] | null>((best, x) => (!best || x.share > best.share ? x : best), null);
}

const isKeywordAtom = (atom: Atom): atom is KeywordAtom => atom.kind === 'keywords';

/** A duty is a long sentence, not a condition: one of the terms it names is enough to show the work. */
function namedTools(line: string, skills: SkillIndex): AtomResult[] {
  return parseRequirement(line)
    .atoms.filter(isKeywordAtom)
    .map((atom) => evaluateKeywords({ ...atom, mode: 'any' }, skills));
}

const NUMBERED = /^\s*\d+[.)]\s/;
const WORKING_HOURS = /\b(?:thoi gian lam viec|gio lam viec|nghi trua|thu hai|thu 2|thu bay|thu 7)\b/;

function isWorkingHours(line: string): boolean {
  const clean = cleanLine(line);
  return clean === clean.toUpperCase() || WORKING_HOURS.test(foldClean(clean));
}

/**
 * Job ads carry group titles and working hours in the same field as the duties, and neither is work to look for.
 * A numbered line is a title only with a plain line under it: in a list numbered throughout, the lines are the duties.
 */
export function dutyLines(lines: readonly string[]): string[] {
  return lines.filter((line, i) => {
    const next = lines[i + 1];
    const isTitle = NUMBERED.test(line) && next !== undefined && !NUMBERED.test(next);
    return !isTitle && !isWorkingHours(line);
  });
}

const dutyItem = (requirement: string, verdict: MatchItem['verdict'], evidence: string | null, reason: string) => ({
  requirement,
  verdict,
  evidence,
  reason,
  counted: false,
  section: 'duties' as const,
});

/** A term the CV denies decides it; then the closest work line, which quotes best; then a term the CV shows. */
export function scoreDuty(requirement: string, doc: CvDoc, skills: SkillIndex): MatchItem {
  const tools = namedTools(requirement, skills);
  // A term the CV is silent about proves nothing about a duty: only a quote can say the candidate lacks it.
  const denied = tools.find((r) => r.verdict === 'unmet' && r.evidence);
  if (denied) return dutyItem(requirement, 'unmet', denied.evidence ?? null, denied.reason);
  const closest = closestWorkLine(wordPairs(foldClean(cleanLine(requirement))), doc);
  if (closest && closest.share >= MIN_SHARE && closest.shared >= MIN_PAIRS) {
    return dutyItem(requirement, 'met', snippet(closest.line), 'CV có việc tương tự');
  }
  const shown = tools.find((r) => r.verdict === 'met');
  if (shown) return dutyItem(requirement, 'met', shown.evidence ?? null, shown.reason);
  return dutyItem(requirement, 'unknown', null, SILENT_REASON);
}
