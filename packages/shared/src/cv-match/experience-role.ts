/**
 * The role a job states, read off the lines around its dates: "2021 - nay: Kế toán, Công ty A. Lập báo cáo" holds the
 * role "Kế toán"; "Grand River Hotel, Hoi An, Feb 2021 - Present. Guest check-in" names a company and duties, no role.
 * A job with no role of its own takes the line under the candidate's name, where a CV says what the person does.
 */
import type { MonthInterval } from './dates.js';
import type { CvDoc, CvLine } from './normalize.js';

export interface JobRole {
  /** Folded words that may name the role, without employers named by their kind ("Công ty …"). */
  role: string;
  /** Some of those words read as a role rather than a proper name. */
  hasTitle: boolean;
  /** The role is not written in Vietnamese tones, so missing words of the line prove nothing. */
  isForeign: boolean;
}

const ORG_START =
  /^(?:cong ty|cty|ctcp|tap doan|ngan hang|benh vien|phong kham|nha hang|khach san|nha may|nha thuoc|xuong|xi nghiep|trung tam|hoc vien|dai hoc|cao dang|sieu thi|cua hang|chuoi|tiem|resort|truong (?:dai hoc|cao dang|trung cap|thpt|thcs|tieu hoc|mam non|pho thong|ngoai ngu|tin hoc))\b/;
const CLAUSE_END = /[.:;(](?:\s|$)|\(/;
const SEGMENTS = /[,;]|\s-\s|\sat\s|\stai\s/g;

/** Every word capitalised, or a lead-in then a two-word name: "Grand River Hotel", "Vận tải Tây Bắc". */
function isProperName(segment: string): boolean {
  const tokens = segment.trim().split(/\s+/);
  const isCapital = (t: string | undefined) => t !== undefined && /^[\p{Lu}\d]/u.test(t);
  if (tokens.length >= 2 && tokens.every(isCapital)) return true;
  return tokens.length >= 3 && isCapital(tokens[tokens.length - 1]) && isCapital(tokens[tokens.length - 2]);
}

interface Span {
  text: string;
  folded: string;
}

function slice(line: CvLine, from: number, to: number): Span {
  return { text: line.text.slice(from, to), folded: line.folded.slice(from, to) };
}

/** Before the dates, after any label ("Kinh nghiệm:") and the "từ" leading into them. */
function beforeDates(line: CvLine, at: number): Span {
  const label = line.folded.slice(0, at).lastIndexOf(':');
  const from = label + 1;
  const head = line.folded.slice(from, at).replace(/\s*\b(?:tu|since|bat dau tu)\s*(?:nam\s+|thang\s+)?$/, '');
  return slice(line, from, from + head.length);
}

/** After the dates up to the end of the clause; a full stop right after the dates means duties follow. */
function afterDates(line: CvLine, end: number): Span {
  const rest = line.folded.slice(end);
  if (/^\s*\)?\s*\./.test(rest)) return { text: '', folded: '' };
  const lead = /^[\s:,)\-]*/.exec(rest)?.[0].length ?? 0;
  const stop = CLAUSE_END.exec(rest.slice(lead));
  return slice(line, end + lead, end + lead + (stop ? stop.index : rest.length - lead));
}

/** Parts of a span, cut on the folded text, which is as long as the original. */
function segmentsOf(span: Span): Span[] {
  const cuts = [...span.folded.matchAll(SEGMENTS)];
  const starts = [0, ...cuts.map((m) => m.index + m[0].length)];
  const ends = [...cuts.map((m) => m.index), span.folded.length];
  return starts.map((start, i) => ({
    text: span.text.slice(start, ends[i]).trim(),
    folded: span.folded.slice(start, ends[i]).trim(),
  }));
}

function roleOfSpans(spans: readonly Span[]): JobRole {
  const pairs = spans.flatMap(segmentsOf);
  const isEmployer = (p: { folded: string }) => ORG_START.test(p.folded);
  // One capitalised word after an employer is its town: "Khách sạn Đông Á, Huế".
  const isTown = (i: number) => {
    const before = pairs[i - 1];
    return before !== undefined && isEmployer(before) && /^\p{Lu}\p{L}*$/u.test(pairs[i]?.text ?? '');
  };
  const named = pairs.filter((p) => /[a-z]{2}/.test(p.folded) && !isEmployer(p));
  const titles = pairs.filter((p, i) => named.includes(p) && !isProperName(p.text) && !isTown(i));
  return {
    role: named.map((p) => p.folded).join(', '),
    hasTitle: titles.length > 0,
    isForeign: titles.every((p) => !/[^\p{ASCII}]/u.test(p.text)),
  };
}

/** The role a job states on its date line and the title lines around it. */
export function readRole(headLines: readonly CvLine[], dateLine: CvLine, interval: MonthInterval): JobRole {
  // A title broken over lines by the PDF is one title.
  const others = headLines.filter((line) => line !== dateLine);
  const above: Span = { text: others.map((l) => l.text).join(' '), folded: others.map((l) => l.folded).join(' ') };
  const onDateLine = headLines.includes(dateLine)
    ? [beforeDates(dateLine, interval.start), afterDates(dateLine, interval.end)]
    : [];
  return roleOfSpans([above, ...onDateLine]);
}

const MAX_WORDS_OF_ROLE_BELOW = 4;

/**
 * "06/2020 - nay Khách sạn Đông Á" then "Lễ tân. Check-in, đặt phòng": a role may open the line under a job naming only
 * its company. It can prove the role; it cannot tell a role from a duty, so it never counts as a stated title.
 */
export function roleWithLineBelow(own: JobRole, below: CvLine | undefined): JobRole {
  if (own.hasTitle || !below) return own;
  const first = below.folded.split(/[.,:;(]/)[0]?.trim() ?? '';
  if (first.length === 0 || first.split(/\s+/).length > MAX_WORDS_OF_ROLE_BELOW) return own;
  return { ...own, role: [own.role, first].filter((part) => part.length > 0).join(', ') };
}

const MAX_HEADLINE = 70;
const NOT_A_HEADLINE =
  /\b(ung tuyen|mong muon|tim viec|applying|apply for|ho so)\b|\b(?:email|ngay sinh|dien thoai|phone)\s*:|@|\d{6}/;

/** The lines at the top of the CV, before any section or job, that can say what the person does. */
export function cvHeadline(doc: CvDoc, firstJobLine: number): Span {
  const top: CvLine[] = [];
  for (const line of doc.lines) {
    if (line.index >= firstJobLine || line.isHeader || line.section !== 'none') break;
    const isShort = line.text.length <= MAX_HEADLINE && (line.text.match(/,/g) ?? []).length < 3;
    if (isShort && !NOT_A_HEADLINE.test(line.folded)) top.push(line);
  }
  // One line on top of a CV is the candidate's name.
  if (top.length < 2) return { text: '', folded: '' };
  return { text: top.map((l) => l.text).join(', '), folded: top.map((l) => l.folded).join(', ') };
}

/** A job that states no role takes the headline's. */
export function roleWithHeadline(own: JobRole, headline: Span): JobRole {
  if (own.hasTitle || headline.folded.length === 0) return own;
  return {
    role: [own.role, headline.folded].filter((part) => part.length > 0).join(', '),
    hasTitle: true,
    isForeign: !/[^\p{ASCII}]/u.test(headline.text),
  };
}
