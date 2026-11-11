import { z } from 'zod';
import {
  COMPONENT_ATTRIBUTES,
  componentTaxSchema,
  CONTRACT_ATTRIBUTES,
  contractTypeSchema,
  DATE_KEY,
  LAW_MIN_OVERTIME,
  LAW_MIN_PROBATION_RATE,
  MONTH_KEY,
  payComponentSchema,
  PAYROLL_SETTINGS,
  ZONES,
  type LawGroup,
  type SettingDef,
  type SettingRow,
  type SettingScope,
  type Zone,
} from './payroll/index.js';

/**
 * Cấu hình lương as the API stores it (spec-luong.md 6, 7, 9). One row per value: a key, everyone or one person, the
 * month (or date, for a law parameter) it applies from, a value, its source. Keys, scopes, value schemas and defaults
 * are the engine's (`packages/shared/src/payroll/`), so a stored row is always a change on top of them; the API adds
 * the menu area, HR's wording of a refusal, and the few keys the engine has no setting for (`engine: false`).
 */

/** The engine's `SettingRow`: a stored row is handed to `settingFor` as it is. */
export type PayrollSettingRow = SettingRow;
export type PayrollSettingScope = SettingScope;
/** Which date a law parameter is read on (R2): day 1 of the insurance month, or the pay date. */
export type PayrollLawGroup = LawGroup;
/** The menu of Cấu hình (spec 11.6, `?muc=`). */
export const PAYROLL_CONFIG_AREAS = ['khoan-luong', 'tham-so', 'quy-tac', 'loai-hd', 'tuy-chon', 'khu-vuc'] as const;
// Same list as the engine's own type (payroll/explain-refs.ts); one name, so the shared index has no clash.
export type { PayrollConfigArea } from './payroll/explain-refs.js';
import type { PayrollConfigArea } from './payroll/explain-refs.js';

export const PAYROLL_MONTH = MONTH_KEY;
export const PAYROLL_DATE = DATE_KEY;

export interface PayrollSettingDef {
  key: string;
  label: string;
  area: PayrollConfigArea;
  scope: PayrollSettingScope;
  /** "Ghi đè một người" (spec 6.2, 9). */
  perPerson: boolean;
  group?: PayrollLawGroup;
  schema: z.ZodType;
  /**
   * The first date or month a default covers. A stored row before it is the only value of its months, so removing it
   * would leave them without one (L-A14). Null: the value always falls back to its catalogue entry.
   */
  defaultFrom: string | null;
  /** False: a key the API needs that the engine has no setting for yet. */
  engine: boolean;
}

const money = z.number({ message: 'Nhập số tiền.' }).int('Số tiền là số đồng.').nonnegative('Số tiền không âm.');
const rate = z.number({ message: 'Nhập tỷ lệ.' }).min(0).max(1);
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Mã chỉ gồm chữ thường không dấu, số và gạch nối.');

/** Legal floors of the engine (BLLĐ Đ.26, Đ.98). */
export const PAYROLL_LAW_MIN_PROBATION_RATE = LAW_MIN_PROBATION_RATE;
export const PAYROLL_LAW_MIN_OVERTIME = LAW_MIN_OVERTIME;

export const PAYROLL_ZONES = ZONES;
export type PayrollZone = Zone;

const insuranceRates = z.object({ social: rate, health: rate, unemployment: rate });
const overtimeFloor = (min: number) =>
  z.number().min(min, `Dưới mức luật: tối thiểu ${Math.round(min * 100)}% (BLLĐ Đ.98).`);

export const payrollComponentTaxSchema = componentTaxSchema;

/** The engine's `payComponentSchema` with HR's wording: one entry of `khoan.danh-sach`. */
export const payrollComponentSchema = payComponentSchema.extend({
  id: slug,
  name: z.string().trim().min(1, 'Nhập tên khoản.').max(80),
  defaultAmount: money,
  regulatedCap: money.nullable(),
  stoppedFrom: z.string().regex(PAYROLL_MONTH).nullable(),
});
export type PayrollComponent = z.infer<typeof payrollComponentSchema>;

/** The engine's `contractTypeSchema` with HR's wording: one entry of `loai-hd.danh-sach`. */
export const payrollContractTypeSchema = contractTypeSchema.extend({
  id: slug,
  name: z.string().trim().min(1, 'Nhập tên loại hợp đồng.').max(80),
});
export type PayrollContractType = z.infer<typeof payrollContractTypeSchema>;

const uniqueIds = <T extends { id: string }>(item: z.ZodType<T>, words: string) =>
  z
    .array(item)
    .refine((list) => new Set(list.map((e) => e.id)).size === list.length, { message: `Hai ${words} trùng mã.` });

