import { escapeHtml } from '../news/render.js';
import { MAIL_COMPANY } from './company.js';
import { interviewPartsOf } from './details.js';
import type { MailDetails } from './types.js';

const LINK_STYLE = 'color:#C8102E;font-weight:bold;text-decoration:none;';
/** The only texts that ever become links in HR's wording. HR cannot write HTML or other links. */
const AUTOLINKS: Record<string, string> = {
  [MAIL_COMPANY.careersSite]: MAIL_COMPANY.careersUrl,
  [MAIL_COMPANY.website]: `https://${MAIL_COMPANY.website}`,
};
/** Phrases HR's designs stress in the default wording. */
const STRESSED_PHRASES = ['phản hồi email này trong vòng 24 giờ', 'phản hồi email này', 'vượt qua vòng sàng lọc'];

const quoteRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Longest first, so "Ms. Lan – 0909" wins over "Lan". */
const alternatives = (texts: string[]) =>
  [...texts]
    .sort((a, b) => b.length - a.length)
    .map(quoteRegex)
    .join('|');

/** The values in bold wherever they appear in a text. */
function boldTexts(details: MailDetails): string[] {
  const hrName = details.hrName.trim();
  const hrPhone = details.hrPhone.trim();
  const contact = hrName && hrPhone ? [`Ms. ${hrName} – ${hrPhone}`, `${hrName} – ${hrPhone}`] : [];
  const values = [details.candidateName, details.jobTitle, interviewPartsOf(details)?.date ?? '', hrName];
  return [...new Set([...contact, ...values.map((v) => v.trim()), ...STRESSED_PHRASES])].filter(Boolean);
}

function highlightPattern(details: MailDetails): RegExp {
  // Whole words only ("An" in "Anh" is not the name), and never part of an email or a longer domain.
  const links = `(?<![\\p{L}\\p{N}@./-])(?:${alternatives(Object.keys(AUTOLINKS))})(?![\\p{L}\\p{N}/@-]|\\.\\p{L})`;
  const bold = `(?<![\\p{L}\\p{N}])(?:${alternatives(boldTexts(details))})(?![\\p{L}\\p{N}])`;
  return new RegExp(`${links}|${bold}`, 'gu');
}

function highlighted(match: string): string {
  // A name like "constructor" is a key of every object, not of the links.
  const href = Object.hasOwn(AUTOLINKS, match) ? AUTOLINKS[match] : undefined;
  const safe = escapeHtml(match);
  return href ? `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${safe}</a>` : `<b>${safe}</b>`;
}

/**
 * One piece of text as HTML: everything escaped, the known values bold. Matching runs on the raw text and every
 * piece is escaped afterwards, so a value can never match inside an entity such as "&amp;".
 */
function inlineHtml(text: string, pattern: RegExp): string {
  const pieces: string[] = [];
  let last = 0;
  for (const found of text.matchAll(pattern)) {
    pieces.push(escapeHtml(text.slice(last, found.index)), highlighted(found[0]));
    last = found.index + found[0].length;
  }
  pieces.push(escapeHtml(text.slice(last)));
  return pieces.join('').replace(/\n/g, '<br>');
}

/** A blank line starts a new paragraph. */
export const splitParagraphs = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n[^\S\n]*\n\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

export interface TextStyle {
  /** Space under each paragraph, in px. */
  gap: number;
}

/** `<p>` per paragraph; the last one has no space under it, unless more text follows (`trailingGap`). */
export function paragraphsHtml(text: string, details: MailDetails, style: TextStyle, trailingGap = false): string {
  const pattern = highlightPattern(details);
  const paragraphs = splitParagraphs(text);
  return paragraphs
    .map((p, i) => {
      const margin = i < paragraphs.length - 1 || trailingGap ? `margin:0 0 ${style.gap}px;` : 'margin:0;';
      return `<p style="${margin}">${inlineHtml(p, pattern)}</p>`;
    })
    .join('\n  ');
}

/** Each paragraph on its own, for places where a `<p>` cannot follow a title on the next line, such as the callout box. */
export function blocksHtml(text: string, details: MailDetails): string[] {
  const pattern = highlightPattern(details);
  return splitParagraphs(text).map((p) => inlineHtml(p, pattern));
}
