/**
 * Skill / tool / certificate / asset keywords in the CV, with context: negated ("chưa biết Photoshop"),
 * aspirational ("mong muốn học thêm Figma", "Sở thích"), only in the objective, or part of a company/school name.
 */
import { result, type AtomResult, type KeywordAtom } from './atoms.js';
import { findGroupHits, groupById, type KeywordGroup } from './keywords.js';
import type { CvDoc, CvLine } from './normalize.js';
import { isAspiration, isInOrgNameAt, isNegatedAt, joinEvidence, snippet, type Span } from './text-match.js';

export type HitClass = 'ok' | 'negated' | 'objective' | 'weak';

interface Located {
  line: CvLine;
  span: Span;
  cls: HitClass;
}

export type SkillIndex = ReadonlyMap<string, Located[]>;

/** Context of a keyword hit; null when it is part of an organisation name and must be ignored. */
export function classify(line: CvLine, span: Span): HitClass | null {
  if (isInOrgNameAt(line.folded, span.start)) return null;
  if (line.section === 'interests' || isAspiration(line.folded)) return 'weak';
  if (isNegatedAt(line.folded, span.start)) return 'negated';
  return line.section === 'objective' ? 'objective' : 'ok';
}

/** Indexes every keyword group hit of the CV once. */
export function indexSkills(doc: CvDoc): SkillIndex {
  const index = new Map<string, Located[]>();
  for (const line of doc.lines) {
    for (const hit of findGroupHits(line.folded, 'cv')) {
      const cls = classify(line, hit);
      if (cls === null) continue;
      index.set(hit.groupId, [...(index.get(hit.groupId) ?? []), { line, span: hit, cls }]);
    }
  }
  return index;
}

type Status =
  | { kind: 'met'; evidence: string[] }
  | { kind: 'negated'; evidence: string[] }
  | { kind: 'objective'; evidence: string[] }
  | { kind: 'absent' };

function ownStatus(hits: readonly Located[]): Status | null {
  const ok = hits.find((h) => h.cls === 'ok');
  if (ok) return { kind: 'met', evidence: [snippet(ok.line, ok.span)] };
  return null;
}

function derivedStatus(group: KeywordGroup, index: SkillIndex, depth: number): Status | null {
  for (const id of group.covers ?? []) {
    const s = groupStatus(id, index, depth + 1);
    if (s.kind === 'met') return s;
  }
  const all = (group.allOf ?? []).map((id) => groupStatus(id, index, depth + 1));
  if (all.length > 0 && all.every((s) => s.kind === 'met')) {
    return { kind: 'met', evidence: all.flatMap((s) => (s.kind === 'met' ? s.evidence : [])) };
  }
  return null;
}

function groupStatus(id: string, index: SkillIndex, depth = 0): Status {
  const group = groupById(id);
  if (!group || depth > 3) return { kind: 'absent' };
  const hits = index.get(id) ?? [];
  const status = ownStatus(hits) ?? derivedStatus(group, index, depth);
  if (status) return status;
  const negated = hits.find((h) => h.cls === 'negated');
  if (negated) return { kind: 'negated', evidence: [snippet(negated.line, negated.span)] };
  const objective = hits.find((h) => h.cls === 'objective');
  if (objective) return { kind: 'objective', evidence: [snippet(objective.line, objective.span)] };
  return { kind: 'absent' };
}

interface Judged {
  group: KeywordGroup;
  status: Status;
}

function evidenceOf(list: readonly Judged[]): string | null {
  return joinEvidence(list.flatMap((j) => (j.status.kind === 'absent' ? [] : j.status.evidence)));
}

function labels(list: readonly Judged[]): string {
  return list.map((j) => j.group.label).join(', ');
}

function isHardMissing(j: Judged): boolean {
  return j.status.kind === 'negated' || (j.status.kind === 'absent' && j.group.kind !== 'asset');
}

function missingReason(list: readonly Judged[]): string {
  const negated = list.filter((j) => j.status.kind === 'negated');
  const absent = list.filter((j) => j.status.kind === 'absent');
  const parts = [
    negated.length > 0 ? `CV ghi chưa biết/không có ${labels(negated)}` : '',
    absent.length > 0 ? `không thấy ${labels(absent)} trong CV` : '',
  ].filter((p) => p.length > 0);
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function judgeAll(judged: Judged[]): AtomResult {
  const met = judged.filter((j) => j.status.kind === 'met');
  if (met.length === judged.length) return result('met', `CV có ${labels(met)}`, evidenceOf(met));
  const prefix = met.length > 0 ? `Có ${labels(met)}; ` : '';
  const hard = judged.filter(isHardMissing);
  if (hard.length > 0) {
    const missing = missingReason(hard);
    const reason = met.length > 0 ? `${prefix}${missing.charAt(0).toLowerCase()}${missing.slice(1)}` : missing;
    return result('unmet', reason, evidenceOf(hard) ?? evidenceOf(met));
  }
  const soft = judged.filter((j) => j.status.kind !== 'met');
  const why = soft.some((j) => j.status.kind === 'objective')
    ? `chỉ thấy ${labels(soft)} ở phần mục tiêu`
    : `CV thường không ghi ${labels(soft)}, HR hỏi khi phỏng vấn`;
  return result('unknown', `${prefix}${why}`, evidenceOf(soft));
}

function judgeAny(judged: Judged[]): AtomResult {
  const met = judged.filter((j) => j.status.kind === 'met');
  if (met.length > 0) return result('met', `CV có ${labels(met)}`, evidenceOf(met));
  if (judged.every(isHardMissing)) return result('unmet', missingReason(judged), evidenceOf(judged));
  return result('unknown', `Chưa rõ CV có ${labels(judged)} không`, evidenceOf(judged));
}

/** Keyword requirement verdict ("Thành thạo Excel, Word" → both needed; "React hoặc Vue" → either). */
export function evaluateKeywords(atom: KeywordAtom, index: SkillIndex): AtomResult {
  const judged = atom.groupIds
    .map((id) => groupById(id))
    .filter((g): g is KeywordGroup => g !== null)
    .map((group) => ({ group, status: groupStatus(group.id, index) }));
  if (judged.length === 0) return result('unknown', 'Không rõ kỹ năng cần có');
  return atom.mode === 'any' ? judgeAny(judged) : judgeAll(judged);
}
