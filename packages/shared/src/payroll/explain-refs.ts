import type { PayrollConfig } from './config.js';
import type { PayrollMoneyCell } from './line.js';
import { toNumber, type Rational } from './rational.js';
import type { SettingRow } from './setting-core.js';
import { PAYROLL_SETTINGS } from './settings.js';

/**
 * Words and numbers for the payroll grid's tooltips (spec 11.2, Q6, Q7): Vietnamese number formats, the setting
 * versions a cell used, and a person's own settings (spec 4.6). Display only: nothing here feeds the engine.
 */

export type PayrollCellKey =
  | PayrollMoneyCell
  | 'gross'
  | 'paidDays'
  | 'dailyRate'
  | 'kpiPercent'
  | 'overtimeHours'
  | 'restDays'
  | 'holidayDays';

/** The sections of Cấu hình (spec 11.6, `?muc=`). */
export type PayrollConfigArea = 'khoan-luong' | 'tham-so' | 'quy-tac' | 'loai-hd' | 'tuy-chon' | 'khu-vuc';

/** One setting version a cell used: "Trần tiền ăn miễn thuế 1.200.000 · từ 01/07/2026 · NĐ 253". */
export interface PayrollConfigRef {
  key: string;
  label: string;
  value: string;
  /** dd/mm/yyyy for a law parameter, Tmm/yyyy for a setting by month. */
  from: string;
  source: string;
  area: PayrollConfigArea;
  /** The person's own row, not everyone's. */
  isPersonal: boolean;
}

/** A person's own setting in force this month, and the cells it shows on. */
export interface PayrollPersonSetting {
  key: string;
  /** "Tiền cơm chịu thuế". */
  text: string;
  from: string;
  cells: PayrollCellKey[];
  area: PayrollConfigArea;
}

/** 6.400.000; a minus sign for a negative amount. */
export function dong(amount: number): string {
  const digits = Math.abs(Math.round(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 ? `−${digits}` : digits;
}

/** 0,9 → 90%; 0,015 → 1,5%; 0,818182 → 81,8182%. */
export const pct = (rate: number) => `${String(Number((rate * 100).toFixed(4))).replace('.', ',')}%`;

/** 19,5 */
export const count = (n: number) => String(n).replace('.', ',');

/** An exact amount to two decimals: 366.136,36. */
export function exact(value: Rational): string {
  const [whole = '0', cents = '00'] = toNumber(value).toFixed(2).split('.');
  return `${dong(Number(whole))},${cents}`;
}

/** 2026-07-01 → 01/07/2026; 2026-10 → T10/2026. */
export function fromText(from: string): string {
  const [y, m, d] = from.split('-');
  return d ? `${d}/${m}/${y}` : `T${m}/${y}`;
}

const AREA_OF_PREFIX: Record<string, PayrollConfigArea> = {
  luat: 'tham-so',
  'quy-tac': 'quy-tac',
  'tuy-chon': 'tuy-chon',
  khoan: 'khoan-luong',
  'loai-hd': 'loai-hd',
};

export const areaOf = (key: string): PayrollConfigArea => AREA_OF_PREFIX[key.split('.')[0] ?? ''] ?? 'quy-tac';

export function labelOf(key: string): string {
  const found = Object.entries(PAYROLL_SETTINGS).find(([k]) => k === key);
  return found ? found[1].label : key;
}

/** The version of `key` this person's month used, with its value in words. */
export function refOf(config: PayrollConfig, key: string, value: string): PayrollConfigRef | null {
  const used = [...config.law.used, ...config.used].find((r) => r.key === key);
  if (!used) return null;
  const isPersonal = used.employeeId !== null;
  return { key, label: labelOf(key), value, from: fromText(used.from), source: used.source, area: areaOf(key), isPersonal };
}

const ATTRIBUTE_CELLS: Record<string, PayrollCellKey[]> = {
  thue: ['exempt'],
  'tinh-bh': ['socialBase'],
  'chia-theo-ngay': ['dailyRate'],
  'thu-viec': ['dailyRate'],
  'vao-lam-them': ['overtimePay'],
  'muc-quy-che': ['exempt'],
  'cam-ket-kem-hd': ['tax'],
};

const KEY_CELLS: Record<string, PayrollCellKey[]> = {
  'quy-tac.ty-le-thu-viec': ['dailyRate', 'kpiPercent'],
  'quy-tac.kpi-theo-khoi': ['kpiPercent'],
  'quy-tac.he-so-lam-them': ['overtimePay'],
  'quy-tac.gio-mot-ngay': ['overtimePay'],
  'tuy-chon.d02': ['tax'],
  'tuy-chon.d04': ['health'],
  'tuy-chon.d05': ['exempt'],
  'tuy-chon.d09': ['tax'],
  'tuy-chon.d10': ['tax'],
  'tuy-chon.d15': ['social'],
  'luat.luong-toi-thieu-vung': ['socialBase'],
};

const cellsOf = (key: string): PayrollCellKey[] => {
  const [prefix, , attribute = ''] = key.split('.');
  return prefix === 'khoan' ? (ATTRIBUTE_CELLS[attribute] ?? []) : (KEY_CELLS[key] ?? []);
};

const TAX_WORDS: Record<string, string> = { taxable: 'chịu thuế', exempt: 'miễn thuế', cap: 'miễn tới trần' };

function valueWords(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'có' : 'không';
  if (typeof value === 'number') return value > 0 && value < 1 ? pct(value) : dong(value);
  if (typeof value === 'string') return value;
  const kind = typeof value === 'object' && value !== null && 'kind' in value ? String(value.kind) : '';
  return TAX_WORDS[kind] ?? JSON.stringify(value);
}

/** "Tiền cơm chịu thuế" for a component attribute, "Tỷ lệ lương thử việc: 95%" for anything else. */
function settingWords(row: SettingRow, config: PayrollConfig): string {
  const [prefix, id, attribute] = row.key.split('.');
  if (prefix === 'khoan' && id && attribute) {
    const name = config.components.find((c) => c.id === id)?.name ?? id;
    return attribute === 'thue' ? `${name} ${valueWords(row.value)}` : `${name}: ${attribute} ${valueWords(row.value)}`;
  }
  return `${labelOf(row.key)}: ${valueWords(row.value)}`;
}

/** The person's own rows in force this month: the latest of each key, a "Bỏ ghi đè" row ending it (spec 6.1). */
export function personSettingsOf(config: PayrollConfig): PayrollPersonSetting[] {
  const { personId, dates } = config;
  if (!personId) return [];
  const own = config.rows.filter(
    (r) => r.employeeId === personId && !r.supersededBy && r.from.slice(0, 7) <= dates.monthKey,
  );
  const latest = new Map<string, SettingRow>();
  for (const row of [...own].sort((a, b) => a.from.localeCompare(b.from))) latest.set(row.key, row);
  return [...latest.values()]
    .filter((row) => !row.stop)
    .map((row) => ({
      key: row.key,
      text: settingWords(row, config),
      from: fromText(row.from),
      cells: cellsOf(row.key),
      area: areaOf(row.key),
    }));
}

/** The person's own settings as references, for the cells they show on. */
export function personalRefs(settings: readonly PayrollPersonSetting[], cell: PayrollCellKey): PayrollConfigRef[] {
  return settings
    .filter((s) => s.cells.includes(cell))
    .map((s) => ({ key: s.key, label: 'Riêng', value: s.text, from: s.from, source: '', area: s.area, isPersonal: true }));
}
