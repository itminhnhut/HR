/// <reference types="node" />
/**
 * Gate on the accuracy of the CV matcher on SYNTHETIC CVs, labelled by reading each CV as a careful recruiter before
 * the scorer was run. This is not a real-world accuracy figure: the corpus is invented and over-samples hard cases on
 * purpose, and the scorer has since been tuned on it, so it guards against regressions and proves no held-out accuracy.
 *
 * The floors and ceilings below sit at or just below what the scorer reaches. Per-line disagreements are report output,
 * not failing tests: set CV_HOLDOUT_REPORT to a file path to get them. Lines labelled "ambiguous" (a reasonable
 * recruiter could go either way) are listed in the report and not counted.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { scoreCv } from '../index.js';
import type { MatchVerdict } from '../types.js';

const TODAY = '2026-11-03';
const MIN_CASES = 120;
const MIN_PAIRS = 30;
/** Targets stated in spec-cv-match.md section 4. */
const SPEC_MET_PRECISION = 0.95;
const SPEC_MEASURABLE_AGREEMENT = 0.85;
/** At or just below what the scorer reaches on this corpus. */
const FLOOR_ACCURACY = 0.975;
const FLOOR_MET_PRECISION = 0.995;
const FLOOR_MET_RECALL = 0.97;
const FLOOR_MEASURABLE_AGREEMENT = 0.96;
const CEILING_FALSE_MET = 0;
const CEILING_FALSE_NOT_MET = 2;
/** 18, not 17: a line answered only by similar wording now stays open with its quote (spec: 64% right on the blind set). */
const CEILING_DISAGREEMENTS = 18;

const clearLabelSchema = z.enum(['met', 'unmet', 'unknown']);
const labelSchema = z.enum(['met', 'unmet', 'unknown', 'ambiguous']);
const CATEGORIES = ['experience', 'education', 'language', 'licence', 'skills', 'soft'] as const;
const categorySchema = z.enum(CATEGORIES);
const itemSchema = z.tuple([z.string().min(1), labelSchema, categorySchema]).rest(z.string());
const caseSchema = z.object({
  id: z.string().min(1),
  notes: z.string(),
  transform: z.literal('nfd').optional(),
  cvText: z.string(),
  items: z.array(itemSchema).min(1),
});
const pairSchema = z.object({
  id: z.string().min(1),
  why: z.string().min(1),
  requirements: z.array(z.string().min(1)).min(1),
  strong: z.string().min(1),
  weak: z.string().min(1),
});

type Label = z.infer<typeof labelSchema>;
type Category = z.infer<typeof categorySchema>;
type Got = MatchVerdict | 'threw';

interface Row {
  caseId: string;
  theme: string;
  requirement: string;
  want: Label;
  category: Category;
  got: Got;
  reason: string | null;
  evidence: string | null;
}

interface PairOutcome {
  id: string;
  why: string;
  strong: number | null;
  weak: number | null;
}

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');

function readFixture(name: string): unknown {
  const raw: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
  return raw;
}

function fixtureNames(prefix: string): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .sort();
}

function scoreOrNull(cvText: string, requirements: string[]): ReturnType<typeof scoreCv> | null {
  try {
    return scoreCv({ cvText, requirements, today: TODAY });
  } catch (error) {
    process.stderr.write(`scoreCv threw: ${String(error)}\n`);
    return null;
  }
}

function loadRows(prefix: string): { rows: Row[]; caseCount: number } {
  const perFile = fixtureNames(prefix).map((name) => {
    const cases = z.array(caseSchema).parse(readFixture(name));
    const theme = name.replace(/^cases-\d+-/, '').replace(/\.json$/, '');
    return { theme, cases };
  });
  const rows = perFile.flatMap(({ theme, cases }) =>
    cases.flatMap((testCase) => {
      const text = testCase.transform === 'nfd' ? testCase.cvText.normalize('NFD') : testCase.cvText;
      const result = scoreOrNull(
        text,
        testCase.items.map((item) => item[0]),
      );
      return testCase.items.map(([requirement, want, category], i): Row => {
        const item = result?.items[i];
        return {
          caseId: testCase.id,
          theme,
          requirement,
          want,
          category,
          got: result === null ? 'threw' : (item?.verdict ?? 'unknown'),
          reason: item?.reason ?? null,
          evidence: item?.evidence ?? null,
        };
      });
    }),
  );
  return { rows, caseCount: perFile.reduce((sum, file) => sum + file.cases.length, 0) };
}

