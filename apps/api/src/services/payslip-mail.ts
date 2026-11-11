import {
  fieldErrors,
  fillPayslipTemplate,
  MAIL_COMPANY,
  PAYSLIP_FILE_MAX_BYTES,
  payslipFileName,
  payslipMailDetails,
  payslipMarkSchema,
  payslipSendSchema,
  renderMailHtml,
  type HrMe,
  type PayrollLineDto,
  type PayrollMonthDto,
  type PayslipListDto,
  type PayslipSendDto,
  type PayslipSendResultDto,
} from '@careers/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, payrollPayslipSends } from '../db/schema.js';
import { HttpError, invalid } from '../lib/http-error.js';
import { MAIL_NOT_CONFIGURED, MailError, mailRouteOf, sendMail, type Mailer } from '../lib/mailer.js';
import { listMessageTemplates } from './message-templates.js';
import { writePayrollLog } from './payroll-log.js';
import { payrollMonthOf, storedOf } from './payroll-month.js';
import { dateWords, moneyWords, personWords } from './payroll-words.js';
import { actorOf } from './timesheet-people.js';

/**
 * Lương › Phiếu lương: who gets the payslip of a month, where it goes and whether it was sent — by HR from their own
 * mailbox ("Đánh dấu đã gửi") or by the server ("Gửi tự động"). Kept per person, month and approval: a mark of an
 * earlier approval reads "Số đã đổi, cần gửi lại". Nothing here writes an amount to the log.
 */

type SendRow = typeof payrollPayslipSends.$inferSelect;

export interface MailContext {
  mailer: Mailer | null | undefined;
  isProduction: boolean;
}

interface Loaded {
  month: PayrollMonthDto;
  periodId: string | null;
  approvalNo: number | null;
  canSend: boolean;
  emails: Map<string, string | null>;
  sends: SendRow[];
}

const NEVER: PayslipSendDto = { state: 'never', at: null, by: null, channel: null, error: null };
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NOT_APPROVED = 'Tháng lương chưa duyệt nên chưa gửi phiếu lương được. Duyệt bảng lương trước.';

async function load(db: Db, key: string, now: Date): Promise<Loaded> {
  const month = await payrollMonthOf(db, key, now);
  const stored = await storedOf(db, month.year, month.month);
  const ids = month.lines.map((l) => l.employeeId);
  const [people, sends] = await Promise.all([
    ids.length > 0
      ? db.select({ id: employees.id, email: employees.email }).from(employees).where(inArray(employees.id, ids))
      : [],
    stored ? db.select().from(payrollPayslipSends).where(eq(payrollPayslipSends.periodId, stored.id)) : [],
  ]);
  const canSend = month.status === 'approved' || month.status === 'paid';
  return {
    month,
    periodId: stored?.id ?? null,
    approvalNo: canSend ? (stored?.approvalNo ?? null) : null,
    canSend,
    emails: new Map(people.map((p) => [p.id, p.email])),
    sends,
  };
}

/** The one place the address lives: the person's own, as it is now in Chấm công › Nhân viên. */
const emailOf = (loaded: Loaded, line: PayrollLineDto): string | null => loaded.emails.get(line.employeeId) ?? null;

const dtoOf = (row: SendRow, state: PayslipSendDto['state']): PayslipSendDto => ({
  state,
  at: row.at.toISOString(),
  by: row.actor,
  channel: row.channel,
  error: row.error,
});

/** The row of the approval in force says sent or failed; a sent row of an earlier approval is stale. */
function sendOf(loaded: Loaded, employeeId: string): PayslipSendDto {
  const mine = loaded.sends.filter((s) => s.employeeId === employeeId);
  const current = loaded.approvalNo === null ? undefined : mine.find((s) => s.approvalNo === loaded.approvalNo);
  if (current) return dtoOf(current, current.status);
  const earlier = mine.filter((s) => s.status === 'sent').sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  return earlier ? dtoOf(earlier, 'stale') : NEVER;
}

