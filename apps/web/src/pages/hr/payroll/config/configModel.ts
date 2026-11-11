import {
  CATALOGUE_SETTINGS,
  componentsFor,
  contractCommitment,
  contractTypesFor,
  isInUse,
  PAYROLL_SETTINGS,
  payrollSettingDef,
  resolveSetting,
  type ContractType,
  type PayComponent,
  type PayrollSettingDto,
  type PayrollSettingsMonthDto,
  type PayrollSettingStatus,
  type PayrollSettingViewLineDto,
  type SettingDefault,
} from '@careers/shared';
import type { PayrollRates } from '../payrollModel';

/**
 * What the Cấu hình tab shows (spec 6, 11.6): every setting with its default (engine or law, with the legal source),
 * the value for everyone in force in the month viewed, whether that is a change, and how many people have their own.
 * Pay components and contract types appear one entry at a time, each flag its own setting (`khoan.<id>.<flag>`).
 */

export const CONFIG_GROUPS = [
  { id: 'khoan-luong', label: 'Khoản lương' },
  { id: 'loai-hd', label: 'Loại HĐ' },
  { id: 'bao-hiem', label: 'Bảo hiểm' },
  { id: 'thue', label: 'Thuế' },
  { id: 'quy-tac', label: 'Quy tắc' },
] as const;
export type ConfigGroup = (typeof CONFIG_GROUPS)[number]['id'];

export type ConfigRow = PayrollSettingDto & { status: PayrollSettingStatus };

export interface ConfigItem {
  key: string;
  label: string;
  group: ConfigGroup;
  /** The component or contract type an attribute belongs to. */
  entry: string | null;
  scope: 'month' | 'date';
  perPerson: boolean;
  /** The date or month the viewed month reads it on (R2). */
  readOn: string;
  /** In force for everyone: a stored row, else the default. Undefined: nothing known (an API-only key). */
  value: unknown;
  /** The stored row for everyone in force; null when the default applies. */
  inForce: PayrollSettingDto | null;
  fallback: { value: unknown; from: string; source: string } | null;
  overrides: number;
  rows: ConfigRow[];
}

const INSURANCE_OPTIONS = new Set(['tuy-chon.d03', 'tuy-chon.d04', 'tuy-chon.d15', 'quy-tac.dem-ngay-bh']);
const TAX_OPTIONS = new Set(['tuy-chon.d02', 'tuy-chon.d05', 'tuy-chon.d08', 'tuy-chon.d09', 'tuy-chon.d10']);
/** Labour-law limits are read on the pay date but belong with the rules HR thinks of them with. */
const LABOUR_LAW = new Set(['luat.thu-viec-toi-da', 'luat.gioi-han-lam-them']);
const CATALOGUES = new Set(['khoan.danh-sach', 'loai-hd.danh-sach']);

function groupOf(key: string): ConfigGroup {
  if (INSURANCE_OPTIONS.has(key)) return 'bao-hiem';
  if (TAX_OPTIONS.has(key)) return 'thue';
  if (key.startsWith('luat.') && !LABOUR_LAW.has(key)) {
    return payrollSettingDef(key)?.group === 'tax' ? 'thue' : 'bao-hiem';
  }
  return 'quy-tac';
}

export const COMPONENT_FLAGS = {
  thue: 'Cách thuế',
  'tinh-bh': 'Tính BH',
  'chia-theo-ngay': 'Chia theo ngày công',
  'thu-viec': 'Nhân tỷ lệ lương thử việc',
  'luong-theo-hd': 'Tính vào lương theo HĐ (trả phép chưa nghỉ)',
  'vao-lam-them': 'Tính vào đơn giá làm thêm',
  'muc-mac-dinh': 'Mức mặc định (điền sẵn hồ sơ mới)',
  'muc-quy-che': 'Mức miễn theo quy chế',
} as const satisfies Record<string, string>;

export const CONTRACT_FLAGS = {
  'dong-bh': 'Đóng BH',
  'cach-thue': 'Cách thuế',
  'duoi-3-thang': 'HĐ dưới 3 tháng',
  'ngay-thu-viec': 'Số ngày thử việc mặc định',
  'cam-ket-kem-hd': 'Cam kết thuế kèm hợp đồng (không khấu trừ 10%)',
} as const satisfies Record<string, string>;

const COMPONENT_FIELD: Record<keyof typeof COMPONENT_FLAGS, keyof PayComponent> = {
  thue: 'tax',
  'tinh-bh': 'insured',
  'chia-theo-ngay': 'perDay',
  'thu-viec': 'probationRate',
  'luong-theo-hd': 'contractPay',
  'vao-lam-them': 'overtimeBase',
  'muc-mac-dinh': 'defaultAmount',
  'muc-quy-che': 'regulatedCap',
};

