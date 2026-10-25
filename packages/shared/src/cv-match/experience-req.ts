/**
 * Parses the experience part of a requirement line: "Từ 2 năm", "tối thiểu 1 năm kinh nghiệm bán hàng", "2+ năm",
 * "3+ years of sales experience", "Kinh nghiệm: Không yêu cầu".
 */
import type { ExperienceAtom } from './atoms.js';
import { buildField, isRelatedOnly } from './fields.js';

export type ExperienceParse = { kind: 'atom'; atom: ExperienceAtom } | { kind: 'none'; reason: string } | null;

const MENTION = /\b(kinh nghiem|experience|exp)\b/;
const NOT_REQUIRED =
  /\b(khong (?:yeu cau|can|doi hoi|bat buoc|can thiet)|chua co kinh nghiem|chua can kinh nghiem|no experience|not required|nhan (?:ca )?(?:sinh vien|nguoi) (?:moi|chua)|moi ra truong|duoi \d+(?:[.,]\d+)? (?:nam|thang)|se duoc dao tao|duoc dao tao tu dau)\b/;
const YEARS =
  /(?:(?:tu|toi thieu|it nhat|tren|hon|from|at least|minimum|min)\s*)?(\d+(?:[.,]\d+)?)\s*(?:(?:-|~|den|toi)\s*\d+(?:[.,]\d+)?\s*)?\+?\s*(nam|years?|yrs?|thang|months?)\b\s*\+?(?:\s*tro len)?/;
const WORD_NUMBERS: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  nua: 0.5,
};
const WORD_YEARS = /\b(mot|hai|ba|bon|nua|one|two|three|four|five)\s+(nam|years?|thang|months?)\b/;
const RELATED_WORDS = /\b(tuong duong|lien quan|tuong tu|phu hop|relevant|related|similar|equivalent)\b/g;

interface YearsHit {
  months: number;
  start: number;
  end: number;
}

function findYears(folded: string): YearsHit | null {
  const m = YEARS.exec(folded);
  if (m) {
    const n = Number(m[1].replace(',', '.'));
    const months = /^(thang|month)/.test(m[2]) ? n : n * 12;
    if (n > 0 && n <= 30) return { months: Math.round(months), start: m.index, end: m.index + m[0].length };
  }
  const w = WORD_YEARS.exec(folded);
  if (!w) return null;
  const n = WORD_NUMBERS[w[1]] ?? 0;
  const months = /^(thang|month)/.test(w[2]) ? n : n * 12;
  return { months: Math.round(months), start: w.index, end: w.index + w[0].length };
}

function fieldPhrase(folded: string, years: YearsHit | null): string {
  const text = years ? `${folded.slice(0, years.start)} ${folded.slice(years.end)}` : folded;
  const mention = MENTION.exec(text);
  if (!mention) return '';
  const after = text.slice(mention.index + mention[0].length).split(/[,;.()]/)[0];
  if (/[a-z]{2,}/.test(after.replace(/\b(lam viec|tro len|tu|toi thieu|it nhat|of|in)\b/g, ''))) return after;
  // "3+ years of sales experience": the field sits before the word "experience".
  return (
    text
      .slice(0, mention.index)
      .split(/[,;.()]/)
      .pop() ?? ''
  );
}

function parseField(phrase: string): ExperienceAtom['field'] {
  const cleaned = phrase.replace(
    /^[\s:\-]*(?:(?:co|da co|da tung|have|has|with|toi thieu|it nhat|tu|tren|hon)\s+)*/,
    ' ',
  );
  const field = buildField(cleaned.replace(RELATED_WORDS, ' '));
  if (field) return field;
  return isRelatedOnly(phrase) ? 'related' : null;
}

/** Experience atom of a requirement line; `labelled` = line starts with "Kinh nghiệm:". */
export function parseExperienceRequirement(folded: string, labelled: boolean, hasKeywords: boolean): ExperienceParse {
  if (!labelled && !MENTION.test(folded)) return null;
  if (NOT_REQUIRED.test(folded)) return { kind: 'none', reason: 'Tin không yêu cầu kinh nghiệm' };
  const years = findYears(folded);
  if (!years && (!MENTION.test(folded) || hasKeywords)) return null;
  const field = parseField(fieldPhrase(folded, years));
  return { kind: 'atom', atom: { kind: 'experience', minMonths: years ? Math.max(1, years.months) : 1, field } };
}
