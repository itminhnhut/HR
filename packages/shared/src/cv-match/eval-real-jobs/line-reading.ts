/**
 * Compares how the parser reads a real requirement line with what the line actually asks.
 * A finding is "wrong" when every CV would be judged wrongly on that aspect, "partial" when part of the line is
 * dropped, and "abstains" when the parser does not attempt a measurable line (safe, but HR gets nothing).
 */
import type { Atom, ParsedRequirement } from '../atoms.js';
import { majorMatches } from '../education.js';
import { matchesField } from '../fields.js';
import { groupById } from '../keywords.js';
import { fold } from '../normalize.js';
import { parseRequirement } from '../requirement.js';
import { hasTerm } from '../text-match.js';
import type { LineClass, LineTruth } from './types.js';

export type Severity = 'wrong' | 'partial' | 'abstains';

export interface LineFinding {
  severity: Severity;
  aspect: string;
  detail: string;
}

function classOf(atom: Atom): LineClass {
  switch (atom.kind) {
    case 'experience':
      return 'experience';
    case 'education':
      return 'education';
    case 'language':
      return 'language';
    default:
      return 'skill';
  }
}

function atomOf<K extends Atom['kind']>(parsed: ParsedRequirement, kind: K): Extract<Atom, { kind: K }> | null {
  const found = parsed.atoms.find((a) => a.kind === kind);
  return found ? (found as Extract<Atom, { kind: K }>) : null;
}

function classFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const got = new Set(parsed.atoms.map(classOf));
  const wanted: readonly LineClass[] = truth.classes.filter((c) => c !== 'soft');
  const extra = [...got]
    .filter((c) => !wanted.includes(c))
    .map((c): LineFinding => ({
      severity: 'wrong',
      aspect: 'class',
      detail: `judged as ${c}, the line does not ask for it`,
    }));
  if (parsed.trivialReason) {
    extra.push({ severity: 'wrong', aspect: 'class', detail: `treated as always met: ${parsed.trivialReason}` });
  }
  const missing = wanted
    .filter((c) => !got.has(c))
    .map((c): LineFinding => ({
      severity: parsed.atoms.length === 0 ? 'abstains' : 'partial',
      aspect: 'class',
      detail: `${c} not read (${parsed.unknownReason ?? 'other atoms only'})`,
    }));
  return [...extra, ...missing];
}

function bonusFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const expected = truth.bonus === 'whole';
  if (expected === parsed.preference) return [];
  const detail = parsed.preference
    ? 'mandatory content read as a bonus, so missing it can never count against the CV'
    : 'a bonus read as mandatory, so missing it counts against the CV';
  return [{ severity: 'wrong', aspect: 'bonus', detail }];
}

function experienceFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const atom = atomOf(parsed, 'experience');
  if (!atom) return [];
  const out: LineFinding[] = [];
  if (truth.minMonths !== undefined && atom.minMonths !== truth.minMonths) {
    out.push({
      severity: 'wrong',
      aspect: 'years',
      detail: `read ${atom.minMonths} months, ad asks ${truth.minMonths}`,
    });
  }
  const field = atom.field === 'related' ? null : atom.field;
  for (const work of truth.fieldCounts ?? []) {
    if (!field || !matchesField(work, field)) {
      out.push({
        severity: 'wrong',
        aspect: 'field',
        detail: `"${work}" should count but does not (field read: ${JSON.stringify(field?.terms ?? atom.field)})`,
      });
    }
  }
  for (const work of truth.fieldDoesNotCount ?? []) {
    if (field && matchesField(work, field)) {
      out.push({
        severity: 'wrong',
        aspect: 'field',
        detail: `"${work}" counts but should not (field read: "${field.label}")`,
      });
    }
  }
  return out;
}

function educationFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const atom = atomOf(parsed, 'education');
  if (!atom) return [];
  const out: LineFinding[] = [];
  if (truth.minEducationLevel !== undefined && atom.minLevel !== truth.minEducationLevel) {
    out.push({
      severity: 'wrong',
      aspect: 'degree level',
      detail: `read level ${String(atom.minLevel)}, ad asks ${truth.minEducationLevel}`,
    });
  }
  for (const major of truth.majors ?? []) {
    if (!atom.majors.some((m) => majorMatches(major, m))) {
      out.push({
        severity: 'wrong',
        aspect: 'major',
        detail: `"${major}" dropped (majors read: ${JSON.stringify(atom.majors)})`,
      });
    }
  }
  if (truth.relatedMajorsAccepted !== undefined && atom.majorRelatedOnly !== truth.relatedMajorsAccepted) {
    out.push({
      severity: 'wrong',
      aspect: 'related majors',
      detail: `"hoặc ngành liên quan" read as ${String(atom.majorRelatedOnly)}`,
    });
  }
  return out;
}

function languageFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const atom = atomOf(parsed, 'language');
  if (!atom || truth.minEnglishLevel === undefined) return [];
  if (atom.language !== 'english') {
    return [{ severity: 'wrong', aspect: 'language', detail: `read ${atom.language}` }];
  }
  if (atom.minLevel === truth.minEnglishLevel) return [];
  return [
    {
      severity: 'wrong',
      aspect: 'english level',
      detail: `read level ${String(atom.minLevel)}, ad asks ${truth.minEnglishLevel}`,
    },
  ];
}

function atomTerms(parsed: ParsedRequirement): string[] {
  return parsed.atoms.flatMap((atom) => {
    if (atom.kind === 'literal') return [atom.term];
    if (atom.kind !== 'keywords') return [];
    return atom.groupIds.flatMap((id) => groupById(id)?.terms ?? []);
  });
}

function skillFindings(truth: LineTruth, parsed: ParsedRequirement): LineFinding[] {
  const terms = atomTerms(parsed);
  const covered = (skill: string) => terms.some((t) => t === skill || hasTerm(t, skill) || hasTerm(skill, t));
  const missing = (truth.skills ?? []).filter((s) => !covered(s));
  const bonusAsked = (truth.bonusSkills ?? []).filter(covered);
  const out: LineFinding[] = [];
  if (missing.length > 0) {
    out.push({
      severity: parsed.atoms.length === 0 ? 'abstains' : 'partial',
      aspect: 'skills',
      detail: `not checked: ${missing.join(', ')}`,
    });
  }
  if (bonusAsked.length > 0) {
    out.push({ severity: 'wrong', aspect: 'skills', detail: `bonus skill treated as asked: ${bonusAsked.join(', ')}` });
  }
  return out;
}

export function readLine(truth: LineTruth): { parsed: ParsedRequirement; findings: LineFinding[] } {
  const parsed = parseRequirement(truth.line);
  const findings = [
    ...classFindings(truth, parsed),
    ...bonusFindings(truth, parsed),
    ...experienceFindings(truth, parsed),
    ...educationFindings(truth, parsed),
    ...languageFindings(truth, parsed),
    ...skillFindings(truth, parsed),
  ];
  return { parsed, findings };
}

export function worstSeverity(findings: readonly LineFinding[]): Severity | 'ok' {
  const order: readonly Severity[] = ['wrong', 'partial', 'abstains'];
  return order.find((s) => findings.some((f) => f.severity === s)) ?? 'ok';
}

/** The folded form used by truth tables, exposed so a typo there fails loudly rather than silently passing. */
export function isFolded(term: string): boolean {
  return fold(term) === term;
}
