import {
  applicableRow as engineApplicableRow,
  payrollDates,
  RULE_SETTINGS,
  settingFor,
  type PayrollSettingDef,
  type PayrollSettingRow,
} from '@careers/shared';

/**
 * Which stored row a payroll month reads (spec-luong.md 6.1, R2): the engine's `applicableRow` (one person's latest
 * live row, else everyone's; a stop row hands over to the level below; corrected rows are skipped) and its
 * `payrollDates`. Pure, so R5 can ask which approved months a row decides.
 */

export type Row = PayrollSettingRow & { id: string };

const PAY_DAY_KEY = 'quy-tac.ngay-chi-tra';

const PAY_DAY_DEFAULT = RULE_SETTINGS[PAY_DAY_KEY].defaults[0];
const PAY_DAY_FROM = PAY_DAY_DEFAULT.from;
/** Engine default of `quy-tac.ngay-chi-tra` (câu 27): day 5 of the next month. */
export const DEFAULT_PAY_DAY = PAY_DAY_DEFAULT.value;

const pad = (n: number) => String(n).padStart(2, '0');

const yearMonth = (month: string): [number, number] => {
  const [year = 2000, m = 1] = month.split('-').map(Number);
  return [year, m];
};

/** Payroll month T is paid on `payDay` of T+1 unless HR set another date (R2). */
export function payDateOf(month: string, payDay: number): string {
  return payrollDates(...yearMonth(month), undefined, payDay).payDate;
}

/** The latest live row of one scope in force at `at`. */
export function latestRow<T extends Row>(
  rows: readonly T[],
  key: string,
  employeeId: string | null,
  at: string,
): T | undefined {
  return rows
    .filter((r) => r.key === key && r.employeeId === employeeId && !r.supersededBy && r.from <= at)
    .sort((a, b) => b.from.localeCompare(a.from))[0];
}

/** The engine's `applicableRow`, handing back the caller's own row type. */
export function applicableRow<T extends Row>(
  rows: readonly T[],
  def: Pick<PayrollSettingDef, 'key' | 'perPerson'>,
  personId: string | null,
  at: string,
): T | undefined {
  const found = engineApplicableRow(rows, def.key, def.perPerson, personId, at);
  return found ? rows.find((r) => r === found) : undefined;
}

/**
 * Whether the engine has a value for a key at `at`: a stored row, or a default already in force. The engine's
 * defaults start in 2026, so an earlier month without a stored row has none.
 */
export function hasValue(
  rows: readonly Row[],
  def: Pick<PayrollSettingDef, 'key' | 'perPerson' | 'defaultFrom'>,
  personId: string | null,
  at: string,
): boolean {
  if (applicableRow(rows, def, personId, at)) return true;
  return def.defaultFrom !== null && def.defaultFrom <= at;
}

/** The pay day stored for a month, or the engine's default. */
export function payDayFor(rows: readonly Row[], month: string): number {
  const def = { key: PAY_DAY_KEY, perPerson: false, defaultFrom: PAY_DAY_FROM };
  return hasValue(rows, def, null, month) ? settingFor(rows, PAY_DAY_KEY, null, month).value : DEFAULT_PAY_DAY;
}

/** The date or month a key is read on for payroll month `month` (R2). */
export function readOn(def: Pick<PayrollSettingDef, 'scope' | 'group'>, month: string, rows: readonly Row[]): string {
  if (def.scope === 'month') return month;
  const dates = payrollDates(...yearMonth(month), undefined, payDayFor(rows, month));
  return def.group === 'tax' ? dates.payDate : dates.insuranceDate;
}

/** The months among `months` whose value of its own scope this row decides. */
export function monthsDecidedBy(
  row: Row,
  rows: readonly Row[],
  def: Pick<PayrollSettingDef, 'scope' | 'group'>,
  months: readonly string[],
): string[] {
  return months.filter((m) => latestRow(rows, row.key, row.employeeId, readOn(def, m, rows))?.id === row.id);
}

const previousMonth = (month: string) => {
  const [y = 2000, m = 1] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

const previousDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * What removing an everyone row would leave without any value (L-A14): its months up to the next row or the start
 * of the engine's default, when no earlier row takes them over. Null when nothing is left bare.
 */
export function gapIfRemoved(
  row: Row,
  rows: readonly Row[],
  def: Pick<PayrollSettingDef, 'defaultFrom'>,
): { from: string; to: string } | null {
  if (row.employeeId !== null || row.stop || def.defaultFrom === null) return null;
  const others = rows.filter((r) => r.key === row.key && r.employeeId === null && !r.supersededBy && r.id !== row.id);
  if (others.some((r) => r.from <= row.from)) return null;
  const next = others.map((r) => r.from).filter((f) => f > row.from);
  const end = [...next, def.defaultFrom].sort()[0] ?? def.defaultFrom;
  if (end <= row.from) return null;
  return { from: row.from, to: end.length === 7 ? previousMonth(end) : previousDay(end) };
}
