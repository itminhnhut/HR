import {
  componentsFor,
  contractTypesFor,
  DEFAULT_CONTRACT_TYPES,
  PAYROLL_SETTING_DEFS,
  settingFor,
  type PayrollZone,
} from '@careers/shared';
import { applicableRow, hasValue, type Row } from './payroll-versions.js';

/**
 * What a profile needs from Cấu hình: component default amounts, a contract type's probation days, the regional
 * minimum of a person's region. Stored rows on top of the payroll engine's defaults (`componentsFor`,
 * `contractTypesFor`, `settingFor`), so a prefill and the minimum-wage warning work with no stored row. Before the
 * engine's defaults start (2026) only stored rows count.
 */

/** Spec 17.2, câu 33: the engine's probation days (60) unless the contract type or the person says otherwise. */
export const DEFAULT_PROBATION_DAYS = DEFAULT_CONTRACT_TYPES[0]?.probationDays ?? 60;
/** The engine's id of "Lương thời gian", compared with the regional minimum (L-B12). */
export const SALARY_COMPONENT = 'luong';
/** API-only `quy-tac.thang-dau` default (câu 34). */
export const DEFAULT_FIRST_MONTH = '2026-11';

const fixed = (key: string) => {
  const def = PAYROLL_SETTING_DEFS[key];
  if (!def) throw new Error(`No payroll setting ${key}`);
  return def;
};

const attribute = (rows: readonly Row[], key: string, personId: string | null, month: string) =>
  applicableRow(rows, { key, perPerson: true }, personId, month)?.value;

/** Default amount of each component in force for a person in a month: `khoan.<id>.muc-mac-dinh`, else the list's. */
export function componentDefaults(
  rows: readonly Row[],
  personId: string | null,
  month: string,
): Record<string, number> {
  if (!hasValue(rows, fixed('khoan.danh-sach'), null, month)) return {};
  return Object.fromEntries(componentsFor(rows, personId, month).map((c) => [c.id, c.defaultAmount]));
}

/** Probation days of a contract type in a month: its attribute row, the list's, or 60. */
export function probationDaysOf(rows: readonly Row[], contractTypeId: string, personId: string | null, month: string) {
  const own = attribute(rows, `loai-hd.${contractTypeId}.ngay-thu-viec`, personId, month);
  if (typeof own === 'number') return own;
  if (!hasValue(rows, fixed('loai-hd.danh-sach'), null, month)) return DEFAULT_PROBATION_DAYS;
  const entry = contractTypesFor(rows, personId, month).find((t) => t.id === contractTypeId);
  return entry?.probationDays ?? DEFAULT_PROBATION_DAYS;
}

/** The regional minimum for a person on a date: zone of the region (vùng I when none), stored or the engine's; null before 2026 with none stored. */
export function regionalMinimum(
  rows: readonly Row[],
  person: { id: string; regionId: string },
  date: string,
): { zone: PayrollZone; amount: number } | null {
  const month = date.slice(0, 7);
  const day = `${month}-01`;
  const key = 'luat.luong-toi-thieu-vung';
  if (!hasValue(rows, fixed(key), person.id, day)) return null;
  const stored = attribute(rows, `khu-vuc.${person.regionId}.vung`, person.id, month);
  const zone: PayrollZone = stored === 'II' || stored === 'III' || stored === 'IV' ? stored : 'I';
  return { zone, amount: settingFor(rows, key, person.id, day).value[zone] };
}

/** The first payroll month on the web: `quy-tac.thang-dau`, else T11/2026. */
export function firstMonth(rows: readonly Row[]): string {
  const value = applicableRow(rows, fixed('quy-tac.thang-dau'), null, '9999-12')?.value;
  return typeof value === 'string' ? value : DEFAULT_FIRST_MONTH;
}
