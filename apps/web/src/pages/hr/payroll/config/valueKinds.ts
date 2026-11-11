import { PAYROLL_SETTING_DEFS } from '@careers/shared';
import { describeValue } from '../excel/paramWords';
import { fromWords } from './configModel';

/**
 * How each setting is typed and read: whole dong, a percent, a plain number, a choice, yes/no, a few numbers
 * together, or the tax brackets. The API's schema stays the authority; this only picks the input.
 */

export type NumberKind = 'money' | 'percent' | 'number';

interface Option {
  value: string;
  label: string;
}

export type ValueKind =
  | { kind: NumberKind }
  | { kind: 'bool' }
  | { kind: 'choice'; options: readonly Option[] }
  | { kind: 'fields'; fields: readonly { field: string; label: string; kind: NumberKind }[] }
  | { kind: 'choices'; fields: readonly { field: string; label: string; options: readonly Option[] }[] }
  | { kind: 'brackets' }
  | { kind: 'month' }
  | { kind: 'tax' };

const MONEY_KEYS = new Set([
  'luat.luong-co-so',
  'luat.tran-tien-an',
  'luat.tran-trang-phuc',
  'muc-mac-dinh',
  'muc-quy-che',
]);
const PERCENT_KEYS = new Set(['luat.kpcd', 'luat.doan-phi', 'quy-tac.ty-le-thu-viec']);
const BOOL_KEYS = new Set([
  'quy-tac.kpi-chinh-thuc-theo-ngay',
  'quy-tac.gross-gom-kpi',
  'tinh-bh',
  'chia-theo-ngay',
  'thu-viec',
  'luong-theo-hd',
  'vao-lam-them',
  'dong-bh',
  'duoi-3-thang',
  'cam-ket-kem-hd',
]);

const f = (field: string, label: string, kind: NumberKind) => ({ field, label, kind });
const RATES = [f('social', 'BHXH', 'percent'), f('health', 'BHYT', 'percent'), f('unemployment', 'BHTN', 'percent')];

const FIELDS: Readonly<Record<string, ValueKind>> = {
  'luat.luong-toi-thieu-vung': {
    kind: 'fields',
    fields: ['I', 'II', 'III', 'IV'].map((z) => f(z, `Vùng ${z}`, 'money')),
  },
  'luat.he-so-tran': {
    kind: 'fields',
    fields: [
      f('social', 'BHXH, BHYT (lần lương cơ sở)', 'number'),
      f('unemployment', 'BHTN (lần lương vùng)', 'number'),
    ],
  },
  'luat.bh-nld': { kind: 'fields', fields: RATES },
  'luat.bh-cty': { kind: 'fields', fields: RATES },
  'luat.giam-tru': {
    kind: 'fields',
    fields: [f('personal', 'Bản thân', 'money'), f('dependant', 'Mỗi người phụ thuộc', 'money')],
  },
  'luat.khau-tru-10': {
    kind: 'fields',
    fields: [f('rate', 'Tỷ lệ', 'percent'), f('threshold', 'Ngưỡng một lần chi', 'money')],
  },
  'luat.thu-viec-toi-da': {
    kind: 'fields',
    fields: [
      f('manager', 'Quản lý doanh nghiệp', 'number'),
      f('college', 'Cao đẳng trở lên', 'number'),
      f('intermediate', 'Trung cấp', 'number'),
      f('other', 'Việc khác', 'number'),
    ],
  },
  'luat.gioi-han-lam-them': {
    kind: 'fields',
    fields: [f('month', 'Giờ một tháng', 'number'), f('year', 'Giờ một năm', 'number')],
  },
  'quy-tac.he-so-lam-them': {
    kind: 'fields',
    fields: [
      f('weekday', 'Ngày thường', 'percent'),
      f('restDay', 'Ngày nghỉ', 'percent'),
      f('holiday', 'Ngày lễ', 'percent'),
    ],
  },
};

const EXTRA_WORDS: Readonly<Record<string, string>> = {
  flat10: '10% (khấu trừ)',
  progressive: 'Lũy tiến',
  support: 'Hỗ trợ',
  refund: 'Hoàn lại',
  advance: 'Tạm ứng',
};

const words = (value: string) => EXTRA_WORDS[value] ?? describeValue(value);
const options = (values: readonly string[]) => values.map((value) => ({ value, label: words(value) }));

const CHOICES: Readonly<Record<string, readonly string[]>> = {
  'quy-tac.dem-ngay-bh': ['unpaid-days', 'insured-days'],
  'quy-tac.khoan-32-mac-dinh': ['support', 'refund', 'advance'],
  'cach-thue': ['progressive', 'flat10'],
};

