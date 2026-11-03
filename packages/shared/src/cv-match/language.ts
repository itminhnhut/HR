/**
 * Foreign languages: which language, test scores (TOEIC/IELTS/TOEFL/JLPT/HSK/TOPIK) and proficiency words,
 * on both requirement and CV side. Levels: 1 cơ bản, 2 đọc hiểu, 3 giao tiếp, 4 thành thạo.
 */
import type { AnyLanguageAtom, LanguageAtom, LanguageName, LanguageTest } from './atoms.js';
import { findTerm, hasAnyTerm } from './text-match.js';

const LANGUAGE_TERMS: Record<LanguageName, string[]> = {
  english: ['tieng anh', 'anh van', 'anh ngu', 'english', 'toeic', 'ielts', 'toefl', 'ngon ngu anh', 'vstep'],
  japanese: ['tieng nhat', 'nhat ngu', 'japanese', 'jlpt', 'ngon ngu nhat', '日本語', '日本語能力試験'],
  chinese: ['tieng trung', 'tieng hoa', 'hoa ngu', 'trung van', 'chinese', 'mandarin', 'hsk', 'ngon ngu trung'],
  korean: ['tieng han', 'han ngu', 'korean', 'topik', 'ngon ngu han'],
  french: ['tieng phap', 'french', 'delf', 'dalf', 'ngon ngu phap'],
  german: ['tieng duc', 'german', 'ngon ngu duc'],
  spanish: ['tieng tay ban nha', 'spanish'],
  russian: ['tieng nga', 'russian'],
  thai: ['tieng thai', 'thai language'],
};

export const LANGUAGE_LABELS: Record<LanguageName, string> = {
  english: 'tiếng Anh',
  japanese: 'tiếng Nhật',
  chinese: 'tiếng Trung',
  korean: 'tiếng Hàn',
  french: 'tiếng Pháp',
  german: 'tiếng Đức',
  spanish: 'tiếng Tây Ban Nha',
  russian: 'tiếng Nga',
  thai: 'tiếng Thái',
};

export const TEST_LANGUAGE: Record<LanguageTest, LanguageName> = {
  toeic: 'english',
  ielts: 'english',
  toefl: 'english',
  jlpt: 'japanese',
  hsk: 'chinese',
  topik: 'korean',
};

/** Neutralised before looking for level words: "tốt nghiệp" is not "tốt", "khả năng" is not "khá". */
const DECOYS = /\b(tot nghiep|kha nang|doc lap|doc quyen|basic salary)\b/g;

const LEVEL_WORDS: [number, string[]][] = [
  [
    4,
    [
      'thanh thao',
      'luu loat',
      'fluent',
      'fluently',
      'fluency',
      'advanced',
      'proficient',
      'native',
      'ban ngu',
      'xuat sac',
      'thong thao',
      'gioi',
      'upper intermediate',
      'upper-intermediate',
    ],
  ],
  [3, ['giao tiep', 'kha', 'intermediate', 'conversational', 'good', 'tot', 'working proficiency', 'trung cap']],
  [
    2,
    [
      // "tốt" here grades the reading: it does not ask for conversation.
      'doc hieu tot',
      'doc tot',
      'doc hieu',
      'doc tai lieu',
      'doc viet',
      'doc va viet',
      'doc duoc',
      'reading',
      'read',
      'pre-intermediate',
      'pre intermediate',
      'trung binh',
    ],
  ],
  [1, ['co ban', 'basic', 'so cap', 'beginner', 'elementary', 'limited', 'biet chut', 'mot chut']],
];
const LEVEL_ENTRIES = LEVEL_WORDS.flatMap(([lvl, terms]) => terms.map((t) => ({ lvl, term: t }))).sort(
  (a, b) => b.term.length - a.term.length,
);

/** Proficiency levels named in a folded text (longest phrases first, so "pre-intermediate" is not "intermediate"). */
export function levelWords(folded: string): number[] {
  let text = folded.replace(DECOYS, (m) => ' '.repeat(m.length));
  const out: number[] = [];
  for (const { lvl, term } of LEVEL_ENTRIES) {
    for (const span of findTerm(text, term)) {
      out.push(lvl);
      text = text.slice(0, span.start) + ' '.repeat(span.end - span.start) + text.slice(span.end);
    }
  }
  return out;
}

export function languagesIn(folded: string): LanguageName[] {
  return (Object.keys(LANGUAGE_TERMS) as LanguageName[]).filter((l) => hasAnyTerm(folded, LANGUAGE_TERMS[l]));
}

