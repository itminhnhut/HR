/**
 * Driving licences ("bằng lái B2", "GPLX hạng C", "Driving licence: B"). A higher car class covers a lower one.
 */
import { result, type AtomResult, type LicenseAtom } from './atoms.js';
import type { CvDoc, CvLine } from './normalize.js';
import { isNegatedAt, snippet } from './text-match.js';

const CAR_CLASSES = ['b1', 'b', 'b2', 'c1', 'c', 'd1', 'd2', 'd', 'e', 'f'];
const MOTORBIKE_CLASSES = ['a1', 'a', 'a2'];

const REQ_TRIGGER =
  /\b(bang lai|gplx|giay phep lai xe|driving licen[cs]e|driver'?s? licen[cs]e|biet lai xe|lai xe (?:o to|oto|may|tai)|bang (?:a1|a2|b1|b2|c|d|e)|hang (?:a1|a2|b1|b2|b|c|d|e))\b/;
const DRIVING_CONTEXT = /\b(lai|xe|gplx|licen[cs]e|driv\w*|o to)\b/;
const CLASS_RE =
  /\b(?:bang lai(?: xe)?(?: o to| may)?|gplx|giay phep lai xe|bang|hang|licen[cs]e|class)\s*(?:lai xe\s*)?(?:o to\s*)?(?:hang\s*)?:?\s*(a1|a2|b1|b2|c1|d1|d2|[abcdef])\b(?!\s*(?:anh|tieng|tin hoc|ngoai ngu|english))/g;
const ANY_LICENSE =
  /\b(bang lai|gplx|giay phep lai xe|driving licen[cs]e|driver'?s? licen[cs]e|biet lai xe|lai xe o to|lai xe may)\b/;

function normalizeClass(c: string): string {
  return c.startsWith('f') ? 'f' : c;
}

function vehicleOf(cls: string | null, folded: string): LicenseAtom['vehicle'] {
  if (cls) return cls.startsWith('a') ? 'motorbike' : 'car';
  if (/\bxe may\b|\bmotorbike\b|\bmotorcycle\b/.test(folded)) return 'motorbike';
  return /\b(o to|oto|xe hoi|car|xe tai)\b/.test(folded) ? 'car' : 'any';
}

function classesIn(folded: string): string[] {
  CLASS_RE.lastIndex = 0;
  const out: string[] = [];
  for (let m = CLASS_RE.exec(folded); m; m = CLASS_RE.exec(folded)) out.push(normalizeClass(m[1]));
  return out;
}

function rank(cls: string): number {
  const car = CAR_CLASSES.indexOf(cls);
  return car >= 0 ? car : MOTORBIKE_CLASSES.indexOf(cls);
}

/** Licence atom of a requirement line, or null. */
export function parseLicenseRequirement(folded: string): LicenseAtom | null {
  if (!REQ_TRIGGER.test(folded)) return null;
  const classes = classesIn(folded).sort((a, b) => rank(a) - rank(b));
  const licenseClass = classes[0] ?? null;
  return { kind: 'license', licenseClass, vehicle: vehicleOf(licenseClass, folded) };
}

interface CvLicense {
  cls: string | null;
  vehicle: LicenseAtom['vehicle'];
  line: CvLine;
}

function cvLicenses(doc: CvDoc): CvLicense[] {
  const out: CvLicense[] = [];
  for (const line of doc.lines) {
    if (!DRIVING_CONTEXT.test(line.folded) || line.section === 'interests') continue;
    const any = ANY_LICENSE.exec(line.folded);
    if (any && isNegatedAt(line.folded, any.index)) continue;
    const classes = classesIn(line.folded);
    for (const cls of classes) out.push({ cls, vehicle: vehicleOf(cls, line.folded), line });
    if (classes.length === 0 && any) out.push({ cls: null, vehicle: vehicleOf(null, line.folded), line });
  }
  return out;
}

function covers(have: string, want: string): boolean {
  const sameTrack =
    (CAR_CLASSES.includes(have) && CAR_CLASSES.includes(want)) ||
    (MOTORBIKE_CLASSES.includes(have) && MOTORBIKE_CLASSES.includes(want));
  return sameTrack && rank(have) >= rank(want);
}

function classVerdict(atom: LicenseAtom, want: string, list: CvLicense[]): AtomResult {
  const label = `bằng lái ${want.toUpperCase()}`;
  const ok = list.find((l) => l.cls !== null && covers(l.cls, want));
  if (ok) return result('met', `CV ghi bằng lái ${ok.cls?.toUpperCase()}, yêu cầu ${label}`, snippet(ok.line));
  const lower = list.find((l) => l.cls !== null && l.vehicle === atom.vehicle);
  if (lower)
    return result('unmet', `CV ghi bằng lái ${lower.cls?.toUpperCase()}, yêu cầu ${label}`, snippet(lower.line));
  const vague = list.find((l) => l.cls === null);
  if (vague) return result('unknown', `CV có nhắc bằng lái nhưng không rõ hạng, yêu cầu ${label}`, snippet(vague.line));
  if (list.length > 0) {
    const have = list.map((l) => l.cls?.toUpperCase()).join(', ');
    return result('unmet', `CV chỉ ghi bằng lái ${have}, yêu cầu ${label}`, snippet(list[0].line));
  }
  if (atom.vehicle === 'motorbike') return result('unknown', `CV thường không ghi ${label}, HR hỏi khi phỏng vấn`);
  return result('unmet', `Không thấy ${label} trong CV`);
}

/** Driving licence verdict. */
export function evaluateLicense(atom: LicenseAtom, doc: CvDoc): AtomResult {
  const list = cvLicenses(doc);
  if (atom.licenseClass) return classVerdict(atom, atom.licenseClass, list);
  const fit = list.find((l) => atom.vehicle === 'any' || l.vehicle === atom.vehicle);
  if (fit) return result('met', 'CV có bằng lái xe', snippet(fit.line));
  if (list.length > 0) return result('unknown', 'CV có nhắc bằng lái nhưng không rõ loại xe', snippet(list[0].line));
  if (atom.vehicle === 'motorbike')
    return result('unknown', 'CV thường không ghi bằng lái xe máy, HR hỏi khi phỏng vấn');
  return result('unmet', 'Không thấy bằng lái xe trong CV');
}
