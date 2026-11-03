/**
 * Judges a language requirement: test score, CEFR level, proficiency wording, or a plain "tiếng Anh".
 * A CV written in English shows the candidate reads English (level 2), nothing more. Target scores and employers
 * with a language in their name are no evidence.
 */
import { result, type AnyLanguageAtom, type AtomResult, type LanguageAtom } from './atoms.js';
import {
  cefrLevel,
  cefrRanks,
  convertScore,
  findScores,
  LANGUAGE_LABELS,
  LEVEL_LABELS,
  languageTerms,
  levelWords,
  scoreCefr,
  scoreLevel,
  testLabel,
  type TestScore,
} from './language.js';
import { LIST_ONLY_REASON, unbackedLists, withoutListLines } from './experience-lists.js';
import type { CvDoc, CvLine } from './normalize.js';
import { findTerm, isAspirationAt, isInNameAt, isNegatedAround, joinEvidence, snippet } from './text-match.js';

interface LanguageFacts {
  lines: CvLine[];
  negated: CvLine | null;
  scores: { score: TestScore; line: CvLine }[];
  /** Best CEFR rank shown and where. */
  cefr: { rank: number; line: CvLine } | null;
  /** Best stated level and where; `fromEnglishCv` when only implied by the CV being in English. */
  level: { value: number; line: CvLine | null; fromEnglishCv: boolean } | null;
  /** The CV has real content, so silence about a language means it is not there. */
  substantive: boolean;
}

const TARGET_WORDS =
  /\b(muc tieu|target|aiming|aim for|dang on|on thi|du kien|ke hoach|hope to|plan to|mong muon|se thi|sap thi)\b/;

/** "IELTS 5.0. Đang ôn thi, mục tiêu đạt IELTS 7.0": the second sentence states a wish, blank it. */
function withoutTargets(folded: string): string {
  return folded.replace(/[^.;]+/g, (part) => (TARGET_WORDS.test(part) ? ' '.repeat(part.length) : part));
}

/** A wish names the language without giving it to the candidate, which answers the question as well as a "no". */
function isWishLine(line: CvLine, atom: LanguageAtom): boolean {
  const mentions = languageTerms(atom.language).flatMap((t) => findTerm(line.folded, t));
  if (mentions.length === 0) return false;
  if (line.section === 'interests' || line.section === 'objective') return true;
  return mentions.every((s) => isAspirationAt(line.folded, s.start));
}

function mentionLines(doc: CvDoc, atom: LanguageAtom): { lines: CvLine[]; negated: CvLine | null } {
  const lines: CvLine[] = [];
  let negated: CvLine | null = null;
  for (const line of doc.lines) {
    if (isWishLine(line, atom)) negated = negated ?? line;
    if (line.section === 'interests' || line.section === 'objective' || line.section === 'references') continue;
    const text = withoutTargets(line.folded);
    const spans = languageTerms(atom.language)
      .flatMap((t) => findTerm(text, t))
      .filter((s) => !isInNameAt(line, s) && !isAspirationAt(text, s.start));
    if (spans.length === 0) continue;
    if (spans.every((s) => isNegatedAround(text, s))) negated = negated ?? line;
    else lines.push(line);
  }
  return { lines, negated };
}

const ROLE_BEFORE =
  /\b(?:giao vien|giang vien|bien dich(?: vien)?|phien dich(?: vien)?|thong dich(?: vien)?|tro giang|translator|interpreter|teacher|lecturer)\s+(?:day\s+)?$/;
const MAJOR_BEFORE = /\b(?:su pham|cu nhan)\s+(?:ngon ngu\s+)?$/;

/** Teaching or translating a language proves more than a level word could; having studied it proves a good deal. */
function roleLevel(line: CvLine, atom: LanguageAtom): number | null {
  for (const term of languageTerms(atom.language)) {
    for (const span of findTerm(line.folded, term)) {
      const before = line.folded.slice(0, span.start);
      if (ROLE_BEFORE.test(before)) return 4;
      if (MAJOR_BEFORE.test(before) || term.startsWith('ngon ngu')) return 3;
    }
  }
  return null;
}

