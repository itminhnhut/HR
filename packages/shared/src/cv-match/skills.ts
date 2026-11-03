/**
 * Skill / tool / certificate / asset keywords in the CV, with context: negated ("chưa biết Photoshop"), aspirational
 * ("mong muốn học thêm Figma", "Sở thích"), only in the objective, part of a name ("Java Coffee"), a trade term claimed
 * in a list with nothing in the work history or education to back it, or a tool found only in a long keyword list that
 * nothing backs either, which stays open for HR.
 */
import { askInInterview, result, type AtomResult, type KeywordAtom } from './atoms.js';
import { isInWork, isKeywordList, isListShownIn, withoutLines } from './keyword-list.js';
import { familyTerms, findGroupHits, groupById, KEYWORD_GROUPS, type KeywordGroup } from './keywords.js';
import type { CvDoc, CvLine } from './normalize.js';
import {
  hasAnyTerm,
  isAspirationAt,
  isInNameAt,
  isNegatedAround,
  joinEvidence,
  snippet,
  type Span,
} from './text-match.js';

export type HitClass = 'ok' | 'basic' | 'negated' | 'objective' | 'weak';

interface Located {
  line: CvLine;
  span: Span;
  cls: HitClass;
}

/** What the rest of the CV says about the candidate, for judging claims and absences. */
export interface CvEvidence {
  /** Job titles, companies and duties. */
  work: string;
  /** Folded education lines. */
  education: string;
  hasJobs: boolean;
  /** The CV has real content: a missing skill then means the candidate does not show it. */
  substantive: boolean;
}

export interface SkillIndex {
  hits: ReadonlyMap<string, Located[]>;
  evidence: CvEvidence;
  /** Indexes of the keyword lists with nothing behind them in the work or education. */
  unbackedLists: ReadonlySet<number>;
}

const BASIC_LEVEL = /\b(co ban|basic|so cap|beginner|biet so qua)\b/;
const ADVANCED_LEVEL = /\b(nang cao|advanced|thanh thao|proficient|expert|gioi|pivot|vlookup|macro|chuyen sau)\b/;
const SAP_FALSE_FRIEND = /^\s+(?:xep|dat|toi|ra|tot)\b/;
/** "Nhà cung cấp nước ngoài" holds the letters of "cấp nước". */
const FOREIGN_SUPPLIER = 'cap nuoc ngoai';

/** The list item a keyword sits in, to read a level written next to it. */
function chunkAround(folded: string, span: Span): string {
  const before =
    folded
      .slice(0, span.start)
      .split(/[,;.:|()]/)
      .pop() ?? '';
  const after = folded.slice(span.end).split(/[,;.:|()]/)[0] ?? '';
  return `${before} ${after}`;
}

/** Context of a keyword hit; null when it is part of a name and must be ignored. */
export function classify(line: CvLine, span: Span): HitClass | null {
  if (isInNameAt(line, span)) return null;
  if (line.section === 'references') return null;
  if (line.section === 'interests' || isAspirationAt(line.folded, span.start)) return 'weak';
  if (isNegatedAround(line.folded, span)) return 'negated';
  if (line.section === 'objective') return 'objective';
  return BASIC_LEVEL.test(chunkAround(line.folded, span)) ? 'basic' : 'ok';
}

/** "Sắp xếp" folds to the same letters as SAP; "sap xep" in a CV without tones is the same trap. */
function isFalseFriend(line: CvLine, hit: { start: number; end: number; toneless: boolean }): boolean {
  const original = line.text.slice(hit.start, hit.end);
  if (hit.toneless && /[^\x00-\x7F]/.test(original)) return true;
  if (line.folded.startsWith(FOREIGN_SUPPLIER, hit.start)) return true;
  return original.toLowerCase() === 'sap' && SAP_FALSE_FRIEND.test(line.folded.slice(hit.end));
}

function abbrevHits(line: CvLine): { groupId: string; span: Span }[] {
  if (line.section !== 'skills') return [];
  return KEYWORD_GROUPS.flatMap((g) =>
    (g.abbrev ?? [])
      .filter(() => !g.abbrevNeeds || g.abbrevNeeds.test(line.folded))
      .flatMap((a) =>
        [...line.text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${a}(?![\\p{L}\\p{N}+#.])`, 'gu'))].map((m) => ({
          groupId: g.id,
          span: { start: m.index, end: m.index + a.length },
        })),
      ),
  );
}

