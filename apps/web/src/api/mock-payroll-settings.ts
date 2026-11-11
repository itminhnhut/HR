import {
  fieldErrors,
  PAYROLL_DATE,
  PAYROLL_MONTH,
  PAYROLL_SETTING_DEFS,
  payrollDates,
  payrollSettingCorrectSchema,
  payrollSettingDef,
  payrollSettingEditSchema,
  payrollSettingInputSchema,
  type PayrollSettingDef,
  type PayrollSettingDto,
  type PayrollSettingSavedDto,
  type PayrollSettingsMonthDto,
  type PayrollSettingStatus,
  type PayrollSettingViewLineDto,
} from '@careers/shared';
import { z } from 'zod';
import { DEMO_HR } from './demo-accounts';
import type { MockDb } from './mock-seed';
import { delay, load, requireHr, save, uid } from './mock-store';
import { ApiError } from './types';

/**
 * The demo's Cấu hình lương: the API's rules on the browser's own rows (apps/api/src/services/payroll-settings.ts).
 * Values are checked by the API's schemas, so a refusal reads the same; a row an approved demo month used is never
 * edited or deleted. One row to start with: NV A pays tax on meals from T10 (L-L03), as on the demo's Bảng lương.
 */

const SEED: PayrollSettingDto[] = [
  {
    id: 'st-seed-nv-a-com',
    key: 'khoan.com.thue',
    employeeId: 'nv-a',
    from: '2026-10',
    value: { kind: 'taxable' },
    stop: false,
    supersededBy: null,
    source: 'Demo: quyết định riêng',
    createdBy: DEMO_HR.name,
    createdAt: '2026-11-01T02:00:00.000Z',
  },
];

/** The demo's people have short ids ("nv-a"), not the database's UUIDs. */
const inputSchema = payrollSettingInputSchema.extend({ employeeId: z.string().min(1).nullish() });

const rowsOf = (db: MockDb): PayrollSettingDto[] => db.payrollSettings ?? SEED;

function store(db: MockDb, rows: PayrollSettingDto[]) {
  db.payrollSettings = rows;
  save();
}

const invalid = (message: string, errors: Record<string, string> = {}) => new ApiError(422, message, errors);

function payrollDb(): MockDb {
  const db = load();
  if (requireHr(db).canPayroll === false) throw new ApiError(403, 'Bạn không có quyền xem lương.');
  return db;
}

const approvedMonths = (db: MockDb) =>
  Object.entries(db.payrollMonths ?? {})
    .filter(([, state]) => state.status !== 'draft')
    .map(([key]) => key)
    .sort();

/** The date or month a key is read on for a payroll month (R2). */
function readOn(def: PayrollSettingDef, month: string): string {
  if (def.scope === 'month') return month;
  if (def.group !== 'tax') return `${month}-01`;
  return payrollDates(Number(month.slice(0, 4)), Number(month.slice(5, 7))).payDate;
}

const fromWords = (from: string) =>
  from.length === 7
    ? `T${Number(from.slice(5))}/${from.slice(0, 4)}`
    : `${from.slice(8, 10)}/${from.slice(5, 7)}/${from.slice(0, 4)}`;

function latestRow(rows: readonly PayrollSettingDto[], key: string, employeeId: string | null, at: string) {
  return rows
    .filter((r) => r.key === key && r.employeeId === employeeId && !r.supersededBy && r.from <= at)
    .sort((a, b) => b.from.localeCompare(a.from))[0];
}

function statusOf(row: PayrollSettingDto, rows: readonly PayrollSettingDto[], at: string): PayrollSettingStatus {
  if (row.supersededBy) return 'superseded';
  if (latestRow(rows, row.key, row.employeeId, at)?.id === row.id) return 'in-force';
  return row.from > at ? 'upcoming' : 'past';
}

