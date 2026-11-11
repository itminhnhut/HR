import {
  fieldErrors,
  payrollRightsSchema,
  type HrMe,
  type PayrollAccessDto,
  type PayrollRightsDto,
  type PayrollRightsListDto,
} from '@careers/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { hrUsers, type HrUser } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { writePayrollLog } from './payroll-log.js';
import { actorOf } from './timesheet-people.js';

/** Quyền Lương (spec-luong.md 10.2). Answers carry no salary figure: they are only about who may see them. */

export interface PayrollRights {
  canPayroll: boolean;
  canApprovePayroll: boolean;
}

const NO_RIGHT = 'Bạn không có quyền Lương.';
const NO_APPROVE = 'Bạn không có quyền Duyệt lương.';
export const LAST_HOLDER = 'Phải còn ít nhất một người có quyền Lương và Duyệt.';

export const noPayrollRight = () => new HttpError(403, NO_RIGHT, {}, 'no_payroll_right');
export const noApproveRight = () => new HttpError(403, NO_APPROVE, {}, 'no_payroll_approve');

const rightsOf = (user: Pick<HrUser, 'canPayroll' | 'canApprovePayroll'>): PayrollRights => ({
  canPayroll: user.canPayroll,
  canApprovePayroll: user.canApprovePayroll,
});

/**
 * PAYROLL_ADMINS: both rights to the listed accounts, but only while nobody has any payroll right. Once someone has
 * it the list is ignored, so a right taken on the web stays taken. One statement, so two first requests agree.
 */
async function bootstrapFromEnv(db: Db, admins: readonly string[], now: Date): Promise<void> {
  const granted = await db
    .update(hrUsers)
    .set({ canPayroll: true, canApprovePayroll: true })
    .where(
      and(
        inArray(hrUsers.email, [...admins]),
        sql`not exists (select 1 from ${hrUsers} as holder where holder.can_payroll)`,
      ),
    )
    .returning({ email: hrUsers.email });
  if (granted.length === 0) return;
  await writePayrollLog(db, {
    area: 'quyen',
    actor: 'Hệ thống',
    action: 'Cấp quyền từ PAYROLL_ADMINS',
    detail: `${granted.map((g) => g.email).join(', ')}: Xem, sửa lương và Duyệt lương`,
    month: null,
    at: now,
  });
}

/**
 * PAYROLL_ADMINS left unset: every HR account has both payroll rights and the rights screen decides nothing. The owner
 * chose this while the company has no need to tell payroll users apart; naming emails in PAYROLL_ADMINS turns it off.
 */
export const PAYROLL_OPEN = '*';

export const isPayrollOpen = (admins: readonly string[]): boolean => admins.includes(PAYROLL_OPEN);

const OPEN_WORDS = 'Lương đang mở cho mọi tài khoản HR, chưa cần phân quyền';
const payrollOpen = () => new HttpError(409, OPEN_WORDS, {}, 'payroll_open');

/** Read again on every request: a right taken away applies to the very next call. */
export async function payrollRightsOf(db: Db, me: HrMe, admins: readonly string[], now: Date): Promise<PayrollRights> {
  const user = await db.query.hrUsers.findFirst({ where: eq(hrUsers.id, me.id) });
  if (!user) return { canPayroll: false, canApprovePayroll: false };
  if (isPayrollOpen(admins)) return { canPayroll: true, canApprovePayroll: true };
  if (user.canPayroll || !admins.includes(user.email)) return rightsOf(user);
  await bootstrapFromEnv(db, admins, now);
  const fresh = await db.query.hrUsers.findFirst({ where: eq(hrUsers.id, me.id) });
  return fresh ? rightsOf(fresh) : { canPayroll: false, canApprovePayroll: false };
}

export const accessOf = (rights: PayrollRights): PayrollAccessDto => ({
  canPayroll: true,
  canApprovePayroll: rights.canApprovePayroll,
});

