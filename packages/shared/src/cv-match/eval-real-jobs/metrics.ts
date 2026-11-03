/**
 * Pure numbers of the evaluation: verdict agreement per requirement and tier separation per job.
 */
import { scoreCv } from '../index.js';
import type { MatchVerdict } from '../types.js';
import { loadJob, scoredLines } from './job-lines.js';
import type { JobEval, Label, LabelledCv, Tier } from './types.js';

/** All evaluation dates are read as of this day; CVs were written against it. */
export const EVAL_TODAY = '2026-11-03';

export interface Row {
  job: string;
  cvId: string;
  kind: LabelledCv['kind'];
  form: LabelledCv['form'];
  key: string;
  requirement: string;
  label: Label;
  got: MatchVerdict;
  reason: string | null;
  evidence: string | null;
}

export interface ScoredCv {
  cv: LabelledCv;
  percent: number | null;
  /** The percent if every verdict matched the labels (ambiguous treated as not judged). */
  labelPercent: number | null;
  rows: Row[];
}

export interface ScoredJob {
  job: JobEval;
  lines: string[];
  cvs: ScoredCv[];
}

function percentOf(met: number, unmet: number): number | null {
  return met + unmet === 0 ? null : Math.round((100 * met) / (met + unmet));
}

function labelPercent(cv: LabelledCv, keys: readonly string[]): number | null {
  const labels = keys.map((key) => labelOf(cv, key));
  return percentOf(labels.filter((l) => l === 'met').length, labels.filter((l) => l === 'unmet').length);
}

function labelOf(cv: LabelledCv, key: string): Label {
  const label = cv.labels[key];
  if (label === undefined) throw new Error(`${cv.id} has no label for "${key}"`);
  return label;
}

function keyAt(job: JobEval, index: number): string {
  const key = job.keys[index];
  if (key === undefined) throw new Error(`${job.slug} has no key for line ${index}`);
  return key;
}

function scoreOne(job: JobEval, lines: string[], cv: LabelledCv): ScoredCv {
  const result = scoreCv({ cvText: cv.text, requirements: lines, today: EVAL_TODAY });
  const rows = result.items.map((item, i): Row => {
    const key = keyAt(job, i);
    return {
      job: job.short,
      cvId: cv.id,
      kind: cv.kind,
      form: cv.form,
      key,
      requirement: item.requirement,
      label: labelOf(cv, key),
      got: item.verdict,
      reason: item.reason,
      evidence: item.evidence,
    };
  });
  return { cv, percent: result.percent, labelPercent: labelPercent(cv, job.keys), rows };
}

export function scoreJob(job: JobEval): ScoredJob {
  const lines = scoredLines(loadJob(job.slug));
  return { job, lines, cvs: job.cvs.map((cv) => scoreOne(job, lines, cv)) };
}

export interface VerdictStats {
  rows: number;
  ambiguous: number;
  judged: number;
  correct: number;
  accuracy: number;
  labelMet: number;
  labelUnmet: number;
  labelUnknown: number;
  /** Labelled unmet, bot said met. */
  falseMet: number;
  falseMetRate: number;
  /** Labelled unknown (soft or bonus not shown), bot said met. */
  metOnUnknown: number;
  /** Labelled met, bot said unmet. */
  falseUnmet: number;
  falseUnmetRate: number;
  /** Labelled unknown, bot said unmet. */
  unmetOnUnknown: number;
  /** Labelled met or unmet, bot said unknown. */
  abstainedOnMet: number;
  abstainedOnUnmet: number;
  saidMet: number;
  saidMetCorrect: number;
  metPrecision: number;
  measurable: number;
  measurableAgreed: number;
  measurableRecall: number;
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

export function verdictStats(rows: readonly Row[]): VerdictStats {
  const judged = rows.filter((r) => r.label !== 'ambiguous');
  const count = (label: Label, got: MatchVerdict) => judged.filter((r) => r.label === label && r.got === got).length;
  const labelMet = judged.filter((r) => r.label === 'met').length;
  const labelUnmet = judged.filter((r) => r.label === 'unmet').length;
  const correct = judged.filter((r) => r.label === r.got).length;
  const saidMet = judged.filter((r) => r.got === 'met').length;
  const measurable = labelMet + labelUnmet;
  const measurableAgreed = count('met', 'met') + count('unmet', 'unmet');
  return {
    rows: rows.length,
    ambiguous: rows.length - judged.length,
    judged: judged.length,
    correct,
    accuracy: ratio(correct, judged.length),
    labelMet,
    labelUnmet,
    labelUnknown: judged.length - measurable,
    falseMet: count('unmet', 'met'),
    falseMetRate: ratio(count('unmet', 'met'), labelUnmet),
    metOnUnknown: count('unknown', 'met'),
    falseUnmet: count('met', 'unmet'),
    falseUnmetRate: ratio(count('met', 'unmet'), labelMet),
    unmetOnUnknown: count('unknown', 'unmet'),
    abstainedOnMet: count('met', 'unknown'),
    abstainedOnUnmet: count('unmet', 'unknown'),
    saidMet,
    saidMetCorrect: count('met', 'met'),
    metPrecision: ratio(count('met', 'met'), saidMet),
    measurable,
    measurableAgreed,
    measurableRecall: ratio(measurableAgreed, measurable),
  };
}

export interface TierView {
  id: string;
  percent: number;
}

export interface PairStats {
  pairs: number;
  /** Lower tier strictly above the higher tier. */
  inverted: number;
  tied: number;
  /** Share of pairs ordered correctly, ties counted as half. */
  auc: number;
  worst: { low: string; lowPercent: number; high: string; highPercent: number }[];
}

export function tierPercents(job: ScoredJob, tier: Tier, use: 'bot' | 'labels' = 'bot'): TierView[] {
  return job.cvs
    .filter((c) => c.cv.tier === tier && c.cv.tierDebatable === undefined)
    .map((c) => ({ id: c.cv.id, percent: (use === 'bot' ? c.percent : c.labelPercent) ?? 0 }));
}

export function pairStats(high: readonly TierView[], low: readonly TierView[]): PairStats {
  const pairs = high.flatMap((h) => low.map((l) => ({ h, l })));
  const inverted = pairs.filter(({ h, l }) => l.percent > h.percent);
  const tied = pairs.filter(({ h, l }) => l.percent === h.percent).length;
  const right = pairs.length - inverted.length - tied;
  return {
    pairs: pairs.length,
    inverted: inverted.length,
    tied,
    auc: ratio(right + tied / 2, pairs.length),
    worst: [...inverted]
      .sort((a, b) => b.l.percent - b.h.percent - (a.l.percent - a.h.percent))
      .slice(0, 5)
      .map(({ h, l }) => ({ low: l.id, lowPercent: l.percent, high: h.id, highPercent: h.percent })),
  };
}

export interface ThresholdRow {
  threshold: number;
  interviewKept: number;
  interviewTotal: number;
  noPassed: number;
  noTotal: number;
}

/** What "percent >= threshold means worth reading" would do at every threshold worth looking at. */
export function thresholdTable(high: readonly TierView[], low: readonly TierView[]): ThresholdRow[] {
  const candidates = [...new Set([...high, ...low].map((v) => v.percent))].sort((a, b) => a - b);
  return candidates.map((threshold) => ({
    threshold,
    interviewKept: high.filter((v) => v.percent >= threshold).length,
    interviewTotal: high.length,
    noPassed: low.filter((v) => v.percent >= threshold).length,
    noTotal: low.length,
  }));
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
