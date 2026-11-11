import type { z } from 'zod';
import {
  CATALOGUE_SETTINGS,
  contractTypeSchema,
  payComponentSchema,
  type ContractType,
  type PayComponent,
} from './defaults-company.js';
import { applicableRow, resolveSetting } from './resolve.js';
import type { Resolved, SettingRow } from './setting-core.js';

/**
 * Pay components and contract types are catalogues by month; each attribute can also be changed for everyone or for
 * one person from a month with a row keyed `khoan.<id>.<attribute>` or `loai-hd.<id>.<attribute>` (spec 6.2).
 */

export const COMPONENT_ATTRIBUTES = {
  ten: 'name',
  'thu-tu': 'order',
  'chia-theo-ngay': 'perDay',
  'thu-viec': 'probationRate',
  'tinh-bh': 'insured',
  'luong-theo-hd': 'contractPay',
  'vao-lam-them': 'overtimeBase',
  thue: 'tax',
  'muc-mac-dinh': 'defaultAmount',
  'muc-quy-che': 'regulatedCap',
  ngung: 'stoppedFrom',
} as const satisfies Record<string, keyof PayComponent>;

export const CONTRACT_ATTRIBUTES = {
  ten: 'name',
  'dong-bh': 'insured',
  'cach-thue': 'taxMethod',
  'duoi-3-thang': 'shortTerm',
  'ngay-thu-viec': 'probationDays',
  'cam-ket-kem-hd': 'commitmentIncluded',
  ngung: 'stoppedFrom',
} as const satisfies Record<string, keyof ContractType>;

interface Catalogue<T extends { id: string }> {
  prefix: string;
  entries: (rows: readonly SettingRow[], month: string) => Resolved<T[]>;
  attributes: Readonly<Record<string, keyof T & string>>;
  shape: Readonly<Record<string, z.ZodType>>;
}

const COMPONENTS: Catalogue<PayComponent> = {
  prefix: 'khoan',
  entries: (rows, month) => resolveSetting(rows, CATALOGUE_SETTINGS['khoan.danh-sach'], null, month),
  attributes: COMPONENT_ATTRIBUTES,
  shape: payComponentSchema.shape,
};

const CONTRACTS: Catalogue<ContractType> = {
  prefix: 'loai-hd',
  entries: (rows, month) => resolveSetting(rows, CATALOGUE_SETTINGS['loai-hd.danh-sach'], null, month),
  attributes: CONTRACT_ATTRIBUTES,
  shape: contractTypeSchema.shape,
};

function attributeValue<T extends { id: string }>(
  catalogue: Catalogue<T>,
  rows: readonly SettingRow[],
  args: { entry: T; base: Resolved<T[]>; attribute: string; personId: string | null; month: string },
): Resolved<unknown> {
  const { entry, base, attribute, personId, month } = args;
  const key = `${catalogue.prefix}.${entry.id}.${attribute}`;
  const field = catalogue.attributes[attribute];
  const schema = field ? catalogue.shape[field] : undefined;
  if (!field || !schema) throw new Error(`Payroll setting ${key}: unknown attribute`);
  const row = applicableRow(rows, key, true, personId, month);
  if (!row) return { ...base, key, value: entry[field] };
  const parsed = schema.safeParse(row.value);
  if (!parsed.success) throw new Error(`Payroll setting ${key} (from ${row.from}): ${parsed.error.message}`);
  return {
    key,
    value: parsed.data,
    from: row.from,
    employeeId: row.employeeId,
    source: row.source ?? '',
    isDefault: false,
  };
}

function withOverrides<T extends { id: string }>(
  catalogue: Catalogue<T>,
  rows: readonly SettingRow[],
  personId: string | null,
  month: string,
): T[] {
  const base = catalogue.entries(rows, month);
  return base.value.map((entry) =>
    Object.keys(catalogue.attributes).reduce<T>((acc, attribute) => {
      const field = catalogue.attributes[attribute];
      if (!field) return acc;
      const { value } = attributeValue(catalogue, rows, { entry, base, attribute, personId, month });
      return { ...acc, [field]: value };
    }, entry),
  );
}

/** The pay components in force for a person in a payroll month, in column order, stopped ones left out. */
export function componentsFor(rows: readonly SettingRow[], personId: string | null, month: string): PayComponent[] {
  return withOverrides(COMPONENTS, rows, personId, month)
    .filter((c) => !c.stoppedFrom || c.stoppedFrom > month)
    .sort((a, b) => a.order - b.order);
}

/** The contract types in force for a person in a payroll month. */
export function contractTypesFor(rows: readonly SettingRow[], personId: string | null, month: string): ContractType[] {
  return withOverrides(CONTRACTS, rows, personId, month);
}

export function contractTypeFor(
  rows: readonly SettingRow[],
  id: string,
  personId: string | null,
  month: string,
): ContractType {
  const found = contractTypesFor(rows, personId, month).find((t) => t.id === id);
  if (!found) throw new Error(`Payroll: contract type ${id} is not configured for ${month}`);
  return found;
}

function attributeOf<T extends { id: string }>(
  catalogue: Catalogue<T>,
  rows: readonly SettingRow[],
  args: { id: string; attribute: string; personId: string | null; month: string },
): Resolved<unknown> {
  const base = catalogue.entries(rows, args.month);
  const entry = base.value.find((e) => e.id === args.id);
  if (!entry) throw new Error(`Payroll setting ${catalogue.prefix}.${args.id}: not configured for ${args.month}`);
  return attributeValue(catalogue, rows, { ...args, entry, base });
}

/** One attribute of a component or contract type, with the row it came from. */
export function resolveAttribute(
  rows: readonly SettingRow[],
  key: string,
  personId: string | null,
  month: string,
): Resolved<unknown> {
  const [prefix, id, attribute, ...rest] = key.split('.');
  if (!id || !attribute || rest.length > 0) throw new Error(`Payroll setting ${key}: unknown key`);
  if (prefix === 'khoan') return attributeOf(COMPONENTS, rows, { id, attribute, personId, month });
  if (prefix === 'loai-hd') return attributeOf(CONTRACTS, rows, { id, attribute, personId, month });
  throw new Error(`Payroll setting ${key}: unknown key`);
}
