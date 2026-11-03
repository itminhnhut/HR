/**
 * Skill / tool / certificate / asset dictionary (folded, lowercase, no tones).
 * A requirement mentioning any `terms` of a group asks for that group; the CV satisfies it with any of the group's
 * own terms, any covered group (`covers`, e.g. "CRM" ← HubSpot) or, for `allOf`, every listed group together
 * ("tin học văn phòng" ← Word + Excel). Vocabulary lives in vocab-tools.ts and vocab-trade.ts.
 */
import type { KeywordGroup } from './keyword-types.js';
import { fold } from './normalize.js';
import type { Span } from './text-match.js';
import { findTerm } from './text-match.js';
import { TOOL_GROUPS } from './vocab-tools.js';
import { FAMILY_SUPPORT, TRADE_GROUPS } from './vocab-trade.js';

export type { GroupKind, KeywordGroup } from './keyword-types.js';

const RAW_GROUPS: readonly KeywordGroup[] = [...TOOL_GROUPS, ...TRADE_GROUPS];

function foldGroup(g: KeywordGroup): KeywordGroup {
  return { ...g, terms: g.terms.map(fold), reqOnly: g.reqOnly?.map(fold) };
}

export const KEYWORD_GROUPS: readonly KeywordGroup[] = RAW_GROUPS.map(foldGroup);

const BY_ID = new Map(KEYWORD_GROUPS.map((g) => [g.id, g]));

/** Groups made redundant when `g` is named in the same requirement line. */
export function subsumedBy(g: KeywordGroup): string[] {
  return [...(g.covers ?? []), ...(g.allOf ?? []), ...(g.examples ?? [])];
}

export function groupById(id: string): KeywordGroup | null {
  return BY_ID.get(id) ?? null;
}

interface TermEntry {
  term: string;
  groupId: string;
  /** Written without tones in the dictionary (a product name): the CV must write it without tones too. */
  toneless: boolean;
}

function termTable(includeReqOnly: boolean): TermEntry[] {
  const entries = RAW_GROUPS.flatMap((g) => [
    ...g.terms.map((raw) => ({ term: fold(raw), groupId: g.id, toneless: raw === fold(raw) })),
    ...(includeReqOnly
      ? (g.reqOnly ?? []).map((raw) => ({ term: fold(raw), groupId: g.id, toneless: raw === fold(raw) }))
      : []),
  ]);
  return entries.sort((a, b) => b.term.length - a.term.length);
}

const REQ_TERMS = termTable(true);
const CV_TERMS = termTable(false);

export interface GroupHit extends Span {
  groupId: string;
  toneless: boolean;
}

function overlaps(a: Span, taken: readonly Span[]): boolean {
  return taken.some((t) => a.start < t.end && t.start < a.end);
}

/** Longest-match, non-overlapping group hits in a folded string ("react native" beats "react"). */
export function findGroupHits(folded: string, side: 'req' | 'cv'): GroupHit[] {
  const hits: GroupHit[] = [];
  for (const { term, groupId, toneless } of side === 'req' ? REQ_TERMS : CV_TERMS) {
    if (!folded.includes(term)) continue;
    for (const span of findTerm(folded, term)) {
      if (!overlaps(span, hits)) hits.push({ ...span, groupId, toneless });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

/** Every folded word that places a job or degree in an occupation: its support words and its own vocabulary. */
export function familyTerms(family: string): string[] {
  const own = KEYWORD_GROUPS.filter((g) => g.family === family).flatMap((g) => g.terms);
  return [...own, ...(FAMILY_SUPPORT[family] ?? []).map(fold)];
}