function hitsOnLine(line: CvLine): { groupId: string; span: Span }[] {
  const named = findGroupHits(line.folded, 'cv')
    .filter((hit) => !isFalseFriend(line, hit))
    .map((hit) => ({ groupId: hit.groupId, span: { start: hit.start, end: hit.end } }));
  return [...named, ...abbrevHits(line)];
}

function isAcceptedHit(group: KeywordGroup | null, line: CvLine): boolean {
  // Selling laptops is not owning one: an asset is only read outside the work history.
  return group?.kind !== 'asset' || line.section !== 'experience';
}

/** A trade term in a list counts only when the candidate's own work or study is in that occupation. */
function familySupported(group: KeywordGroup, evidence: CvEvidence): boolean {
  if (!group.family) return true;
  const terms = familyTerms(group.family);
  return hasAnyTerm(evidence.work, terms) || hasAnyTerm(evidence.education, terms);
}

function tradesOnLine(line: CvLine, hits: ReadonlyMap<string, Located[]>): KeywordGroup[] {
  return [...hits]
    .filter(([, located]) => located.some((h) => h.line === line))
    .map(([id]) => groupById(id))
    .filter((g): g is KeywordGroup => g?.kind === 'trade');
}

/**
 * Lists that nothing stands behind. Backing is some of the items in the work or education, or a trade term of the
 * candidate's own occupation: the only link between a tool and a job the dictionary has, so a list without one is
 * read by what it shares with the CV, word for word.
 */
function unbackedLists(doc: CvDoc, hits: ReadonlyMap<string, Located[]>, evidence: CvEvidence): ReadonlySet<number> {
  const lists = doc.lines.filter((line) => isKeywordList(line) && !isInWork(line, evidence.work));
  const rest: CvEvidence = {
    ...evidence,
    work: withoutLines(evidence.work, lists),
    education: withoutLines(evidence.education, lists),
  };
  const isBacked = (line: CvLine) =>
    isListShownIn(line, `${rest.work} \n ${rest.education}`) ||
    tradesOnLine(line, hits).some((group) => familySupported(group, rest));
  return new Set(lists.filter((line) => !isBacked(line)).map((line) => line.index));
}

/** Indexes every keyword group hit of the CV once. */
export function indexSkills(doc: CvDoc, evidence: CvEvidence): SkillIndex {
  const hits = new Map<string, Located[]>();
  for (const line of doc.lines) {
    for (const { groupId, span } of hitsOnLine(line)) {
      const cls = classify(line, span);
      if (cls === null || !isAcceptedHit(groupById(groupId), line)) continue;
      hits.set(groupId, [...(hits.get(groupId) ?? []), { line, span, cls }]);
    }
  }
  return { hits, evidence, unbackedLists: unbackedLists(doc, hits, evidence) };
}

type Status =
  | { kind: 'met'; evidence: string[] }
  | { kind: 'negated'; evidence: string[] }
  | { kind: 'basic'; evidence: string[] }
  | { kind: 'objective'; evidence: string[] }
  | { kind: 'wish'; evidence: string[] }
  | { kind: 'unsupported'; evidence: string[] }
  | { kind: 'listed'; evidence: string[] }
  | { kind: 'absent' };

function inWorkHistory(hit: Located, work: string): boolean {
  return work.includes(hit.line.folded);
}

/** A hit outside the unbacked lists decides; an asset is never in a job, so a list says as much about it as anywhere. */
function plainStatus(group: KeywordGroup, ok: readonly Located[], index: SkillIndex): Status | null {
  const seen = group.kind === 'asset' ? ok : ok.filter((h) => !index.unbackedLists.has(h.line.index));
  const first = seen.find((h) => h.cls === 'ok') ?? seen[0];
  if (!first) return null;
  const evidence = [snippet(first.line, first.span)];
  return first.cls === 'basic' ? { kind: 'basic', evidence } : { kind: 'met', evidence };
}

function ownStatus(group: KeywordGroup, hits: readonly Located[], index: SkillIndex): Status | null {
  const ok = hits.filter((h) => h.cls === 'ok' || h.cls === 'basic');
  const first = ok.find((h) => h.cls === 'ok') ?? ok[0];
  if (!first) return null;
  const evidence = [snippet(first.line, first.span)];
  if (group.kind !== 'trade') {
    return plainStatus(group, ok, index) ?? { kind: first.cls === 'basic' ? 'basic' : 'listed', evidence };
  }
  const shown = ok.find((h) => inWorkHistory(h, index.evidence.work));
  if (shown) return { kind: 'met', evidence: [snippet(shown.line, shown.span)] };
  return familySupported(group, index.evidence) ? { kind: 'met', evidence } : { kind: 'unsupported', evidence };
}