const CONTRACT_FIELD: Record<keyof typeof CONTRACT_FLAGS, keyof ContractType> = {
  'dong-bh': 'insured',
  'cach-thue': 'taxMethod',
  'duoi-3-thang': 'shortTerm',
  'ngay-thu-viec': 'probationDays',
  'cam-ket-kem-hd': 'commitmentIncluded',
};

const EMPTY_LINE = (key: string, readOn: string): PayrollSettingViewLineDto => ({
  key,
  label: key,
  area: 'quy-tac',
  readOn,
  inForce: null,
  overrides: 0,
  rows: [],
});

function engineDefaults(key: string): readonly SettingDefault<unknown>[] {
  const entries: [string, { defaults: readonly SettingDefault<unknown>[] }][] = Object.entries(PAYROLL_SETTINGS);
  return entries.find(([k]) => k === key)?.[1].defaults ?? [];
}

/**
 * A label as HR reads it (F13): the builders' codes in it ("D03 KPCĐ", "… (BH-1)") mean nothing to HR and are left
 * out; the setting's key, shown on hover, still tells a developer which one it is.
 */
export const shownLabel = (label: string) =>
  label
    .replace(/^D\d{2}\s+/, '')
    .replace(/\s*\(BH-\d\)/g, '')
    .trim();

function itemOf(line: PayrollSettingViewLineDto, extra: Partial<ConfigItem> = {}): ConfigItem {
  const def = payrollSettingDef(line.key);
  const fallback = [...engineDefaults(line.key)].reverse().find((d) => d.from <= line.readOn) ?? null;
  const base: ConfigItem = {
    key: line.key,
    label: shownLabel(line.label),
    group: groupOf(line.key),
    entry: null,
    scope: def?.scope ?? 'month',
    perPerson: def?.perPerson ?? false,
    readOn: line.readOn,
    inForce: line.inForce,
    fallback,
    value: undefined,
    overrides: line.overrides,
    rows: line.rows,
  };
  const merged = { ...base, ...extra };
  return { ...merged, value: merged.inForce ? merged.inForce.value : merged.fallback?.value };
}

/** Each entry of a catalogue in force, then one item per flag; the default is the entry's own field. */
function entryItems<T extends { id: string; name: string }>(
  view: PayrollSettingsMonthDto,
  lines: ReadonlyMap<string, PayrollSettingViewLineDto>,
  args: {
    prefix: 'khoan' | 'loai-hd';
    group: ConfigGroup;
    entries: { value: readonly T[]; from: string; source: string };
    flags: Readonly<Record<string, string>>;
    field: (flag: string) => keyof T | undefined;
    skip?: (entry: T, flag: string) => boolean;
  },
): ConfigItem[] {
  return args.entries.value.flatMap((entry) =>
    Object.entries(args.flags).flatMap(([flag, label]) => {
      const field = args.field(flag);
      if (!field || args.skip?.(entry, flag)) return [];
      const key = `${args.prefix}.${entry.id}.${flag}`;
      const line = lines.get(key) ?? EMPTY_LINE(key, view.month);
      const fallback = { value: entry[field], from: args.entries.from, source: args.entries.source };
      return [itemOf({ ...line, label }, { group: args.group, entry: entry.name, perPerson: true, fallback })];
    }),
  );
}

const allRows = (view: PayrollSettingsMonthDto) => view.lines.flatMap((l) => l.rows);

export const zoneKey = (regionId: string) => `khu-vuc.${regionId}.vung`;

/**
 * The minimum-wage zone of each region (F24): `khu-vuc.<id>.vung`, vùng I until HR sets one. It decides the floor of
 * the insurance salary and the cap of BHTN, so it sits with Bảo hiểm, one item per region of Chấm công.
 */
function zoneItems(
  view: PayrollSettingsMonthDto,
  lines: ReadonlyMap<string, PayrollSettingViewLineDto>,
  regions: readonly { id: string; name: string }[],
): ConfigItem[] {
  return regions.map((region) => {
    const key = zoneKey(region.id);
    const line = lines.get(key) ?? EMPTY_LINE(key, view.month);
    const fallback = { value: 'I', from: view.month, source: 'Mặc định khi chưa chọn vùng' };
    return itemOf(
      { ...line, label: `Vùng lương tối thiểu · ${region.name}` },
      { group: 'bao-hiem', scope: 'month', perPerson: false, fallback },
    );
  });
}

