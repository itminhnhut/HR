/**
 * Fields of work as a requirement names them: "bán hàng dự án hoặc bán hàng kỹ thuật trong ngành cơ điện, HVAC"
 * becomes any-of (sales) and, separately, any-of the industries. A job or degree belongs to the field when it shows
 * one alternative and, if the line names an industry, one industry.
 */
import { FIELD_ENTRIES, type FieldEntry } from './field-dictionary.js';
import { findGroupHits, groupById } from './keywords.js';
import { fold } from './normalize.js';
import { hasAnyTerm, hasTerm } from './text-match.js';

export interface TermSet {
  /** Exact folded phrases. */
  terms: string[];
  /** Folded phrases whose words only have to appear on one line, in any order ("bảo trì tủ điện" for "bảo trì điện"). */
  loose: string[];
  /** Shown by the job title alone, not by the duties. */
  titleOnly?: boolean;
}

export interface FieldSpec {
  /** As HR wrote it, folded ("ban hang"); swapped for HR's own wording in reasons. */
  label: string;
  /** Any one of these fits; every set inside it must be shown. */
  alternatives: TermSet[][];
  /** The industry named after "trong ngành" / "tại công ty", when there is one. */
  industry: TermSet | null;
  /** Every folded term, for reports and synonyms. */
  terms: string[];
  /** False when the dictionary recognised nothing: absence then says little, so the verdict stays open. */
  known: boolean;
  /** Every alternative is mostly a dictionary tool ("sử dụng CRM"): the keyword check judges it better. */
  toolsOnly: boolean;
}

const ENTRIES: readonly FieldEntry[] = FIELD_ENTRIES.map((e) => ({
  names: e.names.map(fold),
  also: e.also?.map(fold),
  reqOnly: e.reqOnly?.map(fold),
  titleOnly: e.titleOnly,
}));

function entryNames(e: FieldEntry): string[] {
  return [...e.names, ...(e.also ?? [])];
}

/** The words a job is matched on: a reqOnly name such as "kho" would also match "khó khăn". */
function matchTerms(e: FieldEntry): string[] {
  return entryNames(e).filter((name) => !e.reqOnly?.includes(name));
}

interface EntryHit {
  entry: FieldEntry;
  name: string;
}

/** The dictionary entry whose name takes up most of the phrase. */
function longestEntry(phrase: string): EntryHit | null {
  let best: EntryHit | null = null;
  for (const entry of ENTRIES) {
    for (const name of entry.names) {
      if (name.length > (best?.name.length ?? 0) && hasTerm(phrase, name)) best = { entry, name };
    }
  }
  return best;
}

/** Synonyms of a major or field name: the dictionary words and the vocabulary of any tool it names. */
export function synonymsOf(phrase: string): string[] {
  const hit = longestEntry(phrase);
  const groups = findGroupHits(phrase, 'req').flatMap((h) => groupById(h.groupId)?.terms ?? []);
  return [...new Set([...(hit ? matchTerms(hit.entry) : []), ...groups])];
}

const WEAK_WORDS =
  /\b(nhan vien|chuyen vien|vi tri|cong viec|linh vuc|nganh|san pham|tren|cua|cac|cho|ve|o|lam|chay|quan ly|phu trach|tung)\b/g;

