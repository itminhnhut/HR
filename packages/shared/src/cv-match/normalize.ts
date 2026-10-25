/**
 * Text normalisation for the CV matcher. Every line keeps two views of the same length:
 * `text` (cleaned original, used for evidence quotes) and `folded` (lowercase, no tones, đ→d, used for matching),
 * so an index found in `folded` points at the same characters in `text`.
 */
import { detectHeader, type SectionKind } from './sections.js';

export interface CvLine {
  index: number;
  text: string;
  folded: string;
  section: SectionKind;
  isHeader: boolean;
}

export interface CvDoc {
  lines: CvLine[];
  letterCount: number;
  isEnglish: boolean;
}

const LIGATURES: Record<string, string> = { ﬁ: 'fi', ﬂ: 'fl', ﬀ: 'ff', ﬃ: 'ffi', ﬄ: 'ffl', ﬅ: 'st', ﬆ: 'st' };
const DASHES = /[‐-―−﹘﹣－]/g;
const BULLETS = /[•●○◦▪▫■□►▶➢✓✔❖◆◇∙‣⁃]/g;
const INVISIBLE = /[  -​  　﻿\t]/g;

/** Cleans one line: NFC, ligatures, unified dashes/bullets, collapsed whitespace. Keeps tones. */
export function cleanLine(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[\uD800-\uDFFF]/g, ' ')
    .replace(/\p{M}/gu, '')
    .replace(DASHES, '-')
    .replace(BULLETS, '-')
    .replace(INVISIBLE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function foldChar(c: string): string {
  if (c === 'đ' || c === 'Đ') return 'd';
  const base = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return base.length > 0 ? base.charAt(0) : ' ';
}

/** Folds an already-cleaned string to the matching form; output has the same length as input. */
export function foldClean(clean: string): string {
  let out = '';
  for (let i = 0; i < clean.length; i += 1) out += foldChar(clean.charAt(i));
  return out;
}

/** Clean + fold in one go (for requirement lines and dictionary terms). */
export function fold(raw: string): string {
  return foldClean(cleanLine(raw));
}

function splitRawLines(cvText: string): string[] {
  return cvText
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((l) => l.split(/(?=[•●▪■➢❖])/))
    .map(cleanLine)
    .filter((l) => l.length > 0);
}

const EN_WORDS = new Set([
  'the',
  'and',
  'of',
  'to',
  'in',
  'for',
  'with',
  'experience',
  'skills',
  'education',
  'responsible',
  'managed',
  'work',
  'worked',
  'team',
  'customer',
  'customers',
  'university',
  'present',
  'english',
  'sales',
  'company',
  'developed',
  'project',
  'projects',
  'my',
  'at',
  'as',
  'on',
  'from',
  'years',
  'using',
  'handled',
  'is',
]);

function countLetters(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

function detectEnglish(lines: CvLine[], letters: number): boolean {
  if (letters === 0) return false;
  let toned = 0;
  let tokens = 0;
  let english = 0;
  for (const line of lines) {
    for (let i = 0; i < line.text.length; i += 1) {
      const c = line.text.charAt(i);
      if (/\p{L}/u.test(c) && !/[a-zA-Z]/.test(c) && /[a-z]/.test(line.folded.charAt(i))) toned += 1;
    }
    for (const w of line.folded.split(/[^a-z]+/)) {
      if (w.length === 0) continue;
      tokens += 1;
      if (EN_WORDS.has(w)) english += 1;
    }
  }
  return toned / letters < 0.01 && tokens > 0 && english / tokens >= 0.06;
}

/** Splits a CV into cleaned lines with folded twins and the section each line belongs to. */
export function buildCvDoc(cvText: string): CvDoc {
  let section: SectionKind = 'none';
  const lines: CvLine[] = splitRawLines(cvText).map((text, index) => {
    const folded = foldClean(text);
    const header = detectHeader(folded);
    if (header) section = header.kind;
    return { index, text, folded, section, isHeader: header !== null && !header.inline };
  });
  const letterCount = countLetters(lines.map((l) => l.text).join(' '));
  return { lines, letterCount, isEnglish: detectEnglish(lines, letterCount) };
}