function lineOf(def: PayrollSettingDef, all: readonly PayrollSettingDto[], month: string): PayrollSettingViewLineDto {
  const at = readOn(def, month);
  const own = all.filter((r) => r.key === def.key);
  const people = [...new Set(own.map((r) => r.employeeId).filter((id): id is string => id !== null))];
  const everyone = latestRow(own, def.key, null, at);
  return {
    key: def.key,
    label: def.label,
    area: def.area,
    readOn: at,
    inForce: everyone && !everyone.stop ? everyone : null,
    overrides: people.filter((id) => {
      const row = latestRow(own, def.key, id, at);
      return row !== undefined && !row.stop;
    }).length,
    rows: [...own]
      .sort((a, b) => b.from.localeCompare(a.from) || Number(!!a.supersededBy) - Number(!!b.supersededBy))
      .map((r) => ({ ...r, status: statusOf(r, own, at) })),
  };
}

function parsed<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw invalid('Kiểm tra lại cấu hình.', fieldErrors(result.error));
  return result.data;
}

function defOf(key: string): PayrollSettingDef {
  const def = payrollSettingDef(key);
  if (!def) throw invalid('Không có mục cấu hình này.', { key: 'Không có mục cấu hình này.' });
  return def;
}

function checkFrom(def: PayrollSettingDef, from: string) {
  const ok = def.scope === 'month' ? PAYROLL_MONTH.test(from) : PAYROLL_DATE.test(from);
  if (ok) return;
  const words = def.scope === 'month' ? 'Mục này áp dụng từ một tháng.' : 'Mục này áp dụng từ một ngày.';
  throw invalid(words, { from: words });
}

function valueOf(def: PayrollSettingDef, value: unknown): unknown {
  if (value === undefined || value === null) throw invalid('Nhập giá trị.', { value: 'Nhập giá trị.' });
  const result = def.schema.safeParse(value);
  if (result.success) return result.data;
  const message = result.error.issues[0]?.message ?? 'Giá trị không hợp lệ.';
  throw invalid(message, { value: message });
}

/** KPCĐ off (L-A27): a reason and a warning. */
function lawWarnings(key: string, value: unknown, source: string): string[] {
  if (key !== 'tuy-chon.d03' || value !== 'off') return [];
  if (!source) throw invalid('Tắt KPCĐ phải ghi lý do.', { source: 'Ghi lý do.' });
  return ['Bắt buộc theo Luật Công đoàn 2024 (Đ.29 k1 b).'];
}

function sameDate(
  rows: readonly PayrollSettingDto[],
  row: Pick<PayrollSettingDto, 'key' | 'employeeId' | 'from'>,
  except = '',
) {
  const taken = rows.some(
    (r) =>
      r.key === row.key && r.employeeId === row.employeeId && r.from === row.from && !r.supersededBy && r.id !== except,
  );
  if (taken) throw new ApiError(409, `Đã có mức từ ${fromWords(row.from)}. Dùng Sửa lỗi.`, {}, 'payroll_setting_taken');
}

/** Approved months on or after the row's month: the demo's stand-in for "months this row decided". */
const touched = (db: MockDb, row: PayrollSettingDto) => approvedMonths(db).filter((m) => m >= row.from.slice(0, 7));

function liveRow(db: MockDb, id: string): PayrollSettingDto {
  const row = rowsOf(db).find((r) => r.id === id);
  if (!row) throw new ApiError(404, 'Không tìm thấy dòng cấu hình.');
  if (row.supersededBy)
    throw new ApiError(409, 'Dòng này đã được thay. Sửa dòng đang dùng.', {}, 'payroll_setting_replaced');
  return row;
}

function refuseUsed(db: MockDb, row: PayrollSettingDto, hint: string) {
  const used = touched(db, row);
  if (used.length > 0) throw new ApiError(409, `Đã dùng ở ${used.map(fromWords).join(', ')} đã duyệt. ${hint}`);
}

