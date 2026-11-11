import {
  fieldErrors,
  needsAcknowledgement,
  payrollApproveSchema,
  payrollMarkPaidSchema,
  payrollReopenSchema,
  type HrMe,
  type PayrollCellKey,
  type PayrollMonthDto,
  type PayrollMonthSnapshot,
} from '@careers/shared';
import { and, desc, eq, inArray, max, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/index.js';
import { payrollPeriods, payrollRuns } from '../db/schema.js';
import { HttpError, invalid } from '../lib/http-error.js';
import { writePayrollLog } from './payroll-log.js';
import { keyOfPeriod as keyOf, runOf, type StoredPeriod as Stored } from './payroll-month-index.js';
import { liveMonthOf, monthInRange, payrollMonthOf } from './payroll-month.js';
import { noApproveRight, type PayrollRights } from './payroll-rights.js';
import type { Tx } from './timesheet-closings.js';
import { dateWords, moneyWords, monthWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Duyệt, Mở lại, Đã chuyển khoản (spec-luong.md R4, R7, 11.4; step 16). Each action runs on the month's row locked,
 * writes one line of the payroll log in the same transaction, and answers the month as GET reads it afterwards.
 */

export interface MonthActionArgs {
  key: string;
  raw: unknown;
  hr: HrMe;
  rights: PayrollRights;
  now: Date;
}

const conflict = (message: string, code: string) => new HttpError(409, message, {}, code);

function parse<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại.', errors);
  }
  return parsed.data;
}

async function lock(tx: Tx, year: number, month: number): Promise<Stored | undefined> {
  const [stored] = await tx
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, year), eq(payrollPeriods.month, month)))
    .for('update');
  return stored;
}

/** The month's row, made when nobody has worked on the month yet, and locked. */
async function lockOrCreate(tx: Tx, year: number, month: number): Promise<Stored> {
  await tx.insert(payrollPeriods).values({ year, month }).onConflictDoNothing();
  const stored = await lock(tx, year, month);
  if (!stored) throw new Error(`No payroll month ${keyOf({ year, month })}`);
  return stored;
}

const update = (tx: Tx, stored: Stored, now: Date, fields: Partial<typeof payrollPeriods.$inferInsert>) =>
  tx
    .update(payrollPeriods)
    .set({ ...fields, rowVersion: stored.rowVersion + 1, updatedAt: now })
    .where(eq(payrollPeriods.id, stored.id));

const snapshotOf = ({ status: _s, computedAt: _c, approval: _a, paidOn: _p, retroOut: _r, ...rest }: PayrollMonthDto) =>
  rest satisfies PayrollMonthSnapshot;

async function lastApprovalNo(tx: Tx, periodId: string): Promise<number> {
  const [row] = await tx
    .select({ no: max(payrollRuns.approvalNo) })
    .from(payrollRuns)
    .where(eq(payrollRuns.periodId, periodId));
  return row?.no ?? 0;
}

/** Same people with the same number in every cell (the stored snapshot went through jsonb: keys reordered). */
function sameNumbers(before: PayrollMonthSnapshot, after: PayrollMonthSnapshot): boolean {
  if (before.lines.length !== after.lines.length) return false;
  const cells = new Map(before.lines.map((l) => [l.employeeId, l.cells]));
  return after.lines.every((line) => {
    const old = cells.get(line.employeeId);
    return old !== undefined && (Object.keys(line.cells) as PayrollCellKey[]).every((k) => old[k] === line.cells[k]);
  });
}

/** L-E13: approval N against N−1, in net pay. */
async function againstPrevious(tx: Tx, periodId: string, no: number, snapshot: PayrollMonthSnapshot) {
  const previous = no > 1 ? await runOf(tx, periodId, no - 1) : undefined;
  if (!previous) return '';
  if (sameNumbers(previous.snapshot, snapshot)) return `, không chênh với lần ${no - 1}`;
  const before = moneyWords(previous.snapshot.totals.netPay ?? 0);
  return `, thực nhận lần ${no - 1} ${before} → ${moneyWords(snapshot.totals.netPay ?? 0)}`;
}

function checkApprovable(key: string, month: PayrollMonthDto, acknowledgedRed: boolean) {
  if (month.status === 'waiting')
    throw conflict(`${monthWords(key)} chờ chốt công, chưa duyệt được.`, 'payroll_waiting');
  if (month.status !== 'draft')
    throw conflict(`${monthWords(key)} đã duyệt, không duyệt lại được.`, 'payroll_approved');
  if (month.lines.length === 0) throw conflict(`${monthWords(key)} chưa có dòng lương nào.`, 'payroll_empty');
  if (needsAcknowledgement(month.review) && !acknowledgedRed) {
    throw invalid('Tích "Đã xem cảnh báo đỏ" trước khi duyệt.', { acknowledgedRed: 'Tích "Đã xem cảnh báo đỏ".' });
  }
}

