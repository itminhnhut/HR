/**
 * Fallback for tools and certificates the dictionary does not know: "Biết sử dụng phần mềm KiotViet",
 * "Có chứng chỉ vận hành xe nâng". The name is searched word for word; absence gives "unknown", because the CV
 * may spell it differently.
 */
import { result, type AtomResult, type LiteralAtom } from './atoms.js';
import { cleanLine, foldClean, type CvDoc } from './normalize.js';
import { classify } from './skills.js';
import { findTerm, snippet } from './text-match.js';

const VERB =
  /\b(biet su dung|biet dung|co the su dung|su dung duoc|su dung thanh thao|su dung tot|su dung|thanh thao|nam vung|lam viec voi|biet|co|know|use|using|proficient in|experience with|familiar with|knowledge of)\b\s*/;
const OBJECT_STOP = /[,;.()]|\s(?:va|de|trong|for|and|to)\s/;
const CERTIFICATE = /^(chung chi|bang|giay phep|the)\b/;

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

/** Literal verdict: found → met; negated or only wished for → unmet; not found → unknown. */
export function evaluateLiteral(atom: LiteralAtom, doc: CvDoc): AtomResult {
  let weak: AtomResult | null = null;
  for (const line of doc.lines) {
    for (const span of findTerm(line.folded, atom.term)) {
      const cls = classify(line, span);
      if (cls === 'ok') return result('met', `CV có ${atom.label}`, snippet(line, span));
      if (cls === 'negated' || cls === 'weak') {
        weak = weak ?? result('unmet', `CV chỉ nhắc ${atom.label} ở dạng chưa biết / muốn học`, snippet(line, span));
      }
    }
  }
  return weak ?? result('unknown', `Không thấy "${atom.label}" trong CV (có thể ghi tên khác), HR xem trực tiếp`);
}