/** (19) by block when HR typed nothing: the formula on days, or HR's evaluation (spec 5.3). */
const KPI_RULES = options(['formula', 'typed']);
const KPI_BY_BLOCK: ValueKind = {
  kind: 'choices',
  fields: [
    { field: 'BO', label: 'Khối BO', options: KPI_RULES },
    { field: 'KD', label: 'Khối KD', options: KPI_RULES },
  ],
};

/** The values of an option's `z.enum`, read off the schema the API checks with. */
function enumValues(key: string): readonly string[] {
  const schema = PAYROLL_SETTING_DEFS[key]?.schema;
  const values: unknown = schema ? Reflect.get(schema, 'options') : undefined;
  return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : [];
}

/** `khoan.com.thue` → `thue`: an attribute is typed the same for every entry. */
const attributeOf = (key: string) => (key.split('.').length === 3 ? (key.split('.')[2] ?? key) : key);

const ZONE_OPTIONS = ['I', 'II', 'III', 'IV'].map((value) => ({ value, label: `Vùng ${value}` }));

export function kindOf(key: string): ValueKind | null {
  if (key.startsWith('khu-vuc.')) return { kind: 'choice', options: ZONE_OPTIONS };
  const k = attributeOf(key);
  if (k === 'thue') return { kind: 'tax' };
  if (MONEY_KEYS.has(k)) return { kind: 'money' };
  if (PERCENT_KEYS.has(k)) return { kind: 'percent' };
  if (BOOL_KEYS.has(k)) return { kind: 'bool' };
  if (k === 'luat.bieu-thue') return { kind: 'brackets' };
  if (k === 'quy-tac.thang-dau') return { kind: 'month' };
  if (k === 'quy-tac.kpi-theo-khoi') return KPI_BY_BLOCK;
  const fields = FIELDS[k];
  if (fields) return fields;
  const choices = CHOICES[k] ?? (k.startsWith('tuy-chon.') ? enumValues(k) : []);
  if (choices.length > 0) return { kind: 'choice', options: options(choices) };
  if (['quy-tac.gio-mot-ngay', 'quy-tac.ngay-chi-tra', 'quy-tac.gio-cong-ngay-nghi', 'ngay-thu-viec'].includes(k))
    return { kind: 'number' };
  return null;
}

export const TAX_OPTIONS = [
  { value: 'taxable', label: 'Chịu thuế' },
  { value: 'exempt', label: 'Miễn toàn bộ' },
  { value: 'cap:meal', label: 'Miễn tới trần tiền ăn' },
  { value: 'cap:regulated', label: 'Miễn tới mức quy chế' },
  { value: 'cap:clothing-year', label: 'Miễn tới trần trang phục năm' },
] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function taxCode(value: unknown): string {
  if (!isRecord(value)) return '';
  return value.kind === 'cap' ? `cap:${String(value.cap)}` : String(value.kind);
}

export function taxValue(code: string): unknown {
  return code.startsWith('cap:') ? { kind: 'cap', cap: code.slice(4) } : { kind: code };
}

/** A value in HR's words: 2.530.000, 1,5%, "Miễn tới trần tiền ăn", "Có". */
export function valueWords(key: string, value: unknown): string {
  if (value === undefined || value === null) return '—';
  const kind = kindOf(key);
  if (kind?.kind === 'tax') return TAX_OPTIONS.find((o) => o.value === taxCode(value))?.label ?? '—';
  if (kind?.kind === 'month' && typeof value === 'string') return fromWords(value);
  if (kind?.kind === 'number' && typeof value === 'number') return describeValue(value);
  if (kind?.kind === 'choice' && typeof value === 'string') {
    return kind.options.find((o) => o.value === value)?.label ?? words(value);
  }
  if (kind?.kind === 'fields' && isRecord(value)) {
    return kind.fields.map((x) => `${x.label} ${numberWords(x.kind, value[x.field])}`).join(' · ');
  }
  if (kind && 'kind' in kind && (kind.kind === 'money' || kind.kind === 'percent'))
    return numberWords(kind.kind, value);
  return describeValue(value);
}

const MONEY = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

export function numberWords(kind: NumberKind, value: unknown): string {
  if (typeof value !== 'number') return '—';
  if (kind === 'money') return MONEY.format(value);
  if (kind === 'percent') return `${NUMBER.format(value * 100)}%`;
  return NUMBER.format(value);
}
