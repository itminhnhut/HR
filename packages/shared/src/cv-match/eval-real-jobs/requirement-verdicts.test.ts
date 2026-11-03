/// <reference types="node" />
/**
 * Step 2: per-requirement verdicts against a recruiter's labels on synthetic CVs. A gate: the floors and ceilings sit at
 * or just below what the scorer reaches, and the disagreements go to the report (CV_EVAL_REPORT, see report.test.ts)
 * rather than failing one by one. The scorer has been tuned on these CVs, so this guards against regressions and proves
 * no held-out accuracy. Synthetic CVs: these numbers are not a real-world accuracy figure.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_JOBS } from './all-jobs.js';
import { LABEL_CHANGES } from './label-changes.js';
import { pct, scoreJob, verdictStats, type Row, type ScoredJob } from './metrics.js';

const MIN_CVS_PER_JOB = 25;
/** Targets stated in spec-cv-match.md section 4. */
const SPEC_MET_PRECISION = 0.95;
const SPEC_MEASURABLE_AGREEMENT = 0.85;
/** At or just below what the scorer reaches on these CVs. */
const FLOOR_ACCURACY = 0.99;
const FLOOR_MET_PRECISION = 0.995;
const FLOOR_MEASURABLE_AGREEMENT = 0.99;
const CEILING_FALSE_MET = 0;
const CEILING_FALSE_NOT_MET = 0;

function describeRow(row: Row): string {
  return `${row.cvId} ${row.key}: label ${row.label}, bot ${row.got} (${row.reason ?? 'no reason'})`;
}

function rowsOf(scored: ScoredJob): Row[] {
  return scored.cvs.flatMap((c) => c.rows);
}

function lockedFiles(): { name: string; hash: string }[] {
  const lock = readFileSync(fileURLToPath(new URL('labels.lock.txt', import.meta.url)), 'utf8');
  return lock
    .split('\n')
    .filter((line) => /^[0-9a-f]{64}\s/.test(line))
    .map((line) => {
      const [hash = '', name = ''] = line.split(/\s+/);
      return { name, hash };
    });
}

describe('the labels', () => {
  it('should still match the frozen hashes unless a change is listed', () => {
    // Arrange
    const files = lockedFiles();

    // Act
    const changed = files.filter(({ name, hash }) => {
      const body = readFileSync(fileURLToPath(new URL(name, import.meta.url)));
      return createHash('sha256').update(body).digest('hex') !== hash;
    });

    // Assert
    expect(files.length).toBeGreaterThan(0);
    if (LABEL_CHANGES.length === 0) expect(changed).toEqual([]);
  });
});

for (const evaluation of ALL_JOBS) {
  describe(`recruiter labels on ${evaluation.slug}`, () => {
    const scored = scoreJob(evaluation);
    const rows = rowsOf(scored);

    it(`should have at least ${MIN_CVS_PER_JOB} CVs, each labelled on every scored line`, () => {
      // Assert
      expect(evaluation.cvs.length).toBeGreaterThanOrEqual(MIN_CVS_PER_JOB);
      expect(rows.length).toBe(evaluation.cvs.length * evaluation.keys.length);
      expect(scored.lines.length).toBe(evaluation.keys.length);
    });

    it('should explain every ambiguous label', () => {
      // Arrange
      const unexplained = evaluation.cvs.flatMap((cv) =>
        evaluation.keys
          .filter((key) => cv.labels[key] === 'ambiguous' && !cv.why?.[key])
          .map((key) => `${cv.id}/${key}`),
      );

      // Assert
      expect(unexplained).toEqual([]);
    });

    it('should meet the targets of the spec on this ad', () => {
      // Act
      const stats = verdictStats(rows);

      // Assert
      expect(
        stats.metPrecision,
        `${stats.saidMetCorrect}/${stats.saidMet} = ${pct(stats.metPrecision)}`,
      ).toBeGreaterThanOrEqual(SPEC_MET_PRECISION);
      expect(
        stats.measurableRecall,
        `${stats.measurableAgreed}/${stats.measurable} = ${pct(stats.measurableRecall)}`,
      ).toBeGreaterThanOrEqual(SPEC_MEASURABLE_AGREEMENT);
    });
  });
}

describe('recruiter labels on all the ads', () => {
  const rows = ALL_JOBS.flatMap((job) => rowsOf(scoreJob(job)));
  const stats = verdictStats(rows);
  const wrong = rows.filter((r) => r.label !== 'ambiguous' && r.label !== r.got).map(describeRow);

  it('should not fall below the accuracy it has reached', () => {
    // Assert
    expect(stats.accuracy, wrong.join('\n')).toBeGreaterThanOrEqual(FLOOR_ACCURACY);
    expect(stats.metPrecision).toBeGreaterThanOrEqual(FLOOR_MET_PRECISION);
    expect(stats.measurableRecall).toBeGreaterThanOrEqual(FLOOR_MEASURABLE_AGREEMENT);
  });

  it('should keep false verdicts under their ceilings', () => {
    // Assert
    expect(stats.falseMet, wrong.join('\n')).toBeLessThanOrEqual(CEILING_FALSE_MET);
    expect(stats.falseUnmet, wrong.join('\n')).toBeLessThanOrEqual(CEILING_FALSE_NOT_MET);
  });
});