/** Every account with its stored rights; `open` says they decide nothing while Lương is open to every HR account. */
export async function listPayrollRights(db: Db, me: HrMe, admins: readonly string[]): Promise<PayrollRightsListDto> {
  const rows = await db.select().from(hrUsers).orderBy(asc(hrUsers.createdAt), asc(hrUsers.email));
  const accounts = rows.map((u) => ({
    userId: u.id,
    email: u.email,
    name: u.name,
    ...rightsOf(u),
    isMe: u.id === me.id,
  }));
  return { open: isPayrollOpen(admins), accounts };
}

/** Someone other than `exceptId` still holds both rights. Locks the holders, so two removals cannot both pass. */
async function anotherFullHolder(db: Pick<Db, 'select'>, exceptId: string): Promise<boolean> {
  const holders = await db
    .select({ id: hrUsers.id })
    .from(hrUsers)
    .where(and(eq(hrUsers.canPayroll, true), eq(hrUsers.canApprovePayroll, true)))
    .for('update');
  return holders.some((h) => h.id !== exceptId);
}

/** Deleting an account must not leave Lương without anyone who can approve. */
export async function requireNotLastFullHolder(db: Db, user: HrUser): Promise<void> {
  if (!user.canApprovePayroll) return;
  if (!(await anotherFullHolder(db, user.id))) throw invalid(LAST_HOLDER);
}

const RIGHT_WORDS = (r: PayrollRights) =>
  r.canApprovePayroll ? 'Xem, sửa lương và Duyệt lương' : r.canPayroll ? 'Xem, sửa lương' : 'không có quyền Lương';

function changeWords(before: PayrollRights, after: PayrollRights): { action: string; words: string } {
  const gives = (after.canPayroll && !before.canPayroll) || (after.canApprovePayroll && !before.canApprovePayroll);
  const takes = (!after.canPayroll && before.canPayroll) || (!after.canApprovePayroll && before.canApprovePayroll);
  const action = gives && !takes ? 'Cấp quyền' : takes && !gives ? 'Bỏ quyền' : 'Đổi quyền';
  return {
    action,
    words: action === 'Cấp quyền' ? RIGHT_WORDS(after) : `${RIGHT_WORDS(before)} → ${RIGHT_WORDS(after)}`,
  };
}

export interface SetRightsArgs {
  userId: string;
  raw: unknown;
  me: HrMe;
  mine: PayrollRights;
  admins: readonly string[];
  now: Date;
}

/**
 * Giving or taking a right. Xem, sửa may give Xem, sửa; Duyệt is given or taken only by someone who has it, so nobody
 * raises their own rights. At least one account keeps both. While Lương is open to every HR account the stored rights
 * decide nothing, so nothing is changed or logged (409 payroll_open).
 */
export async function setPayrollRights(db: Db, args: SetRightsArgs): Promise<PayrollRightsDto> {
  const { userId, raw, me, mine, admins, now } = args;
  if (isPayrollOpen(admins)) throw payrollOpen();
  const parsed = payrollRightsSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Duyệt lương cần có quyền Xem, sửa lương.', fieldErrors(parsed.error));
  const user = isUuid(userId) ? await db.query.hrUsers.findFirst({ where: eq(hrUsers.id, userId) }) : undefined;
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  const before = rightsOf(user);
  const after = parsed.data;
  if (before.canPayroll === after.canPayroll && before.canApprovePayroll === after.canApprovePayroll) {
    return { userId: user.id, email: user.email, name: user.name, ...before, isMe: user.id === me.id };
  }
  if (before.canApprovePayroll !== after.canApprovePayroll && !mine.canApprovePayroll) throw noApproveRight();
  const saved = await db.transaction(async (tx) => {
    if (before.canApprovePayroll && !after.canApprovePayroll && !(await anotherFullHolder(tx, user.id))) {
      throw invalid(LAST_HOLDER);
    }
    const [row] = await tx.update(hrUsers).set(after).where(eq(hrUsers.id, user.id)).returning();
    const { action, words } = changeWords(before, after);
    await writePayrollLog(tx, {
      area: 'quyen',
      actor: actorOf(me),
      action,
      detail: `${user.email}: ${words}`,
      month: null,
      at: now,
    });
    return row;
  });
  if (!saved) throw notFound('Không tìm thấy tài khoản.');
  return { userId: saved.id, email: saved.email, name: saved.name, ...rightsOf(saved), isMe: saved.id === me.id };
}