function loadPairs(prefix: string): PairOutcome[] {
  return fixtureNames(prefix)
    .flatMap((name) => z.array(pairSchema).parse(readFixture(name)))
    .map((pair) => ({
      id: pair.id,
      why: pair.why,
      strong: scoreOrNull(pair.strong, pair.requirements)?.percent ?? null,
      weak: scoreOrNull(pair.weak, pair.requirements)?.percent ?? null,
    }));
}

function pct(part: number, whole: number): string {
  if (whole === 0) return `${part}/0 (n/a)`;
  return `${part}/${whole} (${((100 * part) / whole).toFixed(1)}%)`;
}

function count(rows: readonly Row[], want: Label, got: Got): number {
  return rows.filter((r) => r.want === want && r.got === got).length;
}

function isClear(row: Row): boolean {
  return row.want !== 'ambiguous';
}

/** The list sorts a CV without a percent ("chưa đủ dữ liệu") last, so here it ranks below any percent. */
function pairWins(pair: PairOutcome): boolean {
  return pair.strong !== null && pair.strong > (pair.weak ?? -1);
}

function confusionLines(rows: readonly Row[]): string[] {
  const wants: Label[] = ['met', 'unmet', 'unknown'];
  const body = wants.map((want) => {
    const cells = (['met', 'unmet', 'unknown'] as const).map((got) => String(count(rows, want, got)).padStart(7));
    return `want ${want.padEnd(8)}${cells.join('')}`;
  });
  return ['Confusion (rows = recruiter, columns = bot):', `${' '.repeat(13)}    met  unmet  unknown`, ...body];
}

function overallLines(rows: readonly Row[]): string[] {
  const agreed = rows.filter((r) => r.got === r.want).length;
  const saidMet = rows.filter((r) => r.got === 'met').length;
  const wantMet = rows.filter((r) => r.want === 'met').length;
  const wantUnmet = rows.filter((r) => r.want === 'unmet').length;
  const wantUnknown = rows.filter((r) => r.want === 'unknown').length;
  const saidUnknown = rows.filter((r) => r.got === 'unknown').length;
  const tp = count(rows, 'met', 'met');
  const decided = rows.filter((r) => r.want !== 'unknown' && r.got !== 'unknown');
  return [
    `Per-requirement accuracy: ${pct(agreed, rows.length)}`,
    `Precision of "met": ${pct(tp, saidMet)}`,
    `Recall of "met": ${pct(tp, wantMet)}`,
    `False-met rate (want unmet, says met): ${pct(count(rows, 'unmet', 'met'), wantUnmet)}`,
    `Says met on a line that cannot be judged (want unknown, says met): ${pct(count(rows, 'unknown', 'met'), wantUnknown)}`,
    `False-not-met rate (want met, says unmet): ${pct(count(rows, 'met', 'unmet'), wantMet)}`,
    `Says unmet on a line that cannot be judged (want unknown, says unmet): ${pct(count(rows, 'unknown', 'unmet'), wantUnknown)}`,
    `Says unknown overall: ${pct(saidUnknown, rows.length)}`,
    `  of which should be unknown: ${pct(count(rows, 'unknown', 'unknown'), saidUnknown)}`,
    `  abstained where want met: ${pct(count(rows, 'met', 'unknown'), wantMet)}`,
    `  abstained where want unmet: ${pct(count(rows, 'unmet', 'unknown'), wantUnmet)}`,
    `Should be unknown and is: ${pct(count(rows, 'unknown', 'unknown'), wantUnknown)}`,
    `Accuracy when both sides decided (met/unmet only): ${pct(decided.filter((r) => r.got === r.want).length, decided.length)}`,
  ];
}

