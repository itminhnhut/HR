/**
 * Small matching helpers over folded text: whole-word term search, snippets for evidence, context checks.
 */
import { foldClean, type CvLine } from './normalize.js';

export interface Span {
  start: number;
  end: number;
}

const REGEX_CACHE = new Map<string, RegExp>();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Global regex for a folded term with alphanumeric word boundaries; spaces match any whitespace. */
export function termRegex(term: string): RegExp {
  const cached = REGEX_CACHE.get(term);
  if (cached) return cached;
  const body = escapeRegExp(term).replace(/ /g, '\\s+');
  const re = new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'g');
  REGEX_CACHE.set(term, re);
  return re;
}

/** All whole-word occurrences of a folded term. */
export function findTerm(folded: string, term: string): Span[] {
  const re = termRegex(term);
  re.lastIndex = 0;
  const out: Span[] = [];
  for (let m = re.exec(folded); m; m = re.exec(folded)) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function hasTerm(folded: string, term: string): boolean {
  return findTerm(folded, term).length > 0;
}

export function hasAnyTerm(folded: string, terms: readonly string[]): boolean {
  return terms.some((t) => hasTerm(folded, t));
}

export const MAX_EVIDENCE = 160;

/** The original (toned) wording of a folded phrase inside `clean`; falls back to the phrase itself. */
export function originalOf(clean: string, foldedPhrase: string): string {
  const at = foldClean(clean).indexOf(foldedPhrase);
  return at >= 0 ? clean.slice(at, at + foldedPhrase.length) : foldedPhrase;
}

/** Original-text quote around a span, at most `max` characters, cut on word boundaries. */
export function snippet(line: CvLine, span?: Span, max = MAX_EVIDENCE): string {
  const text = line.text.replace(/^[-*+>\s]+/, '');
  const offset = line.text.length - text.length;
  if (text.length <= max) return text;
  const hitStart = span ? Math.max(0, span.start - offset) : 0;
  const width = max - 2;
  let from = Math.max(0, hitStart - 50);
  const to = Math.min(text.length, from + width);
  from = Math.max(0, to - width);
  let cut = text.slice(from, to);
  if (from > 0) cut = cut.replace(/^\S*\s/, '');
  if (to < text.length) cut = cut.replace(/\s\S*$/, '');
  return `${from > 0 ? '…' : ''}${cut.trim()}${to < text.length ? '…' : ''}`;
}

/** Joins several quotes, keeping the total within MAX_EVIDENCE. */
export function joinEvidence(parts: readonly string[]): string | null {
  const unique = [...new Set(parts.filter((p) => p.length > 0))];
  if (unique.length === 0) return null;
  let out = unique[0];
  for (const p of unique.slice(1)) {
    if (out.length + p.length + 3 > MAX_EVIDENCE) break;
    out = `${out} … ${p}`;
  }
  return out.length > MAX_EVIDENCE ? `${out.slice(0, MAX_EVIDENCE - 1)}…` : out;
}

const NEGATION =
  /\b(chua tung|khong co|chua biet|khong biet|chua co|chua su dung|khong su dung|chua thanh thao|khong thanh thao|chua thao|khong thao|chua lam|chua hoc|never|not familiar with|no experience (?:with|in)|without|lack of|chua nam|khong nam)\b/;

/** Clause text before a span (since the last punctuation), limited to the last few words. */
export function clauseBefore(folded: string, start: number, words = 5): string {
  const before = folded.slice(0, start);
  const clause = before.split(/[,;.:|()[\]!?]/).pop() ?? '';
  return clause.trim().split(/\s+/).slice(-words).join(' ');
}

/** "Chưa biết Photoshop", "không có kinh nghiệm Excel". */
export function isNegatedAt(folded: string, start: number): boolean {
  return NEGATION.test(clauseBefore(folded, start, 6));
}

const ORG_WORDS =
  /(?:^|\s)(?:cong ty|cty|tap doan|(?<!(?:thi|moi|hien|quang|chien|lap|nha) )truong|company|corporation|corp|jsc|tnhh|ngan hang|bank|university|college|school|hoc vien|academy)(?:\s|$)/;

/** Keyword that is part of an organisation name ("Công ty TNHH Excel Việt"). */
export function isInOrgNameAt(folded: string, start: number): boolean {
  return ORG_WORDS.test(` ${clauseBefore(folded, start, 6)} `);
}

const ASPIRATION =
  /\b(mong muon (?:duoc )?(?:hoc|tim hieu)|muon hoc|se hoc|hoc them|dang tim hieu|dang hoc them|du dinh hoc|want to learn|hope to learn|plan to learn|would like to learn|currently learning|eager to learn)\b/;

/** "Mong muốn học thêm Photoshop" — mentions a skill the candidate does not have yet. */
export function isAspiration(folded: string): boolean {
  return ASPIRATION.test(folded);
}
