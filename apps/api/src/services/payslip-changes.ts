import {
  type HrMe,
  type PayrollLineDto,
  type PayrollLogLineDto,
  type PayrollMonthDto,
  type PayslipCellChangeDto,
  type PayslipChangeEventDto,
  type PayslipChangesDto,
  type PayslipListDto,
} from '@careers/shared';
import { and, desc, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { payrollLog, payrollPayslipSends, payrollRuns } from '../db/schema.js';
import { HttpError, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { writePayrollLog } from './payroll-log.js';
import { payrollMonthOf, storedOf } from './payroll-month.js';
import { personWords } from './payroll-words.js';
import { payslipsOf, saveSend, type MailContext } from './payslip-mail.js';
import { actorOf } from './timesheet-people.js';

/**
 * "Thay đổi từ lần gửi" (Lương › Phiếu lương): what a person's payslip was when it went out, from the approval it was
 * sent for, against the payslip now; why the month moved on (reopened, approved again) and the log lines since.
 * Reading writes nothing. "Vẫn đúng" keeps a send for the approval in force when not one figure differs.
 */

type Run = typeof payrollRuns.$inferSelect;
type Send = typeof payrollPayslipSends.$inferSelect;

const LOG_LIMIT = 300;
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The code as a whole word: "NV01" is not in "NV010". */
const mentions = (detail: string, code: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(code)}($|[^\\p{L}\\p{N}])`, 'iu').test(detail);

/** The month as approval `run` froze it, with one person's line only: enough to print their payslip of then. */
function monthOfRun(run: Run, employeeId: string): PayrollMonthDto | null {
  const line = (run.snapshot.lines ?? []).find((l) => l.employeeId === employeeId);
  if (!line) return null;
  return {
    ...run.snapshot,
    lines: [line],
    // Nobody else's figures leave with it: the total row and the other people's warnings stay behind.
    totals: {},
    review: (run.snapshot.review ?? []).filter((r) => r.employeeId === employeeId),
    status: 'approved',
    computedAt: null,
    approval: { no: run.approvalNo, at: run.approvedAt.toISOString(), by: run.approvedBy },
    paidOn: null,
    retroOut: null,
  };
}

/** Every cell that is not the same number, net pay first. */
export function cellChanges(sent: PayrollLineDto, now: PayrollLineDto): PayslipCellChangeDto[] {
  const before: Readonly<Record<string, number | null | undefined>> = sent.cells;
  const after: Readonly<Record<string, number | null | undefined>> = now.cells;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = keys
    .map((key) => ({ key, sent: before[key] ?? null, now: after[key] ?? null }))
    .filter((c) => c.sent !== c.now);
  return [...changed.filter((c) => c.key === 'netPay'), ...changed.filter((c) => c.key !== 'netPay')];
}

function eventsAfter(runs: readonly Run[], since: Date): PayslipChangeEventDto[] {
  const all = runs.flatMap((r): (PayslipChangeEventDto & { time: number })[] => [
    {
      kind: 'approved',
      approvalNo: r.approvalNo,
      at: r.approvedAt.toISOString(),
      by: r.approvedBy,
      reason: null,
      time: r.approvedAt.getTime(),
    },
    ...(r.reopenedAt
      ? [
          {
            kind: 'reopened' as const,
            approvalNo: r.approvalNo,
            at: r.reopenedAt.toISOString(),
            by: r.reopenedBy ?? '',
            reason: r.reopenReason,
            time: r.reopenedAt.getTime(),
          },
        ]
      : []),
  ]);
  return all
    .filter((e) => e.time > since.getTime())
    .sort((a, b) => a.time - b.time)
    .map(({ time: _, ...event }) => event);
}

/**
 * Log lines after the send that are about this person (their code is in the line) or about the whole month: a line of
 * the month, or of Cấu hình up to it, that names nobody else of the month. Downloads and views are left out.
 */
async function logSince(db: Db, month: PayrollMonthDto, code: string, since: Date): Promise<PayrollLogLineDto[]> {
  const rows = await db
    .select()
    .from(payrollLog)
    .where(gt(payrollLog.at, since))
    .orderBy(desc(payrollLog.at), desc(payrollLog.id))
    .limit(LOG_LIMIT);
  const others = month.lines.map((l) => l.code).filter((c) => c !== code);
  const isAbout = (r: (typeof rows)[number]) => {
    if (r.area === 'tai-xem') return false;
    if (mentions(r.detail, code)) return true;
    if (others.some((c) => mentions(r.detail, c))) return false;
    if (r.month === month.monthKey) return true;
    return r.area === 'cau-hinh' && (r.month === null || r.month <= month.monthKey);
  };
  return rows.filter(isAbout).map((r) => ({
    id: r.id,
    area: r.area,
    actor: r.actor,
    action: r.action,
    detail: r.detail,
    month: r.month,
    at: r.at.toISOString(),
  }));
}

interface Loaded {
  month: PayrollMonthDto;
  line: PayrollLineDto;
  periodId: string | null;
  approvalNo: number | null;
  /** The last time the payslip went out, whatever the approval. */
  sent: Send | undefined;
  runs: Run[];
}

async function load(db: Db, key: string, employeeId: string, now: Date): Promise<Loaded> {
  const month = await payrollMonthOf(db, key, now);
  const line = isUuid(employeeId) ? month.lines.find((l) => l.employeeId === employeeId) : undefined;
  if (!line) throw notFound('Người này không có trong bảng lương của tháng.');
  const stored = await storedOf(db, month.year, month.month);
  const isApproved = month.status === 'approved' || month.status === 'paid';
  const t = payrollPayslipSends;
  const [sends, runs] = stored
    ? await Promise.all([
        db
          .select()
          .from(t)
          .where(and(eq(t.periodId, stored.id), eq(t.employeeId, line.employeeId), eq(t.status, 'sent'))),
        db.select().from(payrollRuns).where(eq(payrollRuns.periodId, stored.id)),
      ])
    : [[], []];
  return {
    month,
    line,
    periodId: stored?.id ?? null,
    approvalNo: isApproved ? (stored?.approvalNo ?? null) : null,
    sent: [...sends].sort((a, b) => b.at.getTime() - a.at.getTime())[0],
    runs,
  };
}

export async function payslipChangesOf(db: Db, key: string, employeeId: string, now: Date): Promise<PayslipChangesDto> {
  const loaded = await load(db, key, employeeId, now);
  const { month, line, sent } = loaded;
  const head = { monthKey: month.monthKey, employeeId: line.employeeId, code: line.code, fullName: line.fullName };
  const current = { status: month.status, approvalNo: loaded.approvalNo };
  if (!sent) {
    return {
      ...head,
      sent: null,
      current,
      events: [],
      sentMonth: null,
      cells: [],
      canConfirmUnchanged: false,
      log: [],
    };
  }
  const run = loaded.runs.find((r) => r.approvalNo === sent.approvalNo);
  const sentMonth = run ? monthOfRun(run, line.employeeId) : null;
  const cells = sentMonth?.lines[0] ? cellChanges(sentMonth.lines[0], line) : [];
  const isStale = loaded.approvalNo !== null && sent.approvalNo !== loaded.approvalNo;
  return {
    ...head,
    sent: { at: sent.at.toISOString(), by: sent.actor, approvalNo: sent.approvalNo, channel: sent.channel },
    current,
    events: eventsAfter(loaded.runs, sent.at),
    sentMonth,
    cells,
    canConfirmUnchanged: isStale && sentMonth !== null && cells.length === 0,
    log: await logSince(db, month, line.code, sent.at),
  };
}

export interface ConfirmArgs {
  key: string;
  employeeId: string;
  hr: HrMe;
  now: Date;
  mail: MailContext;
}

/**
 * "Đánh dấu vẫn đúng (không cần gửi lại)": the month was approved again and the person's numbers are what they were
 * sent. Keeps a manual send for the approval in force, with a log line; 409 when a figure differs.
 */
export async function confirmPayslipUnchanged(db: Db, args: ConfirmArgs): Promise<PayslipListDto> {
  const loaded = await load(db, args.key, args.employeeId, args.now);
  const dto = await payslipChangesOf(db, args.key, args.employeeId, args.now);
  if (!dto.canConfirmUnchanged || !dto.sent || !loaded.periodId || loaded.approvalNo === null) {
    const why = dto.cells.length > 0 ? 'Số trên phiếu đã đổi so với lần gửi: cần gửi lại.' : 'Không có gì để xác nhận.';
    throw new HttpError(409, why, {}, 'payslip_changed');
  }
  const { periodId, approvalNo } = loaded;
  const actor = actorOf(args.hr);
  const email = loaded.sent?.email ?? '';
  await db.transaction(async (tx) => {
    await saveSend(tx, {
      periodId,
      approvalNo,
      employeeId: loaded.line.employeeId,
      status: 'sent',
      channel: 'manual',
      email,
      sentTo: email,
      error: null,
      at: args.now,
      actor,
    });
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor,
      action: 'Xác nhận phiếu lương không đổi',
      detail: `Bản duyệt lần ${approvalNo}: ${personWords(loaded.line)} (số trên phiếu không đổi so với bản duyệt lần ${dto.sent?.approvalNo ?? ''} đã gửi)`,
      month: loaded.month.monthKey,
      at: args.now,
    });
  });
  return payslipsOf(db, args.key, args.now, args.mail);
}