export function languageTerms(language: LanguageName): string[] {
  return LANGUAGE_TERMS[language];
}

export interface TestScore {
  test: LanguageTest;
  /** Higher is better for every test (JLPT N1 is stored as 5, N5 as 1). */
  score: number;
}

const SCORE_RES: [LanguageTest, RegExp, (s: string) => number][] = [
  ['toeic', /toeic[^\n;]{0,30}?(?<![\d.,/])(\d{3})(?![\d/])|(?<!\d)(\d{3})\s*\+?\s*(?:diem\s*)?toeic/g, Number],
  [
    'ielts',
    /ielts[^\n;]{0,25}?(?<![\d.,/])(\d(?:[.,][05])?)(?![\d.,]\d|\d)|(?<![\d.])(\d[.,][05])\s*\+?\s*ielts/g,
    (s) => Number(s.replace(',', '.')),
  ],
  ['toefl', /toefl[^\n;]{0,20}?(?<![\d.,/])(\d{2,3})(?![\d/])/g, Number],
  [
    'jlpt',
    /(?:jlpt|tieng nhat|nhat ngu|japanese|日本語能力試験|日本語)[^\n]{0,20}?\bn\s?([1-5])\b|\bn([1-5])\s*(?:jlpt|tieng nhat)/g,
    (s) => 6 - Number(s),
  ],
  ['hsk', /hsk\s*(?:cap\s*)?([1-9])\b/g, Number],
  ['topik', /topik\s*(?:cap\s*|level\s*)?([1-6])\b/g, Number],
];

/** Test scores written in a folded text. */
export function findScores(folded: string): TestScore[] {
  const out: TestScore[] = [];
  for (const [test, re, convert] of SCORE_RES) {
    re.lastIndex = 0;
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const raw = m[1] ?? m[2];
      if (raw) out.push({ test, score: convert(raw) });
    }
  }
  return out;
}

const TEST_NAMES: LanguageTest[] = ['toeic', 'ielts', 'toefl', 'jlpt', 'hsk', 'topik'];

const CEFR = /\b(a1|a2|b1|b2|c1|c2)\b/g;
const CEFR_RANK: Record<string, number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6 };
/** "Bằng C tiếng Anh": the old national certificates, which read roughly as A2, B1 and B2. */
const OLD_CERT = /\b(?:bang|chung chi)\s+([abc])\s+(?:tieng\s+)?(?:anh|english|nhat|trung|han|phap|duc)\b/;
const OLD_CERT_RANK: Record<string, number> = { a: 2, b: 3, c: 4 };

/** CEFR ranks written in a folded text (A1 = 1 … C2 = 6). */
export function cefrRanks(folded: string): number[] {
  const out = [...folded.matchAll(CEFR)].map((m) => CEFR_RANK[m[1]] ?? 0);
  const old = OLD_CERT.exec(folded);
  return old?.[1] ? [...out, OLD_CERT_RANK[old[1]] ?? 0] : out;
}

/** Proficiency a CEFR rank shows, on the 1–4 scale used in requirement wording. */
export function cefrLevel(rank: number): number {
  if (rank >= 5) return 4;
  if (rank >= 3) return 3;
  return rank === 2 ? 2 : 1;
}

/** The level a line asks for: "đọc hiểu và giao tiếp" asks for the higher; "giao tiếp cơ bản" means basic. */
function askedLevel(levels: readonly number[]): number | null {
  if (levels.length === 0) return null;
  return levels.includes(1) ? 1 : Math.max(...levels);
}

function atomFor(language: LanguageName, folded: string): LanguageAtom {
  const scores = findScores(folded).filter((s) => TEST_LANGUAGE[s.test] === language);
  const named = TEST_NAMES.find((t) => TEST_LANGUAGE[t] === language && new RegExp(`\\b${t}\\b`).test(folded)) ?? null;
  const test = scores[0]?.test ?? named;
  const ranks = cefrRanks(folded);
  return {
    kind: 'language',
    language,
    test,
    minScore: scores.find((s) => s.test === test)?.score ?? null,
    minLevel: askedLevel(levelWords(folded)),
    minCefr: ranks.length > 0 ? Math.min(...ranks) : null,
    needsCertificate: /\b(chung chi|chung nhan|certificate|certification)\b/.test(folded),
  };
}

const BARE_NAMES: [LanguageName, RegExp][] = [
  ['english', /\b(?:tieng )?anh\b/],
  ['chinese', /\b(?:tieng )?(?:trung|hoa)\b/],
  ['korean', /\b(?:tieng )?han\b/],
  ['japanese', /\b(?:tieng )?nhat\b/],
  ['french', /\b(?:tieng )?phap\b/],
  ['german', /\b(?:tieng )?duc\b/],
];

