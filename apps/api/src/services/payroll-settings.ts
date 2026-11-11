import {
  fieldErrors,
  payrollSettingCorrectSchema,
  payrollSettingDef,
  payrollSettingEditSchema,
  payrollSettingInputSchema,
  PAYROLL_DATE,
  PAYROLL_MONTH,
  type HrMe,
  type PayrollSettingDef,
  type PayrollSettingDto,
  type PayrollSettingSavedDto,
} from '@careers/shared';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/index.js';
import { employees, payrollSettings } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { stillUsedWarnings } from './payroll-catalogue-use.js';
import { writePayrollLog } from './payroll-log.js';
import { approvedMonths, usedConflict } from './payroll-months.js';
import { gapIfRemoved, monthsDecidedBy, type Row } from './payroll-versions.js';
import { fromWords, monthWords, personWords, valueWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Cấu hình có phiên bản và ghi đè (spec-luong.md 6, 7 R1–R6, 9). Adding is always allowed; a row an approved month
 * used is never edited or deleted, only corrected ("Sửa lỗi") or followed by a newer one. Every change is one line of
 * the payroll log, old → new, by whom.
 */

type Setting = typeof payrollSettings.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export const settingDtoOf = (s: Setting): PayrollSettingDto => ({
  id: s.id,
  key: s.key,
  employeeId: s.employeeId,
  from: s.appliesFrom,
  value: s.value ?? null,
  stop: s.stop,
  supersededBy: s.supersededBy,
  source: s.source,
  createdBy: s.createdBy,
  createdAt: s.createdAt.toISOString(),
});

export async function loadRows(db: Pick<Db, 'select'>, key?: string): Promise<PayrollSettingDto[]> {
  const rows = await db
    .select()
    .from(payrollSettings)
    .where(key ? eq(payrollSettings.key, key) : undefined);
  return rows.map(settingDtoOf);
}

function defOf(key: string): PayrollSettingDef {
  const def = payrollSettingDef(key);
  if (!def) throw invalid('Không có mục cấu hình này.', { key: 'Không có mục cấu hình này.' });
  return def;
}

function checkFrom(def: PayrollSettingDef, from: string): void {
  const ok = def.scope === 'month' ? PAYROLL_MONTH.test(from) : PAYROLL_DATE.test(from);
  if (ok) return;
  const words = def.scope === 'month' ? 'Mục này áp dụng từ một tháng.' : 'Mục này áp dụng từ một ngày.';
  throw invalid(words, { from: words });
}

function parseValue(def: PayrollSettingDef, value: unknown): unknown {
  if (value === undefined || value === null) throw invalid('Nhập giá trị.', { value: 'Nhập giá trị.' });
  const parsed = def.schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const message = parsed.error.issues[0]?.message ?? 'Giá trị không hợp lệ.';
  throw invalid(message, { value: message });
}

async function scopeWords(db: Pick<Db, 'select'>, employeeId: string | null): Promise<string> {
  if (!employeeId) return 'cho tất cả';
  const [person] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  return `cho ${personWords(person)}`;
}

/** KPCĐ is required by law (câu 8, L-A27): off needs a reason, from a month not approved yet, and a warning. */
function lawGuards(key: string, value: unknown, source: string, from: string, approved: readonly string[]): string[] {
  if (key !== 'tuy-chon.d03' || value !== 'off') return [];
  if (!source) throw invalid('Tắt KPCĐ phải ghi lý do.', { source: 'Ghi lý do.' });
  const last = approved.at(-1);
  if (last && from <= last)
    throw invalid(`Chỉ áp từ tháng chưa duyệt: sau ${monthWords(last)}.`, { from: 'Chọn tháng sau.' });
  return ['Bắt buộc theo Luật Công đoàn 2024 (Đ.29 k1 b).'];
}

function sameDateConflict(rows: readonly Row[], key: string, employeeId: string | null, from: string, except?: string) {
  const taken = rows.some(
    (r) => r.key === key && r.employeeId === employeeId && r.from === from && !r.supersededBy && r.id !== except,
  );
  if (taken) throw new HttpError(409, `Đã có mức từ ${fromWords(from)}. Dùng Sửa lỗi.`, {}, 'payroll_setting_taken');
}

const sourceWords = (source: string) => (source ? `. Nguồn: ${source}` : '');

async function log(tx: Tx, hr: HrMe, now: Date, row: Row, action: string, detail: string) {
  await writePayrollLog(tx, {
    area: 'cau-hinh',
    actor: actorOf(hr),
    action,
    detail,
    month: row.from.slice(0, 7),
    at: now,
  });
}

function parseInput<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại cấu hình.', fieldErrors(parsed.error));
  return parsed.data;
}

