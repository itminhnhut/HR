/**
 * Keyword lists: one line of many short items outside the work history, the shape of a job ad pasted into a CV. Only
 * long lists are questioned, because a few tools under "Kỹ năng" is how honest CVs are written, and a long list stands
 * when the work or education shows some of its items (see `unbackedLists` in skills.ts).
 */
import { findRanges } from './dates.js';
import { withoutOtherPeople } from './experience-jobs.js';
import type { CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';
import { hasTerm } from './text-match.js';

/** Measured on simulated honest lists: fewer items cost honest candidates more and caught no more keyword dumps. */
const MIN_LIST_ITEMS = 8;
/** Longer items on average are sentences, a job described in a run of clauses. */
const MAX_WORDS_PER_ITEM = 5;
/** One item in the work can be chance (data entry "vào Excel"); two show the list belongs to the person. */
const MIN_ITEMS_SHOWN = 2;

/** Certificates and projects are lists by nature, and work and education lines are judged on their own. */
const LIST_SECTIONS: ReadonlySet<SectionKind> = new Set(['none', 'skills', 'summary', 'other']);

/** Words of a list item that say nothing about which work it is. */
const FILLER_WORDS = new Set(
  (
    'va voi cac cua cho tai trong tren co la nam kinh nghiem ky nang tot biet su dung thanh thao ' +
    'and or the of with in'
  ).split(' '),
);

function listItems(folded: string): string[] {
  return folded
    .replace(/^[-*+>\s]+/, '')
    .replace(/^[^:,;]{0,30}:/, '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter((item) => /[a-z0-9]/.test(item));
}

/** A range still running; `findRanges` only reads those with today's date, which this module has no need of. */
const RUNNING_RANGE = /\d{4}\s*(?:-|~|den|to)\s*(?:den\s+)?(?:nay|hien tai|hien nay|present|now|current)\b/;

function hasDateRange(folded: string): boolean {
  return RUNNING_RANGE.test(folded) || findRanges(folded, null).length > 0;
}

/** Many short items, and no date range: a dated line is a job the work history could not read, not a list. */
export function isKeywordList(line: CvLine): boolean {
  if (line.isHeader || !LIST_SECTIONS.has(line.section)) return false;
  const items = listItems(line.folded);
  if (items.length < MIN_LIST_ITEMS || hasDateRange(line.folded)) return false;
  const words = items.reduce((sum, item) => sum + item.split(/\s+/).length, 0);
  return words <= items.length * MAX_WORDS_PER_ITEM;
}

/** The line is part of a job, which `work` holds without mentions of other people's work. */
export function isInWork(line: CvLine, work: string): boolean {
  return work.includes(withoutOtherPeople(line.folded));
}

/** `text` without these lines, so that a list cannot back itself. */
export function withoutLines(text: string, lines: readonly CvLine[]): string {
  return lines.reduce((rest, line) => rest.split(line.folded).join(' '), text);
}

function isItemShown(item: string, text: string): boolean {
  const words = (item.match(/[a-z0-9+#&]+/g) ?? []).filter((word) => !FILLER_WORDS.has(word));
  if (words.length === 1) return hasTerm(text, words[0] ?? '');
  return words.slice(0, -1).some((word, i) => hasTerm(text, `${word} ${words[i + 1] ?? ''}`));
}

/** Enough items of the list, word for word or by a pair of their words, appear in `text`. */
export function isListShownIn(line: CvLine, text: string): boolean {
  return listItems(line.folded).filter((item) => isItemShown(item, text)).length >= MIN_ITEMS_SHOWN;
}
