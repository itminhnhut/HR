import { standardPeriod } from '@careers/shared';
import { asc, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollPeriods } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import { monthWords } from './payroll-words.js';

/**
 * Months already approved or paid (spec-luong.md R4, R5): what they used is no longer edited or deleted, only replaced
 * with a new version or a correction. A version counts as used when it is the one in force for an approved month;
 * the month's numbers themselves are kept in its approval snapshot (`payroll_runs`) and never recomputed.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM" of every approved or paid payroll month, oldest first. */
export async function approvedMonths(db: Pick<Db, 'select'>): Promise<string[]> {
  const rows = await db
    .select({ year: payrollPeriods.year, month: payrollPeriods.month })
    .from(payrollPeriods)
    .where(inArray(payrollPeriods.status, ['approved', 'paid']))
    .orderBy(asc(payrollPeriods.year), asc(payrollPeriods.month));
  return rows.map((r) => `${r.year}-${pad(r.month)}`);
}

/** The days of payroll month "YYYY-MM": 26 of the month before to 25. */
export function periodOfMonth(month: string): { from: string; to: string } {
  const [year = 2000, m = 1] = month.split('-').map(Number);
  return standardPeriod(year, m);
}

/** 409 for a version an approved month used, naming the months and what to do instead. */
export function usedConflict(months: readonly string[], instead: string): HttpError {
  return new HttpError(
    409,
    `Đã dùng ở ${months.map(monthWords).join(', ')} đã duyệt. ${instead}`,
    {},
    'payroll_setting_used',
    { months },
  );
}
