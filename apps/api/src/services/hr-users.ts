import { fieldErrors, hrProfileSchema, type HrMe, type HrUserDto, type TempPasswordResponse } from '@careers/shared';
import { asc, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { hrUsers, type HrUser } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { generatePassword, hashPassword, passwordProblem, verifyPassword } from '../lib/password.js';
import { clearSlots } from '../lib/rate-limit.js';
import { failureKey, toHrMe } from './hr-accounts.js';
import { isUuid, normalizeEmail } from '../lib/request.js';

const toDto = (user: HrUser, me: HrMe): HrUserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  isMe: user.id === me.id,
  phone: user.phone,
  contactEmail: user.contactEmail,
});

export async function listHrUsers(db: Db, me: HrMe): Promise<HrUserDto[]> {
  const rows = await db.select().from(hrUsers).orderBy(asc(hrUsers.createdAt));
  return rows.map((u) => toDto(u, me));
}

async function findUser(db: Db, id: string): Promise<HrUser> {
  const user = isUuid(id) ? await db.query.hrUsers.findFirst({ where: eq(hrUsers.id, id) }) : undefined;
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  return user;
}

const newUserSchema = z.object({
  email: z.string().trim().pipe(z.email('Email chưa đúng.').max(200)),
  name: z.string().trim().max(100, 'Tên tối đa 100 ký tự.').optional(),
});

/** New account with a generated password, shown once to the HR who created it. */
export async function createHrUser(db: Db, raw: unknown, me: HrMe): Promise<TempPasswordResponse> {
  const parsed = newUserSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Kiểm tra lại thông tin.';
    throw invalid(message, { [String(parsed.error.issues[0]?.path[0] ?? 'form')]: message });
  }
  const email = normalizeEmail(parsed.data.email);
  if (await db.query.hrUsers.findFirst({ where: eq(hrUsers.email, email) })) {
    throw invalid('Email này đã có tài khoản.', { email: 'Email này đã có tài khoản.' });
  }
  const password = generatePassword();
  const [user] = await db
    .insert(hrUsers)
    .values({ email, name: parsed.data.name || null, passwordHash: await hashPassword(password) })
    .returning();
  return { user: toDto(user, me), password };
}

/** A new password for someone else; their open sessions end (the cookie carries a password fingerprint). */
export async function resetHrPassword(db: Db, id: string, me: HrMe): Promise<TempPasswordResponse> {
  const user = await findUser(db, id);
  if (user.id === me.id) throw new HttpError(422, 'Đổi mật khẩu của bạn ở mục "Đổi mật khẩu".');
  const password = generatePassword();
  const [updated] = await db
    .update(hrUsers)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(hrUsers.id, user.id))
    .returning();
  // A forgotten password often comes with a locked account: the new password works right away.
  await clearSlots(db, `${failureKey(user.email)}:`);
  return { user: toDto(updated, me), password };
}

export async function deleteHrUser(db: Db, id: string, me: HrMe): Promise<{ ok: true }> {
  const user = await findUser(db, id);
  if (user.id === me.id) throw new HttpError(422, 'Không xoá được tài khoản bạn đang dùng.');
  const [{ total }] = await db.select({ total: count() }).from(hrUsers);
  if (total <= 1) throw new HttpError(422, 'Phải còn ít nhất một tài khoản HR.');
  await db.delete(hrUsers).where(eq(hrUsers.id, user.id));
  return { ok: true };
}

const changeSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

/** Returns the updated account so the route can renew the session cookie. */
export async function changeOwnPassword(db: Db, raw: unknown, me: HrMe): Promise<HrUser> {
  const parsed = changeSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Nhập mật khẩu hiện tại và mật khẩu mới.', {});
  const user = await findUser(db, me.id);
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    throw invalid('Mật khẩu hiện tại chưa đúng.', { current: 'Mật khẩu hiện tại chưa đúng.' });
  }
  const problem = passwordProblem(parsed.data.next, user.email);
  if (problem) throw invalid(problem, { next: problem });
  const [updated] = await db
    .update(hrUsers)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(hrUsers.id, user.id))
    .returning();
  return updated;
}

/** "Thông tin người gửi": the name, phone and real mailbox put into message templates. */
export async function updateMyProfile(db: Db, raw: unknown, me: HrMe): Promise<HrMe> {
  const parsed = hrProfileSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại thông tin.', fieldErrors(parsed.error));
  const { name, phone, contactEmail } = parsed.data;
  const [user] = await db
    .update(hrUsers)
    .set({ name: name || null, phone: phone || null, contactEmail: contactEmail.toLowerCase() || null })
    .where(eq(hrUsers.id, me.id))
    .returning();
  if (!user) throw notFound('Không tìm thấy tài khoản.');
  return toHrMe(user);
}
