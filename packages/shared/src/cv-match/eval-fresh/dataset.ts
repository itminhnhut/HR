import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = ['experience', 'education', 'language', 'licence', 'skills', 'soft'] as const;
const TIERS = ['interview', 'maybe', 'no'] as const;
const KINDS = ['strong', 'partial', 'near-miss', 'non-fit', 'stuffing', 'messy'] as const;
const DIFFICULTIES = ['ordinary', 'hard'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Tier = (typeof TIERS)[number];
export type CvKind = (typeof KINDS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Gold = 'met' | 'unmet' | 'unknown' | 'ambiguous';

export interface FreshRequirement {
  line: string;
  category: Category;
  isBonus: boolean;
}

export interface FreshCv {
  id: string;
  kind: CvKind;
  difficulty: Difficulty;
  tier: Tier;
  labels: Gold[];
  text: string;
}

export interface FreshAd {
  id: string;
  occupation: string;
  requirements: FreshRequirement[];
  cvs: FreshCv[];
}

export interface LoadedDataset {
  ads: FreshAd[];
  problems: string[];
}

const GOLD_BY_LETTER = new Map<string, Gold>([
  ['M', 'met'],
  ['U', 'unmet'],
  ['K', 'unknown'],
  ['A', 'ambiguous'],
]);

const isOneOf = <T extends string>(values: readonly T[], value: string | undefined): value is T =>
  value !== undefined && (values as readonly string[]).includes(value);

function parseRequirement(line: string): FreshRequirement | null {
  const match = /^@req (\S+)( bonus)? \| (.+)$/.exec(line);
  if (!match || !isOneOf(CATEGORIES, match[1])) return null;
  return { line: match[3] ?? '', category: match[1], isBonus: match[2] !== undefined };
}

function parseLabels(raw: string | undefined): Gold[] | null {
  const labels = (raw ?? '').split(' ').map((letter) => GOLD_BY_LETTER.get(letter));
  return labels.every((label): label is Gold => label !== undefined) ? labels : null;
}

function parseCv(chunk: string, requirementCount: number, where: string): { cv: FreshCv | null; problems: string[] } {
  const [header = '', ...body] = chunk.split('\n');
  const [id, kind, difficulty, tier, rawLabels, transform] = header.split(' | ').map((part) => part.trim());
  const labels = parseLabels(rawLabels);
  if (!id || !isOneOf(KINDS, kind) || !isOneOf(DIFFICULTIES, difficulty) || !isOneOf(TIERS, tier) || !labels) {
    return { cv: null, problems: [`${where}: bad CV header "${header}"`] };
  }
  const lengthProblem =
    labels.length === requirementCount ? [] : [`${where}/${id}: ${labels.length} labels, ${requirementCount} lines`];
  const plain = body
    .filter((line) => !line.startsWith('#why '))
    .join('\n')
    .trim();
  const text = transform === 'nfd' ? plain.normalize('NFD') : plain;
  return { cv: { id, kind, difficulty, tier, labels, text }, problems: lengthProblem };
}

function parseAd(fileName: string, raw: string): { ad: FreshAd; problems: string[] } {
  const [head = '', ...chunks] = raw.split(/^=== /m);
  const headLines = head.split('\n').filter((line) => line.trim() !== '');
  const id = headLines.find((line) => line.startsWith('@ad '))?.slice(4) ?? fileName;
  const occupation = headLines.find((line) => line.startsWith('@occupation '))?.slice(12) ?? '';
  const reqLines = headLines.filter((line) => line.startsWith('@req '));
  const parsedReqs = reqLines.map(parseRequirement);
  const requirements = parsedReqs.filter((req): req is FreshRequirement => req !== null);
  const reqProblems = parsedReqs.flatMap((req, i) => (req ? [] : [`${fileName}: bad requirement "${reqLines[i]}"`]));
  const parsedCvs = chunks.map((chunk) => parseCv(chunk, requirements.length, fileName));
  const cvs = parsedCvs.flatMap((parsed) => (parsed.cv ? [parsed.cv] : []));
  const problems = [...reqProblems, ...parsedCvs.flatMap((parsed) => parsed.problems)];
  return { ad: { id, occupation, requirements, cvs }, problems };
}

function datasetProblems(ads: readonly FreshAd[]): string[] {
  const cvIds = ads.flatMap((ad) => ad.cvs.map((cv) => cv.id));
  const repeated = cvIds.filter((id, i) => cvIds.indexOf(id) !== i);
  const perAd = ads.flatMap((ad) => [
    ...(ad.cvs.length < 10 ? [`${ad.id}: only ${ad.cvs.length} CVs`] : []),
    ...(ad.cvs.some((cv) => cv.tier === 'interview') ? [] : [`${ad.id}: no "interview" CV`]),
    ...(ad.cvs.some((cv) => cv.tier === 'no') ? [] : [`${ad.id}: no "no" CV`]),
  ]);
  return [
    ...(ads.length < 15 ? [`only ${ads.length} ads`] : []),
    ...(cvIds.length < 150 ? [`only ${cvIds.length} CVs`] : []),
    ...repeated.map((id) => `repeated CV id ${id}`),
    ...perAd,
  ];
}

/** Compares data files with the lock written before the first run. Any difference stops scoring. */
function lockProblems(dir: string, dataFiles: readonly string[]): string[] {
  const lockLines = readFileSync(join(dir, 'labels.sha256'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const locked = new Map(lockLines.map((line) => [line.slice(66).trim(), line.slice(0, 64)] as const));
  const changed = dataFiles.flatMap((file) => {
    const hash = createHash('sha256')
      .update(readFileSync(join(dir, 'data', file)))
      .digest('hex');
    return locked.get(file) === hash ? [] : [`${file}: differs from labels.sha256`];
  });
  const missing = [...locked.keys()].flatMap((file) => (dataFiles.includes(file) ? [] : [`${file}: missing`]));
  return [...changed, ...missing];
}

export function loadDataset(dir: string): LoadedDataset {
  const dataFiles = readdirSync(join(dir, 'data')).filter((file) => file.endsWith('.txt'));
  const adFiles = dataFiles.filter((file) => !file.startsWith('00-'));
  const parsed = adFiles.map((file) => parseAd(file, readFileSync(join(dir, 'data', file), 'utf8')));
  const ads = parsed.map((entry) => entry.ad);
  return {
    ads,
    problems: [...parsed.flatMap((entry) => entry.problems), ...datasetProblems(ads), ...lockProblems(dir, dataFiles)],
  };
}