const fieldSchemas = (
  attributes: Readonly<Record<string, string>>,
  shape: Readonly<Record<string, z.ZodType>>,
): Readonly<Record<string, z.ZodType>> =>
  Object.fromEntries(
    Object.entries(attributes).flatMap(([attribute, field]) => {
      const schema = shape[field];
      return schema ? [[attribute, schema]] : [];
    }),
  );

/** The engine's `COMPONENT_ATTRIBUTES`: `khoan.<id>.<attribute>` changes one field of a component. */
export const PAYROLL_COMPONENT_ATTRIBUTES = fieldSchemas(COMPONENT_ATTRIBUTES, payrollComponentSchema.shape);

/** The engine's `CONTRACT_ATTRIBUTES`: `loai-hd.<id>.<attribute>`. */
export const PAYROLL_CONTRACT_ATTRIBUTES = fieldSchemas(CONTRACT_ATTRIBUTES, payrollContractTypeSchema.shape);

/** One refusal in HR's words for any value the engine's schema does not accept. */
const oneOf = (schema: z.ZodType, message: string) => z.custom((v) => schema.safeParse(v).success, { message });

/** HR's wording, checked before the engine's schema (which stays the authority on what is stored). */
const HR_CHECKS: Readonly<Record<string, z.ZodType>> = {
  'luat.luong-co-so': money,
  'luat.luong-toi-thieu-vung': z.object({ I: money, II: money, III: money, IV: money }),
  'luat.bh-nld': insuranceRates,
  'luat.bh-cty': insuranceRates,
  'luat.kpcd': rate,
  'luat.doan-phi': rate,
  'luat.giam-tru': z.object({ personal: money, dependant: money }),
  'luat.bieu-thue': z.array(z.object({ upTo: money.nullable(), rate })).min(1, 'Biểu thuế cần ít nhất một bậc.'),
  'luat.tran-tien-an': money,
  'luat.khau-tru-10': z.object({ rate, threshold: money }),
  'luat.tran-trang-phuc': money,
  'quy-tac.ty-le-thu-viec': z
    .number({ message: 'Nhập tỷ lệ.' })
    .min(PAYROLL_LAW_MIN_PROBATION_RATE, 'Luật tối thiểu 85% (BLLĐ Đ.26).')
    .max(1, 'Tối đa 100%.'),
  'quy-tac.he-so-lam-them': z.object({
    weekday: overtimeFloor(PAYROLL_LAW_MIN_OVERTIME.weekday),
    restDay: overtimeFloor(PAYROLL_LAW_MIN_OVERTIME.restDay),
    holiday: overtimeFloor(PAYROLL_LAW_MIN_OVERTIME.holiday),
  }),
  'khoan.danh-sach': uniqueIds(payrollComponentSchema, 'khoản').min(1, 'Cần ít nhất một khoản.'),
  'loai-hd.danh-sach': uniqueIds(payrollContractTypeSchema, 'loại hợp đồng').min(1, 'Cần ít nhất một loại.'),
};

const AREA_OF_PREFIX: Readonly<Record<string, PayrollConfigArea>> = {
  luat: 'tham-so',
  'quy-tac': 'quy-tac',
  'tuy-chon': 'tuy-chon',
  khoan: 'khoan-luong',
  'loai-hd': 'loai-hd',
};

function areaOf(key: string): PayrollConfigArea {
  const area = AREA_OF_PREFIX[key.split('.')[0] ?? ''];
  if (!area) throw new Error(`Payroll setting ${key}: no menu area`);
  return area;
}

const isOption = (key: string) => key.startsWith('tuy-chon.');

/** "D01 Làm tròn": an option's label starts with its code. */
const labelOf = (key: string, label: string) => (isOption(key) ? `${key.slice(-3).toUpperCase()} ${label}` : label);

function fromEngine(key: string, def: SettingDef<unknown>): PayrollSettingDef {
  const check = HR_CHECKS[key] ?? (isOption(key) ? oneOf(def.schema, 'Không có lựa chọn này.') : undefined);
  return {
    key,
    label: labelOf(key, def.label),
    area: areaOf(key),
    scope: def.scope,
    perPerson: def.perPerson,
    ...(def.group ? { group: def.group } : {}),
    schema: check ? check.pipe(def.schema) : def.schema,
    defaultFrom: def.defaults[0]?.from ?? null,
    engine: true,
  };
}

const COMPANY_FROM = '2026-01';

/** Keys the API needs that the engine has no setting for. */
const apiOnly = (key: string, label: string, schema: z.ZodType): PayrollSettingDef => ({
  key,
  label,
  area: 'quy-tac',
  scope: 'month',
  perPerson: false,
  schema,
  defaultFrom: COMPANY_FROM,
  engine: false,
});

const engineDefs: [string, SettingDef<unknown>][] = Object.entries(PAYROLL_SETTINGS);