/** A new row for everyone or one person, or a stop row. */
export async function addSetting(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<PayrollSettingSavedDto> {
  const input = parseInput(payrollSettingInputSchema, raw);
  const def = defOf(input.key);
  checkFrom(def, input.from);
  const employeeId = input.employeeId ?? null;
  if (employeeId && !def.perPerson) throw invalid('Mục này chỉ đổi cho tất cả.', { employeeId: 'Chỉ cho tất cả.' });
  const value = input.stop ? null : parseValue(def, input.value);
  const scope = await scopeWords(db, employeeId);
  const approved = await approvedMonths(db);
  const warnings = [
    ...lawGuards(def.key, value, input.source, input.from, approved),
    ...(input.stop || employeeId ? [] : await stillUsedWarnings(db, def.key)),
  ];
  return db.transaction(async (tx) => {
    const rows = await loadRows(tx, def.key);
    sameDateConflict(rows, def.key, employeeId, input.from);
    const [saved] = await tx
      .insert(payrollSettings)
      .values({
        key: def.key,
        employeeId,
        appliesFrom: input.from,
        value,
        stop: !!input.stop,
        source: input.source,
        createdBy: actorOf(hr),
      })
      .returning();
    if (!saved) throw notFound('Không lưu được cấu hình.');
    const row = settingDtoOf(saved);
    const detail = input.stop
      ? `${employeeId ? 'Bỏ ghi đè' : 'Ngừng'} ${def.label} ${scope}, từ ${fromWords(row.from)}${sourceWords(row.source)}`
      : `Thêm ${def.label} ${scope}: ${valueWords(value)}, từ ${fromWords(row.from)}${sourceWords(row.source)}`;
    await log(tx, hr, now, row, input.stop ? 'Ngừng' : 'Thêm', detail);
    return { setting: row, warnings, approvedMonthsTouched: monthsDecidedBy(row, [...rows, row], def, approved) };
  });
}

async function liveRow(tx: Tx, id: string): Promise<{ row: Row; def: PayrollSettingDef }> {
  const [found] = isUuid(id)
    ? await tx.select().from(payrollSettings).where(eq(payrollSettings.id, id)).for('update')
    : [];
  if (!found) throw notFound('Không tìm thấy dòng cấu hình.');
  if (found.supersededBy)
    throw new HttpError(409, 'Dòng này đã được thay. Sửa dòng đang dùng.', {}, 'payroll_setting_replaced');
  return { row: settingDtoOf(found), def: defOf(found.key) };
}

/** Editing a row no approved month used (R5): value, date or source. */
export async function editSetting(
  db: Db,
  id: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollSettingSavedDto> {
  const input = parseInput(payrollSettingEditSchema, raw);
  return db.transaction(async (tx) => {
    const { row, def } = await liveRow(tx, id);
    const [rows, approved] = await Promise.all([loadRows(tx, def.key), approvedMonths(tx)]);
    const used = monthsDecidedBy(row, rows, def, approved);
    if (used.length > 0) throw usedConflict(used, 'Thêm mức mới hoặc Sửa lỗi.');
    const from = input.from ?? row.from;
    checkFrom(def, from);
    const value = row.stop ? null : input.value === undefined ? row.value : parseValue(def, input.value);
    const source = input.source ?? row.source ?? '';
    const warnings = lawGuards(def.key, value, source, from, approved);
    sameDateConflict(rows, def.key, row.employeeId, from, row.id);
    const [saved] = await tx
      .update(payrollSettings)
      .set({ appliesFrom: from, value, source })
      .where(eq(payrollSettings.id, row.id))
      .returning();
    if (!saved) throw notFound('Không tìm thấy dòng cấu hình.');
    const next = settingDtoOf(saved);
    const fromText = from === row.from ? fromWords(from) : `${fromWords(row.from)} → ${fromWords(from)}`;
    const scope = await scopeWords(tx, row.employeeId);
    const detail = `Sửa ${def.label} ${scope}: ${valueWords(row.value)} → ${valueWords(value)}, từ ${fromText}${sourceWords(source)}`;
    await log(tx, hr, now, next, 'Sửa', detail);
    const others = rows.filter((r) => r.id !== row.id);
    return { setting: next, warnings, approvedMonthsTouched: monthsDecidedBy(next, [...others, next], def, approved) };
  });
}

const CATALOGUES = new Set(['khoan.danh-sach', 'loai-hd.danh-sach']);

function gapWords(gap: { from: string; to: string }): string {
  return `${fromWords(gap.from)}–${fromWords(gap.to)} sẽ không có mức.`;
}

/** Deleting a row no approved month used, unless it is the only value of some months (L-A14). */
export async function deleteSetting(db: Db, id: string, hr: HrMe, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const { row, def } = await liveRow(tx, id);
    const [rows, approved] = await Promise.all([loadRows(tx, def.key), approvedMonths(tx)]);
    const used = monthsDecidedBy(row, rows, def, approved);
    if (used.length > 0) {
      throw usedConflict(used, CATALOGUES.has(def.key) ? 'Dùng Ngừng từ tháng.' : 'Dùng Ngừng từ tháng hoặc Sửa lỗi.');
    }
    const gap = gapIfRemoved(row, rows, def);
    if (gap) throw invalid(gapWords(gap));
    await tx.delete(payrollSettings).where(eq(payrollSettings.id, row.id));
    await tx.update(payrollSettings).set({ supersededBy: null }).where(eq(payrollSettings.supersededBy, row.id));
    const scope = await scopeWords(tx, row.employeeId);
    const what = row.stop ? 'dòng ngừng' : valueWords(row.value);
    await log(tx, hr, now, row, 'Xoá', `Xoá ${def.label} ${scope}: ${what}, từ ${fromWords(row.from)}`);
  });
}

