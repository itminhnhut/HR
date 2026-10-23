import type { HrMe } from '@careers/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { hrUsers, type HrUser } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import { dummyHash, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../lib/password.js';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const loginSchema = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });
const WRONG = 'Email hoặc mật khẩu chưa đúng.';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const findHrUser = (db: Db, email: string): Promise<HrUser | undefined> =>
  db.query.hrUsers.findFirst({ where: eq(hrUsers.email, normalizeEmail(email)) });

function lockedMessage(until: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return `Đăng nhập sai nhiều lần. Thử lại sau ${minutes} phút.`;
}

/** Counts a failed attempt atomically; the 5th failure locks the account for 15 minutes. */
async function recordFailure(db: Db, user: HrUser, now: Date): Promise<void> {
  const [row] = await db
    .update(hrUsers)
    .set({ failedAttempts: sql`${hrUsers.failedAttempts} + 1` })
    .where(eq(hrUsers.id, user.id))
    .returning({ failedAttempts: hrUsers.failedAttempts });
  if (row && row.failedAttempts >= MAX_FAILED_LOGINS) {
    const until = new Date(now.getTime() + LOCK_MINUTES * 60_000);
    await db.update(hrUsers).set({ failedAttempts: 0, lockedUntil: until }).where(eq(hrUsers.id, user.id));
    throw new HttpError(429, lockedMessage(until, now));
  }
}

export async function signIn(db: Db, raw: unknown, now: Date): Promise<HrUser> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, 'Nhập email và mật khẩu.');
  const user = await findHrUser(db, parsed.data.email);
  if (!user) {
    // Same work as a real check, so response time does not reveal which emails exist.
    await verifyPassword(parsed.data.password, await dummyHash());
    throw new HttpError(401, WRONG);
  }
  if (user.lockedUntil && user.lockedUntil > now) throw new HttpError(429, lockedMessage(user.lockedUntil, now));
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    await recordFailure(db, user, now);
    throw new HttpError(401, WRONG);
  }
  const upgrade = needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(parsed.data.password) } : {};
  if (user.failedAttempts > 0 || user.lockedUntil || upgrade.passwordHash) {
    const [fresh] = await db
      .update(hrUsers)
      .set({ failedAttempts: 0, lockedUntil: null, ...upgrade })
      .where(eq(hrUsers.id, user.id))
      .returning();
    return fresh ?? user;
  }
  return user;
}

export const toHrMe = (user: HrUser): HrMe => ({ email: user.email, name: user.name });

/** Creates the account, or sets a new password (and name) for an existing one. Used by scripts/hr-user.ts. */
export async function upsertHrUser(db: Db, input: { email: string; name: string | null; password: string }) {
  const problem = passwordProblem(input.password, input.email);
  if (problem) throw new Error(problem);
  const values = {
    email: normalizeEmail(input.email),
    name: input.name,
    passwordHash: await hashPassword(input.password),
    failedAttempts: 0,
    lockedUntil: null,
  };
  const [user] = await db
    .insert(hrUsers)
    .values(values)
    .onConflictDoUpdate({ target: hrUsers.email, set: values })
    .returning();
  return user;
}
