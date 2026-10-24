import type { CandidateMe } from '@careers/shared';
import { desc, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import type { Env } from '../app.js';
import type { Db } from '../db/index.js';
import { applications, candidates, subscribers, type Candidate } from '../db/schema.js';
import type { GoogleIdentity } from '../lib/google.js';
import { HttpError } from '../lib/http-error.js';
import { isUuid, normalizeEmail } from '../lib/request.js';
import { clearSession, readSession } from '../lib/session.js';

/** Applications belong to an account when they were sent with its (Google-verified) email. */
export const sentWith = (email: string) => sql`lower(${applications.email}) = ${normalizeEmail(email)}`;

/**
 * Google sign-in: the account is found by email, or created on first sign-in and
 * pre-filled from the latest application sent with that email.
 */
export async function signInWithGoogle(db: Db, identity: GoogleIdentity): Promise<Candidate> {
  const email = normalizeEmail(identity.email);
  const existing = await db.query.candidates.findFirst({ where: eq(candidates.email, email) });
  if (existing) return existing;
  const [last] = await db
    .select()
    .from(applications)
    .where(sentWith(email))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  await db
    .insert(candidates)
    .values({
      email,
      name: last?.fullName ?? identity.name,
      phone: last?.phone ?? null,
    })
    .onConflictDoNothing();
  const created = await db.query.candidates.findFirst({ where: eq(candidates.email, email) });
  if (!created) throw new Error(`Candidate ${email} vanished right after insert`);
  return created;
}

/** The signed-in candidate, or null. A deleted account ends the session. */
export async function currentCandidate(c: Context<Env>): Promise<Candidate | null> {
  const session = await readSession(c, 'candidate');
  if (!session || !isUuid(session.subject)) return null;
  const candidate = await c.get('deps').db.query.candidates.findFirst({ where: eq(candidates.id, session.subject) });
  if (!candidate) clearSession(c, 'candidate');
  return candidate ?? null;
}

export async function requireCandidate(c: Context<Env>): Promise<Candidate> {
  const candidate = await currentCandidate(c);
  if (!candidate) throw new HttpError(401, 'Đăng nhập lại để tiếp tục.');
  return candidate;
}

export async function toCandidateMe(db: Db, candidate: Candidate): Promise<CandidateMe> {
  // Only alerts this account turned on: its phone is not verified, so public sign-ups stay out of reach.
  const alerts = await db
    .select({ department: subscribers.department })
    .from(subscribers)
    .where(eq(subscribers.candidateId, candidate.id))
    .orderBy(subscribers.createdAt);
  return {
    email: candidate.email,
    phone: candidate.phone,
    name: candidate.name,
    cvFileName: candidate.cvFileName,
    alertDepartments: alerts.map((a) => a.department),
  };
}
