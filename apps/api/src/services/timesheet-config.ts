import { departmentInputSchema, fieldErrors, STAFF_TYPE_LABEL, staffKindInputSchema, type DepartmentDto, type HrMe, type StaffKindDto } from '@careers/shared';
import { asc, count, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetDepartments, timesheetStaffKinds } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { listStaffKinds, logChange } from './timesheet-people.js';

/** What HR sets up once: departments and kinds of staff. Regions and holidays live with the people they apply to. */

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Departments

export async function listDepartments(db: Db): Promise<DepartmentDto[]> {
  const [rows, counts] = await Promise.all([
    db.select().from(timesheetDepartments).orderBy(asc(timesheetDepartments.name)),
    db.select({ name: employees.department, n: count() }).from(employees).groupBy(employees.department),
  ]);
  const used = new Map(counts.map((c) => [c.name, c.n]));
  return rows.map((r) => ({ id: r.id, name: r.name, employees: used.get(r.name) ?? 0 }));
}

function parseDepartment(raw: unknown) {
  const parsed = departmentInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại bộ phận.', fieldErrors(parsed.error));
  return parsed.data.name;
}

const taken = () => invalid('Đã có bộ phận này.', { name: 'Đã có bộ phận này.' });

export async function addDepartment(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<DepartmentDto[]> {
  const name = parseDepartment(raw);
  if ((await listDepartments(db)).some((d) => sameName(d.name, name))) throw taken();
  await db.insert(timesheetDepartments).values({ name });
  await logChange(db, hr, 'Thêm bộ phận', name, now);
  return listDepartments(db);
}

/** Everyone in it follows the new name. A closed period keeps the name it closed with, in its own copy. */
export async function renameDepartment(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<DepartmentDto[]> {
  const name = parseDepartment(raw);
  const all = await listDepartments(db);
  const current = all.find((d) => d.id === id);
  if (!current) throw notFound('Không tìm thấy bộ phận.');
  if (all.some((d) => d.id !== id && sameName(d.name, name))) throw taken();
  await db.transaction(async (tx) => {
    await tx.update(timesheetDepartments).set({ name }).where(eq(timesheetDepartments.id, id));
    await tx.update(employees).set({ department: name, updatedAt: now }).where(eq(employees.department, current.name));
  });
  if (current.name !== name) await logChange(db, hr, 'Sửa bộ phận', `${current.name} → ${name}`, now);
  return listDepartments(db);
}

export async function removeDepartment(db: Db, id: string, hr: HrMe, now: Date): Promise<DepartmentDto[]> {
  const current = isUuid(id) ? (await listDepartments(db)).find((d) => d.id === id) : undefined;
  if (!current) throw notFound('Không tìm thấy bộ phận.');
  if (current.employees > 0) throw new HttpError(409, `Bộ phận đang có ${current.employees} người.`, {}, 'in_use');
  await db.delete(timesheetDepartments).where(eq(timesheetDepartments.id, id));
  await logChange(db, hr, 'Xoá bộ phận', current.name, now);
  return listDepartments(db);
}

// Kinds of staff

function parseKind(raw: unknown) {
  const parsed = staffKindInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại loại nhân viên.', fieldErrors(parsed.error));
  return parsed.data;
}

const kindTaken = () => invalid('Đã có loại này.', { name: 'Đã có loại này.' });

export async function addStaffKind(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<StaffKindDto[]> {
  const input = parseKind(raw);
  if ((await listStaffKinds(db)).some((k) => sameName(k.name, input.name))) throw kindTaken();
  await db.insert(timesheetStaffKinds).values({ ...input, isDefault: false });
  await logChange(db, hr, 'Thêm loại nhân viên', input.name, now);
  return listStaffKinds(db);
}

/** The two kinds of the sheet can take another name, but what they mean for leave is fixed: every rule stands on them. */
export async function updateStaffKind(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<StaffKindDto[]> {
  const input = parseKind(raw);
  const all = await listStaffKinds(db);
  const current = all.find((k) => k.id === id);
  if (!current) throw notFound('Không tìm thấy loại nhân viên.');
  if (all.some((k) => k.id !== id && sameName(k.name, input.name))) throw kindTaken();
  if (current.isDefault && current.rule !== input.rule) throw invalid('Loại mặc định không đổi được cách tính phép.', { rule: 'Loại mặc định không đổi được cách tính phép.' });
  await db.transaction(async (tx) => {
    await tx.update(timesheetStaffKinds).set(input).where(eq(timesheetStaffKinds.id, id));
    if (current.rule !== input.rule) await tx.update(employees).set({ employment: input.rule, updatedAt: now }).where(eq(employees.staffKindId, id));
  });
  const changes = [
    current.name !== input.name ? `Tên ${current.name} → ${input.name}` : '',
    current.rule !== input.rule ? `Cách tính phép ${STAFF_TYPE_LABEL[current.rule]} → ${STAFF_TYPE_LABEL[input.rule]}` : '',
  ].filter(Boolean);
  if (changes.length > 0) await logChange(db, hr, 'Sửa loại nhân viên', `${input.name}: ${changes.join('; ')}`, now);
  return listStaffKinds(db);
}

export async function removeStaffKind(db: Db, id: string, hr: HrMe, now: Date): Promise<StaffKindDto[]> {
  const current = isUuid(id) ? (await listStaffKinds(db)).find((k) => k.id === id) : undefined;
  if (!current) throw notFound('Không tìm thấy loại nhân viên.');
  if (current.isDefault) throw new HttpError(409, 'Loại mặc định không xoá được.', {}, 'is_default');
  if (current.employees > 0) throw new HttpError(409, `Loại này đang có ${current.employees} người.`, {}, 'in_use');
  await db.delete(timesheetStaffKinds).where(eq(timesheetStaffKinds.id, id));
  await logChange(db, hr, 'Xoá loại nhân viên', current.name, now);
  return listStaffKinds(db);
}