/** Duyệt (R4): bản duyệt lần N+1 of the month as computed now, kept unchanged from then on. */
export async function approveMonth(db: Db, { key, raw, hr, rights, now }: MonthActionArgs): Promise<PayrollMonthDto> {
  if (!rights.canApprovePayroll) throw noApproveRight();
  const { acknowledgedRed } = parse(payrollApproveSchema, raw);
  await db.transaction(async (tx) => {
    const { year, month } = await monthInRange(tx, key, now);
    const stored = await lockOrCreate(tx, year, month);
    const { dto, closingId } = await liveMonthOf(tx, key, now);
    checkApprovable(key, dto, acknowledgedRed);
    if (!closingId) throw conflict(`${monthWords(key)} chờ chốt công, chưa duyệt được.`, 'payroll_waiting');
    const no = (await lastApprovalNo(tx, stored.id)) + 1;
    const snapshot = snapshotOf(dto);
    const actor = actorOf(hr);
    const versus = await againstPrevious(tx, stored.id, no, snapshot);
    await tx
      .insert(payrollRuns)
      .values({ periodId: stored.id, approvalNo: no, closingId, snapshot, approvedAt: now, approvedBy: actor });
    await update(tx, stored, now, {
      status: 'approved',
      closingId,
      approvalNo: no,
      approvedAt: now,
      approvedBy: actor,
    });
    const reds = dto.review.filter((i) => i.level === 'red').length;
    const seen = reds > 0 ? `, đã xem ${reds} cảnh báo đỏ` : '';
    const total = `${dto.lines.length} người, thực nhận ${moneyWords(dto.totals.netPay ?? 0)}`;
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor,
      action: 'Duyệt',
      detail: `Duyệt lần ${no}: ${total}${seen}${versus}`,
      month: key,
      at: now,
    });
  });
  return payrollMonthOf(db, key, now);
}

/** The latest approved or paid month after this one, which has to be reopened first (R7). */
async function laterApproved(tx: Tx, stored: Stored): Promise<string | undefined> {
  const [later] = await tx
    .select({ year: payrollPeriods.year, month: payrollPeriods.month })
    .from(payrollPeriods)
    .where(
      and(
        inArray(payrollPeriods.status, ['approved', 'paid']),
        sql`${payrollPeriods.year} * 12 + ${payrollPeriods.month} > ${stored.year * 12 + stored.month}`,
      ),
    )
    .orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month))
    .limit(1);
  return later ? keyOf(later) : undefined;
}

/** Mở lại (R7): back to a draft computed again; bản duyệt lần N stays, marked as reopened. */
export async function reopenMonth(db: Db, { key, raw, hr, rights, now }: MonthActionArgs): Promise<PayrollMonthDto> {
  if (!rights.canApprovePayroll) throw noApproveRight();
  await db.transaction(async (tx) => {
    const { year, month } = await monthInRange(tx, key, now);
    const stored = await lock(tx, year, month);
    if (stored?.status === 'paid') {
      throw conflict(
        `${monthWords(key)} đã chuyển khoản, không mở lại được. Dùng truy lĩnh / truy thu ở tháng sau.`,
        'payroll_paid',
      );
    }
    if (!stored || stored.status !== 'approved') {
      throw conflict(`${monthWords(key)} chưa duyệt, không có gì để mở lại.`, 'payroll_not_approved');
    }
    const later = await laterApproved(tx, stored);
    if (later)
      throw conflict(`Chỉ mở lại tháng duyệt gần nhất. Mở lại ${monthWords(later)} trước.`, 'payroll_not_latest');
    const { reason } = parse(payrollReopenSchema, raw);
    const actor = actorOf(hr);
    const no = stored.approvalNo;
    if (no !== null) {
      await tx
        .update(payrollRuns)
        .set({ reopenedAt: now, reopenedBy: actor, reopenReason: reason })
        .where(and(eq(payrollRuns.periodId, stored.id), eq(payrollRuns.approvalNo, no)));
    }
    await update(tx, stored, now, {
      status: 'draft',
      approvalNo: null,
      approvedAt: null,
      approvedBy: null,
      timesheetReopenedAt: null,
      timesheetReopenedBy: null,
      timesheetReopenReason: null,
    });
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor,
      action: 'Mở lại',
      detail: `Mở lại bản duyệt lần ${no ?? '?'}, lý do: ${reason}`,
      month: key,
      at: now,
    });
  });
  return payrollMonthOf(db, key, now);
}

/** Đã chuyển khoản: the payroll right is enough; from then on the month is not reopened (R7). */
export async function markMonthPaid(db: Db, { key, raw, hr, now }: MonthActionArgs): Promise<PayrollMonthDto> {
  await db.transaction(async (tx) => {
    const { year, month } = await monthInRange(tx, key, now);
    const stored = await lock(tx, year, month);
    if (!stored || stored.status !== 'approved') {
      throw conflict('Chỉ đánh dấu đã chuyển khoản cho tháng đã duyệt.', 'payroll_not_approved');
    }
    const { paidOn, note } = parse(payrollMarkPaidSchema, raw);
    await update(tx, stored, now, { status: 'paid', paidOn });
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor: actorOf(hr),
      action: 'Đã chuyển khoản',
      detail: `Bản duyệt lần ${stored.approvalNo ?? '?'}, chuyển khoản ngày ${dateWords(paidOn)}${note ? `. Ghi chú: ${note}` : ''}`,
      month: key,
      at: now,
    });
  });
  return payrollMonthOf(db, key, now);
}