export async function payslipsOf(db: Db, key: string, now: Date, mail: MailContext): Promise<PayslipListDto> {
  const loaded = await load(db, key, now);
  const { month } = loaded;
  return {
    monthKey: month.monthKey,
    status: month.status,
    approvalNo: loaded.approvalNo,
    payDate: month.payDate,
    canSend: loaded.canSend,
    mail: mailRouteOf(mail.mailer, mail.isProduction),
    people: month.lines.map((line) => ({
      employeeId: line.employeeId,
      code: line.code,
      fullName: line.fullName,
      department: line.department,
      block: line.block,
      email: emailOf(loaded, line),
      netPay: line.cells.netPay,
      send: sendOf(loaded, line.employeeId),
    })),
  };
}

/** The period and approval a send is kept under; 409 for a month that is not approved. */
function sendable(loaded: Loaded): { periodId: string; approvalNo: number } {
  if (!loaded.canSend || !loaded.periodId || loaded.approvalNo === null) {
    throw new HttpError(409, NOT_APPROVED, {}, 'payslip_month_not_approved');
  }
  return { periodId: loaded.periodId, approvalNo: loaded.approvalNo };
}

function lineOf(loaded: Loaded, employeeId: string): PayrollLineDto {
  const line = loaded.month.lines.find((l) => l.employeeId === employeeId);
  if (!line) throw invalid('Người này không có trong bảng lương của tháng.', {});
  return line;
}

interface SaveArgs {
  periodId: string;
  approvalNo: number;
  employeeId: string;
  status: 'sent' | 'failed';
  channel: 'manual' | 'auto';
  email: string;
  sentTo: string;
  error: string | null;
  at: Date;
  actor: string;
}

export async function saveSend(db: Pick<Db, 'insert'>, row: SaveArgs): Promise<void> {
  const { periodId: _p, employeeId: _e, approvalNo: _n, ...changed } = row;
  const t = payrollPayslipSends;
  await db
    .insert(t)
    .values(row)
    .onConflictDoUpdate({ target: [t.periodId, t.employeeId, t.approvalNo], set: changed });
}

export interface MarkArgs {
  key: string;
  raw: unknown;
  hr: HrMe;
  now: Date;
  mail: MailContext;
}

/** "Đánh dấu đã gửi": HR mailed these people themselves. `sent: false` takes the mark of this approval back. */
export async function markPayslipsSent(db: Db, args: MarkArgs): Promise<PayslipListDto> {
  const parsed = payslipMarkSchema.safeParse(args.raw);
  if (!parsed.success) throw invalid('Chọn người cần đánh dấu.', fieldErrors(parsed.error));
  const loaded = await load(db, args.key, args.now);
  const { periodId, approvalNo } = sendable(loaded);
  const lines = [...new Set(parsed.data.employeeIds)].map((id) => lineOf(loaded, id));
  const actor = actorOf(args.hr);
  const t = payrollPayslipSends;
  await db.transaction(async (tx) => {
    if (parsed.data.sent) {
      for (const line of lines) {
        const email = emailOf(loaded, line) ?? '';
        const row = { periodId, approvalNo, employeeId: line.employeeId, email, sentTo: email, at: args.now, actor };
        await saveSend(tx, { ...row, status: 'sent', channel: 'manual', error: null });
      }
    } else {
      const ids = lines.map((l) => l.employeeId);
      await tx.delete(t).where(and(eq(t.periodId, periodId), eq(t.approvalNo, approvalNo), inArray(t.employeeId, ids)));
    }
    await writePayrollLog(tx, {
      area: 'bang-luong',
      actor,
      action: parsed.data.sent ? 'Đánh dấu đã gửi phiếu lương' : 'Bỏ đánh dấu đã gửi phiếu lương',
      detail: `Bản duyệt lần ${approvalNo}: ${lines.map(personWords).join(', ')}`,
      month: loaded.month.monthKey,
      at: args.now,
    });
  });
  return payslipsOf(db, args.key, args.now, args.mail);
}

/** "10/2026" of "2026-10". */
const monthLabel = (key: string) => `${key.slice(5)}/${key.slice(0, 4)}`;

