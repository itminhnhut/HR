import {
  PAYROLL_MONTH,
  PAYROLL_SETTING_DEFS,
  payrollSettingDef,
  type PayrollSettingDef,
  type PayrollSettingDto,
  type PayrollSettingStatus,
  type PayrollSettingsMonthDto,
  type PayrollSettingViewLineDto,
} from '@careers/shared';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { invalid } from '../lib/http-error.js';
import { loadRows } from './payroll-settings.js';
import { applicableRow, latestRow, payDateOf, payDayFor, readOn } from './payroll-versions.js';

/**
 * "Xem cấu hình áp dụng cho tháng …" (spec-luong.md 11.6, L-A32): each key as the month reads it, on its own reference
 * date (R2), with every stored row labelled. A key without a stored row in force uses the engine's default.
 */

const querySchema = z.object({
  thang: z.string().regex(PAYROLL_MONTH),
  nguoi: z.string().uuid().optional(),
});

function statusOf(row: PayrollSettingDto, rows: readonly PayrollSettingDto[], at: string): PayrollSettingStatus {
  if (row.supersededBy) return 'superseded';
  if (latestRow(rows, row.key, row.employeeId, at)?.id === row.id) return 'in-force';
  return row.from > at ? 'upcoming' : 'past';
}

/** Newest first; on one date the live row before the ones it replaced. */
const byDate = (a: PayrollSettingDto, b: PayrollSettingDto) =>
  b.from.localeCompare(a.from) || Number(!!a.supersededBy) - Number(!!b.supersededBy);

function lineOf(
  def: PayrollSettingDef,
  rows: readonly PayrollSettingDto[],
  month: string,
  personId: string | null,
): PayrollSettingViewLineDto {
  const at = readOn(def, month, rows);
  const own = rows.filter((r) => r.key === def.key);
  const people = new Set(own.map((r) => r.employeeId).filter((id): id is string => id !== null));
  const overrides = [...people].filter((id) => {
    const row = latestRow(own, def.key, id, at);
    return row !== undefined && !row.stop;
  }).length;
  return {
    key: def.key,
    label: def.label,
    area: def.area,
    readOn: at,
    inForce: applicableRow(own, def, personId, at) ?? null,
    overrides,
    rows: [...own].sort(byDate).map((r) => ({ ...r, status: statusOf(r, own, at) })),
  };
}

export async function settingsOfMonth(db: Db, raw: unknown): Promise<PayrollSettingsMonthDto> {
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) throw invalid('Chọn tháng lương.', { thang: 'Chọn tháng lương.' });
  const { thang: month, nguoi } = parsed.data;
  const rows = await loadRows(db);
  const stored = [...new Set(rows.map((r) => r.key))].filter((key) => !PAYROLL_SETTING_DEFS[key]);
  const defs = [
    ...Object.values(PAYROLL_SETTING_DEFS),
    ...stored.map(payrollSettingDef).filter((d): d is PayrollSettingDef => d !== undefined),
  ];
  return {
    month,
    payDate: payDateOf(month, payDayFor(rows, month)),
    insuranceDate: `${month}-01`,
    lines: defs.map((def) => lineOf(def, rows, month, nguoi ?? null)),
  };
}