function lineLevel(doc: CvDoc, line: CvLine, atom: LanguageAtom): number | null {
  const own = levelWords(withoutTargets(line.folded));
  const role = roleLevel(line, atom);
  if (own.length > 0) return Math.max(Math.min(...own), role ?? 0);
  if (role !== null) return role;
  const next = doc.lines[line.index + 1];
  if (!next || next.text.length > 40 || next.section !== line.section) return null;
  const nextLevels = levelWords(next.folded);
  return nextLevels.length > 0 ? Math.min(...nextLevels) : null;
}

function bestCefr(lines: readonly CvLine[], scores: LanguageFacts['scores']): LanguageFacts['cefr'] {
  const written = lines.flatMap((line) => cefrRanks(withoutTargets(line.folded)).map((rank) => ({ rank, line })));
  const fromScores = scores.flatMap(({ score, line }) => {
    const rank = scoreCefr(score);
    return rank === null ? [] : [{ rank, line }];
  });
  return [...written, ...fromScores].reduce<LanguageFacts['cefr']>(
    (best, c) => (best && best.rank >= c.rank ? best : c),
    null,
  );
}

function collectFacts(doc: CvDoc, atom: LanguageAtom, substantive: boolean): LanguageFacts {
  const { lines, negated } = mentionLines(doc, atom);
  const scores = lines.flatMap((line) => findScores(withoutTargets(line.folded)).map((score) => ({ score, line })));
  const cefr = bestCefr(lines, scores);
  let level: LanguageFacts['level'] = null;
  const consider = (value: number, line: CvLine | null, fromEnglishCv: boolean) => {
    if (!level || value > level.value) level = { value, line, fromEnglishCv };
  };
  for (const s of scores) consider(scoreLevel(s.score), s.line, false);
  if (cefr) consider(cefrLevel(cefr.rank), cefr.line, false);
  for (const line of lines) {
    const lvl = lineLevel(doc, line, atom);
    if (lvl !== null) consider(lvl, line, false);
  }
  if (atom.language === 'english' && doc.isEnglish) consider(2, null, true);
  return { lines, negated, scores, cefr, level, substantive };
}

function absent(atom: LanguageAtom, facts: LanguageFacts, what: string): AtomResult {
  if (facts.negated)
    return result('unmet', `CV ghi không biết ${LANGUAGE_LABELS[atom.language]}`, snippet(facts.negated));
  if (!facts.substantive) return result('unknown', `CV quá ít nội dung để kết luận về ${what}, HR xem trực tiếp`);
  return result('unmet', `Không thấy ${what} trong CV`);
}

function convertedVerdict(atom: LanguageAtom, facts: LanguageFacts, wanted: string): AtomResult | null {
  const test = atom.test;
  if (test === null || atom.minScore === null) return null;
  const minScore = atom.minScore;
  for (const s of facts.scores) {
    const converted = convertScore(s.score, test);
    if (converted === null) continue;
    const got = testLabel(s.score.test, s.score.score);
    if (converted >= minScore)
      return result('met', `CV ghi ${got}, tương đương hoặc cao hơn ${wanted}`, snippet(s.line));
    return result('unmet', `CV ghi ${got}, thấp hơn ${wanted}`, snippet(s.line));
  }
  return null;
}

function scoreVerdict(atom: LanguageAtom, facts: LanguageFacts): AtomResult | null {
  const test = atom.test;
  if (test === null) return null;
  const wanted = atom.minScore === null ? test.toUpperCase() : testLabel(test, atom.minScore);
  const same = facts.scores.filter((s) => s.score.test === test).sort((a, b) => b.score.score - a.score.score)[0];
  if (same) {
    const got = testLabel(test, same.score.score);
    if (atom.minScore === null || same.score.score >= atom.minScore)
      return result('met', `CV ghi ${got}, yêu cầu ${wanted}`, snippet(same.line));
    return result('unmet', `CV ghi ${got}, yêu cầu ${wanted}`, snippet(same.line));
  }
  const converted = convertedVerdict(atom, facts, wanted);
  if (converted) return converted;
  const named = facts.lines.some((l) => new RegExp(`\\b${test}\\b`).test(l.folded));
  // Asked for a score, not for the paper: someone stating a level may still meet it.
  if (!atom.needsCertificate && atom.minScore !== null && (facts.lines.length > 0 || facts.level)) {
    const evidence = facts.lines[0] ? snippet(facts.lines[0]) : null;
    return result('unknown', `CV không ghi điểm ${test.toUpperCase()} quy đổi được, yêu cầu ${wanted}`, evidence);
  }
  if (named && atom.minScore === null) return result('met', `CV có ${wanted}`, snippet(facts.lines[0]));
  return absent(atom, facts, `chứng chỉ ${wanted}`);
}

