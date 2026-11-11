/** How the payroll log and messages write months, dates, amounts and values (spec-luong.md 11.9). */

/** "2026-12" → "T12/2026". */
export function monthWords(month: string): string {
  const [year, m] = month.split('-');
  return `T${Number(m)}/${year}`;
}

/** "2026-07-01" → "01/07/2026". */
export function dateWords(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** A month or a date, as the row has it. */
export const fromWords = (from: string) => (from.length === 7 ? monthWords(from) : dateWords(from));

/** 1100000 → "1.100.000". */
export function moneyWords(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return sign + String(Math.abs(Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const decimal = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',');

function numberWords(n: number): string {
  if (Number.isInteger(n)) return Math.abs(n) >= 1000 ? moneyWords(n) : String(n);
  if (n > 0 && n < 1) return `${decimal(n * 100)}%`;
  return decimal(n);
}

const hasName = (v: unknown): v is { name: string } =>
  typeof v === 'object' && v !== null && 'name' in v && typeof v.name === 'string';

/** Any stored value in a few words: amounts grouped, rates as %, lists by their names. */
export function valueWords(value: unknown): string {
  if (value === null || value === undefined) return 'trống';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return numberWords(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.every(hasName) ? value.map((v) => v.name).join(', ') : `${value.length} dòng`;
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k} ${valueWords(v)}`)
      .join(', ');
  }
  return String(value);
}

/** "NV02 NV B". */
export const personWords = (p: { code: string; fullName: string }) => `${p.code} ${p.fullName}`;