function breakdownLines(title: string, rows: readonly Row[], key: (row: Row) => string): string[] {
  const keys = [...new Set(rows.map(key))].sort();
  return [
    title,
    ...keys.map((k) => {
      const group = rows.filter((r) => key(r) === k);
      const falseMet = group.filter((r) => r.want === 'unmet' && r.got === 'met').length;
      const falseUnmet = group.filter((r) => r.want === 'met' && r.got === 'unmet').length;
      const agreed = group.filter((r) => r.got === r.want).length;
      return `  ${k.padEnd(18)} ${pct(agreed, group.length).padEnd(18)} false-met ${falseMet}, false-not-met ${falseUnmet}`;
    }),
  ];
}

function rowLine(r: Row): string {
  const evidence = r.evidence ? ` | evidence: ${r.evidence.replace(/\s+/g, ' ')}` : '';
  return `  [${r.category}] ${r.caseId} | "${r.requirement}" | want ${r.want}, got ${r.got} | ${r.reason ?? ''}${evidence}`;
}

function mismatchLines(rows: readonly Row[]): string[] {
  const severity = (r: Row): number => {
    if (r.want === 'unmet' && r.got === 'met') return 0;
    if (r.want === 'met' && r.got === 'unmet') return 1;
    if (r.got === 'met') return 2;
    if (r.got === 'unmet') return 3;
    return 4;
  };
  const wrong = rows.filter((r) => r.got !== r.want);
  const sorted = [...wrong].sort((a, b) => severity(a) - severity(b));
  return [`Disagreements (${wrong.length}), worst first:`, ...sorted.map(rowLine)];
}

function pairLines(pairs: readonly PairOutcome[]): string[] {
  const wins = pairs.filter(pairWins).length;
  const losers = pairs.filter((p) => !pairWins(p));
  return [
    `Score sanity, stronger CV outscores weaker: ${pct(wins, pairs.length)}`,
    ...losers.map((p) => `  ${p.id}: strong ${p.strong ?? 'null'}, weak ${p.weak ?? 'null'} | ${p.why}`),
  ];
}

function posthocLines(rows: readonly Row[], pairs: readonly PairOutcome[]): string[] {
  const wrong = rows.filter((r) => r.got !== r.want);
  return [
    'Post-hoc probes, written after reading the scorer, NOT in the numbers above:',
    `  Lines agreeing: ${pct(rows.length - wrong.length, rows.length)}`,
    ...wrong.map(rowLine),
    ...pairLines(pairs),
  ];
}

function buildReport(
  rows: readonly Row[],
  caseCount: number,
  pairs: readonly PairOutcome[],
  posthoc: { rows: readonly Row[]; pairs: readonly PairOutcome[] },
): string {
  const clear = rows.filter(isClear);
  const ambiguous = rows.filter((r) => !isClear(r));
  const ambiguousCounts = (['met', 'unmet', 'unknown'] as const).map(
    (got) => `${got} ${ambiguous.filter((r) => r.got === got).length}`,
  );
  return [
    '=== CV MATCH REPORT: SYNTHETIC DATA, TUNED ON, NOT A REAL-WORLD ACCURACY FIGURE ===',
    `Cases: ${caseCount}. Requirement lines: ${rows.length}. Clear: ${clear.length}. Ambiguous (not counted): ${ambiguous.length}. Pairs: ${pairs.length}.`,
    ...overallLines(clear),
    ...confusionLines(clear),
    ...breakdownLines('Per category:', clear, (r) => r.category),
    ...breakdownLines('Per fixture theme:', clear, (r) => r.theme),
    ...pairLines(pairs),
    `Ambiguous lines, bot said: ${ambiguousCounts.join(', ')}`,
    ...ambiguous.map(rowLine),
    ...mismatchLines(clear),
    ...posthocLines(posthoc.rows, posthoc.pairs),
    '=== END REPORT ===',
  ].join('\n');
}

