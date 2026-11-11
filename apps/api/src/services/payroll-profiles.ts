import {
  fieldErrors,
  payrollProfileVersionSchema,
  periodMonthOf,
  standardPeriod,
  type HrMe,
  type PayrollProfileVersionDto,
  type PayrollProfileVersionSavedDto,
} from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollProfileAmounts, payrollProfiles } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { regionalMinimum, SALARY_COMPONENT } from './payroll-catalogue.js';
import { writePayrollLog } from './payroll-log.js';
import { approvedMonths, monthApprovals, periodOfMonth, usedConflict } from './payroll-months.js';
import {
  addDays,
  levelsOf,
  monthsThatUsedLevel,
  monthsUsingLevel,
  personOf,
  type Employee,
} from './payroll-profile-store.js';
import { loadRows } from './payroll-settings.js';
import { dateWords, moneyWords, personWords, valueWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Pay levels by effective date (spec-luong.md 10.2, 11.5, R5): added freely, changed only while no approved month used
 * them. "Used" means the level was there when the month was approved: one added afterwards is still HR's to fix.
 */

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Level = Omit<PayrollProfileVersionDto, 'id' | 'createdBy' | 'createdAt'>;

function parseLevel(raw: unknown): Level {
  const parsed = payrollProfileVersionSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại hồ sơ.', fieldErrors(parsed.error));
  const { fromMonth, effectiveOn, probationDays, ...rest } = parsed.data;
  const [year = 2000, month = 1] = (fromMonth ?? '').split('-').map(Number);
  const day = effectiveOn ?? standardPeriod(year, month).from;
  return { ...rest, effectiveOn: day, probationDays: probationDays ?? null };
}

const amountWords = (amounts: Record<string, number>) =>
  Object.entries(amounts).map(([id, amount]) => `${id} ${moneyWords(amount)}`);

function levelWords(l: Level): string {
  return [
    `loại HĐ ${l.contractTypeId}`,
    ...amountWords(l.amounts),
    `KPI ${moneyWords(l.kpiAmount)}`,
    ...(l.probationDays === null ? [] : [`thử việc ${l.probationDays} ngày`]),
    ...(l.managesBusiness ? ['việc quản lý doanh nghiệp'] : []),
    ...(l.unionMember ? ['đoàn viên'] : []),
  ].join(', ');
}

function changeWords(before: Level, after: Level): string {
  const ids = [...new Set([...Object.keys(before.amounts), ...Object.keys(after.amounts)])];
  const money = (n: number | undefined) => (n === undefined ? 'trống' : moneyWords(n));
  const fields: [string, string, string][] = [
    ['loại HĐ', before.contractTypeId, after.contractTypeId],
    ...ids.map((id): [string, string, string] => [id, money(before.amounts[id]), money(after.amounts[id])]),
    ['KPI', moneyWords(before.kpiAmount), moneyWords(after.kpiAmount)],
    ['thử việc', valueWords(before.probationDays), valueWords(after.probationDays)],
    ['việc quản lý doanh nghiệp', valueWords(before.managesBusiness), valueWords(after.managesBusiness)],
    ['đoàn viên', valueWords(before.unionMember), valueWords(after.unionMember)],
  ];
  const changed = fields.filter(([, a, b]) => a !== b).map(([label, a, b]) => `${label} ${a} → ${b}`);
  return changed.join(', ') || 'không đổi';
}

async function warningsFor(db: Db, person: Employee, level: Level, levels: readonly PayrollProfileVersionDto[]) {
  const warnings: string[] = [];
  const earliest = levels.every((l) => l.effectiveOn > level.effectiveOn);
  if (earliest && person.joinedOn && person.joinedOn < level.effectiveOn) {
    const gap = `${dateWords(person.joinedOn)}–${dateWords(addDays(level.effectiveOn, -1))}`;
    warnings.push(`${gap} có công nhưng chưa có mức. Đề nghị lùi ngày hiệu lực về ${dateWords(person.joinedOn)}.`);
  }
  const salary = level.amounts[SALARY_COMPONENT];
  const minimum = salary === undefined ? null : regionalMinimum(await loadRows(db), person, level.effectiveOn);
  if (salary !== undefined && minimum && salary < minimum.amount) {
    warnings.push(
      `Lương thời gian ${moneyWords(salary)} dưới lương tối thiểu vùng ${minimum.zone} ${moneyWords(minimum.amount)}.`,
    );
  }
  return warnings;
}

/** A date that is not the first day of a period splits that month in two (L-B06), when an earlier level exists. */
function splitsMonth(level: Level, levels: readonly PayrollProfileVersionDto[]): string | null {
  if (level.effectiveOn.endsWith('-26') || !levels.some((l) => l.effectiveOn < level.effectiveOn)) return null;
  const { year, month } = periodMonthOf(level.effectiveOn);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function sameDay(levels: readonly PayrollProfileVersionDto[], day: string, except?: string) {
  if (levels.some((l) => l.effectiveOn === day && l.id !== except)) {
    throw new HttpError(409, `Đã có mức từ ${dateWords(day)}.`, {}, 'payroll_profile_taken');
  }
}

async function writeAmounts(tx: Tx, profileId: string, amounts: Record<string, number>) {
  await tx.delete(payrollProfileAmounts).where(eq(payrollProfileAmounts.profileId, profileId));
  const rows = Object.entries(amounts).map(([componentId, amount]) => ({ profileId, componentId, amount }));
  if (rows.length > 0) await tx.insert(payrollProfileAmounts).values(rows);
}

async function log(tx: Tx, hr: HrMe, now: Date, day: string, action: string, detail: string) {
  const { year, month } = periodMonthOf(day);
  const key = `${year}-${String(month).padStart(2, '0')}`;
  await writePayrollLog(tx, { area: 'ho-so', actor: actorOf(hr), action, detail, month: key, at: now });
}

async function saved(tx: Tx, employeeId: string, id: string) {
  const found = (await levelsOf(tx, employeeId)).find((l) => l.id === id);
  if (!found) throw notFound('Không tìm thấy mức.');
  return found;
}

/** `now`: the API's clock, the one approvals are dated with, so "added after the approval" compares like with like. */
async function insertLevel(tx: Tx, employeeId: string, level: Level, hr: HrMe, now: Date): Promise<string> {
  const { amounts, ...fields } = level;
  const [row] = await tx
    .insert(payrollProfiles)
    .values({ ...fields, employeeId, createdBy: actorOf(hr), createdAt: now })
    .returning({ id: payrollProfiles.id });
  if (!row) throw notFound('Không lưu được hồ sơ.');
  await writeAmounts(tx, row.id, amounts);
  return row.id;
}

export async function addLevel(
  db: Db,
  employeeId: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollProfileVersionSavedDto> {
  const person = await personOf(db, employeeId);
  const level = parseLevel(raw);
  const [levels, approved] = await Promise.all([levelsOf(db, person.id), approvedMonths(db)]);
  sameDay(levels, level.effectiveOn);
  const warnings = await warningsFor(db, person, level, levels);
  return db.transaction(async (tx) => {
    const id = await insertLevel(tx, person.id, level, hr, now);
    const detail = `Thêm hồ sơ của ${personWords(person)}, từ ${dateWords(level.effectiveOn)}: ${levelWords(level)}`;
    await log(tx, hr, now, level.effectiveOn, 'Thêm', detail);
    const version = await saved(tx, person.id, id);
    const touched = monthsUsingLevel([...levels, version].sort(byDay), version, approved);
    return { version, warnings, splitsMonth: splitsMonth(level, levels), approvedMonthsTouched: touched };
  });
}

const byDay = (a: { effectiveOn: string }, b: { effectiveOn: string }) => a.effectiveOn.localeCompare(b.effectiveOn);

/** "Thêm mức mới từ 26/10/2026": the first day after the last approved month. */
function nextFreeDay(approved: readonly string[]): string {
  const last = approved.at(-1);
  return last ? addDays(periodOfMonth(last).to, 1) : '';
}

async function unusedLevel(db: Db, employeeId: string, id: string) {
  const [levels, approvals] = await Promise.all([levelsOf(db, employeeId), monthApprovals(db)]);
  const approved = approvals.map((a) => a.month);
  const current = levels.find((l) => l.id === id);
  if (!current) throw notFound('Không tìm thấy mức.');
  const used = monthsThatUsedLevel(levels, current, approvals);
  if (used.length > 0) throw usedConflict(used, `Thêm mức mới từ ${dateWords(nextFreeDay(approved))} hoặc Sửa lỗi.`);
  return { levels, approved, current };
}

export async function editLevel(
  db: Db,
  employeeId: string,
  id: string,
  raw: unknown,
  hr: HrMe,
  now: Date,
): Promise<PayrollProfileVersionSavedDto> {
  const person = await personOf(db, employeeId);
  const level = parseLevel(raw);
  const { levels, approved, current } = await unusedLevel(db, person.id, id);
  sameDay(levels, level.effectiveOn, id);
  const others = levels.filter((l) => l.id !== id);
  const warnings = await warningsFor(db, person, level, others);
  return db.transaction(async (tx) => {
    const { amounts, ...fields } = level;
    await tx.update(payrollProfiles).set(fields).where(eq(payrollProfiles.id, id));
    await writeAmounts(tx, id, amounts);
    const days = current.effectiveOn === level.effectiveOn ? '' : `${dateWords(current.effectiveOn)} → `;
    const detail = `Sửa hồ sơ của ${personWords(person)}, từ ${days}${dateWords(level.effectiveOn)}: ${changeWords(current, level)}`;
    await log(tx, hr, now, level.effectiveOn, 'Sửa', detail);
    const version = await saved(tx, person.id, id);
    const touched = monthsUsingLevel([...others, version].sort(byDay), version, approved);
    return { version, warnings, splitsMonth: splitsMonth(level, others), approvedMonthsTouched: touched };
  });
}

export async function deleteLevel(db: Db, employeeId: string, id: string, hr: HrMe, now: Date): Promise<void> {
  const person = await personOf(db, employeeId);
  const { current } = await unusedLevel(db, person.id, id);
  await db.transaction(async (tx) => {
    await tx.delete(payrollProfiles).where(and(eq(payrollProfiles.id, id), eq(payrollProfiles.employeeId, person.id)));
    const detail = `Xoá mức của ${personWords(person)}, từ ${dateWords(current.effectiveOn)}: ${levelWords(current)}`;
    await log(tx, hr, now, current.effectiveOn, 'Xoá', detail);
  });
}

/** The whole profile, only when no approved month used any of its levels (L-B10). */
export async function deleteProfile(db: Db, employeeId: string, hr: HrMe, now: Date): Promise<void> {
  const person = await personOf(db, employeeId);
  const [levels, approvals] = await Promise.all([levelsOf(db, person.id), monthApprovals(db)]);
  const used = [...new Set(levels.flatMap((l) => monthsThatUsedLevel(levels, l, approvals)))].sort();
  if (used.length > 0) throw usedConflict(used, 'Hồ sơ đã dùng không xoá được.');
  if (levels.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.delete(payrollProfiles).where(eq(payrollProfiles.employeeId, person.id));
    const first = levels[0]?.effectiveOn ?? '';
    await log(tx, hr, now, first, 'Xoá', `Xoá hồ sơ của ${personWords(person)}: ${levels.length} mức`);
  });
}

export { insertLevel, log as logProfile };
