/**
 * Judges an education requirement (level and optional major) against the CV's education entries.
 */
import { result, type AtomResult, type EducationAtom } from './atoms.js';
import {
  cvMajorLabel,
  cvMajors,
  highestCompleted,
  LEVEL_NAMES,
  majorMatches,
  type EducationEntry,
} from './education.js';
import { hasAnyTerm, snippet } from './text-match.js';

function levelVerdict(atom: EducationAtom, entries: readonly EducationEntry[]): AtomResult | null {
  if (atom.minLevel === null) return null;
  const wanted = `${LEVEL_NAMES[atom.minLevel]} trở lên`;
  if (entries.length === 0) return result('unknown', `CV không ghi rõ học vấn, yêu cầu ${wanted}`);
  const best = highestCompleted(entries);
  const bestLevel = best === null ? 0 : best === 'implied-thpt' ? 1 : best.level;
  if (best !== null && bestLevel >= atom.minLevel) {
    const evidence = best === 'implied-thpt' ? snippet(entries[0].line) : snippet(best.line);
    return result(
      'met',
      `CV ghi ${LEVEL_NAMES[best === 'implied-thpt' ? 1 : best.level]}, yêu cầu ${wanted}`,
      evidence,
    );
  }
  const studying = entries.find((e) => !e.completed && e.level >= (atom.minLevel ?? 1));
  if (studying) {
    return result(
      'unmet',
      `CV ghi đang học ${LEVEL_NAMES[studying.level]} (chưa tốt nghiệp), yêu cầu ${wanted}`,
      snippet(studying.line),
    );
  }
  const top = [...entries].sort((a, b) => b.level - a.level)[0];
  return result('unmet', `CV ghi ${LEVEL_NAMES[top.level]}, yêu cầu ${wanted}`, snippet(top.line));
}

function majorVerdict(atom: EducationAtom, entries: readonly EducationEntry[]): AtomResult | null {
  if (atom.majors.length === 0) return null;
  const wanted = atom.majorLabels.join(', ');
  const written = cvMajors(entries);
  const hit = entries.find((e) => cvMajors([e]).some((m) => atom.majors.some((w) => majorMatches(m, w))));
  if (hit) return result('met', `Đúng chuyên ngành ${wanted}`, snippet(hit.line));
  if (written.length > 0) {
    const evidence = snippet(entries.find((e) => cvMajors([e]).length > 0)?.line ?? entries[0].line);
    if (atom.majorRelatedOnly) {
      return result(
        'unknown',
        `CV ghi ngành ${cvMajorLabel(entries, written[0])}, HR xem có phải ngành liên quan đến ${wanted} không`,
        evidence,
      );
    }
    return result('unmet', `CV ghi ngành ${cvMajorLabel(entries, written[0])}, yêu cầu ngành ${wanted}`, evidence);
  }
  const loose = entries.find((e) => hasAnyTerm(e.folded, atom.majors));
  if (loose)
    return result(
      'unknown',
      `CV không ghi rõ chuyên ngành (có nhắc "${wanted}" trong tên trường/bằng)`,
      snippet(loose.line),
    );
  return result('unknown', `CV không ghi rõ chuyên ngành, yêu cầu ngành ${wanted}`);
}

/** Education requirement verdict: level first, then major; any unmet part makes the whole unmet. */
export function evaluateEducation(atom: EducationAtom, entries: readonly EducationEntry[]): AtomResult {
  const level = levelVerdict(atom, entries);
  const major = majorVerdict(atom, entries);
  const parts = [level, major].filter((p): p is AtomResult => p !== null);
  if (parts.length === 0) return result('unknown', 'Không rõ yêu cầu học vấn');
  const unmet = parts.find((p) => p.verdict === 'unmet');
  if (unmet) return unmet;
  const unknown = parts.find((p) => p.verdict === 'unknown');
  if (unknown) return unknown;
  return result('met', parts.map((p) => p.reason).join('; '), parts[0].evidence);
}
