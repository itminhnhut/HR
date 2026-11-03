import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CvMatchResult, ScoreInput } from '../types.js';
import { loadDataset, type FreshAd, type FreshCv } from './dataset.js';
import type { CvRow, ItemRow } from './metrics.js';
import { buildReport, cvsTsv, itemsTsv, SYNTHETIC_NOTICE } from './report.js';

const TODAY = '2026-11-03';

type Scorer = (input: ScoreInput) => CvMatchResult;

interface Output {
  report: string;
  items: string;
  cvs: string;
}

function scoreOne(score: Scorer, ad: FreshAd, cv: FreshCv): { cvRow: CvRow; itemRows: ItemRow[] } {
  const base = { adId: ad.id, cvId: cv.id, kind: cv.kind, difficulty: cv.difficulty, tier: cv.tier };
  const requirements = ad.requirements.map((req) => req.line);
  const attempt = ((): { result: CvMatchResult | null; error: string | null } => {
    try {
      return { result: score({ cvText: cv.text, requirements, today: TODAY }), error: null };
    } catch (cause) {
      return { result: null, error: cause instanceof Error ? cause.message : String(cause) };
    }
  })();
  const itemRows = ad.requirements.map((req, i): ItemRow => {
    const item = attempt.result?.items[i];
    return {
      ...base,
      category: req.category,
      isBonus: req.isBonus,
      line: req.line,
      gold: cv.labels[i] ?? 'ambiguous',
      bot: item?.verdict ?? 'unknown',
      counted: item?.counted ?? false,
      evidence: item?.evidence ?? '',
      reason: item?.reason ?? '',
    };
  });
  const hasText = cv.text !== '';
  // Same rule as scoreApplication in apps/api/src/services/cv-score.ts: no text means no percent.
  const percent = hasText ? (attempt.result?.percent ?? null) : null;
  return { cvRow: { ...base, percent, hasText, error: attempt.error }, itemRows };
}

function measure(ads: readonly FreshAd[], score: Scorer, version: number): Output {
  const scored = ads.flatMap((ad) => ad.cvs.map((cv) => scoreOne(score, ad, cv)));
  const items = scored.flatMap((entry) => entry.itemRows);
  const cvs = scored.map((entry) => entry.cvRow);
  return { report: buildReport(items, cvs, version), items: itemsTsv(items), cvs: cvsTsv(cvs) };
}

function notMeasured(title: string, details: readonly string[]): Output {
  return { report: [SYNTHETIC_NOTICE, '', title, ...details, ''].join('\n'), items: '', cvs: '' };
}

/** The matcher is imported only after the data passes its checks, so a bad file is fixed without seeing any output. */
async function run(dir: string): Promise<Output> {
  const { ads, problems } = loadDataset(dir);
  if (problems.length > 0) return notMeasured('NOT MEASURED: the data failed its checks. Nothing was scored.', problems);
  try {
    const { scoreCv, CV_MATCH_VERSION } = await import('../index.js');
    return measure(ads, scoreCv, CV_MATCH_VERSION);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return notMeasured('NOT MEASURED: the matcher could not be loaded.', [message]);
  }
}

describe('fresh blind measurement of the CV matcher', () => {
  it('should write a report whatever the accuracy turns out to be', async () => {
    // Arrange
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const outDir = join(dir, 'out');
    mkdirSync(outDir, { recursive: true });

    // Act
    const output = await run(dir);
    writeFileSync(join(outDir, 'report.txt'), output.report);
    writeFileSync(join(outDir, 'items.tsv'), output.items);
    writeFileSync(join(outDir, 'cvs.tsv'), output.cvs);

    // Assert
    expect(readFileSync(join(outDir, 'report.txt'), 'utf8')).toContain('DATA IS SYNTHETIC');
  }, 300_000);
});
