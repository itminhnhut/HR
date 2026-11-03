/**
 * Fallback for tools and certificates the dictionary does not know: "Biết sử dụng phần mềm KiotViet",
 * "Có chứng chỉ vận hành xe nâng". The name is searched word for word. Absence from a CV with a real work history
 * means not met; a CV that shows little stays open, because it may simply not list such things.
 */
import { result, type AtomResult, type LiteralAtom } from './atoms.js';
import { cleanLine, foldClean, type CvDoc, type CvLine } from './normalize.js';
import { classify } from './skills.js';
import { findTerm, snippet, type Span } from './text-match.js';

const VERB =
  /\b(biet su dung|biet dung|co the su dung|su dung duoc|su dung thanh thao|su dung tot|su dung|thanh thao|nam vung|lam viec voi|biet|co|know|use|using|proficient in|experience with|familiar with|knowledge of)\b\s*/;
const OBJECT_STOP = /[,;.()]|\s(?:va|de|trong|for|and|to|hoac|or)\s/;
const CERTIFICATE = /^(chung chi|chung nhan|bang|giay phep|the(?! (?:tang|lam|di|nhan|dam|hien)))\b/;

function objectOf(clean: string, folded: string): { text: string; folded: string } | null {
  const verb = VERB.exec(folded);
  if (!verb) return null;
  const start = verb.index + verb[0].length;
  const rest = folded.slice(start);
  const stop = OBJECT_STOP.exec(rest);
  const end = start + (stop ? stop.index : rest.length);
  return { text: clean.slice(start, end).trim(), folded: folded.slice(start, end).trim() };
}

/** First run of capitalised words ("Power BI", "KiotViet"): a product name. */
function productName(text: string): string | null {
  const tokens = text.split(/\s+/);
  const first = tokens.findIndex((t) => /\p{Lu}/u.test(t) && /[\p{L}\d]{2,}/u.test(t));
  if (first < 0) return null;
  let last = first;
  while (last + 1 < tokens.length && /\p{Lu}|\d/u.test(tokens[last + 1])) last += 1;
  return tokens.slice(first, last + 1).join(' ');
}

/** Literal atom of a requirement line that matched nothing else, or null. */
export function parseLiteralRequirement(line: string): LiteralAtom | null {
  const clean = cleanLine(line);
  const object = objectOf(clean, foldClean(clean));
  if (!object || object.folded.length < 2) return null;
  const name = productName(object.text);
  if (name) return { kind: 'literal', term: foldClean(name), label: name };
  if (!CERTIFICATE.test(object.folded) || object.folded.split(' ').length < 3) return null;
  const words = object.text.split(/\s+/).slice(0, 6).join(' ');
  return { kind: 'literal', term: foldClean(words), label: words };
}

/** All the words of the name on one line ("thẻ hướng dẫn viên du lịch quốc tế" for "thẻ hướng dẫn viên quốc tế"). */
function wordsOnLine(folded: string, term: string): Span | null {
  const words = term.split(' ').filter((w) => w.length > 0);
  if (words.length < 3) return null;
  const hits = words.map((w) => findTerm(folded, w)[0]);
  if (hits.some((h) => h === undefined)) return null;
  const first = hits[0];
  return first ?? null;
}

function spansOf(line: CvLine, term: string): Span[] {
  const exact = findTerm(line.folded, term);
  if (exact.length > 0) return exact;
  const loose = wordsOnLine(line.folded, term);
  return loose ? [loose] : [];
}

/** Literal verdict: found → met; negated or only wished for → unmet; not found → unmet or unknown (see above). */
export function evaluateLiteral(atom: LiteralAtom, doc: CvDoc, hasWorkHistory: boolean): AtomResult {
  let weak: AtomResult | null = null;
  for (const line of doc.lines) {
    for (const span of spansOf(line, atom.term)) {
      const cls = classify(line, span);
      if (cls === 'ok' || cls === 'basic') return result('met', `CV có ${atom.label}`, snippet(line, span));
      if (cls === 'negated' || cls === 'weak') {
        weak = weak ?? result('unmet', `CV chỉ nhắc ${atom.label} ở dạng chưa biết / muốn học`, snippet(line, span));
      }
    }
  }
  if (weak) return weak;
  if (hasWorkHistory) return result('unmet', `Không thấy "${atom.label}" trong CV`);
  return result('unknown', `Không thấy "${atom.label}" trong CV (có thể ghi tên khác), HR xem trực tiếp`);
}
