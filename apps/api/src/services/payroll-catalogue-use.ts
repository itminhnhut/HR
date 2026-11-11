import { isNull } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees } from '../db/schema.js';
import { versionsOf, type Reader } from './payroll-profile-store.js';

/**
 * "Ngừng dùng" a pay component or a contract type people still have (F27): said in yellow, never refused — the people
 * keep what their pay level says, HR decides what to do with them.
 */

const STOP_KEY = /^(khoan|loai-hd)\.(.+)\.ngung$/;

/** Each person still working, with their newest pay level. */
async function currentLevels(db: Reader) {
  const people = await db.select({ id: employees.id }).from(employees).where(isNull(employees.leftOn));
  const versions = await versionsOf(
    db,
    people.map((p) => p.id),
  );
  // Oldest first: the last one written for a person is their newest.
  return [...new Map(versions.map((v) => [v.employeeId, v.version])).values()];
}

export async function stillUsedWarnings(db: Db | Reader, key: string): Promise<string[]> {
  const [, prefix, id] = STOP_KEY.exec(key) ?? [];
  if (!prefix || !id) return [];
  const levels = await currentLevels(db);
  if (prefix === 'khoan') {
    const count = levels.filter((l) => (l.amounts[id] ?? 0) > 0).length;
    return count > 0 ? [`Còn ${count} người đang có khoản này.`] : [];
  }
  const count = levels.filter((l) => l.contractTypeId === id).length;
  return count > 0 ? [`Còn ${count} người đang ở loại HĐ này.`] : [];
}