/** Every fixed key, the engine's and the API's own. */
export const PAYROLL_SETTING_DEFS: Readonly<Record<string, PayrollSettingDef>> = {
  ...Object.fromEntries(engineDefs.map(([key, def]) => [key, fromEngine(key, def)])),
  'quy-tac.thang-dau': apiOnly(
    'quy-tac.thang-dau',
    'Tháng đầu trên web',
    z.string().regex(PAYROLL_MONTH, 'Chọn tháng.'),
  ),
  'quy-tac.khoan-32-mac-dinh': apiOnly(
    'quy-tac.khoan-32-mac-dinh',
    'Loại mặc định của khoản (32)',
    z.enum(['support', 'refund', 'advance']),
  ),
};

const ATTRIBUTE_KEY = /^(khoan|loai-hd)\.([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z0-9-]+)$/;
const ZONE_KEY = /^khu-vuc\.([0-9a-f-]{36})\.vung$/;

function attributeDef(key: string): PayrollSettingDef | undefined {
  const [, prefix, , attribute] = ATTRIBUTE_KEY.exec(key) ?? [];
  if (!prefix || !attribute || attribute === 'danh-sach') return undefined;
  const fields: Readonly<Record<string, z.ZodType>> =
    prefix === 'khoan' ? PAYROLL_COMPONENT_ATTRIBUTES : PAYROLL_CONTRACT_ATTRIBUTES;
  const schema = fields[attribute];
  if (!schema) return undefined;
  const area = prefix === 'khoan' ? 'khoan-luong' : 'loai-hd';
  return { key, label: key, area, scope: 'month', perPerson: true, schema, defaultFrom: null, engine: true };
}

/** `khu-vuc.<regionId>.vung`: the minimum-wage zone of a region from a month; vùng I when nobody set one. */
function zoneDef(key: string): PayrollSettingDef | undefined {
  if (!ZONE_KEY.test(key)) return undefined;
  const schema = z.enum(PAYROLL_ZONES, { message: 'Chọn vùng I–IV.' });
  return {
    key,
    label: 'Vùng lương tối thiểu',
    area: 'khu-vuc',
    scope: 'month',
    perPerson: true,
    schema,
    defaultFrom: null,
    engine: false,
  };
}

/** The definition of any key the API accepts, or undefined. */
export function payrollSettingDef(key: string): PayrollSettingDef | undefined {
  return PAYROLL_SETTING_DEFS[key] ?? attributeDef(key) ?? zoneDef(key);
}

/** What HR saves: a new row, or a stop row ("Ngừng từ tháng", "Bỏ ghi đè"). */
export const payrollSettingInputSchema = z.object({
  key: z.string().trim().min(1, 'Chọn mục cấu hình.').max(120),
  employeeId: z.string().uuid().nullish(),
  from: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Chọn ngày hoặc tháng áp dụng.'),
  value: z.unknown().optional(),
  stop: z.boolean().optional(),
  source: z.string().trim().max(500).default(''),
});
export type PayrollSettingInput = z.input<typeof payrollSettingInputSchema>;

/** Editing a row not used by an approved month; any field left out stays. */
export const payrollSettingEditSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/)
    .optional(),
  value: z.unknown().optional(),
  source: z.string().trim().max(500).optional(),
});

/** "Sửa lỗi" (R5): a replacement on the same date; the old row is kept, marked replaced. */
export const payrollSettingCorrectSchema = z.object({
  value: z.unknown(),
  source: z.string().trim().max(500).default(''),
});

export interface PayrollSettingDto extends PayrollSettingRow {
  id: string;
  stop: boolean;
  supersededBy: string | null;
  source: string;
  createdBy: string;
  createdAt: string;
}

export interface PayrollSettingSavedDto {
  setting: PayrollSettingDto;
  /** E.g. "Bắt buộc theo Luật Công đoàn 2024" when KPCĐ is turned off (L-A27). */
  warnings: string[];
  /** Approved months whose value this changes: the web opens "Thay đổi chạm tháng đã duyệt" (R6, step 17). */
  approvedMonthsTouched: string[];
}

/**
 * How a stored row stands for the month viewed (spec 11.6): in force, still to come, replaced by a later one, or
 * corrected ("đã thay").
 */
export type PayrollSettingStatus = 'in-force' | 'upcoming' | 'past' | 'superseded';

export interface PayrollSettingViewLineDto {
  key: string;
  label: string;
  area: PayrollConfigArea;
  /** The date or month this key is read on for the month viewed (R2). */
  readOn: string;
  /** The stored row for everyone in force; null: the engine's default applies. */
  inForce: PayrollSettingDto | null;
  /** People with their own row in force. */
  overrides: number;
  rows: (PayrollSettingDto & { status: PayrollSettingStatus })[];
}

export interface PayrollSettingsMonthDto {
  month: string;
  payDate: string;
  insuranceDate: string;
  lines: PayrollSettingViewLineDto[];
}
