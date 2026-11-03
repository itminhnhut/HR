/**
 * Parses the experience part of a requirement line: "Từ 2 năm", "tối thiểu 1 năm kinh nghiệm bán hàng", "2+ năm",
 * "3+ years of sales experience", "Kinh nghiệm: Không yêu cầu", "Đã từng quản lý quan hệ với đối tác quốc tế".
 */
import type { ExperienceAtom } from './atoms.js';
import { buildField, isRelatedOnly, type FieldSpec, type TermSet } from './fields.js';

export type ExperienceParse = { kind: 'atom'; atom: ExperienceAtom } | { kind: 'none'; reason: string } | null;

const MENTION = /\b(kinh nghiem|experience|exp|kn)\b/;
const USED_TO = /\bda tung\b/;
const NOT_REQUIRED =
  /\b(khong (?:yeu cau|can|doi hoi|bat buoc|can thiet)|chua co kinh nghiem|chua can kinh nghiem|no experience|not required|nhan (?:ca )?(?:sinh vien|nguoi) (?:moi|chua)|moi ra truong|duoi \d+(?:[.,]\d+)? (?:nam|thang)|se duoc dao tao|duoc dao tao tu dau)\b/;
const YEARS =
  /(?:(?:tu|toi thieu|it nhat|tren|hon|from|at least|minimum|min|over)\s*)?(\d+(?:[.,]\d+)?)\s*(?:(?:-|~|den|toi)\s*\d+(?:[.,]\d+)?\s*)?\+?\s*(nam|years?|yrs?|thang|months?)\b\s*\+?(?:\s*tro len)?/;
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

const LINE_END = /[;.](?:\s|$)/;

function sentenceEnd(text: string): number {
  const m = LINE_END.exec(text);
  return m ? m.index : text.length;
}

/** The words naming the field: after "kinh nghiệm", or before it in "3+ years of sales experience". */
function fieldPhrase(folded: string, years: YearsHit | null): string {
  const text = years ? `${folded.slice(0, years.start)} ${folded.slice(years.end)}` : folded;
  const mention = MENTION.exec(text) ?? USED_TO.exec(text);
  if (!mention) return years ? folded.slice(years.end) : '';
  const rest = text.slice(mention.index + mention[0].length);
  const after = rest.slice(0, sentenceEnd(rest));
  if (trimFillers(after).length > 1 || isRelatedOnly(after)) return after;
  const before = text.slice(0, mention.index);
  return before.split(/[,;.()]/).pop() ?? '';
}

/** Lead-ins, with the words that merely look like them kept: "tư vấn", "cơ khí", "ô tô", "tài chính", "vệ sinh". */
const LEADING_FILLER =
  /^(?:yeu cau|lam viec|lam|cong viec|chuc vu|o vi tri|vi tri|o|trong nganh|trong linh vuc|trong mang|trong|linh vuc|nganh nghe|nganh|mang|lien quan den|lien quan toi|lien quan|thuc te|chuyen mon|tro len|su dung|dung|tu(?! (?:van|dong|duy|lieu))|toi thieu|it nhat|co(?! (?:khi|dien|so|ban|hoc))|da co|da tung|have|has|with|of|in|the|as|at|on|tai(?! (?:chinh|xe|lieu|san|khoan))|ve(?! sinh))(?=\s|$)/;
const LEADING_MARKS = /^[\s:,-]+/;
const TRAILING_FILLER = /\s+(?:lam viec|thuc te|tro len|experience)$/;

function trimFillers(phrase: string): string {
  let text = phrase.replace(LEADING_MARKS, '');
  for (let m = LEADING_FILLER.exec(text); m; m = LEADING_FILLER.exec(text)) {
    text = text.slice(m[0].length).replace(LEADING_MARKS, '');
  }
  return text.replace(TRAILING_FILLER, '').trim();
}

function parseField(phrase: string, isPosition: boolean): ExperienceAtom['field'] {
  const field = buildField(trimFillers(phrase));
  const named =
    field !== null &&
    !/^(?:nganh|vi tri|linh vuc)?\s*(?:tuong duong|lien quan|tuong tu|phu hop|relevant|related|similar|equivalent)\b/.test(
      field.label,
    );
  if (field && named) return isPosition ? (positionField(phrase) ?? field) : field;
  return isRelatedOnly(phrase) ? 'related' : null;
}

function isExperienceMention(folded: string): boolean {
  return MENTION.test(folded) || USED_TO.test(folded);
}

