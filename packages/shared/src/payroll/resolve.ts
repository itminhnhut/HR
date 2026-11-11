import { DATE_KEY, MONTH_KEY, type Resolved, type SettingDef, type SettingRow } from './setting-core.js';

const isLive = (row: SettingRow) => !row.supersededBy;

/** The latest live row of one scope in force at `at`; two live rows on the same date cannot be told apart (R5). */
function latestRow(rows: readonly SettingRow[], key: string, employeeId: string | null, at: string) {
  const candidates = rows
    .filter((r) => r.key === key && r.employeeId === employeeId && isLive(r) && r.from <= at)
    .sort((a, b) => b.from.localeCompare(a.from));
  const [first, second] = candidates;
  if (first && second && first.from === second.from) {
    throw new Error(`Payroll setting ${key}: two live rows from ${first.from} for ${employeeId ?? 'everyone'}`);
  }
  return first;
}

/** The row that applies: one person's row, else everyone's; a stop row hands over to the next level down. */
export function applicableRow(
  rows: readonly SettingRow[],
  key: string,
  perPerson: boolean,
  personId: string | null,
  at: string,
): SettingRow | undefined {
  const own = perPerson && personId ? latestRow(rows, key, personId, at) : undefined;
  if (own && !own.stop) return own;
  const everyone = latestRow(rows, key, null, at);
  return everyone && !everyone.stop ? everyone : undefined;
}

function checkReference(def: { key: string; scope: 'month' | 'date' }, at: string) {
  const pattern = def.scope === 'month' ? MONTH_KEY : DATE_KEY;
  if (!pattern.test(at)) throw new Error(`Payroll setting ${def.key}: "${at}" is not a ${def.scope}`);
}

function parseValue<T>(def: SettingDef<T>, value: unknown, origin: string): T {
  const parsed = def.schema.safeParse(value);
  if (!parsed.success) throw new Error(`Payroll setting ${def.key} (${origin}): ${parsed.error.message}`);
  return parsed.data;
}

/** A setting's value for a person at a month (or a date, for a law parameter): person → everyone → default. */
export function resolveSetting<T>(
  rows: readonly SettingRow[],
  def: SettingDef<T>,
  personId: string | null,
  at: string,
): Resolved<T> {
  checkReference(def, at);
  const row = applicableRow(rows, def.key, def.perPerson, personId, at);
  if (row) {
    const value = parseValue(def, row.value, `from ${row.from}`);
    return {
      key: def.key,
      value,
      from: row.from,
      employeeId: row.employeeId,
      source: row.source ?? '',
      isDefault: false,
    };
  }
  const fallback = [...def.defaults].reverse().find((d) => d.from <= at);
  if (!fallback) throw new Error(`Payroll setting ${def.key}: no value in force at ${at}`);
  return {
    key: def.key,
    value: fallback.value,
    from: fallback.from,
    employeeId: null,
    source: fallback.source,
    isDefault: true,
  };
}
