import type { PayrollMonthSnapshot, PayrollPeriodStatus } from '@careers/shared';
import { and, eq, sql } from 'drizzle-orm';
import { payrollPeriods, payrollRuns } from '../db/schema.js';
import type { Reader } from './payroll-profile-store.js';

/**
 * Payroll months as numbers and their stored rows, shared by the month, its truy lĩnh / truy thu and the yearly
 * figures: "YYYY-MM" ↔ a month index (year × 12 + month − 1), approved or not, the stored months of a window, the
 * approval in force and its snapshot read once per request.
 */

export type StoredPeriod = typeof payrollPeriods.$inferSelect;

const pad = (n: number) => String(n).padStart(2, '0');

export const indexOf = (year: number, month: number) => year * 12 + month - 1;
export const keyOf = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
export const keyOfPeriod = (p: Pick<StoredPeriod, 'year' | 'month'>) => `${p.year}-${pad(p.month)}`;
export const partsOfKey = (key: string) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5)) });
export const indexOfKey = (key: string) => {
  const { year, month } = partsOfKey(key);
  return indexOf(year, month);
};

/** An approved or paid month keeps its approval snapshot and is never computed again in place (R4). */
export const isApprovedStatus = (status: PayrollPeriodStatus | undefined) => status === 'approved' || status === 'paid';
export const isApprovedPeriod = (s: StoredPeriod | undefined): s is StoredPeriod => isApprovedStatus(s?.status);

export async function storedOf(db: Reader, year: number, month: number): Promise<StoredPeriod | undefined> {
  const [stored] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, year), eq(payrollPeriods.month, month)));
  return stored;
}

/** The stored months whose index is from `from` to `to`, both included. */
export async function storedBetween(db: Reader, from: number, to: number): Promise<StoredPeriod[]> {
  return db
    .select()
    .from(payrollPeriods)
    .where(sql`${payrollPeriods.year} * 12 + ${payrollPeriods.month} - 1 between ${from} and ${to}`);
}

/** Bản duyệt lần `no` of a payroll month. */
export async function runOf(db: Reader, periodId: string, no: number) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.periodId, periodId), eq(payrollRuns.approvalNo, no)));
  return run;
}

/** Bản duyệt in force of an approved or paid month; undefined for any other month. */
export type SnapshotOf = (stored: StoredPeriod | undefined) => Promise<PayrollMonthSnapshot | undefined>;

/**
 * The approval snapshots of one request, each read once (by month and approval no.): a month and its truy lĩnh /
 * truy thu read the same approvals many times. Never kept across requests.
 */
export function snapshotsOf(db: Reader): SnapshotOf {
  const known = new Map<string, Promise<PayrollMonthSnapshot | undefined>>();
  return (stored) => {
    if (!isApprovedPeriod(stored) || stored.approvalNo === null) return Promise.resolve(undefined);
    const key = `${stored.id}:${stored.approvalNo}`;
    const hit = known.get(key);
    if (hit) return hit;
    const read = runOf(db, stored.id, stored.approvalNo).then((run) => run?.snapshot);
    known.set(key, read);
    return read;
  };
}