/** "Met" wins over "listed", whichever group came first. */
function strongest(statuses: readonly (Status | null)[]): Status | null {
  return statuses.find((s) => s?.kind === 'met') ?? statuses.find((s) => s?.kind === 'listed') ?? null;
}

/** Named outright, or through a group it covers; "allOf" answers only for the group asked about. */
function namedStatus(id: string, index: SkillIndex, depth: number): Status | null {
  const group = groupById(id);
  if (!group || depth > 3) return null;
  const own = ownStatus(group, index.hits.get(id) ?? [], index);
  return strongest([own, ...(group.covers ?? []).map((covered) => namedStatus(covered, index, depth + 1))]);
}

function derivedStatus(group: KeywordGroup, index: SkillIndex, depth: number): Status | null {
  const covered = strongest((group.covers ?? []).map((id) => namedStatus(id, index, depth + 1)));
  if (covered?.kind === 'met') return covered;
  const all = (group.allOf ?? []).map((id) => groupStatus(id, index, depth + 1));
  const evidence = all.flatMap((s) => (s.kind === 'met' || s.kind === 'listed' ? s.evidence : []));
  if (all.length > 0 && all.every((s) => s.kind === 'met')) return { kind: 'met', evidence };
  if (covered) return covered;
  return all.length > 0 && all.every((s) => s.kind === 'met' || s.kind === 'listed')
    ? { kind: 'listed', evidence }
    : null;
}

function groupStatus(id: string, index: SkillIndex, depth = 0): Status {
  const group = groupById(id);
  if (!group || depth > 3) return { kind: 'absent' };
  const hits = index.hits.get(id) ?? [];
  const own = ownStatus(group, hits, index);
  if (own?.kind === 'met') return own;
  const derived = derivedStatus(group, index, depth);
  if (derived?.kind === 'met') return derived;
  if (own) return own;
  if (derived) return derived;
  const negated = hits.find((h) => h.cls === 'negated');
  if (negated) return { kind: 'negated', evidence: [snippet(negated.line, negated.span)] };
  const wish = hits.find((h) => h.cls === 'weak');
  if (wish) return { kind: 'wish', evidence: [snippet(wish.line, wish.span)] };
  const objective = hits.find((h) => h.cls === 'objective');
  if (objective) return { kind: 'objective', evidence: [snippet(objective.line, objective.span)] };
  return { kind: 'absent' };
}

interface Judged {
  group: KeywordGroup;
  status: Status;
  /** A wanted level that the CV does not show, though the skill itself is there. */
  levelUnproven?: boolean;
}

function evidenceOf(list: readonly Judged[]): string | null {
  return joinEvidence(list.flatMap((j) => (j.status.kind === 'absent' ? [] : j.status.evidence)));
}