/** A field that names a position: only a job's stated role shows it. */
export interface PositionField extends FieldSpec {
  isPosition: true;
  /** One of the roles is outside the dictionary, so a title in another language cannot be compared with it. */
  hasUnknownRole: boolean;
}

export function isPositionField(field: FieldSpec): field is PositionField {
  return 'isPosition' in field;
}

const POSITION_WORD = /\b(?:vi tri|chuc vu|chuc danh)\b/;
/** "Tối thiểu 2 năm làm kế toán": a stretch of years in a role, as opposed to "cam kết làm việc tối thiểu 2 năm". */
const ROLE_AFTER_YEARS = /^\s*(?:lam|lam viec|cong tac|giu|dam nhiem)\b/;
const NOT_THE_PAST = /\b(?:cam ket|gan bo|hop dong|bao hanh|thu viec)\b/;
const PLACE = /\s(?:trong|tai|o)\s/;

function asksForPosition(folded: string, years: YearsHit | null): boolean {
  if (NOT_THE_PAST.test(folded)) return false;
  if (POSITION_WORD.test(folded)) return true;
  return years !== null && ROLE_AFTER_YEARS.test(folded.slice(years.end));
}

/** Without tones syllables collide, so a position is matched as written: "giao dịch viên" is not "giáo viên". */
function exactSet(set: TermSet, isQualifier: boolean, words: number): TermSet {
  const terms = [...set.terms, ...set.loose];
  // A rank is read in the role ("bếp phó"); a longer qualifier may name the employer ("lễ tân, khách sạn X").
  return isQualifier && words >= 2 ? { terms, loose: [] } : { terms, loose: [], titleOnly: true };
}

function wordCount(set: TermSet): number {
  return Math.min(...[...set.terms, ...set.loose].map((t) => t.split(' ').length));
}

/** "nhà máy sản xuất" is two words that each say enough: either shows the place. */
function placeAlternatives(place: string): string {
  const words = place.trim().split(/\s+/);
  if (words.length < 4 || words.length % 2 !== 0) return place.trim();
  return words.flatMap((w, i) => (i % 2 === 0 ? [`${w} ${words[i + 1] ?? ''}`] : [])).join(', ');
}

/** "QA/QC trong nhà máy sản xuất": the roles, any one of them, and the kind of place, which is judged apart. */
function positionField(phrase: string): PositionField | null {
  const label = trimFillers(phrase);
  const place = PLACE.exec(label);
  const hasOwnIndustry = /\s(?:trong (?:nganh|linh vuc|mang)|tai (?:cac )?cong ty|o cong ty)\s/.test(label);
  const role = (place && !hasOwnIndustry ? label.slice(0, place.index) : label).replace(
    /(?<=[a-z0-9])\/(?=[a-z0-9])/g,
    ' hoac ',
  );
  const where =
    place && !hasOwnIndustry ? ` trong nganh ${placeAlternatives(label.slice(place.index + place[0].length))}` : '';
  const field = buildField(`${role}${where}`);
  if (!field) return null;
  const alternatives = field.alternatives.map((sets) => sets.map((s, i) => exactSet(s, i > 0, wordCount(s))));
  const hasUnknownRole = field.alternatives.some((sets) => (sets[0]?.terms.length ?? 0) === 0);
  return { ...field, label, alternatives, isPosition: true, hasUnknownRole };
}

/**
 * Experience atom of a requirement line; `labelled` = line starts with "Kinh nghiệm:". A line with no years that only
 * names tools ("Có kinh nghiệm sử dụng CRM") is left to the keyword check, and "Đã từng …" needs a field we know.
 */
export function parseExperienceRequirement(folded: string, labelled: boolean, hasKeywords: boolean): ExperienceParse {
  const years = findYears(folded);
  const isPosition = asksForPosition(folded, years);
  const asksYearsInRole = years !== null && isPosition;
  if (!labelled && !isExperienceMention(folded) && !asksYearsInRole) return null;
  if (NOT_REQUIRED.test(folded)) return { kind: 'none', reason: 'Tin không yêu cầu kinh nghiệm' };
  if (!years && !isExperienceMention(folded)) return null;
  const field = parseField(fieldPhrase(folded, years), isPosition);
  const months = years ? Math.max(1, years.months) : 1;
  if (!years && field !== null && field !== 'related' && hasKeywords && field.toolsOnly) return null;
  if (!years && !MENTION.test(folded) && (field === null || field === 'related' || !field.known)) return null;
  return { kind: 'atom', atom: { kind: 'experience', minMonths: months, field } };
}
