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
  /\b(chua tung|khong co|chua biet|khong biet|chua co|chua su dung|khong su dung|chua dung|khong dung|chua thanh thao|khong thanh thao|chua thao|khong thao|chua lam|chua hoc|khong yeu cau|never|not familiar with|no experience (?:with|in)|without|lack of|chua nam|khong nam|no knowledge of)\b/;

/** A sentence or an adversative ends what came before: "Không biết Photoshop nhưng thành thạo Canva". */
const CLAUSE_BREAK = /[;!?:|()[\]]|\.(?:\s|$)|\b(?:nhung|but|tuy nhien|however)\b/;

/** The clause leading up to a position; a bare list item after a comma belongs to the chunk before it. */
function clauseUpTo(folded: string, start: number): string {
  const clause = folded.slice(0, start).split(CLAUSE_BREAK).pop() ?? '';
  const chunks = clause.split(',');
  const words = (chunk: string | undefined) =>
    (chunk ?? '').split(/\s+/).filter((w) => w.length > 0 && !/^(va|and|hoac|or)$/.test(w)).length;
  let from = chunks.length - 1;
  while (from > 0 && words(chunks[from]) <= 1) from -= 1;
  return chunks.slice(from).join(',');
}

/** Clause text before a span (since the last punctuation), limited to the last few words. */
export function clauseBefore(folded: string, start: number, words = 5): string {
  const before = folded.slice(0, start);
  const clause = before.split(/[,;.:|()[\]!?]/).pop() ?? '';
  return clause.trim().split(/\s+/).slice(-words).join(' ');
}

const NEGATED_AFTER = /^\s*(?:[:-]\s*)?(?:chua biet|khong biet|chua co|khong co|chua hoc|chua dung|none|no\b)/;

/** "Chưa biết Photoshop", "không có kinh nghiệm Excel", "Chưa có kinh nghiệm dùng AutoCAD và Revit". */
export function isNegatedAt(folded: string, start: number): boolean {
  const words = clauseUpTo(folded, start).trim().split(/\s+/);
  return NEGATION.test(words.slice(-10).join(' '));
}

/** Either side of a term: "Tiếng Nhật: chưa biết". */
export function isNegatedAround(folded: string, span: Span): boolean {
  return isNegatedAt(folded, span.start) || NEGATED_AFTER.test(folded.slice(span.end));
}

const ORG_WORD =
  /(?:^|\s)(cong ty|cty|tap doan|xi nghiep|ngan hang|benh vien|nha hang|khach san|quan (?:ca phe|cafe|an|com|pho)|cua hang|sieu thi|xuong|trung tam|hoc vien|truong (?:dai hoc|cao dang|trung cap|thpt|thcs|tieu hoc|mam non|ngoai ngu|tin hoc)|dai hoc|cao dang|company|corporation|corp|bank|university|college|school|academy)(?=\s|$)/g;
const NAME_QUALIFIER = /^(tnhh|cp|co phan|mtv|tmcp|jsc|ltd|dv|tm|sx|&|-)$/;
const NAME_FOLLOWER =
  /^\s*(?:&\s*)?(?:coffee|cafe|tea|grill|restaurant|bistro|bar|hotel|shop|store|mart|land|group|corp|corporation|company|co\.|co ltd|ltd|jsc|inc|academy|town|center|centre|school|bank|studio)(?![a-z])/;
/** "Oracle Việt Nam" is a company in a work history; "CPA Việt Nam" under certificates is the certificate. */
const COUNTRY_FOLLOWER = /^\s*(?:viet nam|vietnam|asia|pacific)\b/;
const CUSTOMER_WORD =
  /\b(?:khach hang|doi tac|nha cung cap|clients?|customers?|partners?)\b(?!.*\b(?:va|and)\b.*\b(?:su dung|dung|using)\b)/g;

function lastMatchEnd(re: RegExp, text: string): number {
  let end = -1;
  for (const m of text.matchAll(re)) end = m.index + m[0].length;
  return end;
}

function isCapitalisedRun(text: string): boolean {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .every((t) => /^[\p{Lu}\d]/u.test(t) || NAME_QUALIFIER.test(foldClean(t).toLowerCase()));
}

/** A keyword inside a proper name: "Công ty TNHH Excel Việt", "Java Coffee", "khách hàng Oracle, Salesforce". */
export function isInNameAt(line: CvLine, span: Span): boolean {
  const after = line.folded.slice(span.end);
  if (NAME_FOLLOWER.test(after)) return true;
  if (COUNTRY_FOLLOWER.test(after) && (line.section === 'experience' || line.section === 'none')) return true;
  const clause = line.folded.slice(0, span.start).split(CLAUSE_BREAK).pop() ?? '';
  const offset = span.start - clause.length;
  const chunk = clause.split(',').pop() ?? '';
  const orgEnd = lastMatchEnd(ORG_WORD, chunk);
  if (orgEnd >= 0 && isCapitalisedRun(line.text.slice(span.start - chunk.length + orgEnd, span.start))) return true;
  const customerEnd = lastMatchEnd(CUSTOMER_WORD, clause);
  return customerEnd >= 0 && isCapitalisedRun(line.text.slice(offset + customerEnd, span.start));
}

const ASPIRATION =
  /\b(mong muon|muon hoc|muon biet|se hoc|hoc them|dang tim hieu|dang hoc|moi hoc|du dinh hoc|dang on|dang theo hoc|want to learn|hope to learn|plan to learn|would like to learn|willing to learn|looking to learn|currently learning|eager to learn|learning)\b/;

/** "Mong muốn học thêm Photoshop", "Willing to learn Kubernetes": the skill is not there yet. Scoped to the clause. */
export function isAspirationAt(folded: string, start: number): boolean {
  return ASPIRATION.test(clauseUpTo(folded, start));
}

/** Same test over a whole line, for facts that do not sit at one position. */
export function isAspiration(folded: string): boolean {
  return ASPIRATION.test(folded);
}
