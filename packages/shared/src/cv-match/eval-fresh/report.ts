import type { CvKind, Category, Difficulty, Tier } from './dataset.js';
import {
  comparePairs,
  meanPercent,
  statsOf,
  type CvRow,
  type ItemRow,
  type PairStats,
  type Ratio,
  type Stats,
} from './metrics.js';

const TIERS: readonly Tier[] = ['interview', 'maybe', 'no'];
const CATEGORIES: readonly Category[] = ['experience', 'education', 'language', 'licence', 'skills', 'soft'];
const KINDS: readonly CvKind[] = ['strong', 'partial', 'near-miss', 'non-fit', 'stuffing', 'messy'];
const DIFFICULTIES: readonly Difficulty[] = ['ordinary', 'hard'];

export const SYNTHETIC_NOTICE =
  'DATA IS SYNTHETIC: every ad, CV, label and tier was written by one author (an AI agent, blind to the matcher source). ' +
  'This measures a fresh synthetic set, not real CVs.';

const show = ({ n, d }: Ratio): string => (d === 0 ? `${n}/0 (n/a)` : `${n}/${d} (${((100 * n) / d).toFixed(1)}%)`);

function statsLines(stats: Stats): string[] {
  const c = stats.confusion;
  const row = (name: string, counts: { met: number; unmet: number; unknown: number }) =>
    `  label ${name.padEnd(10)} bot met ${counts.met}, bot unmet ${counts.unmet}, bot unknown ${counts.unknown}`;
  return [
    `Accuracy, all scored lines (met, unmet, unknown labels): ${show(stats.accuracy)}`,
    `Accuracy, lines a recruiter could decide (met, unmet): ${show(stats.decidedAccuracy)}`,
    `Precision of met: ${show(stats.metPrecision)}`,
    `Recall of met: ${show(stats.metRecall)}`,
    `False met (label unmet, bot met) over label unmet: ${show(stats.falseMet)}`,
    `Met without basis (label unknown, bot met) over label unknown: ${show(stats.metWithoutBasis)}`,
    `False not-met (label met, bot unmet) over label met: ${show(stats.falseNotMet)}`,
    `Label met, bot unknown, over label met: ${show(stats.metLeftUnknown)}`,
    `Label unmet, bot unknown, over label unmet: ${show(stats.unmetLeftUnknown)}`,
    `Unknown rate (bot unknown) over scored lines: ${show(stats.unknownRate)}`,
    `Bot unknown that should have been decided, over bot unknown: ${show(stats.unknownThatShouldBeDecided)}`,
    `Label unknown but bot decided, over label unknown: ${show(stats.decidedThoughUnknowable)}`,
    'Confusion:',
    row('met', c.met),
    row('unmet', c.unmet),
    row('unknown', c.unknown),
    row('ambiguous', c.ambiguous),
  ];
}

function compactStats(name: string, rows: readonly ItemRow[]): string {
  const s = statsOf(rows);
  return (
    `${name.padEnd(22)} lines ${String(rows.length).padStart(4)} | acc ${show(s.accuracy)} | decided ${show(s.decidedAccuracy)}` +
    ` | prec ${show(s.metPrecision)} | recall ${show(s.metRecall)} | false-met ${show(s.falseMet)}` +
    ` | false-not-met ${show(s.falseNotMet)} | unknown ${show(s.unknownRate)} | should-decide ${show(s.unknownThatShouldBeDecided)}`
  );
}

function pairLine(name: string, stats: PairStats): string {
  return (
    `${name}: at or above ${show({ n: stats.atOrAbove, d: stats.pairs })}, strictly above ${stats.strictlyAbove},` +
    ` pairs left out because a percent is null ${stats.nullPairs}`
  );
}

