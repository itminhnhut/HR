import type { HrMe } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { hrUsers, type HrUser } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import { clearSlots, enforceLimits, takeSlot } from '../lib/rate-limit.js';
import { normalizeEmail } from '../lib/request.js';
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../lib/password.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const LOCK_MS = LOCK_MINUTES * 60_000;
/** Sign-in attempts per device (any email), so unknown emails cannot be used to burn CPU on password hashing. */
export const MAX_ATTEMPTS_PER_IP = 30;

const loginSchema = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });
const WRONG = 'Email hoặc mật khẩu chưa đúng.';
const TOO_MANY_FROM_DEVICE = 'Thử đăng nhập quá nhiều lần từ máy này. Thử lại sau 15 phút.';

export const findHrUser = (db: Db, email: string): Promise<HrUser | undefined> =>
  db.query.hrUsers.findFirst({ where: eq(hrUsers.email, normalizeEmail(email)) });

/** Wrong-password counter per email. Unknown emails get one too, so answers never reveal which accounts exist. */
export const failureKey = (email: string) => `hr-login:email:${normalizeEmail(email)}`;

const CLOCK = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

function locked(until: Date, now: Date): HttpError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return new HttpError(
    429,
    `Đăng nhập sai nhiều lần. Thử lại sau ${minutes} phút (lúc ${CLOCK.format(until)}), hoặc nhờ HR khác đặt lại mật khẩu.`,
  );
}

/**
 * Every attempt first takes a per-device slot and a per-email failure slot (atomically), so parallel guesses
 * cannot check more than 5 passwords per account in 15 minutes. A success gives the failure slots back.
 */
export async function signIn(db: Db, raw: unknown, now: Date, ip: string): Promise<HrUser> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, 'Nhập email và mật khẩu.');
  const { email, password } = parsed.data;
  await enforceLimits(
    db,
    [{ key: `hr-login:ip:${ip}`, max: MAX_ATTEMPTS_PER_IP, windowMs: LOCK_MS }],
    now,
    TOO_MANY_FROM_DEVICE,
  );
  const key = failureKey(email);
  const slot = await takeSlot(db, key, MAX_FAILED_LOGINS, LOCK_MS, now);
  if (!slot.ok) throw locked(slot.freeAt, now);

  const user = await findHrUser(db, email);
  // Unknown emails do the same work as a real check, so response time does not reveal which emails exist.
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await dummyHash()), false);
  if (!user || !valid) {
    if (slot.used >= MAX_FAILED_LOGINS) throw locked(new Date(slot.oldestAt.getTime() + LOCK_MS), now);
    throw new HttpError(401, WRONG);
  }

  await clearSlots(db, key);
  const upgrade = needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(password) } : {};
  const [fresh] = await db
    .update(hrUsers)
    .set({ lastLoginAt: now, ...upgrade })
    .where(eq(hrUsers.id, user.id))
    .returning();
  return fresh ?? user;
}

export const toHrMe = (user: HrUser): HrMe => ({ id: user.id, email: user.email, name: user.name });

/**
 * Creates the account, or sets a new password for an existing one (and its name, only when given).
 * Also lifts a sign-in lock. Used by scripts/hr-user.ts.
 */
export async function upsertHrUser(db: Db, input: { email: string; name?: string | null; password: string }) {
  const problem = passwordProblem(input.password, input.email);
  if (problem) throw new Error(problem);
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(hrUsers)
    .values({ email, name: input.name ?? null, passwordHash })
    .onConflictDoUpdate({
      target: hrUsers.email,
      set: { passwordHash, ...(input.name !== undefined ? { name: input.name } : {}) },
    })
    .returning();
  await clearSlots(db, failureKey(email));
  return user;
}
