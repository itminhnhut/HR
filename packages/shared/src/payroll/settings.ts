import { CATALOGUE_SETTINGS, OPTION_SETTINGS, RULE_SETTINGS } from './defaults-company.js';
import { LAW_SETTINGS } from './defaults-law.js';
import { resolveAttribute } from './components.js';
import { resolveSetting } from './resolve.js';
import type { Resolved, SettingDef, SettingRow } from './setting-core.js';

export const PAYROLL_SETTINGS = { ...LAW_SETTINGS, ...RULE_SETTINGS, ...OPTION_SETTINGS, ...CATALOGUE_SETTINGS };

type Registry = typeof PAYROLL_SETTINGS;
export type SettingKey = keyof Registry;
export type SettingValue<K extends SettingKey> = Registry[K] extends SettingDef<infer T> ? T : never;

/**
 * `settingFor(rows, key, person, month)` (spec 15 step 1). A component or contract attribute such as
 * `khoan.com.thue` resolves against its catalogue entry; see `componentsFor`.
 */
export function settingFor<K extends SettingKey>(
  rows: readonly SettingRow[],
  key: K,
  personId: string | null,
  at: string,
): Resolved<SettingValue<K>>;
export function settingFor(
  rows: readonly SettingRow[],
  key: string,
  personId: string | null,
  at: string,
): Resolved<unknown>;
export function settingFor(
  rows: readonly SettingRow[],
  key: string,
  personId: string | null,
  at: string,
): Resolved<unknown> {
  const def = registeredDef(key);
  if (def) return resolveSetting<unknown>(rows, def, personId, at);
  return resolveAttribute(rows, key, personId, at);
}

function registeredDef(key: string): SettingDef<unknown> | undefined {
  const entries: [string, SettingDef<unknown>][] = Object.entries(PAYROLL_SETTINGS);
  return entries.find(([k]) => k === key)?.[1];
}