function agreement(rows: readonly Row[]): number {
  return rows.filter((r) => r.got === r.want).length / rows.length;
}

function shortList(rows: readonly Row[]): string {
  return rows.map(rowLine).join('\n');
}

describe('cv-match on the synthetic corpus', () => {
  const { rows, caseCount } = loadRows('cases-');
  const pairs = loadPairs('pairs-');
  const clear = rows.filter(isClear);
  const measurable = clear.filter((r) => r.want !== 'unknown');
  const posthocRows = loadRows('posthoc-cases').rows;
  const posthocPairs = loadPairs('posthoc-pairs');
  const posthoc = { rows: posthocRows, pairs: posthocPairs };
  const reportPath = process.env.CV_HOLDOUT_REPORT;
  if (reportPath) writeFileSync(reportPath, buildReport(rows, caseCount, pairs, posthoc));

  it('should hold at least the agreed number of labelled cases and score pairs', () => {
    // Assert
    expect(caseCount).toBeGreaterThanOrEqual(MIN_CASES);
    expect(pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS);
  });

  it('should meet the targets of the spec', () => {
    // Arrange
    const saidMet = clear.filter((r) => r.got === 'met');

    // Act
    const precision = agreement(saidMet);
    const agreed = agreement(measurable);

    // Assert
    expect(precision).toBeGreaterThanOrEqual(SPEC_MET_PRECISION);
    expect(agreed).toBeGreaterThanOrEqual(SPEC_MEASURABLE_AGREEMENT);
  });

  it('should not fall below the accuracy it has reached', () => {
    // Arrange
    const saidMet = clear.filter((r) => r.got === 'met');
    const wantMet = clear.filter((r) => r.want === 'met');

    // Assert
    expect(agreement(clear)).toBeGreaterThanOrEqual(FLOOR_ACCURACY);
    expect(agreement(saidMet)).toBeGreaterThanOrEqual(FLOOR_MET_PRECISION);
    expect(agreement(wantMet)).toBeGreaterThanOrEqual(FLOOR_MET_RECALL);
    expect(agreement(measurable)).toBeGreaterThanOrEqual(FLOOR_MEASURABLE_AGREEMENT);
  });

  it('should keep false verdicts under their ceilings', () => {
    // Act
    const falseMet = clear.filter((r) => r.want === 'unmet' && r.got === 'met');
    const falseNotMet = clear.filter((r) => r.want === 'met' && r.got === 'unmet');
    const disagreements = clear.filter((r) => r.got !== r.want);

    // Assert
    expect(falseMet.length, shortList(falseMet)).toBeLessThanOrEqual(CEILING_FALSE_MET);
    expect(falseNotMet.length, shortList(falseNotMet)).toBeLessThanOrEqual(CEILING_FALSE_NOT_MET);
    expect(disagreements.length, shortList(disagreements)).toBeLessThanOrEqual(CEILING_DISAGREEMENTS);
  });

  it('should never throw on a CV', () => {
    // Assert
    expect(rows.filter((r) => r.got === 'threw')).toEqual([]);
  });

  it('should score the clearly stronger CV above the weaker one in every pair', () => {
    // Act
    const losers = pairs.filter((p) => !pairWins(p)).map((p) => p.id);

    // Assert
    expect(losers).toEqual([]);
  });

  it('should keep the post-hoc probes right, lines and pairs', () => {
    // Act
    const wrongLines = posthocRows.filter((r) => isClear(r) && r.got !== r.want);
    const losers = posthocPairs.filter((p) => !pairWins(p)).map((p) => p.id);

    // Assert
    expect(wrongLines.length, shortList(wrongLines)).toBe(0);
    expect(losers).toEqual([]);
  });
});