/** "một trong các ngoại ngữ: Anh, Trung, Hàn". */
function bareLanguages(folded: string): LanguageName[] {
  const list = /\bngoai ngu\b\s*:?\s*(.+)$/.exec(folded)?.[1];
  if (!list || !/\b(mot trong|bat ky|hoac)\b/.test(folded)) return [];
  return BARE_NAMES.filter(([, re]) => re.test(list)).map(([name]) => name);
}

function namedLanguages(folded: string): LanguageName[] {
  const scored = TEST_NAMES.filter((t) => new RegExp(`\\b${t}\\b`).test(folded)).map((t) => TEST_LANGUAGE[t]);
  const named = languagesIn(folded);
  const rest = named.filter((l) => !scored.includes(l));
  const all = [...new Set([...scored, ...rest])];
  return all.length > 0 ? all : bareLanguages(folded);
}

/** Language atoms of a requirement line: every language named with "và", one of those named with "hoặc". */
export function parseLanguageRequirements(folded: string): (LanguageAtom | AnyLanguageAtom)[] {
  const languages = namedLanguages(folded);
  if (languages.length === 0) return [];
  const atoms = languages.map((l) => atomFor(l, folded));
  if (atoms.length > 1 && /\b(hoac|or|mot trong|bat ky)\b/.test(folded)) {
    return [{ kind: 'any-language', options: atoms }];
  }
  return atoms;
}

/** Rough level implied by a score, used only to compare with "giao tiếp" / "thành thạo" wording. */
export function scoreLevel(s: TestScore): number {
  const steps: Record<LanguageTest, number[]> = {
    toeic: [400, 550, 785],
    ielts: [4, 5, 6.5],
    toefl: [45, 60, 90],
    jlpt: [2, 3, 4],
    hsk: [3, 4, 5],
    topik: [2, 3, 5],
  };
  const [read, talk, fluent] = steps[s.test];
  if (s.score >= fluent) return 4;
  if (s.score >= talk) return 3;
  return s.score >= read ? 2 : 1;
}

const IELTS_TO_TOEIC: [number, number][] = [
  [8, 950],
  [7.5, 900],
  [7, 850],
  [6.5, 750],
  [6, 650],
  [5.5, 600],
  [5, 500],
  [4.5, 450],
  [4, 400],
];

const TOEFL_TO_IELTS: [number, number][] = [
  [110, 8],
  [102, 7.5],
  [94, 7],
  [79, 6.5],
  [60, 6],
  [46, 5.5],
  [35, 5],
  [32, 4.5],
];

function toIelts(from: TestScore): number | null {
  if (from.test === 'ielts') return from.score;
  if (from.test === 'toefl') return TOEFL_TO_IELTS.find(([t]) => from.score >= t)?.[1] ?? 0;
  if (from.test === 'toeic') return IELTS_TO_TOEIC.find(([, t]) => from.score >= t)?.[0] ?? 0;
  return null;
}

/** Converts a score to another English test conservatively; null when no safe conversion exists. */
export function convertScore(from: TestScore, to: LanguageTest): number | null {
  if (from.test === to) return from.score;
  const ielts = toIelts(from);
  if (ielts === null) return null;
  if (to === 'ielts') return ielts;
  if (to === 'toeic') return IELTS_TO_TOEIC.find(([i]) => ielts >= i)?.[1] ?? 0;
  if (to === 'toefl') return TOEFL_TO_IELTS.find(([, i]) => ielts >= i)?.[0] ?? 0;
  return null;
}

const IELTS_CEFR: [number, number][] = [
  [8.5, 6],
  [7, 5],
  [5.5, 4],
  [4, 3],
  [3, 2],
];

/** CEFR rank a score shows; null for tests with their own scale. */
export function scoreCefr(s: TestScore): number | null {
  const ielts = toIelts(s);
  if (ielts === null) return null;
  return IELTS_CEFR.find(([i]) => ielts >= i)?.[1] ?? 1;
}

export const LEVEL_LABELS: Record<number, string> = { 1: 'cơ bản', 2: 'đọc hiểu', 3: 'giao tiếp', 4: 'thành thạo' };

export function testLabel(test: LanguageTest, score: number): string {
  return test === 'jlpt' ? `JLPT N${6 - score}` : `${test.toUpperCase()} ${score}`;
}