function tierLines(cvs: readonly CvRow[]): string[] {
  const interviewNo = comparePairs(cvs, 'interview', 'no');
  const ordinary = cvs.filter((cv) => cv.difficulty === 'ordinary');
  const adIds = [...new Set(cvs.map((cv) => cv.adId))];
  return [
    '== Tier separation (pairs inside one ad) ==',
    pairLine('"no" vs "interview"', interviewNo),
    pairLine('"maybe" vs "interview"', comparePairs(cvs, 'interview', 'maybe')),
    pairLine('"no" vs "maybe"', comparePairs(cvs, 'maybe', 'no')),
    pairLine('"no" vs "interview", ordinary CVs only', comparePairs(ordinary, 'interview', 'no')),
    ...TIERS.map((tier) => {
      const inTier = cvs.filter((cv) => cv.tier === tier);
      const nulls = inTier.filter((cv) => cv.percent === null).length;
      return `Mean percent, tier ${tier}: ${meanPercent(inTier)?.toFixed(1) ?? 'n/a'} (${inTier.length} CVs, ${nulls} null)`;
    }),
    'Per ad, "no" vs "interview":',
    ...adIds.map((adId) => {
      const stats = comparePairs(
        cvs.filter((cv) => cv.adId === adId),
        'interview',
        'no',
      );
      return `  ${adId.padEnd(18)} ${show({ n: stats.atOrAbove, d: stats.pairs })}, null pairs ${stats.nullPairs}`;
    }),
    'Every inverted "no" vs "interview" pair:',
    ...interviewNo.inverted.map(
      (pair) =>
        `  ${pair.adId}: no ${pair.lowId} (${pair.lowKind}) ${pair.lowPercent}% >= interview ${pair.highId} ${pair.highPercent}%`,
    ),
  ];
}

function nullLines(cvs: readonly CvRow[]): string[] {
  const nulls = cvs.filter((cv) => cv.percent === null);
  const withText = cvs.filter((cv) => cv.hasText);
  const nullWithText = withText.filter((cv) => cv.percent === null);
  return [
    '== Percent null ==',
    `All CVs: ${show({ n: nulls.length, d: cvs.length })}`,
    `CVs with text: ${show({ n: nullWithText.length, d: withText.length })}`,
    ...TIERS.map((tier) => {
      const inTier = cvs.filter((cv) => cv.tier === tier);
      return `Tier ${tier}: ${show({ n: inTier.filter((cv) => cv.percent === null).length, d: inTier.length })}`;
    }),
    `Null CVs: ${nulls.map((cv) => `${cv.cvId} (${cv.tier}, ${cv.kind})`).join(', ') || 'none'}`,
  ];
}

function stuffingLines(items: readonly ItemRow[], cvs: readonly CvRow[]): string[] {
  const stuffed = cvs.filter((cv) => cv.kind === 'stuffing');
  const stuffedItems = items.filter((item) => item.kind === 'stuffing');
  const rows = stuffed.map((cv) => {
    const lines = items.filter((item) => item.cvId === cv.cvId);
    const falseMet = lines.filter((item) => item.gold === 'unmet' && item.bot === 'met').length;
    const goldUnmet = lines.filter((item) => item.gold === 'unmet').length;
    const peers = cvs.filter((peer) => peer.adId === cv.adId);
    const above = peers.filter((peer) => (peer.percent ?? -1) > (cv.percent ?? -1)).length;
    const interview = peers.filter((peer) => peer.tier === 'interview');
    const beaten = interview.filter((peer) => (cv.percent ?? -1) >= (peer.percent ?? -1)).length;
    return (
      `  ${cv.cvId.padEnd(8)} percent ${String(cv.percent).padStart(4)} | false met ${falseMet}/${goldUnmet}` +
      ` | rank ${above + 1} of ${peers.length} | at or above ${beaten}/${interview.length} "interview" CVs` +
      ` | ad mean for interview tier ${meanPercent(interview)?.toFixed(0) ?? 'n/a'}`
    );
  });
  return [
    '== Keyword stuffing (all labelled tier "no") ==',
    `Mean percent: ${meanPercent(stuffed)?.toFixed(1) ?? 'n/a'} (${stuffed.length} CVs)`,
    compactStats('stuffing lines', stuffedItems),
    ...rows,
  ];
}

function listLines(title: string, rows: readonly ItemRow[]): string[] {
  return [
    `${title} (${rows.length}):`,
    ...rows.map(
      (r) =>
        `  ${r.cvId} [${r.kind}/${r.difficulty}/tier ${r.tier}] ${r.category}${r.isBonus ? ' bonus' : ''}: "${r.line}"` +
        ` | counted ${r.counted} | evidence: ${r.evidence || '-'} | reason: ${r.reason || '-'}`,
    ),
  ];
}

function errorLines(cvs: readonly CvRow[]): string[] {
  const failed = cvs.filter((cv) => cv.error !== null);
  return failed.length === 0 ? [] : ['== Matcher errors ==', ...failed.map((cv) => `  ${cv.cvId}: ${cv.error}`), ''];
}

