/**
 * "Có thể đi làm ngay" / "available immediately" versus a notice period stated in the CV.
 */
import { result, type AtomResult, type AvailabilityAtom } from './atoms.js';
import type { CvDoc } from './normalize.js';
import { clauseBefore, snippet } from './text-match.js';

const REQ =
  /\b(di lam ngay|nhan viec ngay|bat dau (?:lam viec |lam )?ngay|start immediately|available immediately|immediate start)\b/;
const CV_NOW =
  /\b(di lam ngay|nhan viec ngay|bat dau (?:lam viec |lam )?ngay|start immediately|available immediately|immediately available|immediate start|san sang (?:di lam|lam viec) ngay)\b/;
const CV_LATER =
  /\b(notice period|thoi gian bao truoc|bao truoc \d+|can (?:\d+ (?:ngay|tuan|thang) (?:de )?)?ban giao|available from|co the di lam tu|di lam sau|sau \d+ (?:ngay|tuan|thang))\b/;
const NEGATION = /\b(chua the|khong the|chua|cannot|not)\s*$/;

export function parseAvailabilityRequirement(folded: string): AvailabilityAtom | null {
  return REQ.test(folded) ? { kind: 'availability' } : null;
}

/** Availability verdict: met on an explicit "đi làm ngay", unmet on a notice period, unknown otherwise. */
export function evaluateAvailability(doc: CvDoc): AtomResult {
  for (const line of doc.lines) {
    const now = CV_NOW.exec(line.folded);
    if (now && !NEGATION.test(clauseBefore(line.folded, now.index, 3))) {
      return result(
        'met',
        'CV ghi có thể đi làm ngay',
        snippet(line, { start: now.index, end: now.index + now[0].length }),
      );
    }
  }
  const later = doc.lines.find((l) => CV_LATER.test(l.folded) || CV_NOW.test(l.folded));
  if (later) return result('unmet', 'CV ghi cần thời gian báo trước / chưa đi làm ngay được', snippet(later));
  return result('unknown', 'CV không ghi thời gian có thể đi làm, HR hỏi khi phỏng vấn');
}