const CEFR_NAMES: Record<number, string> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };

function cefrVerdict(atom: LanguageAtom, facts: LanguageFacts): AtomResult | null {
  if (atom.minCefr === null) return null;
  const label = LANGUAGE_LABELS[atom.language];
  const wanted = `${label} ${CEFR_NAMES[atom.minCefr] ?? ''}`.trim();
  if (facts.cefr) {
    const got = `${label} ${CEFR_NAMES[facts.cefr.rank] ?? ''}`.trim();
    const verdict = facts.cefr.rank >= atom.minCefr ? 'met' : 'unmet';
    return result(verdict, `CV ghi ${got}, yêu cầu ${wanted}`, snippet(facts.cefr.line));
  }
  if (facts.lines.length === 0) return absent(atom, facts, wanted);
  return result(
    'unknown',
    `CV có nhắc ${label} nhưng không ghi khung trình độ, yêu cầu ${wanted}`,
    snippet(facts.lines[0]),
  );
}

function levelVerdict(atom: LanguageAtom, facts: LanguageFacts): AtomResult {
  const label = LANGUAGE_LABELS[atom.language];
  const wanted = atom.minLevel === null ? label : `${label} ${LEVEL_LABELS[atom.minLevel]}`;
  const level = facts.level;
  if (!level && facts.lines.length === 0) return absent(atom, facts, label);
  const evidence = level?.line ? snippet(level.line) : facts.lines[0] ? snippet(facts.lines[0]) : null;
  if (atom.minLevel === null || atom.minLevel <= 1) {
    const how = facts.lines.length > 0 ? `CV có ${label}` : 'CV viết bằng tiếng Anh';
    return result('met', `${how}, yêu cầu ${wanted}`, evidence);
  }
  if (!level) return result('unknown', `CV có nhắc ${label} nhưng không ghi trình độ, yêu cầu ${wanted}`, evidence);
  const got = level.fromEnglishCv
    ? 'CV viết bằng tiếng Anh (đọc hiểu được)'
    : `CV ghi ${label} ${LEVEL_LABELS[level.value]}`;
  if (level.value >= atom.minLevel) return result('met', `${got}, yêu cầu ${wanted}`, evidence);
  if (level.fromEnglishCv) return result('unknown', `${got}, chưa rõ có đạt ${wanted} không`, evidence);
  return result('unmet', `${got}, yêu cầu ${wanted}`, evidence);
}

function judge(atom: LanguageAtom, facts: LanguageFacts): AtomResult {
  return scoreVerdict(atom, facts) ?? cefrVerdict(atom, facts) ?? levelVerdict(atom, facts);
}

/** Language requirement verdict: a keyword list with nothing behind it shows nothing, and rules nothing out. */
export function evaluateLanguage(atom: LanguageAtom, doc: CvDoc, substantive: boolean): AtomResult {
  const lists = unbackedLists(doc);
  const own = collectFacts(withoutListLines(doc, lists), atom, substantive);
  const verdict = judge(atom, own);
  if (lists.length === 0 || verdict.verdict === 'met' || own.lines.length > 0 || own.negated) return verdict;
  const listed = judge(atom, collectFacts(doc, atom, substantive));
  return listed.verdict === 'met' ? result('unknown', LIST_ONLY_REASON, listed.evidence) : verdict;
}

/** "Tiếng Anh hoặc tiếng Trung": one is enough. */
export function evaluateAnyLanguage(atom: AnyLanguageAtom, doc: CvDoc, substantive: boolean): AtomResult {
  const results = atom.options.map((option) => evaluateLanguage(option, doc, substantive));
  const met = results.find((r) => r.verdict === 'met');
  if (met) return met;
  if (results.every((r) => r.verdict === 'unmet')) {
    const names = atom.options.map((o) => LANGUAGE_LABELS[o.language]).join(', ');
    return result(
      'unmet',
      `Không thấy ${names} ở mức yêu cầu trong CV`,
      joinEvidence(results.flatMap((r) => r.evidence ?? [])),
    );
  }
  return results.find((r) => r.verdict === 'unknown') ?? result('unknown', 'Chưa rõ trình độ ngoại ngữ');
}
