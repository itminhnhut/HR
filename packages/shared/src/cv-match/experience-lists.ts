/**
 * Keyword lists with nothing behind them, for the facts a list can claim outright: years, licences, languages. Same
 * rule as skills: such a list does not show a fact, and it does not rule one out either. The evaluators take the fact
 * from the rest of the CV, and when only the list states it the line stays open and counted.
 */
import { isKeywordList, isListShownIn } from './keyword-list.js';
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';

export const LIST_ONLY_REASON = 'Chỉ thấy trong danh sách từ khoá, công việc trong CV không thể hiện, HR xem thêm';

/** A line calling itself keywords is a list however it is punctuated ("Tags: Photoshop Illustrator …"). */
const LABELLED_LIST = /^[\s\-*+>]*(?:tags?|keywords?|tu khoa)\b[^:]{0,20}:/;
/** A list is not backed by other lists of words: only work, study and what stands outside any section. */
const NOT_BACKING: ReadonlySet<SectionKind> = new Set(['skills', 'objective', 'interests', 'references', 'personal']);

function isList(line: CvLine): boolean {
  return !line.isHeader && (isKeywordList(line) || LABELLED_LIST.test(line.folded));
}

/** The keyword lists of the CV of which the rest of the CV shows nothing. */
export function unbackedLists(doc: CvDoc): CvLine[] {
  const lists = doc.lines.filter(isList);
  if (lists.length === 0) return [];
  const rest = doc.lines
    .filter((l) => !lists.includes(l) && !l.isHeader && !NOT_BACKING.has(l.section))
    .map((l) => l.folded)
    .join(' \n ');
  return lists.filter((l) => !isListShownIn(l, rest));
}

/** The CV with these lines emptied; positions stay, because readers look at the line after a mention. */
export function withoutListLines(doc: CvDoc, lists: readonly CvLine[]): CvDoc {
  if (lists.length === 0) return doc;
  const emptied = new Set(lists.map((l) => l.index));
  const lines = doc.lines.map((l) => (emptied.has(l.index) ? { ...l, text: '', folded: '' } : l));
  return { ...doc, lines };
}
