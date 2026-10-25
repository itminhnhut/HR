/**
 * Foreign languages: which language, test scores (TOEIC/IELTS/TOEFL/JLPT/HSK/TOPIK) and proficiency words,
 * on both requirement and CV side. Levels: 1 cơ bản, 2 đọc hiểu, 3 giao tiếp, 4 thành thạo.
 */
import type { LanguageAtom, LanguageName, LanguageTest } from './atoms.js';
import { findTerm, hasAnyTerm } from './text-match.js';

const LANGUAGE_TERMS: Record<LanguageName, string[]> = {
  english: ['tieng anh', 'anh van', 'anh ngu', 'english', 'toeic', 'ielts', 'toefl'],
  japanese: ['tieng nhat', 'nhat ngu', 'japanese', 'jlpt'],
  chinese: ['tieng trung', 'tieng hoa', 'hoa ngu', 'trung van', 'chinese', 'mandarin', 'hsk'],
  korean: ['tieng han', 'han ngu', 'korean', 'topik'],
  french: ['tieng phap', 'french'],
  german: ['tieng duc', 'german'],
};

export const LANGUAGE_LABELS: Record<LanguageName, string> = {
  english: 'tiếng Anh',
  japanese: 'tiếng Nhật',
  chinese: 'tiếng Trung',
  korean: 'tiếng Hàn',
  french: 'tiếng Pháp',
  german: 'tiếng Đức',
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
  ['toeic', /toeic[^\d\n]{0,15}?(\d{3})(?!\d)|(?<!\d)(\d{3})\s*\+?\s*(?:diem\s*)?toeic/g, Number],
  [
    'ielts',
    /ielts[^\d\n]{0,15}?(\d(?:[.,][05])?)(?![\d.,]\d)|(?<![\d.])(\d[.,][05])\s*\+?\s*ielts/g,
    (s) => Number(s.replace(',', '.')),
  ],
  ['toefl', /toefl[^\d\n]{0,15}?(\d{2,3})(?!\d)/g, Number],
  [
    'jlpt',
    /(?:jlpt|tieng nhat|nhat ngu|japanese)[^\n]{0,20}?\bn\s?([1-5])\b|\bn([1-5])\s*(?:jlpt|tieng nhat)/g,
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

/** Language atom of a requirement line, or null when no language is named. */
export function parseLanguageRequirement(folded: string): LanguageAtom | null {
  const languages = languagesIn(folded);
  if (languages.length === 0) return null;
  const scores = findScores(folded);
  const named = TEST_NAMES.find((t) => new RegExp(`\\b${t}\\b`).test(folded)) ?? null;
  const test = scores[0]?.test ?? named;
  const language = test ? TEST_LANGUAGE[test] : languages[0];
  const levels = levelWords(folded);
  return {
    kind: 'language',
    language,
    test,
    minScore: scores.find((s) => s.test === test)?.score ?? null,
    minLevel: levels.length > 0 ? Math.min(...levels) : null,
  };
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

/** Converts a score to another English test conservatively; null when no safe conversion exists. */
export function convertScore(from: TestScore, to: LanguageTest): number | null {
  if (from.test === to) return from.score;
  if (from.test === 'ielts' && to === 'toeic') return IELTS_TO_TOEIC.find(([i]) => from.score >= i)?.[1] ?? null;
  if (from.test === 'toeic' && to === 'ielts') {
    return [...IELTS_TO_TOEIC].find(([, t]) => from.score >= t)?.[0] ?? null;
  }
  return null;
}

export const LEVEL_LABELS: Record<number, string> = { 1: 'cơ bản', 2: 'đọc hiểu', 3: 'giao tiếp', 4: 'thành thạo' };

export function testLabel(test: LanguageTest, score: number): string {
  return test === 'jlpt' ? `JLPT N${6 - score}` : `${test.toUpperCase()} ${score}`;
}