/** "Sửa lỗi" (R5): the replacement takes the same date; the old row stays, pointing at it. */
export async function correctSetting(
  db: Db,
  id: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollSettingSavedDto> {
  const input = parseInput(payrollSettingCorrectSchema, raw);
  return db.transaction(async (tx) => {
    const { row, def } = await liveRow(tx, id);
    const value = parseValue(def, input.value);
    const [rows, approved] = await Promise.all([loadRows(tx, def.key), approvedMonths(tx)]);
    const touched = monthsDecidedBy(row, rows, def, approved);
    const newId = randomUUID();
    await tx.update(payrollSettings).set({ supersededBy: newId }).where(eq(payrollSettings.id, row.id));
    const [saved] = await tx
      .insert(payrollSettings)
      .values({
        id: newId,
        key: row.key,
        employeeId: row.employeeId,
        appliesFrom: row.from,
        value,
        source: input.source,
        createdBy: actorOf(hr),
      })
      .returning();
    if (!saved) throw notFound('Không lưu được cấu hình.');
    const next = settingDtoOf(saved);
    const scope = await scopeWords(tx, row.employeeId);
    const before = row.stop ? 'dòng ngừng' : valueWords(row.value);
    const detail = `Sửa lỗi ${def.label} ${scope}: ${before} → ${valueWords(value)}, từ ${fromWords(row.from)}${sourceWords(next.source)}`;
    await log(tx, hr, now, next, 'Sửa lỗi', detail);
    return {
      setting: next,
      warnings: lawGuards(def.key, value, next.source, row.from, approved),
      approvedMonthsTouched: touched,
    };
  });
}

/** Every stored row, for the engine and the Cấu hình page; `?key=` and `?nguoi=` narrow it. */
export async function listSettings(db: Db, query: Record<string, string>): Promise<PayrollSettingDto[]> {
  const nguoi = query.nguoi && isUuid(query.nguoi) ? query.nguoi : undefined;
  const rows = await db
    .select()
    .from(payrollSettings)
    .where(
      and(
        query.key ? eq(payrollSettings.key, query.key) : undefined,
        nguoi ? eq(payrollSettings.employeeId, nguoi) : undefined,
      ),
    );
  return rows.map(settingDtoOf).sort((a, b) => a.key.localeCompare(b.key) || b.from.localeCompare(a.from));
}
