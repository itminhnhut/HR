/**
 * Judges a language requirement: test score, proficiency wording, or a plain "tiếng Anh".
 * A CV written in English shows the candidate reads English (level 2), nothing more.
 */
import { result, type AtomResult, type LanguageAtom } from './atoms.js';
import {
  convertScore,
  findScores,
  LANGUAGE_LABELS,
  LEVEL_LABELS,
  languageTerms,
  levelWords,
  scoreLevel,
  testLabel,
  type TestScore,
} from './language.js';
import type { CvDoc, CvLine } from './normalize.js';
import { findTerm, isAspiration, isNegatedAt, snippet } from './text-match.js';

interface LanguageFacts {
  lines: CvLine[];
  negated: CvLine | null;
  scores: { score: TestScore; line: CvLine }[];
  /** Best stated level and where; `fromEnglishCv` when only implied by the CV being in English. */
  level: { value: number; line: CvLine | null; fromEnglishCv: boolean } | null;
}

function mentionLines(doc: CvDoc, atom: LanguageAtom): { lines: CvLine[]; negated: CvLine | null } {
  const lines: CvLine[] = [];
  let negated: CvLine | null = null;
  for (const line of doc.lines) {
    if (line.section === 'interests' || line.section === 'objective' || isAspiration(line.folded)) continue;
    const spans = languageTerms(atom.language).flatMap((t) => findTerm(line.folded, t));
    if (spans.length === 0) continue;
    if (spans.every((s) => isNegatedAt(line.folded, s.start))) negated = negated ?? line;
    else lines.push(line);
  }
  return { lines, negated };
}

function lineLevel(doc: CvDoc, line: CvLine): number | null {
  const own = levelWords(line.folded);
  if (own.length > 0) return Math.min(...own);
  const next = doc.lines[line.index + 1];
  if (!next || next.text.length > 40 || next.section !== line.section) return null;
  const nextLevels = levelWords(next.folded);
  return nextLevels.length > 0 ? Math.min(...nextLevels) : null;
}

function collectFacts(doc: CvDoc, atom: LanguageAtom): LanguageFacts {
  const { lines, negated } = mentionLines(doc, atom);
  const scores = lines.flatMap((line) => findScores(line.folded).map((score) => ({ score, line })));
  let level: LanguageFacts['level'] = null;
  const consider = (value: number, line: CvLine | null, fromEnglishCv: boolean) => {
    if (!level || value > level.value) level = { value, line, fromEnglishCv };
  };
  for (const s of scores) consider(scoreLevel(s.score), s.line, false);
  for (const line of lines) {
    const lvl = lineLevel(doc, line);
    if (lvl !== null) consider(lvl, line, false);
  }
  if (atom.language === 'english' && doc.isEnglish) consider(2, null, true);
  return { lines, negated, scores, level };
}

function absent(atom: LanguageAtom, facts: LanguageFacts, what: string): AtomResult {
  if (facts.negated)
    return result('unmet', `CV ghi không biết ${LANGUAGE_LABELS[atom.language]}`, snippet(facts.negated));
  return result('unmet', `Không thấy ${what} trong CV`);
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
  for (const s of facts.scores) {
    const converted = convertScore(s.score, test);
    if (converted !== null && (atom.minScore === null || converted >= atom.minScore)) {
      return result(
        'met',
        `CV ghi ${testLabel(s.score.test, s.score.score)}, tương đương hoặc cao hơn ${wanted}`,
        snippet(s.line),
      );
    }
  }
  if (facts.scores.length > 0 || facts.lines.length > 0 || facts.level) {
    const evidence = facts.lines[0] ? snippet(facts.lines[0]) : null;
    return result('unknown', `CV không ghi điểm ${test.toUpperCase()} quy đổi được, yêu cầu ${wanted}`, evidence);
  }
  return absent(atom, facts, `chứng chỉ ${wanted}`);
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

/** Language requirement verdict. */
export function evaluateLanguage(atom: LanguageAtom, doc: CvDoc): AtomResult {
  const facts = collectFacts(doc, atom);
  return scoreVerdict(atom, facts) ?? levelVerdict(atom, facts);
}