export function buildItems(
  view: PayrollSettingsMonthDto,
  regions: readonly { id: string; name: string }[] = [],
): ConfigItem[] {
  const lines = new Map(view.lines.map((l) => [l.key, l]));
  const rows = allRows(view);
  const components = resolveSetting(rows, CATALOGUE_SETTINGS['khoan.danh-sach'], null, view.month);
  const contracts = resolveSetting(rows, CATALOGUE_SETTINGS['loai-hd.danh-sach'], null, view.month);
  const componentsNow = componentsFor(rows, null, view.month);
  const contractsNow = contractTypesFor(rows, null, view.month);
  const simple = view.lines
    .filter((l) => !CATALOGUES.has(l.key) && l.area !== 'khu-vuc' && l.key.split('.').length === 2)
    .map((l) => itemOf(l));
  return [
    ...entryItems(view, lines, {
      prefix: 'khoan',
      group: 'khoan-luong',
      // As the engine reads the month: a component stopped by then is gone, a renamed one shows its new name.
      entries: {
        ...components,
        value: components.value.flatMap((c) => {
          const now = componentsNow.find((x) => x.id === c.id);
          return now ? [{ ...c, name: now.name }] : [];
        }),
      },
      flags: COMPONENT_FLAGS,
      field: (flag) => COMPONENT_FIELD[flag as keyof typeof COMPONENT_FLAGS],
      // The contract-level cap matters only to a component taxed that way.
      skip: (c, flag) => flag === 'muc-quy-che' && !(c.tax.kind === 'cap' && c.tax.cap === 'regulated'),
    }),
    ...entryItems(view, lines, {
      prefix: 'loai-hd',
      group: 'loai-hd',
      // A type stored before "Cam kết thuế kèm hợp đồng" existed reads as the engine reads it.
      entries: {
        ...contracts,
        value: contracts.value.map((t) => {
          const now = contractsNow.find((x) => x.id === t.id) ?? t;
          const stopped = isInUse(now, view.month) ? '' : ` · đã ngừng dùng từ ${fromWords(now.stoppedFrom ?? '')}`;
          return { ...t, name: `${now.name}${stopped}`, commitmentIncluded: contractCommitment(t) };
        }),
      },
      flags: CONTRACT_FLAGS,
      field: (flag) => CONTRACT_FIELD[flag as keyof typeof CONTRACT_FLAGS],
    }),
    ...simple,
    ...zoneItems(view, lines, regions),
  ];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function threeRates(value: unknown): PayrollRates['employee'] | null {
  if (!isRecord(value)) return null;
  const { social, health, unemployment } = value;
  if (typeof social !== 'number' || typeof health !== 'number' || typeof unemployment !== 'number') return null;
  return { social, health, unemployment };
}

function bracketsOf(value: unknown): PayrollRates['brackets'] {
  if (!Array.isArray(value)) return undefined;
  const list: unknown[] = value;
  const tops = list.map((b) => (isRecord(b) ? b.upTo : undefined));
  const isKnown = (top: unknown): top is number | null => top === null || typeof top === 'number';
  return tops.every(isKnown) ? tops.map((upTo) => ({ upTo })) : undefined;
}

/** The insurance rates for everyone in the month viewed (F02): the grid's headings read "BHXH (8%)" as HR's file. */
export function monthRates(view: PayrollSettingsMonthDto): PayrollRates | undefined {
  const items = buildItems(view);
  const valueOf = (key: string) => items.find((i) => i.key === key)?.value;
  const employee = threeRates(valueOf('luat.bh-nld'));
  const company = threeRates(valueOf('luat.bh-cty'));
  const unionFund = valueOf('luat.kpcd');
  if (!employee || !company || typeof unionFund !== 'number') return undefined;
  return { employee, company, unionFund, brackets: bracketsOf(valueOf('luat.bieu-thue')) };
}

/** Changed for everyone in the month viewed, or someone has their own, or a newer version is waiting. */
export const isChanged = (item: ConfigItem) =>
  item.inForce !== null || item.overrides > 0 || item.rows.some((r) => r.status === 'upcoming');

const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export interface ConfigFilters {
  group: ConfigGroup;
  query: string;
  onlyChanged: boolean;
}

/** Searching looks across every group; without a search only the group picked shows. */
export function filterItems(items: readonly ConfigItem[], filters: ConfigFilters): ConfigItem[] {
  const words = fold(filters.query.trim());
  return items.filter((item) => {
    if (filters.onlyChanged && !isChanged(item)) return false;
    if (!words) return item.group === filters.group;
    return fold(`${item.entry ?? ''} ${item.label} ${item.key}`).includes(words);
  });
}

export const changedCount = (items: readonly ConfigItem[], group: ConfigGroup) =>
  items.filter((i) => i.group === group && isChanged(i)).length;

export const isConfigGroup = (value: string | null): value is ConfigGroup => CONFIG_GROUPS.some((g) => g.id === value);

/** `2026-11` → `T11/2026`; `2026-07-01` → `01/07/2026`. */
export const fromWords = (from: string) =>
  from.length === 7
    ? `T${Number(from.slice(5, 7))}/${from.slice(0, 4)}`
    : `${from.slice(8, 10)}/${from.slice(5, 7)}/${from.slice(0, 4)}`;

/** People with their own row, in force or still to come in the month viewed. */
export const personRows = (item: ConfigItem) =>
  item.rows.filter((r) => r.employeeId !== null && !r.stop && (r.status === 'in-force' || r.status === 'upcoming'));
