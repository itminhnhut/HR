import { CONTACT_FIELDS, type BotCase, type ContactField } from './cases.js';

export type Contact = Record<ContactField, string | null>;

/**
 * correct / wrong / missing apply when the CV has the value; correct_empty / false_fill when it has none.
 * wrong and false_fill are the dangerous ones: HR contacts a stranger, or a stranger's data lands in the profile.
 */
export type Outcome = 'correct' | 'wrong' | 'missing' | 'correct_empty' | 'false_fill';

export function classify(want: string | null, got: string | null, alsoAccept: readonly string[] = []): Outcome {
  if (want === null) return got === null ? 'correct_empty' : 'false_fill';
  if (got === null) return 'missing';
  return got === want || alsoAccept.includes(got) ? 'correct' : 'wrong';
}

export interface Row {
  id: string;
  layout: string;
  focus: string;
  path: BotCase['path'];
  field: ContactField;
  want: string | null;
  got: string | null;
  outcome: Outcome;
}

export function rowsOf(cv: BotCase, got: Contact): Row[] {
  return CONTACT_FIELDS.map((field) => ({
    id: cv.id,
    layout: cv.layout,
    focus: cv.focus,
    path: cv.path,
    field,
    want: cv[field],
    got: got[field],
    outcome: classify(cv[field], got[field], cv.alsoAccept?.[field]),
  }));
}

export interface Tally {
  /** CVs that have this value. */
  hasValue: number;
  correct: number;
  wrong: number;
  missing: number;
  /** CVs without this value. */
  noValue: number;
  correctEmpty: number;
  falseFill: number;
}

export function tally(rows: readonly Row[]): Tally {
  const count = (o: Outcome) => rows.filter((r) => r.outcome === o).length;
  const correct = count('correct');
  const wrong = count('wrong');
  const missing = count('missing');
  const correctEmpty = count('correct_empty');
  const falseFill = count('false_fill');
  return {
    hasValue: correct + wrong + missing,
    correct,
    wrong,
    missing,
    noValue: correctEmpty + falseFill,
    correctEmpty,
    falseFill,
  };
}

const pct = (part: number, whole: number) => (whole === 0 ? '  n/a' : `${((100 * part) / whole).toFixed(1)}%`);

export function tallyLine(label: string, t: Tally): string {
  return [
    label.padEnd(30),
    `correct ${t.correct}/${t.hasValue} (${pct(t.correct, t.hasValue)})`.padEnd(26),
    `wrong ${t.wrong}/${t.hasValue} (${pct(t.wrong, t.hasValue)})`.padEnd(24),
    `missing ${t.missing}/${t.hasValue} (${pct(t.missing, t.hasValue)})`.padEnd(26),
    `false fill ${t.falseFill}/${t.noValue} (${pct(t.falseFill, t.noValue)})`,
  ].join(' ');
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string) =>
  items.reduce<Map<string, T[]>>((m, item) => m.set(key(item), [...(m.get(key(item)) ?? []), item]), new Map());

const section = (title: string, rows: readonly Row[], key: (r: Row) => string) => {
  const groups = [...groupBy(rows, key).entries()].sort(([a], [b]) => a.localeCompare(b));
  return [`\n## ${title}`, ...groups.map(([k, g]) => tallyLine(k, tally(g)))];
};

/** Name errors differ a lot in harm: a casing slip, part of the right name, or some other text. */
export function nameErrorKind(
  want: string,
  got: string,
): 'case/spacing only' | 'part of the right name' | 'other text' {
  const squash = (s: string) => s.toLocaleLowerCase('vi').replace(/[\s'’-]+/g, '');
  if (squash(want) === squash(got)) return 'case/spacing only';
  const words = (s: string) => s.toLocaleLowerCase('vi').split(/\s+/);
  const wanted = words(want);
  const given = words(got);
  const overlap = given.filter((w) => wanted.includes(w)).length;
  return overlap >= 2 || (given.length === 1 && overlap === 1) ? 'part of the right name' : 'other text';
}

/** CVs where HR would contact a stranger, or a stranger's details would land in the profile. */
export function dangerousContactCvs(rows: readonly Row[]): string[] {
  const dangerous = (r: Row) => (r.outcome === 'wrong' || r.outcome === 'false_fill') && r.field !== 'fullName';
  return [...new Set(rows.filter(dangerous).map((r) => r.id))];
}

export function renderReport(rows: readonly Row[]): string {
  const ids = [...new Set(rows.map((r) => r.id))];
  const contactDanger = dangerousContactCvs(rows);
  const allRight = ids.filter((id) =>
    rows.filter((r) => r.id === id).every((r) => r.outcome === 'correct' || r.outcome === 'correct_empty'),
  );
  const perField = CONTACT_FIELDS.flatMap((field) => {
    const own = rows.filter((r) => r.field === field);
    return [
      `\n# ${field}`,
      tallyLine('all', tally(own)),
      ...section('by path', own, (r) => r.path),
      ...section('by layout', own, (r) => r.layout),
      ...section('by focus', own, (r) => r.focus),
    ];
  });
  const errorLine = (r: Row) => {
    const kind =
      r.outcome === 'wrong' && r.field === 'fullName' && r.want && r.got ? ` <${nameErrorKind(r.want, r.got)}>` : '';
    return `${r.outcome.padEnd(10)} ${r.field.padEnd(8)} ${r.id.padEnd(18)} want ${JSON.stringify(r.want)} got ${JSON.stringify(r.got)}${kind} [${r.layout}]`;
  };
  const errors = (o: Outcome) => rows.filter((r) => r.outcome === o).map(errorLine);
  return [
    'SYNTHETIC DATA. Real-world accuracy is unknown until checked on real CVs.',
    `CVs: ${ids.length} (pdf ${new Set(rows.filter((r) => r.path === 'pdf').map((r) => r.id)).size}, text ${new Set(rows.filter((r) => r.path === 'text').map((r) => r.id)).size})`,
    `All three fields right: ${allRight.length}/${ids.length} (${pct(allRight.length, ids.length)})`,
    `CVs with a wrong or false phone/email: ${contactDanger.length}/${ids.length} (${pct(contactDanger.length, ids.length)})`,
    ...perField,
    '\n# errors: wrong value',
    ...errors('wrong'),
    '\n# errors: false fill',
    ...errors('false_fill'),
    '\n# errors: missing',
    ...errors('missing'),
    '',
  ].join('\n');
}