function restAfter(alt: string, name: string): string {
  return alt.replace(name, ' ').replace(WEAK_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

function expandAlternative(alt: string, hasIndustry: boolean): { sets: TermSet[]; known: boolean } {
  const hit = longestEntry(alt);
  const groups = findGroupHits(alt, 'req');
  if (hit) {
    const base: TermSet = { terms: matchTerms(hit.entry), loose: [], titleOnly: hit.entry.titleOnly };
    const rest = restAfter(alt, hit.name);
    const needsRest = !hasIndustry && /[a-z]{2,}/.test(rest);
    return { sets: needsRest ? [base, { terms: [], loose: [rest] }] : [base], known: true };
  }
  if (groups.length > 0) {
    const terms = groups.flatMap((g) => groupById(g.groupId)?.terms ?? []);
    return { sets: [{ terms, loose: [alt] }], known: true };
  }
  return { sets: [{ terms: [], loose: [alt] }], known: false };
}

function isMostlyTool(part: string): boolean {
  const covered = findGroupHits(part, 'req').reduce((sum, h) => sum + h.end - h.start, 0);
  return covered * 2 >= part.length;
}

const TRAILING_OPEN =
  /\s*\b(?:hoac\s+)?(?:(?:nganh|vi tri|linh vuc)\s+)?(?:lien quan|tuong duong|tuong tu|phu hop|related|relevant|similar|equivalent)\b.*$/;

function splitAlternatives(phrase: string): string[] {
  return phrase
    .replace(TRAILING_OPEN, '')
    .replace(/\(/g, ', ')
    .replace(/\)/g, ' ')
    .split(/,|\bhoac\b|\bor\b|(?<=[a-z]{3})\/(?=[a-z]{3})/)
    .map((p) => p.replace(/\.+$/, '').replace(/\s+/g, ' ').trim())
    .filter((p) => /[a-z0-9]{2,}/.test(p));
}

const INDUSTRY_SPLIT =
  /\s\b(?:tai cac cong ty|tai cong ty|o cong ty|tai cac|trong nganh|trong linh vuc|trong mang|in the|at)\b\s/;

function splitIndustry(phrase: string): { role: string; industry: string | null } {
  const m = INDUSTRY_SPLIT.exec(phrase);
  if (!m || m.index === 0) return { role: phrase, industry: null };
  return { role: phrase.slice(0, m.index), industry: phrase.slice(m.index + m[0].length) };
}

function industrySet(text: string): TermSet {
  const parts = splitAlternatives(text);
  const expanded = parts.map((p) => expandAlternative(p, true));
  return {
    terms: expanded.flatMap((e) => e.sets.flatMap((s) => s.terms)),
    loose: expanded.flatMap((e) => e.sets.flatMap((s) => s.loose)),
  };
}

/** "Kinh nghiệm bán hàng" → field with synonyms; null when nothing specific is left. */
export function buildField(phraseFolded: string): FieldSpec | null {
  const label = phraseFolded
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:-]+$/, '')
    .trim();
  if (label.length < 2) return null;
  const { role, industry } = splitIndustry(label);
  const parts = splitAlternatives(role);
  if (parts.length === 0) return null;
  const expanded = parts.map((p) => expandAlternative(p, industry !== null));
  const alternatives = expanded.map((e) => e.sets);
  const set = industry === null ? null : industrySet(industry);
  return {
    label,
    alternatives,
    industry: set,
    terms: [...new Set([...alternatives.flat(), ...(set ? [set] : [])].flatMap((s) => [...s.terms, ...s.loose]))],
    known: expanded.some((e) => e.known),
    toolsOnly: parts.every(isMostlyTool),
  };
}

/** "tương đương", "liên quan": a field HR did not name, which cannot be checked automatically. */
export function isRelatedOnly(phraseFolded: string): boolean {
  return /\b(tuong duong|lien quan|tuong tu|phu hop|trong nganh|cung nganh|relevant|related|similar|equivalent|in the (?:industry|field))\b/.test(
    phraseFolded,
  );
}

/** Most of the words of a phrase on one line of the text ("giảng dạy trẻ mầm non" for "giáo viên mầm non"). */
function looseHit(text: string, phrase: string): boolean {
  const words = phrase.split(/\s+/).filter((w) => w.length > 0 && !/^(va|and|the|of)$/.test(w));
  const needed = Math.ceil((words.length * 2) / 3);
  return words.length > 0 && text.split('\n').some((line) => words.filter((w) => hasTerm(line, w)).length >= needed);
}

function setHit(text: string, set: TermSet): boolean {
  return hasAnyTerm(text, set.terms) || set.loose.some((p) => looseHit(text, p));
}

/** Does this text (a job, a degree, a stated sentence) belong to the field? */
export function matchesField(folded: string, field: FieldSpec): boolean {
  if (field.industry && !setHit(folded, field.industry)) return false;
  return field.alternatives.some((sets) => sets.every((s) => setHit(folded, s)));
}

/** "Trợ lý Giám đốc" works for a director; it does not make the candidate one. */
const WORKS_FOR = /\b(?:tro ly|thu ky|assistant to|secretary to)\b[^,\n]*/g;

/** Same, for a job: a title-only set must be shown by the title. */
export function matchesJob(head: string, block: string, field: FieldSpec): boolean {
  if (field.industry && !setHit(block, field.industry)) return false;
  const title = head.replace(WORKS_FOR, ' ');
  return field.alternatives.some((sets) => sets.every((s) => setHit(s.titleOnly ? title : block, s)));
}
