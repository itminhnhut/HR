import { normalizeVietnamPhone, type CandidateMe } from '@careers/shared';
import { and, desc, eq, gt, lt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { applications, candidates, otpCodes, subscribers, type Candidate } from '../db/schema.js';
import type { Deps } from '../deps.js';
import { HttpError, invalid } from '../lib/http-error.js';
import { hashOtp, newOtpCode, OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, otpMatches } from '../lib/otp.js';

const requestSchema = z.object({ phone: z.string(), channel: z.enum(['zalo', 'sms']).default('zalo') });
const verifySchema = z.object({ phone: z.string(), code: z.string() });

const WRONG_CODE = 'Mã chưa đúng hoặc đã hết hạn.';

function phoneOrFail(raw: string): string {
  const phone = normalizeVietnamPhone(raw);
  if (!phone) throw invalid('Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
  return phone;
}

export async function requestOtp(
  { db, otpSender, config, now }: Deps,
  raw: unknown,
): Promise<{ ok: true; devCode?: string }> {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Thiếu số điện thoại.');
  const phone = phoneOrFail(parsed.data.phone);
  if (!otpSender) {
    throw new HttpError(503, 'Đăng nhập bằng số điện thoại chưa sẵn sàng. Dùng Google hoặc thử lại sau.');
  }

  const at = now();
  const previous = await db.query.otpCodes.findFirst({ where: eq(otpCodes.phone, phone) });
  if (previous && at.getTime() - previous.sentAt.getTime() < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (at.getTime() - previous.sentAt.getTime())) / 1000);
    throw new HttpError(429, `Chờ ${wait} giây rồi gửi lại mã.`);
  }

  const code = newOtpCode();
  const row = {
    phone,
    codeHash: hashOtp(config.sessionSecret, phone, code),
    expiresAt: new Date(at.getTime() + OTP_TTL_MS),
    attempts: 0,
    sentAt: at,
  };
  await db.insert(otpCodes).values(row).onConflictDoUpdate({ target: otpCodes.phone, set: row });
  try {
    await otpSender.send(phone, code, parsed.data.channel);
  } catch (error) {
    console.error('OTP delivery failed', error);
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
    throw new HttpError(502, 'Chưa gửi được mã, thử lại sau ít phút.');
  }
  return otpSender.revealsCode ? { ok: true, devCode: code } : { ok: true };
}

/** Uses one attempt atomically, so parallel guesses cannot exceed the limit. */
async function consumeAttempt(db: Db, phone: string, at: Date): Promise<string | null> {
  const [row] = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.expiresAt, at), lt(otpCodes.attempts, OTP_MAX_ATTEMPTS)))
    .returning({ codeHash: otpCodes.codeHash });
  return row?.codeHash ?? null;
}

/** Returns the verified phone. */
export async function verifyOtp({ db, config, now }: Deps, raw: unknown): Promise<string> {
  const parsed = verifySchema.safeParse(raw);
  if (!parsed.success) throw invalid(WRONG_CODE, { code: WRONG_CODE });
  const phone = phoneOrFail(parsed.data.phone);
  const codeHash = await consumeAttempt(db, phone, now());
  if (!codeHash || !otpMatches(config.sessionSecret, phone, parsed.data.code.trim(), codeHash)) {
    throw invalid(WRONG_CODE, { code: WRONG_CODE });
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  return phone;
}

/** The account is created on first sign-in, pre-filled from the latest application (BR-17). */
export async function findOrCreateCandidate(db: Db, phone: string): Promise<Candidate> {
  const existing = await db.query.candidates.findFirst({ where: eq(candidates.phone, phone) });
  if (existing) return existing;
  const last = await db.query.applications.findFirst({
    where: eq(applications.phone, phone),
    orderBy: desc(applications.createdAt),
  });
  await db
    .insert(candidates)
    .values({
      phone,
      name: last?.fullName ?? null,
      email: last?.email ?? null,
      keepForOtherJobs: last?.keepForOtherJobs,
    })
    .onConflictDoNothing();
  const created = await db.query.candidates.findFirst({ where: eq(candidates.phone, phone) });
  if (!created) throw new Error(`Candidate ${phone} vanished right after insert`);
  return created;
}

/**
 * BR-22: the Google account proved the email and the OTP proved the phone.
 * The email moves to this phone if another account held it.
 */
export async function linkGoogleEmail(db: Db, phone: string, email: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(candidates)
      .set({ email: null })
      .where(and(eq(candidates.email, email), ne(candidates.phone, phone)));
    await tx.update(candidates).set({ email }).where(eq(candidates.phone, phone));
  });
}

export async function candidateByEmail(db: Db, email: string): Promise<Candidate | undefined> {
  return db.query.candidates.findFirst({ where: eq(candidates.email, email) });
}

export async function toCandidateMe(db: Db, candidate: Candidate): Promise<CandidateMe> {
  // Sign-ups from closed-job pages count as alerts too (BR-10).
  const alerts = await db
    .select({ department: subscribers.department })
    .from(subscribers)
    .where(eq(subscribers.phone, candidate.phone))
    .orderBy(subscribers.createdAt);
  return {
    phone: candidate.phone,
    name: candidate.name,
    email: candidate.email,
    cvFileName: candidate.cvFileName,
    keepForOtherJobs: candidate.keepForOtherJobs,
    alertDepartments: alerts.map((a) => a.department),
  };
}
