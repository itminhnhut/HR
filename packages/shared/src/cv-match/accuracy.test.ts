/// <reference types="node" />
/**
 * Accuracy of the CV matcher against hand-labelled cases in ./fixtures (see spec-cv-match.md, section 4).
 * The fixtures were labelled independently of the scorer; when a threshold fails, the message lists every
 * disagreement so the scorer can be fixed (or a label challenged in review).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { scoreCv } from './index.js';
import type { CvMatchCase, CvMatchResult, MatchVerdict } from './types.js';

const MIN_MET_PRECISION = 0.95;
const MAX_FALSE_MET_ON_UNMET = 1;
const MIN_MEASURABLE_RECALL = 0.85;

const verdictSchema = z.enum(['met', 'unmet', 'unknown']);
const caseSchema = z
  .object({
    id: z.string().min(1),
    notes: z.string(),
    cvText: z.string(),
    requirements: z.array(z.string().min(1)).min(1),
    expected: z.array(verdictSchema),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((c) => c.expected.length === c.requirements.length, 'expected[] must align with requirements[]');

const FIXTURES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');

function loadCases(): CvMatchCase[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const raw: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
      const parsed = caseSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`Invalid fixture ${name}: ${parsed.error.message}`);
      return parsed.data;
    });
}

interface Row {
  caseId: string;
  requirement: string;
  expected: MatchVerdict;
  got: MatchVerdict;
  reason: string | null;
}

interface Scored {
  testCase: CvMatchCase;
  result: CvMatchResult;
}

function isEmptyCv(testCase: CvMatchCase): boolean {
  return testCase.cvText.trim() === '';
}

function score(testCase: CvMatchCase): CvMatchResult {
  try {
    return scoreCv({ cvText: testCase.cvText, requirements: testCase.requirements, today: testCase.today });
  } catch (error) {
    throw new Error(`scoreCv threw on case ${testCase.id}`, { cause: error });
  }
}

function toRows(scored: Scored[]): Row[] {
  return scored.flatMap(({ testCase, result }) =>
    testCase.requirements.map((requirement, i) => ({
      caseId: testCase.id,
      requirement,
      expected: testCase.expected[i],
      got: result.items[i]?.verdict ?? 'unknown',
      reason: result.items[i]?.reason ?? null,
    })),
  );
}

function clip(text: string, width: number): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > width ? `${flat.slice(0, width - 1)}…` : flat.padEnd(width);
}

/** Readable table of disagreements; false "met" first because they are the costliest. */
function mismatchTable(rows: Row[]): string {
  const severity = (r: Row): number => (r.got === 'met' ? 0 : r.expected === 'unknown' ? 2 : 1);
  const mismatches = rows.filter((r) => r.got !== r.expected).sort((a, b) => severity(a) - severity(b));
  if (mismatches.length === 0) return 'No mismatches.';
  const header = `${clip('case', 44)} | ${clip('requirement', 52)} | ${clip('expected', 8)} | ${clip('got', 8)} | reason`;
  const lines = mismatches.map(
    (r) =>
      `${clip(r.caseId, 44)} | ${clip(r.requirement, 52)} | ${clip(r.expected, 8)} | ${clip(r.got, 8)} | ${r.reason ?? ''}`,
  );
  return [`${mismatches.length} mismatch(es):`, header, '-'.repeat(header.length), ...lines].join('\n');
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 1 : part / whole;
}

describe('cv-match accuracy on labelled fixtures', () => {
  const cases = loadCases();
  let scored: Scored[] = [];
  let rows: Row[] = [];
  let table = '';

  beforeAll(() => {
    scored = cases.map((testCase) => ({ testCase, result: score(testCase) }));
    rows = toRows(scored);
    table = mismatchTable(rows);
  });

  it('has enough labelled cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(36);
  });

  it('returns one item per requirement, in order', () => {
    const broken = scored
      .filter(({ testCase, result }) => {
        const sameLength = result.items.length === testCase.requirements.length;
        return !sameLength || result.items.some((item, i) => item.requirement !== testCase.requirements[i]);
      })
      .map(({ testCase }) => testCase.id);
    expect(broken, `items do not mirror requirements in: ${broken.join(', ')}`).toEqual([]);
  });

  it(`keeps precision of "met" at or above ${MIN_MET_PRECISION * 100}%`, () => {
    const saidMet = rows.filter((r) => r.got === 'met');
    const correct = saidMet.filter((r) => r.expected === 'met').length;
    const precision = ratio(correct, saidMet.length);
    expect(precision, `precision ${correct}/${saidMet.length}\n${table}`).toBeGreaterThanOrEqual(MIN_MET_PRECISION);
  });

  it(`says "met" for at most ${MAX_FALSE_MET_ON_UNMET} item labelled "unmet"`, () => {
    const falseMet = rows.filter((r) => r.expected === 'unmet' && r.got === 'met').length;
    expect(falseMet, table).toBeLessThanOrEqual(MAX_FALSE_MET_ON_UNMET);
  });

  it(`recalls at least ${MIN_MEASURABLE_RECALL * 100}% of measurable items`, () => {
    const measurable = rows.filter((r) => r.expected !== 'unknown');
    const agreed = measurable.filter((r) => r.got === r.expected).length;
    const recall = ratio(agreed, measurable.length);
    expect(recall, `recall ${agreed}/${measurable.length}\n${table}`).toBeGreaterThanOrEqual(MIN_MEASURABLE_RECALL);
  });

  it('judges nothing when the CV has no text (scanned)', () => {
    const empty = scored.filter(({ testCase }) => isEmptyCv(testCase));
    expect(empty.length).toBeGreaterThan(0);
    const wrong = empty
      .filter(({ result }) => result.percent !== null || result.items.some((item) => item.verdict !== 'unknown'))
      .map(({ testCase }) => testCase.id);
    expect(wrong, `empty CVs must be all "unknown" with percent null: ${wrong.join(', ')}`).toEqual([]);
  });

  it('computes percent as round(100 * met / (met + unmet)), or null when nothing was judged', () => {
    const wrong = scored
      .map(({ testCase, result }) => {
        const met = result.items.filter((item) => item.verdict === 'met').length;
        const unmet = result.items.filter((item) => item.verdict === 'unmet').length;
        const want = met + unmet === 0 ? null : Math.round((100 * met) / (met + unmet));
        return { id: testCase.id, want, got: result.percent };
      })
      .filter(({ want, got }) => want !== got);
    expect(wrong, wrong.map((w) => `${w.id}: want ${w.want}, got ${w.got}`).join('\n')).toEqual([]);
  });
});