export const settingsMockApi = {
  async hrPayrollSettings(filter: { key?: string; employeeId?: string } = {}): Promise<PayrollSettingDto[]> {
    const rows = rowsOf(payrollDb()).filter(
      (r) => (!filter.key || r.key === filter.key) && (!filter.employeeId || r.employeeId === filter.employeeId),
    );
    return delay([...rows].sort((a, b) => a.key.localeCompare(b.key) || b.from.localeCompare(a.from)));
  },

  async hrPayrollSettingsMonth(month: string): Promise<PayrollSettingsMonthDto> {
    if (!PAYROLL_MONTH.test(month)) throw invalid('Chọn tháng lương.', { thang: 'Chọn tháng lương.' });
    const rows = rowsOf(payrollDb());
    const stored = [...new Set(rows.map((r) => r.key))].filter((key) => !PAYROLL_SETTING_DEFS[key]);
    const defs = [
      ...Object.values(PAYROLL_SETTING_DEFS),
      ...stored.map(payrollSettingDef).filter((d): d is PayrollSettingDef => d !== undefined),
    ];
    const dates = payrollDates(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
    return delay({
      month,
      payDate: dates.payDate,
      insuranceDate: `${month}-01`,
      lines: defs.map((def) => lineOf(def, rows, month)),
    });
  },

  async hrPayrollAddSetting(raw: unknown): Promise<PayrollSettingSavedDto> {
    const db = payrollDb();
    const input = parsed(inputSchema, raw);
    const def = defOf(input.key);
    checkFrom(def, input.from);
    const employeeId = input.employeeId ?? null;
    if (employeeId && !def.perPerson) throw invalid('Mục này chỉ đổi cho tất cả.', { employeeId: 'Chỉ cho tất cả.' });
    const value = input.stop ? null : valueOf(def, input.value);
    const warnings = lawWarnings(def.key, value, input.source);
    const rows = rowsOf(db);
    sameDate(rows, { key: def.key, employeeId, from: input.from });
    const row: PayrollSettingDto = {
      id: uid('st'),
      key: def.key,
      employeeId,
      from: input.from,
      value,
      stop: !!input.stop,
      supersededBy: null,
      source: input.source,
      createdBy: requireHr(db).name ?? DEMO_HR.name,
      createdAt: new Date().toISOString(),
    };
    store(db, [...rows, row]);
    return delay({ setting: row, warnings, approvedMonthsTouched: touched(db, row) });
  },

  async hrPayrollEditSetting(id: string, raw: unknown): Promise<PayrollSettingSavedDto> {
    const db = payrollDb();
    const input = parsed(payrollSettingEditSchema, raw);
    const row = liveRow(db, id);
    const def = defOf(row.key);
    refuseUsed(db, row, 'Thêm mức mới hoặc Sửa lỗi.');
    const from = input.from ?? row.from;
    checkFrom(def, from);
    const value = row.stop ? null : input.value === undefined ? row.value : valueOf(def, input.value);
    const source = input.source ?? row.source;
    const warnings = lawWarnings(def.key, value, source);
    sameDate(rowsOf(db), { ...row, from }, row.id);
    const next = { ...row, from, value, source };
    store(
      db,
      rowsOf(db).map((r) => (r.id === id ? next : r)),
    );
    return delay({ setting: next, warnings, approvedMonthsTouched: touched(db, next) });
  },

  async hrPayrollDeleteSetting(id: string): Promise<{ ok: true }> {
    const db = payrollDb();
    const row = liveRow(db, id);
    refuseUsed(db, row, 'Dùng Ngừng từ tháng hoặc Sửa lỗi.');
    store(
      db,
      rowsOf(db)
        .filter((r) => r.id !== id)
        .map((r) => (r.supersededBy === id ? { ...r, supersededBy: null } : r)),
    );
    return delay({ ok: true as const });
  },

  async hrPayrollCorrectSetting(id: string, raw: unknown): Promise<PayrollSettingSavedDto> {
    const db = payrollDb();
    const input = parsed(payrollSettingCorrectSchema, raw);
    const row = liveRow(db, id);
    const value = valueOf(defOf(row.key), input.value);
    const next: PayrollSettingDto = {
      ...row,
      id: uid('st'),
      value,
      stop: false,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    const rows = rowsOf(db).map((r) => (r.id === id ? { ...r, supersededBy: next.id } : r));
    store(db, [...rows, next]);
    return delay({
      setting: next,
      warnings: lawWarnings(row.key, value, next.source),
      approvedMonthsTouched: touched(db, row),
    });
  },
};
