/** Scores parse-cv answers against the frozen labels and renders the report. Pure functions, no I/O. */
import { z } from 'zod';

export const FIELDS = ['fullName', 'phone', 'email'] as const;
export type Field = (typeof FIELDS)[number];
export type Outcome = 'correct' | 'wrong' | 'missing' | 'false_fill' | 'true_null';

export const labelSchema = z.object({
  id: z.string(),
  file: z.string(),
  group: z.enum(['ordinary', 'hard']),
  family: z.string(),
  template: z.string(),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  ambiguous: z.record(z.string(), z.string()),
});
export type Label = z.infer<typeof labelSchema>;

const answerSchema = z.object({
  fullName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export type Answer = Record<Field, string | null>;

export interface FieldResult {
  field: Field;
  expected: string | null;
  returned: string | null;
  outcome: Outcome;
  ambiguousReason: string | null;
}

export interface CvResult {
  label: Label;
  status: number;
  raw: unknown;
  fields: FieldResult[];
}

const cleaned = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function readAnswer(raw: unknown): Answer {
  const parsed = answerSchema.safeParse(raw);
  if (!parsed.success) return { fullName: null, phone: null, email: null };
  return { fullName: cleaned(parsed.data.fullName), phone: cleaned(parsed.data.phone), email: cleaned(parsed.data.email) };
}

export function outcomeOf(field: Field, expected: string | null, returned: string | null): Outcome {
  if (expected === null) return returned === null ? 'true_null' : 'false_fill';
  if (returned === null) return 'missing';
  const same = field === 'fullName' ? expected.normalize('NFC') === returned.normalize('NFC') : expected === returned;
  return same ? 'correct' : 'wrong';
}

export function scoreCv(label: Label, status: number, raw: unknown): CvResult {
  const answer = readAnswer(raw);
  const fields = FIELDS.map((field): FieldResult => ({
    field,
    expected: label[field],
    returned: answer[field],
    outcome: outcomeOf(field, label[field], answer[field]),
    ambiguousReason: label.ambiguous[field] ?? null,
  }));
  return { label, status, raw, fields };
}

const isRight = (f: FieldResult): boolean => f.outcome === 'correct' || f.outcome === 'true_null';
const isClear = (f: FieldResult): boolean => f.ambiguousReason === null;
const isBad = (f: FieldResult): boolean => f.outcome === 'wrong' || f.outcome === 'false_fill';

const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`);
const frac = (n: number, d: number): string => `${n}/${d} (${pct(n, d)})`;

function fieldTable(results: CvResult[]): string[] {
  const rows = FIELDS.map((field) => {
    const clear = results.flatMap((r) => r.fields).filter((f) => f.field === field && isClear(f));
    const count = (o: Outcome): number => clear.filter((f) => f.outcome === o).length;
    const hasValue = clear.filter((f) => f.expected !== null).length;
    const hasNone = clear.length - hasValue;
    const cells = [
      field, String(clear.length), frac(count('correct'), hasValue), String(count('wrong')), String(count('missing')),
      frac(count('true_null'), hasNone), String(count('false_fill')), frac(clear.filter(isRight).length, clear.length),
    ];
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '| field | scored | correct (CV has a value) | wrong value | missing | correct null (CV has none) | false fill | right overall |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
  ];
}

function cvLevelLines(results: CvResult[]): string[] {
  const contactBad = results.filter((r) => r.fields.some((f) => f.field !== 'fullName' && isClear(f) && isBad(f)));
  const allRightClear = results.filter((r) => r.fields.filter(isClear).every(isRight));
  const noAmbiguity = results.filter((r) => r.fields.every(isClear));
  const allRightStrict = noAmbiguity.filter((r) => r.fields.every(isRight));
  return [
    `- CVs with a wrong or false phone or email: ${frac(contactBad.length, results.length)}`,
    `- All three fields right (ambiguous fields not counted): ${frac(allRightClear.length, results.length)}`,
    `- All three fields right, only CVs with no ambiguous field: ${frac(allRightStrict.length, noAmbiguity.length)}`,
  ];
}

function groupBlock(title: string, results: CvResult[]): string[] {
  return [`## ${title} (${results.length} CVs)`, '', ...fieldTable(results), '', ...cvLevelLines(results), ''];
}

function diffKind(f: FieldResult): string {
  if (f.field !== 'fullName' || f.expected === null || f.returned === null) return '';
  const base = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  if (f.expected.toLowerCase() === f.returned.toLowerCase()) return ' [case only]';
  if (base(f.expected).toLowerCase() === base(f.returned).toLowerCase()) return ' [diacritics only]';
  return '';
}

const show = (value: string | null): string => (value === null ? '(none)' : `\`${value}\``);

function listOf(results: CvResult[], outcomes: Outcome[], clear: boolean): string[] {
  return results.flatMap((r) =>
    r.fields
      .filter((f) => outcomes.includes(f.outcome) && isClear(f) === clear)
      .map((f) => {
        const note = f.ambiguousReason ? ` - ${f.ambiguousReason}` : '';
        const where = `${r.label.id} ${r.label.group}/${r.label.family}/${r.label.template}`;
        return `- ${where} **${f.field}** ${f.outcome}: expected ${show(f.expected)}, returned ${show(f.returned)}${diffKind(f)}${note}`;
      }),
  );
}

function ambiguousLines(results: CvResult[]): string[] {
  return results.flatMap((r) =>
    r.fields
      .filter((f) => !isClear(f))
      .map((f) => `- ${r.label.id} **${f.field}**: labelled ${show(f.expected)}, returned ${show(f.returned)} - ${f.ambiguousReason ?? ''}`),
  );
}

export function familiesOf(results: CvResult[]): string[] {
  return [...new Set(results.map((r) => `${r.label.group}/${r.label.family}`))];
}

export interface ReportMeta {
  labelsChecksum: string;
  labelsChecksumMatches: boolean;
  frozenAt: string;
}

const CAVEAT = [
  'This data is synthetic and written by one author. It measures a fresh synthetic set the tuning never saw, not real CVs.',
  'The PDFs come from two producers (headless Chrome and reportlab), with one-page layouts and clean embedded fonts.',
];

export function renderReport(results: CvResult[], meta: ReportMeta): string {
  const failed = results.filter((r) => r.status !== 200);
  const decomposed = results.filter((r) => r.fields.some((f) => f.returned !== null && f.returned !== f.returned.normalize('NFC')));
  const lines = [
    '# parse-cv on the fresh blind set',
    '',
    ...CAVEAT.map((c) => `> ${c}`),
    '',
    `Labels frozen: ${meta.frozenAt}. Checksum ${meta.labelsChecksum} (${meta.labelsChecksumMatches ? 'matches' : 'DOES NOT match'} labels.sha256).`,
    `Non-200 responses: ${failed.length}${failed.length ? ` (${failed.map((r) => `${r.label.id}:${r.status}`).join(', ')})` : ''}. Answers not in NFC: ${decomposed.length}${decomposed.length ? ` (${decomposed.map((r) => r.label.id).join(', ')})` : ''}.`,
    '',
    ...groupBlock('All', results),
    ...groupBlock('Ordinary', results.filter((r) => r.label.group === 'ordinary')),
    ...groupBlock('Hard', results.filter((r) => r.label.group === 'hard')),
    ...familiesOf(results).flatMap((key) => groupBlock(key, results.filter((r) => `${r.label.group}/${r.label.family}` === key))),
    '## Wrong values and false fills',
    '',
    ...listOf(results, ['wrong', 'false_fill'], true),
    '',
    '## Missing',
    '',
    ...listOf(results, ['missing'], true),
    '',
    '## Ambiguous fields (not in any count above)',
    '',
    ...ambiguousLines(results),
    '',
  ];
  return lines.join('\n');
}