function labels(list: readonly Judged[]): string {
  return list.map((j) => j.group.label).join(', ');
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isHardMissing(j: Judged, evidence: CvEvidence): boolean {
  const shownNotHeld: readonly Status['kind'][] = ['negated', 'unsupported', 'basic', 'wish'];
  if (shownNotHeld.includes(j.status.kind)) return true;
  if (j.status.kind !== 'absent' && j.status.kind !== 'objective') return false;
  return j.group.kind !== 'asset' && evidence.substantive;
}

function missingReason(list: readonly Judged[]): string {
  const part = (kinds: readonly Status['kind'][], text: (names: string) => string) => {
    const group = list.filter((j) => kinds.includes(j.status.kind));
    return group.length > 0 ? text(labels(group)) : '';
  };
  const text = [
    part(['negated'], (n) => `CV ghi chưa biết/không có ${n}`),
    part(['basic'], (n) => `CV chỉ ghi ${n} ở mức cơ bản`),
    part(['unsupported'], (n) => `chỉ thấy ${n} ở phần liệt kê, công việc và học vấn trong CV không liên quan`),
    part(['objective', 'wish'], (n) => `chỉ thấy ${n} ở phần mục tiêu / muốn học`),
    part(['absent'], (n) => `không thấy ${n} trong CV`),
  ]
    .filter((p) => p.length > 0)
    .join('; ');
  return upperFirst(text);
}

function listedReason(listed: readonly Judged[]): string {
  return `chỉ thấy ${labels(listed)} trong danh sách từ khoá, công việc trong CV không thể hiện, HR xem thêm`;
}

function isListed(j: Judged): boolean {
  return j.status.kind === 'listed';
}

function unstatedReason(soft: readonly Judged[], index: SkillIndex): string {
  if (soft.some((j) => j.group.kind === 'asset')) return `CV thường không ghi ${labels(soft)}, HR hỏi khi phỏng vấn`;
  if (soft.some((j) => j.levelUnproven)) return `CV có ${labels(soft)} nhưng không ghi rõ mức nâng cao, HR hỏi thêm`;
  if (!index.evidence.substantive) return `CV quá ít nội dung để kết luận về ${labels(soft)}, HR xem trực tiếp`;
  return `chỉ thấy ${labels(soft)} ở phần mục tiêu`;
}

function openReason(soft: readonly Judged[], index: SkillIndex): string {
  const listed = soft.filter(isListed);
  const rest = soft.filter((j) => !isListed(j));
  if (listed.length === 0) return unstatedReason(rest, index);
  return rest.length === 0 ? listedReason(listed) : `${listedReason(listed)}; ${unstatedReason(rest, index)}`;
}

function judgeAll(judged: readonly Judged[], index: SkillIndex): AtomResult {
  const met = judged.filter((j) => j.status.kind === 'met' && !j.levelUnproven);
  if (met.length === judged.length) return result('met', `CV có ${labels(met)}`, evidenceOf(met));
  const prefix = met.length > 0 ? `Có ${labels(met)}; ` : '';
  const hard = judged.filter((j) => isHardMissing(j, index.evidence));
  if (hard.length > 0) {
    const missing = missingReason(hard);
    const reason = met.length > 0 ? `${prefix}${missing.charAt(0).toLowerCase()}${missing.slice(1)}` : missing;
    return result('unmet', reason, evidenceOf(hard) ?? evidenceOf(met));
  }
  const soft = judged.filter((j) => !met.includes(j));
  const open = openReason(soft, index);
  const reason = soft.some(isListed) && met.length === 0 ? upperFirst(open) : `${prefix}${open}`;
  if (soft.every((j) => j.group.kind === 'asset')) return askInInterview(reason, evidenceOf(soft));
  return result('unknown', reason, evidenceOf(soft));
}

function judgeAny(judged: readonly Judged[], index: SkillIndex): AtomResult {
  const met = judged.filter((j) => j.status.kind === 'met' && !j.levelUnproven);
  if (met.length > 0) return result('met', `CV có ${labels(met)}`, evidenceOf(met));
  if (judged.every((j) => isHardMissing(j, index.evidence))) {
    return result('unmet', missingReason(judged), evidenceOf(judged));
  }
  const listed = judged.filter(isListed);
  if (listed.length > 0) return result('unknown', upperFirst(listedReason(listed)), evidenceOf(listed));
  return result('unknown', `Chưa rõ CV có ${labels(judged)} không`, evidenceOf(judged));
}

function withLevel(status: Status, atom: KeywordAtom, group: KeywordGroup, index: SkillIndex): Judged {
  if (status.kind === 'basic' && atom.level === undefined) {
    return { group, status: { kind: 'met', evidence: status.evidence } };
  }
  if (status.kind !== 'met' || atom.level !== 'advanced') return { group, status };
  const hits = index.hits.get(group.id) ?? [];
  const proven = hits.some((h) => ADVANCED_LEVEL.test(h.line.folded));
  return { group, status, levelUnproven: !proven };
}

/** Keyword requirement verdict ("Thành thạo Excel, Word" → both needed; "React hoặc Vue" → either). */
export function evaluateKeywords(atom: KeywordAtom, index: SkillIndex): AtomResult {
  const judged = atom.groupIds
    .map((id) => groupById(id))
    .filter((g): g is KeywordGroup => g !== null)
    .map((group) => withLevel(groupStatus(group.id, index), atom, group, index));
  if (judged.length === 0) return result('unknown', 'Không rõ kỹ năng cần có');
  return atom.mode === 'any' ? judgeAny(judged, index) : judgeAll(judged, index);
}
