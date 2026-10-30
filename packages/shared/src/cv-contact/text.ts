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

/** Splits a whitespace-separated word list written as a template literal. */
export function wordList(text: string): string[] {
  return text.trim().split(/\s+/);
}

function fromFullwidth(text: string): string {
  return text.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** NFC, fullwidth → ASCII, invisible characters removed, exotic spaces/dashes unified, tabs → column gaps. */
export function normalizeCvText(text: string): string {
  return fromFullwidth(text.normalize('NFC'))
    .replace(/\r\n?/g, '\n')
    .replace(ZERO_WIDTH, '')
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

function sectionOf(folded: string): ContactSection | null {
  if (EXTRA_REFERENCE.test(folded.replace(/^[\s\-*+>#.•]+/, ''))) return 'reference';
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
    if (kind) section = kind;
    const isHeading = kind !== null && isShortHeading(folded) && !/:\s*\S/.test(folded);
    lines.push({ index: lines.length, text: trimmed, folded, section, isHeading });
  }
  return lines;
}
