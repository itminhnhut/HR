/// <reference types="node" />
/**
 * Writes the full evaluation numbers as JSON when CV_EVAL_REPORT names a file. Lets a person check the summary
 * figures without reading test output. Synthetic CVs: not a real-world accuracy figure.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_JOBS } from './all-jobs.js';
import { LABEL_CHANGES } from './label-changes.js';
import { readLine, worstSeverity } from './line-reading.js';
import { LINE_TRUTH } from './line-truth.js';
import { pairStats, scoreJob, thresholdTable, tierPercents, verdictStats, type ScoredJob } from './metrics.js';

function jobReport(scored: ScoredJob) {
  const rows = scored.cvs.flatMap((c) => c.rows);
  const interview = tierPercents(scored, 'interview');
  const maybe = tierPercents(scored, 'maybe');
  const no = tierPercents(scored, 'no');
  const labelInterview = tierPercents(scored, 'interview', 'labels');
  const labelNo = tierPercents(scored, 'no', 'labels');
  return {
    slug: scored.job.slug,
    cvs: scored.cvs.length,
    verdicts: verdictStats(rows),
    perLine: scored.job.keys.map((key) => ({
      key,
      requirement: rows.find((r) => r.key === key)?.requirement,
      stats: verdictStats(rows.filter((r) => r.key === key)),
    })),
    tiers: { interview, maybe, no },
    debatable: scored.cvs
      .filter((c) => c.cv.tierDebatable !== undefined)
      .map((c) => ({ id: c.cv.id, tier: c.cv.tier, percent: c.percent, why: c.cv.tierDebatable })),
    separation: {
      interviewVsNo: pairStats(interview, no),
      interviewVsMaybe: pairStats(interview, maybe),
      maybeVsNo: pairStats(maybe, no),
      labelPercentInterviewVsNo: pairStats(labelInterview, labelNo),
    },
    thresholds: thresholdTable(interview, no),
    stuffing: scored.cvs
      .filter((c) => c.cv.kind === 'stuffing')
      .map((c) => ({ id: c.cv.id, percent: c.percent, labelPercent: c.labelPercent })),
    perCv: scored.cvs.map((c) => ({
      id: c.cv.id,
      kind: c.cv.kind,
      form: c.cv.form,
      tier: c.cv.tier,
      percent: c.percent,
      labelPercent: c.labelPercent,
    })),
    disagreements: rows
      .filter((r) => r.label !== 'ambiguous' && r.label !== r.got)
      .map((r) => ({ cvId: r.cvId, key: r.key, label: r.label, got: r.got, reason: r.reason, evidence: r.evidence })),
    ambiguous: rows
      .filter((r) => r.label === 'ambiguous')
      .map((r) => ({ cvId: r.cvId, key: r.key, got: r.got, reason: r.reason })),
  };
}

function lineReport() {
  return Object.entries(LINE_TRUTH).map(([slug, table]) => ({
    slug,
    lines: table.map((truth) => {
      const { parsed, findings } = readLine(truth);
      return { line: truth.line, severity: worstSeverity(findings), findings, atoms: parsed.atoms, parsed };
    }),
  }));
}

describe('evaluation report', () => {
  it('should cover every job and be writable on request', () => {
    // Act
    const scored = ALL_JOBS.map(scoreJob);
    const allRows = scored.flatMap((job) => job.cvs.flatMap((c) => c.rows));
    const report = {
      note: 'Synthetic CVs written for this test; not a real-world accuracy figure.',
      overall: verdictStats(allRows),
      jobs: scored.map(jobReport),
      lines: lineReport(),
      labelChanges: LABEL_CHANGES,
    };
    const target = process.env.CV_EVAL_REPORT;
    if (target) writeFileSync(target, JSON.stringify(report, null, 2));

    // Assert
    expect(report.jobs).toHaveLength(ALL_JOBS.length);
    expect(report.lines).toHaveLength(ALL_JOBS.length);
  });
});
