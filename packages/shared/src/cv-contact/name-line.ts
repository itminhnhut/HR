/** Shapes one line (or a label's value) into the words of a possible person's name. */
import { firstStopIndex, HONORIFICS, isSurname, MIDDLE_NAMES } from './name-lexicon.js';
import { fold, hasDiacritics } from './text.js';

export type NameCase = 'caps' | 'title' | 'lower';

export interface NameShape {
  words: string[];
  nameCase: NameCase;
}

const WORD = /^\p{L}+(?:-\p{L}+)?$/u;
/** A middle initial inside a name: "TRẦN V. HÙNG". */
const INITIAL = /^\p{Lu}\.$/u;
const SEPARATOR = /\s*(?:[|•·,;:(/\[{]|\s-\s|\s-|-\s)\s*/;
/** "Nguyễn thị Hoa": a lowercase middle name inside an otherwise capitalized name. */
const LOWER_MIDDLE = new Set(['thị', 'văn', 'thi', 'van']);
const FINAL_CONSONANT = /^(?:n|ng|nh|c|ch|m|p|t)$/iu;
const VOWELS = /[aeiouyàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/iu;

function isLetterSpaced(chunk: string): boolean {
  const tokens = chunk.split(' ');
  return tokens.length >= 2 && tokens.every((t) => [...t].length === 1);
}

/**
 * "T R Ầ N  V Ă N  H Ù N G   Frontend Developer" → "TRẦN VĂN HÙNG  Frontend Developer" (double spaces separate
 * the spaced words); a line spaced with single gaps only becomes one word. Other lines are returned unchanged.
 */
export function joinLetterSpaced(text: string): string {
  const chunks = text.trim().split(/\s{2,}/);
  let spaced = 0;
  while (spaced < chunks.length && isLetterSpaced(chunks[spaced] ?? '')) spaced += 1;
  if (spaced === 0) return text;
  const words = chunks.slice(0, spaced).map((c) => c.replace(/\s+/g, ''));
  return [words.join(' '), ...chunks.slice(spaced)].join('  ');
}

/** PDF extraction splits words: "Nguy ễn" / "NGUYỄ N" → "Nguyễn" / "NGUYỄN". */
function mergeFragments(words: readonly string[]): string[] {
  const out: string[] = [];
  for (const word of words) {
    const prev = out[out.length - 1];
    const isLowerTail =
      prev !== undefined && /^\p{Ll}/u.test(word) && VOWELS.test(word.charAt(0)) && /^\p{Lu}/u.test(prev);
    const isLoneConsonant = prev !== undefined && FINAL_CONSONANT.test(word) && VOWELS.test(prev.slice(-1));
    if (prev !== undefined && (isLowerTail || isLoneConsonant)) out[out.length - 1] = prev + word;
    else out.push(word);
  }
  return out;
}

/**
 * "Ông Nguyễn Văn Bình" starts with Mr., but "ÔNG THỊ DIỆU HIỀN" is the family name Ông (Bà likewise):
 * it is a surname when Thị/Văn or another middle name follows, or when two or more non-surname words follow.
 */
function isHonorificLead(words: readonly string[]): boolean {
  const first = (words[0] ?? '').toLowerCase();
  if (!HONORIFICS.has(first)) return false;
  if (first !== 'ông' && first !== 'bà') return true;
  const second = fold(words[1] ?? '');
  if (second === 'thi' || second === 'van') return false;
  if (isSurname(second)) return true;
  return !MIDDLE_NAMES.has(second) && words.length < 3;
}

function caseOf(words: readonly string[]): NameCase | null {
  if (words.every((w) => w === w.toUpperCase())) return 'caps';
  if (words.every((w) => w === w.toLowerCase())) return 'lower';
  if (words.every((w, i) => /^\p{Lu}/u.test(w) || (i > 0 && LOWER_MIDDLE.has(w)))) return 'title';
  return null;
}

/** Parts of a line between separators: "Trần Văn Hùng – Kế toán" → ["Trần Văn Hùng", "Kế toán"]. */
export function segments(text: string): string[] {
  return joinLetterSpaced(text)
    .split(SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** First segment of a line before a separator: "Trần Văn Hùng – Kế toán" → "Trần Văn Hùng". */
export function headSegment(text: string): string {
  return segments(text)[0] ?? '';
}

/** Words of a possible name in `segment`, cut before the first heading/job/org word; null when it cannot be one. */
export function shapeName(segment: string): NameShape | null {
  if (/[\d@]/.test(segment)) return null;
  const raw = segment
    .replace(/[.,:;!?]+$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const isWordAt = (w: string, i: number) => WORD.test(w) || (i > 0 && i < raw.length - 1 && INITIAL.test(w));
  if (raw.length === 0 || !raw.every(isWordAt)) return null;
  const merged = mergeFragments(raw);
  if (isHonorificLead(merged)) return null;
  const stop = firstStopIndex(merged, hasDiacritics(segment));
  const words = stop >= 0 ? merged.slice(0, stop) : merged;
  if (words.length < 2 || words.length > 5) return null;
  // A bare ASCII letter is only an initial in the middle ("TRẦN V HÙNG"); a toned one can be a name ("Phạm Văn Ý").
  const isEdge = (i: number) => i === 0 || i === words.length - 1;
  if (words.some((w, i) => /^[A-Za-z]$/.test(w) && isEdge(i))) return null;
  const nameCase = caseOf(words);
  return nameCase ? { words, nameCase } : null;
}

function capitalize(word: string): string {
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "TRẦN VĂN HÙNG" / "trần văn hùng" → "Trần Văn Hùng"; mixed-case words ("McDonald") stay as written. */
export function titleCase(words: readonly string[]): string {
  return words
    .map((w) => (w === w.toUpperCase() || w === w.toLowerCase() ? capitalize(w) : w))
    .map((w) => w.replace(/-(\p{Ll})/gu, (_m: string, c: string) => `-${c.toUpperCase()}`))
    .join(' ');
}
