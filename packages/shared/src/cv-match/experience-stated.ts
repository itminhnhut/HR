/**
 * Durations a CV states in words: "3 năm kinh nghiệm", "Ba năm kinh nghiệm phụ bếp", "Over ten years of experience",
 * "18 tháng bán hàng tại…", "lái xe tải 5 năm". Not the company's years ("công ty có hơn 20 năm kinh nghiệm"), nor a
 * warranty ("bảo hành 5 năm").
 */
import type { CvDoc, CvLine } from './normalize.js';
import type { SectionKind } from './sections.js';
import type { Span } from './text-match.js';

export interface StatedYears {
  months: number;
  line: CvLine;
  span: Span;
  /** Folded words around the statement ("… kinh nghiệm bán hàng tại …"), used to match a field. */
  tail: string;
}

const SKIPPED: ReadonlySet<SectionKind> = new Set([
  'education',
  'objective',
  'interests',
  'references',
  'personal',
  'certificates',
]);
const NUMBER =
  '(\\d+(?:[.,]\\d+)?|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|one|two|three|four|five|six|seven|eight|nine|ten|nua)';
const QUALIFIER = '(?:(hon|tren|gan|khoang|over|more than|nearly|almost|about|around)\\s+)?';
const UNIT = '(nam|years?|yrs?|thang|months?)';
const WORDS: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
  muoi: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  nua: 0.5,
};
const CLAIM_RES = [
  new RegExp(
    `(?<![a-z])${QUALIFIER}${NUMBER}\\s*\\+?\\s*${UNIT}\\s*\\+?\\s*(?:kinh nghiem|of (?:professional |work |relevant )?experience|experience)`,
    'g',
  ),
  new RegExp(`kinh nghiem(?: lam viec)?\\s*:\\s*${QUALIFIER}${NUMBER}\\s*\\+?\\s*${UNIT}`, 'g'),
];
/** "Gần 2 năm làm lễ tân", "- 18 tháng bán hàng", "Đã làm 4 năm tại vị trí trên": a line opening with a duration. */
const OPENING_DURATION = new RegExp(
  `^(?:[-*+]\\s*)?(?:da lam\\s+|da co\\s+)?${QUALIFIER}(\\d+(?:[.,]\\d+)?)\\s*${UNIT}\\s+(?=[a-z])`,
);
/** "lái xe tải 5 năm": a short phrase ending in a duration. */
const CLOSING_DURATION = new RegExp(
  `^([a-z ]{3,40}?)\\s+${QUALIFIER}(\\d+(?:[.,]\\d+)?)\\s*${UNIT}(?:\\s+tai\\s[a-z ]+)?$`,
);
const NOT_A_JOB = /\b(bao hanh|hop dong|bao tri|thoi han|tuoi|cach day|sau|truoc|gan day|du kien)\b/;
const OTHERS_YEARS =
  /\b(cong ty|doanh nghiep|tap doan|chung toi|nha may|thuong hieu|don vi|to chuc|the company|our company|we have)\b[^,;.]*$/;
const NOT_A_CLAIM = /\b(yeu cau|toi thieu|required|mong muon|muc tieu|tim kiem)\b/;

function toMonths(qualifier: string | undefined, value: string, unit: string): number {
  const n = WORDS[value] ?? Number(value.replace(',', '.'));
  const months = /^(thang|month)/.test(unit) ? n : n * 12;
  // "gần 2 năm" / "almost 2 years" is a bit less than stated.
  return qualifier && /^(gan|nearly|almost)$/.test(qualifier) ? months - 1 : months;
}

function claimsOn(line: CvLine): StatedYears[] {
  const out: StatedYears[] = [];
  for (const re of CLAIM_RES) {
    re.lastIndex = 0;
    for (let m = re.exec(line.folded); m; m = re.exec(line.folded)) {
      const span = { start: m.index, end: m.index + m[0].length };
      const months = toMonths(m[1], m[2], m[3]);
      const isOthers = OTHERS_YEARS.test(line.folded.slice(0, span.start));
      if (months > 0 && months < 45 * 12 && !isOthers) {
        out.push({ months, line, span, tail: line.folded.slice(span.end, span.end + 80) });
      }
    }
  }
  return out;
}

function roleDurationsOn(line: CvLine): StatedYears[] {
  const opening = OPENING_DURATION.exec(line.folded);
  if (opening) {
    const span = { start: opening.index, end: opening.index + opening[0].length };
    return [{ months: toMonths(opening[1], opening[2], opening[3]), line, span, tail: line.folded.slice(span.end) }];
  }
  const out: StatedYears[] = [];
  for (const chunk of line.folded.split(/[,;.]/)) {
    const m = CLOSING_DURATION.exec(chunk.trim());
    if (m && !NOT_A_JOB.test(m[1])) {
      const start = line.folded.indexOf(chunk);
      out.push({ months: toMonths(m[2], m[3], m[4]), line, span: { start, end: start + chunk.length }, tail: m[1] });
    }
  }
  return out;
}

/** Statements of the CV; a bare "5 năm" beside a role is only read when no dated job exists to contradict it. */
export function extractStated(doc: CvDoc, hasDatedJobs: boolean): StatedYears[] {
  return doc.lines.flatMap((line) => {
    if (SKIPPED.has(line.section) || NOT_A_CLAIM.test(line.folded)) return [];
    const claims = claimsOn(line);
    if (claims.length > 0 || hasDatedJobs) return claims;
    return roleDurationsOn(line);
  });
}
