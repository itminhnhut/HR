import type { z } from 'zod';

/**
 * One configuration row (spec 6.1): a key, a scope (everyone when `employeeId` is null, else one person), the month
 * or date it applies from, a value. "Bỏ ghi đè" is a `stop` row from a month; "Sửa lỗi" marks the old row superseded.
 */
export interface SettingRow {
  id?: string;
  key: string;
  employeeId: string | null;
  /** `YYYY-MM` for a setting by payroll month, `YYYY-MM-DD` for a law parameter by date. */
  from: string;
  value: unknown;
  stop?: boolean;
  supersededBy?: string | null;
  source?: string;
}

/** Law parameters go by a date (R2); everything else by payroll month. */
export type SettingScope = 'month' | 'date';

/** Which reference date a law parameter takes (R2): day 1 of the insurance month, or the pay date. */
export type LawGroup = 'insurance' | 'tax';

export interface SettingDefault<T> {
  from: string;
  value: T;
  source: string;
}

export interface SettingDef<T> {
  key: string;
  label: string;
  scope: SettingScope;
  perPerson: boolean;
  group?: LawGroup;
  schema: z.ZodType<T>;
  defaults: readonly SettingDefault<T>[];
}

export const defineSetting = <T>(def: SettingDef<T>): SettingDef<T> => def;

/** The value used and where it came from, for the tooltip's "Mở cấu hình" link (Q6) and the approval snapshot (R4). */
export interface Resolved<T> {
  key: string;
  value: T;
  from: string;
  employeeId: string | null;
  source: string;
  isDefault: boolean;
}

export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