/** The payslip mail of one person: the `payslip` template of Mẫu thư, signed by the HR who sends it. */
async function mailOf(db: Db, month: PayrollMonthDto, line: PayrollLineDto, hr: HrMe) {
  const { templates } = await listMessageTemplates(db);
  const template = templates.find((t) => t.key === 'payslip');
  if (!template) throw new HttpError(500, 'Không tìm thấy mẫu thư Phiếu lương.');
  const { content } = fillPayslipTemplate(template, {
    fullName: line.fullName,
    month: monthLabel(month.monthKey),
    payDate: month.payDate ? dateWords(month.payDate) : '',
    netPay: `${moneyWords(line.cells.netPay)} đ`,
    hrName: hr.name ?? '',
    hrPhone: hr.phone ?? '',
    company: MAIL_COMPANY.name,
  });
  const details = payslipMailDetails({
    name: hr.name ?? '',
    phone: hr.phone ?? '',
    title: hr.jobTitle ?? '',
    alias: hr.alias ?? '',
    email: hr.contactEmail ?? MAIL_COMPANY.hrEmail,
  });
  return { subject: content.subject, html: renderMailHtml(content, details) };
}

/** An .xlsx file is a zip: it starts with "PK". Anything else is not attached. */
function checkedFile(base64: string): string {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > PAYSLIP_FILE_MAX_BYTES) throw invalid('File phiếu lương quá lớn (tối đa 2 MB).', {});
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw invalid('File phiếu lương không phải file Excel (.xlsx).', {});
  }
  return bytes.toString('base64');
}

export type SendArgs = MarkArgs;

/**
 * "Gửi tự động" for one person: their own payslip file attached to the mail of the template. A refusal by the mail
 * provider is kept as "Lỗi" with its reason and answered, not thrown, so the next person is still sent.
 */
export async function sendPayslip(db: Db, args: SendArgs): Promise<PayslipSendResultDto> {
  const parsed = payslipSendSchema.safeParse(args.raw);
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    throw invalid(Object.values(errors)[0] ?? 'Kiểm tra lại file phiếu lương.', errors);
  }
  const route = mailRouteOf(args.mail.mailer, args.mail.isProduction);
  if (!route.isConfigured) throw new HttpError(409, MAIL_NOT_CONFIGURED, {}, 'mail_not_configured');
  if (route.blocked) throw new HttpError(409, route.blocked, {}, 'mail_blocked');
  const loaded = await load(db, args.key, args.now);
  const { periodId, approvalNo } = sendable(loaded);
  const line = lineOf(loaded, parsed.data.employeeId);
  const email = emailOf(loaded, line);
  if (!email) throw new HttpError(409, `${line.fullName} chưa có email nhận phiếu lương.`, {}, 'payslip_no_email');
  const file = {
    fileName: payslipFileName(loaded.month.monthKey, line.code),
    contentType: XLSX,
    contentBase64: checkedFile(parsed.data.fileBase64),
  };
  const mail = await mailOf(db, loaded.month, line, args.hr);
  const actor = actorOf(args.hr);
  const base = {
    periodId,
    approvalNo,
    employeeId: line.employeeId,
    channel: 'auto' as const,
    email,
    at: args.now,
    actor,
  };
  const log = { area: 'bang-luong' as const, actor, month: loaded.month.monthKey, at: args.now };
  try {
    const { sentTo } = await sendMail(args.mail.mailer, args.mail.isProduction, {
      to: email,
      ...mail,
      attachments: [file],
    });
    await saveSend(db, { ...base, status: 'sent', sentTo, error: null });
    const where = sentTo === email ? email : `${sentTo} (máy thử, không gửi cho nhân viên)`;
    await writePayrollLog(db, { ...log, action: 'Gửi phiếu lương', detail: `${personWords(line)} → ${where}` });
    const send: PayslipSendDto = { state: 'sent', at: args.now.toISOString(), by: actor, channel: 'auto', error: null };
    return { employeeId: line.employeeId, isSent: true, sentTo, error: null, send };
  } catch (error) {
    if (!(error instanceof MailError)) throw error;
    await saveSend(db, { ...base, status: 'failed', sentTo: '', error: error.message });
    const detail = `${personWords(line)}: ${error.message}`;
    await writePayrollLog(db, { ...log, action: 'Gửi phiếu lương bị lỗi', detail });
    const send: PayslipSendDto = {
      state: 'failed',
      at: args.now.toISOString(),
      by: actor,
      channel: 'auto',
      error: error.message,
    };
    return { employeeId: line.employeeId, isSent: false, sentTo: null, error: error.message, send };
  }
}
