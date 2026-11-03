import type { MatchVerdict } from '../types.js';
import type { Category, CvKind, Difficulty, Gold, Tier } from './dataset.js';

export interface ItemRow {
  adId: string;
  cvId: string;
  kind: CvKind;
  difficulty: Difficulty;
  tier: Tier;
  category: Category;
  isBonus: boolean;
  line: string;
  gold: Gold;
  bot: MatchVerdict;
  counted: boolean;
  evidence: string;
  reason: string;
}

export interface CvRow {
  adId: string;
  cvId: string;
  kind: CvKind;
  difficulty: Difficulty;
  tier: Tier;
  percent: number | null;
  hasText: boolean;
  error: string | null;
}

export interface Ratio {
  n: number;
  d: number;
}

export type Confusion = Record<Gold, Record<MatchVerdict, number>>;

export interface Stats {
  confusion: Confusion;
  /** Lines with a met, unmet or unknown label; ambiguous lines are reported apart. */
  scored: number;
  accuracy: Ratio;
  /** Accuracy over lines a recruiter could decide (met or unmet). */
  decidedAccuracy: Ratio;
  metPrecision: Ratio;
  metRecall: Ratio;
  falseMet: Ratio;
  metWithoutBasis: Ratio;
  falseNotMet: Ratio;
  metLeftUnknown: Ratio;
  unmetLeftUnknown: Ratio;
  unknownRate: Ratio;
  unknownThatShouldBeDecided: Ratio;
  decidedThoughUnknowable: Ratio;
}

export interface InvertedPair {
  adId: string;
  highId: string;
  highPercent: number;
  lowId: string;
  lowPercent: number;
  lowKind: CvKind;
}

export interface PairStats {
  /** Pairs where both CVs have a percent. */
  pairs: number;
  /** Lower-tier CV scored at or above the higher-tier CV. */
  atOrAbove: number;
  strictlyAbove: number;
  /** Pairs left out because at least one CV has no percent. */
  nullPairs: number;
  inverted: InvertedPair[];
}

const zeroCounts = (): Record<MatchVerdict, number> => ({ met: 0, unmet: 0, unknown: 0 });

export function confusionOf(rows: readonly ItemRow[]): Confusion {
  const start: Confusion = { met: zeroCounts(), unmet: zeroCounts(), unknown: zeroCounts(), ambiguous: zeroCounts() };
  return rows.reduce<Confusion>(
    (acc, row) => ({ ...acc, [row.gold]: { ...acc[row.gold], [row.bot]: acc[row.gold][row.bot] + 1 } }),
    start,
  );
}

const sum = (counts: Record<MatchVerdict, number>): number => counts.met + counts.unmet + counts.unknown;

export function statsOf(rows: readonly ItemRow[]): Stats {
  const c = confusionOf(rows);
  const goldMet = sum(c.met);
  const goldUnmet = sum(c.unmet);
  const goldUnknown = sum(c.unknown);
  const scored = goldMet + goldUnmet + goldUnknown;
  const botMet = c.met.met + c.unmet.met + c.unknown.met;
  const botUnknown = c.met.unknown + c.unmet.unknown + c.unknown.unknown;
  const agreedDecided = c.met.met + c.unmet.unmet;
  return {
    confusion: c,
    scored,
    accuracy: { n: agreedDecided + c.unknown.unknown, d: scored },
    decidedAccuracy: { n: agreedDecided, d: goldMet + goldUnmet },
    metPrecision: { n: c.met.met, d: botMet },
    metRecall: { n: c.met.met, d: goldMet },
    falseMet: { n: c.unmet.met, d: goldUnmet },
    metWithoutBasis: { n: c.unknown.met, d: goldUnknown },
    falseNotMet: { n: c.met.unmet, d: goldMet },
    metLeftUnknown: { n: c.met.unknown, d: goldMet },
    unmetLeftUnknown: { n: c.unmet.unknown, d: goldUnmet },
    unknownRate: { n: botUnknown, d: scored },
    unknownThatShouldBeDecided: { n: c.met.unknown + c.unmet.unknown, d: botUnknown },
    decidedThoughUnknowable: { n: c.unknown.met + c.unknown.unmet, d: goldUnknown },
  };
}

interface PairCompare {
  low: CvRow;
  high: CvRow;
}

function allPairs(cvs: readonly CvRow[], high: Tier, low: Tier): PairCompare[] {
  const inAd = (adId: string, tier: Tier) => cvs.filter((cv) => cv.adId === adId && cv.tier === tier);
  const adIds = [...new Set(cvs.map((cv) => cv.adId))];
  return adIds.flatMap((adId) => inAd(adId, high).flatMap((h) => inAd(adId, low).map((l) => ({ high: h, low: l }))));
}

/** Compares two tiers CV by CV inside each ad: a recruiter only ever ranks CVs of one job against each other. */
export function comparePairs(cvs: readonly CvRow[], high: Tier, low: Tier): PairStats {
  const pairs = allPairs(cvs, high, low);
  const known = pairs.flatMap((pair) =>
    pair.high.percent === null || pair.low.percent === null
      ? []
      : [{ ...pair, highPercent: pair.high.percent, lowPercent: pair.low.percent }],
  );
  const atOrAbove = known.filter((pair) => pair.lowPercent >= pair.highPercent);
  return {
    pairs: known.length,
    atOrAbove: atOrAbove.length,
    strictlyAbove: known.filter((pair) => pair.lowPercent > pair.highPercent).length,
    nullPairs: pairs.length - known.length,
    inverted: atOrAbove.map((pair) => ({
      adId: pair.high.adId,
      highId: pair.high.cvId,
      highPercent: pair.highPercent,
      lowId: pair.low.cvId,
      lowPercent: pair.lowPercent,
      lowKind: pair.low.kind,
    })),
  };
}

export function meanPercent(cvs: readonly CvRow[]): number | null {
  const percents = cvs.flatMap((cv) => (cv.percent === null ? [] : [cv.percent]));
  if (percents.length === 0) return null;
  return percents.reduce((total, percent) => total + percent, 0) / percents.length;
}