function breakdownLines(items: readonly ItemRow[], cvs: readonly CvRow[]): string[] {
  const where = (name: string, keep: (item: ItemRow) => boolean) => compactStats(name, items.filter(keep));
  const adIds = [...new Set(cvs.map((cv) => cv.adId))];
  return [
    '== Ordinary vs hard ==',
    ...DIFFICULTIES.map((name) => where(name, (i) => i.difficulty === name)),
    '',
    '== Per category ==',
    ...CATEGORIES.map((name) => where(name, (i) => i.category === name)),
    where('bonus lines', (i) => i.isBonus),
    where('counted lines only', (i) => i.counted),
    where('not counted lines', (i) => !i.counted),
    '',
    '== Per CV kind ==',
    ...KINDS.map((name) => where(name, (i) => i.kind === name)),
    ...KINDS.map((name) => {
      const inKind = cvs.filter((cv) => cv.kind === name);
      return `Mean percent, ${name}: ${meanPercent(inKind)?.toFixed(1) ?? 'n/a'} (${inKind.length} CVs)`;
    }),
    '',
    '== Per ad ==',
    ...adIds.map((name) => where(name, (i) => i.adId === name)),
  ];
}

export function buildReport(items: readonly ItemRow[], cvs: readonly CvRow[], version: number): string {
  const ambiguousCount = items.filter((item) => item.gold === 'ambiguous').length;
  const adCount = new Set(cvs.map((cv) => cv.adId)).size;
  const ambiguous = statsOf(items).confusion.ambiguous;
  const pick = (gold: ItemRow['gold'], bot: ItemRow['bot']) => items.filter((i) => i.gold === gold && i.bot === bot);
  return [
    SYNTHETIC_NOTICE,
    `Matcher version ${version}. ${adCount} ads, ${cvs.length} CVs, ${items.length} labelled lines, ${ambiguousCount} ambiguous.`,
    '',
    ...errorLines(cvs),
    '== Overall ==',
    ...statsLines(statsOf(items)),
    `Ambiguous, reported apart: bot met ${ambiguous.met}, bot unmet ${ambiguous.unmet}, bot unknown ${ambiguous.unknown}`,
    '',
    ...breakdownLines(items, cvs),
    '',
    ...nullLines(cvs),
    '',
    ...tierLines(cvs),
    '',
    ...stuffingLines(items, cvs),
    '',
    '== Every false met ==',
    ...listLines('Label unmet, bot met', pick('unmet', 'met')),
    ...listLines('Label unknown, bot met', pick('unknown', 'met')),
    ...listLines('Label ambiguous, bot met (not scored as wrong)', pick('ambiguous', 'met')),
    '',
    '== Every false not-met ==',
    ...listLines('Label met, bot unmet', pick('met', 'unmet')),
    ...listLines('Label unknown, bot unmet', pick('unknown', 'unmet')),
    '',
    '== Unknown that should have been decided ==',
    ...listLines('Label met, bot unknown', pick('met', 'unknown')),
    ...listLines('Label unmet, bot unknown', pick('unmet', 'unknown')),
    '',
  ].join('\n');
}

const cell = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function itemsTsv(items: readonly ItemRow[]): string {
  const header = 'ad\tcv\tkind\tdifficulty\ttier\tcategory\tbonus\tgold\tbot\tcounted\tline\tevidence\treason';
  const rows = items.map((i) =>
    [
      i.adId,
      i.cvId,
      i.kind,
      i.difficulty,
      i.tier,
      i.category,
      String(i.isBonus),
      i.gold,
      i.bot,
      String(i.counted),
      cell(i.line),
      cell(i.evidence),
      cell(i.reason),
    ].join('\t'),
  );
  return [header, ...rows, ''].join('\n');
}

const cvCells = (cv: CvRow): string[] => [
  cv.adId,
  cv.cvId,
  cv.kind,
  cv.difficulty,
  cv.tier,
  String(cv.percent),
  String(cv.hasText),
  cv.error ?? '',
];

export function cvsTsv(cvs: readonly CvRow[]): string {
  const header = 'ad\tcv\tkind\tdifficulty\ttier\tpercent\thasText\terror';
  return [header, ...cvs.map((cv) => cvCells(cv).join('\t')), ''].join('\n');
}
