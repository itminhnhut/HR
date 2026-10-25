import type { HrMe } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { hrUsers, type HrUser } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import { clearKey, clearSlots, releaseSlot, takeSlots, UNKNOWN_IP, type Limit } from '../lib/rate-limit.js';
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

/**
 * Wrong-password counters. Unknown emails get them too, so answers never reveal which accounts exist.
 * Per email AND device: someone guessing from elsewhere cannot lock the real HR out of their own laptop.
 * A wider per-email cap still stops guessing spread over many devices.
 */
export const failureKey = (email: string) => `hr-login:email:${normalizeEmail(email)}`;
const deviceFailureKey = (email: string, ip: string) => `${failureKey(email)}:ip:${ip}`;
const MAX_FAILED_PER_EMAIL = 30;
const EMAIL_WINDOW_MS = 60 * 60_000;

const CLOCK = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

function locked(until: Date, now: Date): HttpError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return new HttpError(
    429,
    `Đăng nhập sai nhiều lần. Thử lại sau ${minutes} phút (lúc ${CLOCK.format(until)}), hoặc nhờ HR khác đặt lại mật khẩu.`,
  );
}

/** Lifts every sign-in lock on this email (a new password should work straight away). */
export async function unlockHrSignIn(db: Db, email: string): Promise<void> {
  await clearSlots(db, `${failureKey(email)}:`);
}

/**
 * Takes this attempt's slots in one transaction before any password is checked, so parallel guesses cannot
 * check more than 5 passwords per account and device. The 5th wrong one locks that device for 15 minutes.
 * A refused attempt takes nothing. Returns the device count and a way to give the slots back after a success.
 */
async function takeLoginSlots(db: Db, email: string, ip: string, now: Date) {
  const overallKey = `${failureKey(email)}:all`;
  const deviceKey = deviceFailureKey(email, ip);
  const ipKey = `hr-login:ip:${ip}`;
  // Every password check costs CPU, so a device has a budget whatever email it tries. Without an address
  // all clients would share it, and anyone could block every HR: then only the per-email limits apply.
  const perIp: Limit[] = ip === UNKNOWN_IP ? [] : [{ key: ipKey, max: MAX_ATTEMPTS_PER_IP, windowMs: LOCK_MS }];
  const slots = await takeSlots(
    db,
    [
      { key: overallKey, max: MAX_FAILED_PER_EMAIL, windowMs: EMAIL_WINDOW_MS },
      { key: deviceKey, max: MAX_FAILED_LOGINS, windowMs: LOCK_MS, lockout: true },
      ...perIp,
    ],
    now,
  );
  if (!slots.ok) throw slots.key === ipKey ? new HttpError(429, TOO_MANY_FROM_DEVICE) : locked(slots.freeAt, now);
  return {
    /** True when this attempt was the last allowed one: a wrong password now locks the device. */
    isLast: (slots.used[deviceKey] ?? 0) >= MAX_FAILED_LOGINS,
    /** After a success: this attempt is not a failure, and the HR's own device starts afresh. */
    succeeded: async () => {
      await releaseSlot(db, overallKey, now);
      if (perIp.length) await releaseSlot(db, ipKey, now);
      await clearKey(db, deviceKey);
    },
  };
}

export async function signIn(db: Db, raw: unknown, now: Date, ip: string): Promise<HrUser> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, 'Nhập email và mật khẩu.');
  const { email, password } = parsed.data;
  const slots = await takeLoginSlots(db, email, ip, now);

  const user = await findHrUser(db, email);
  // Unknown emails do the same work as a real check, so response time does not reveal which emails exist.
  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : (await verifyPassword(password, await dummyHash()), false);
  if (!user || !valid) {
    if (slots.isLast) throw locked(new Date(now.getTime() + LOCK_MS), now);
    throw new HttpError(401, WRONG);
  }

  await slots.succeeded();
  const upgrade = needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(password) } : {};
  const [fresh] = await db
    .update(hrUsers)
    .set({ lastLoginAt: now, ...upgrade })
    .where(eq(hrUsers.id, user.id))
    .returning();
  return fresh ?? user;
}

export const toHrMe = (user: HrUser): HrMe => ({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  contactEmail: user.contactEmail,
});

/**
 * Creates the account, or sets a new password for an existing one (and its name, only when given).
 * Also lifts a sign-in lock. Used by scripts/hr-user.ts.
 */
export async function upsertHrUser(db: Db, input: { email: string; name?: string | null; password: string }) {
  const problem = passwordProblem(input.password, input.email);
  if (problem) throw new Error(problem);
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  // "--name ''" means no name: the UI then shows the email.
  const name = input.name?.trim() || null;
  const [user] = await db
    .insert(hrUsers)
    .values({ email, name, passwordHash })
    .onConflictDoUpdate({
      target: hrUsers.email,
      set: { passwordHash, ...(input.name !== undefined ? { name } : {}) },
    })
    .returning();
  await unlockHrSignIn(db, email);
  return user;
}
