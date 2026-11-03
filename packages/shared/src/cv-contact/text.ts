/**
 * Text clean-up for contact extraction. Unlike the CV matcher, runs of spaces are kept inside a line
 * (letter-spaced headers use them as word gaps) and zero-width characters are removed, not turned into spaces.
 */
import { detectHeader } from '../cv-match/sections.js';
import { repairIsolatedAccents } from './glyph-repair.js';

export type ContactSection = 'top' | 'contact' | 'work' | 'reference' | 'other';

export interface ContactLine {
  index: number;
  /** Trimmed line; inner runs of spaces kept. */
  text: string;
  /** Same length as `text`: lowercase, no tones, đ→d. */
  folded: string;
  section: ContactSection;
  isHeading: boolean;
}

const ZERO_WIDTH = /[­​-‍⁠﻿]/g;
const SPACES = /[   -   　\f\v]/g;
const DASHES = /[‐-―−﹘﹣]/g;
const EXTRA_REFERENCE =
  /^(?:\d+[.)]\s*)?(?:nguoi tham chieu|tham chieu|nguoi gioi thieu|nguoi xac nhan|referees?|references?|reference persons?)\b/;
/** Whole-line headings of a block about other people; "Tham khảo: chị Lan – 09…" inline is judged line by line. */
const OTHER_PEOPLE_HEADING =
  /^(?:\d+[.)]\s*)?(?:nguoi tham khao|tham khao|quan he gia dinh|hoan canh gia dinh|thong tin gia dinh|gia dinh|family background|family members?|family|lien he khan cap|emergency contacts?)$/;
/** Headings the shared CV matcher does not need to tell apart, but a name or section reader does. */
const EXTRA_CONTACT_HEADING =
  /^(?:thong tin lien lac|lien he voi toi|lien lac|contact details|contact info|get in touch)$/;
const EXTRA_OTHER_HEADING = /^(?:nang luc|nang luc chuyen mon|ky nang noi bat|strengths|qualifications)$/;
/** Icon fonts put their glyphs in the Private Use Area; they carry no text. */
const PRIVATE_USE = /[\uE000-\uF8FF]/g;
/** Typographic ligatures some PDF writers keep as one character: "ﬁnance" → "finance". */
const LIGATURES: Record<string, string> = { ﬀ: 'ff', ﬁ: 'fi', ﬂ: 'fl', ﬃ: 'ffi', ﬄ: 'ffl', ﬅ: 'st', ﬆ: 'st' };
/** Chrome's PDF text layer cuts a ligature out of its word: "certi fi cate", "O ffi ce", "   fi les". */
const SPLIT_LIGATURE = /(^|\s|[\p{L}\d._-] )(ffi|ffl|fi|fl|ff) (?=[\p{L}\d])/gu;

/** Splits a whitespace-separated word list written as a template literal. */
export function wordList(text: string): string[] {
  return text.trim().split(/\s+/);
}

/** Old VNI/TCVN3 fonts read as Latin-1 ("Ñieän thoaïi", "§iÖn tho¹i", "NguyÔn ThÞ"): no Vietnamese word has these. */
const LEGACY_FONT_WORD = /[\p{L}][ñïøöäëÞÖµ¹¸¶ð]|[§Ñ]\p{L}/gu;
const MIN_LEGACY_WORDS = 2;

/** True when the text uses an old font encoding, so any name read from it would be garbage. */
export function isLegacyEncoded(text: string): boolean {
  return (text.match(LEGACY_FONT_WORD) ?? []).length >= MIN_LEGACY_WORDS;
}

function fromFullwidth(text: string): string {
  return text.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** NFC, fullwidth → ASCII, invisible characters removed, exotic spaces/dashes unified, tabs → column gaps. */
export function normalizeCvText(text: string): string {
  return fromFullwidth(text.normalize('NFC'))
    .replace(/\r\n?/g, '\n')
    .replace(ZERO_WIDTH, '')
    .replace(PRIVATE_USE, ' ')
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(SPLIT_LIGATURE, (_m: string, before: string, part: string) => before.replace(/(\S) $/, '$1') + part)
    .replace(SPACES, ' ')
    .replace(/\t/g, '   ')
    .replace(DASHES, '-')
    .normalize('NFC');
}

function foldChar(c: string): string {
  if (c === 'đ' || c === 'Đ') return 'd';
  const base = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return base.length > 0 ? base.charAt(0) : ' ';
}

/** Lowercase, tone-free twin of `text` with exactly the same length (indexes line up). */
export function fold(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) out += foldChar(text.charAt(i));
  return out;
}

/** True when the text carries any Vietnamese tone or vowel mark (or đ). */
export function hasDiacritics(text: string): boolean {
  return fold(text) !== text.toLowerCase();
}

function extraSection(folded: string): ContactSection | null {
  const bare = folded.replace(/^[\s\-*+>#.•]+/, '').replace(/[\s:.\-]+$/, '');
  if (EXTRA_REFERENCE.test(bare) || OTHER_PEOPLE_HEADING.test(bare)) return 'reference';
  if (EXTRA_CONTACT_HEADING.test(bare)) return 'contact';
  return EXTRA_OTHER_HEADING.test(bare) ? 'other' : null;
}

function sectionOf(folded: string): ContactSection | null {
  const extra = extraSection(folded);
  if (extra) return extra;
  const header = detectHeader(folded);
  if (!header) return null;
  switch (header.kind) {
    case 'references':
      return 'reference';
    case 'personal':
      return 'contact';
    case 'experience':
    case 'projects':
    case 'activities':
      return 'work';
    default:
      return 'other';
  }
}

function isShortHeading(folded: string): boolean {
  return folded.length <= 60 && !/\d|@/.test(folded);
}

/** Splits normalized CV text into non-empty lines, each tagged with the section it sits in. */
export function toContactLines(text: string): ContactLine[] {
  let section: ContactSection = 'top';
  const lines: ContactLine[] = [];
  for (const raw of normalizeCvText(text).split('\n')) {
    const trimmed = repairIsolatedAccents(raw.trim());
    if (trimmed.length === 0) continue;
    const folded = fold(trimmed);
    const kind = sectionOf(folded);
    const isInline = /:\s*\S/.test(folded);
    // "Liên hệ: 0912…" is a contact field on its own line, not a new section: work history goes on after it.
    if (kind && !(kind === 'contact' && isInline)) section = kind;
    const isHeading = kind !== null && isShortHeading(folded) && !isInline;
    lines.push({ index: lines.length, text: trimmed, folded, section, isHeading });
  }
  return lines;
}
