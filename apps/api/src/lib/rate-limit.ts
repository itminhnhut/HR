import { and, desc, eq, gt, inArray, like, lt, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import type { Db } from '../db/index.js';
import { rateLimitHits } from '../db/schema.js';
import { HttpError } from './http-error.js';

export interface Limit {
  key: string;
  max: number;
  windowMs: number;
  /**
   * Reaching `max` locks the key for a full `windowMs` from that attempt, instead of only until the oldest
   * attempt leaves the window (which could be a minute later and let guessing go on drip by drip).
   */
  lockout?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Share of calls that also delete old rows, so most requests skip that extra statement. */
const HOUSEKEEPING_SHARE = 0.05;

const lockKey = (key: string) => `${key}:lock`;

export type Slots = { ok: true; used: Record<string, number> } | { ok: false; key: string; freeAt: Date };

/** Times of the hits for `key` inside the window, newest first. */
const hitsInWindow = (tx: Pick<Db, 'select'>, key: string, since: Date) =>
  tx
    .select({ at: rateLimitHits.at })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.at, since)))
    .orderBy(desc(rateLimitHits.at));

/**
 * Takes one slot of every limit, all or none, in one transaction with a lock per key (taken in key order, so
 * parallel calls cannot deadlock and cannot use more than `max`). When any limit is full, nothing is taken
 * and the answer says which one and when it frees up. `used` counts this attempt.
 */
export async function takeSlots(db: Db, limits: Limit[], now: Date): Promise<Slots> {
  const sorted = [...limits].sort((a, b) => a.key.localeCompare(b.key));
  const result = await db.transaction(async (tx): Promise<Slots> => {
    for (const { key } of sorted) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const used: Record<string, number> = {};
    const locks: string[] = [];
    for (const { key, max, windowMs, lockout } of sorted) {
      const since = new Date(now.getTime() - windowMs);
      const [lock] = lockout ? await hitsInWindow(tx, lockKey(key), since).limit(1) : [];
      if (lock) return { ok: false, key, freeAt: new Date(lock.at.getTime() + windowMs) };
      const hits = await hitsInWindow(tx, key, since);
      if (hits.length >= max) return { ok: false, key, freeAt: new Date(hits[max - 1].at.getTime() + windowMs) };
      used[key] = hits.length + 1;
      if (lockout && used[key] >= max) locks.push(lockKey(key));
    }
    await tx.insert(rateLimitHits).values([...sorted.map(({ key }) => key), ...locks].map((key) => ({ key, at: now })));
    return { ok: true, used };
  });
  // Housekeeping: nothing older than a day is ever counted.
  if (Math.random() < HOUSEKEEPING_SHARE) {
    await db.delete(rateLimitHits).where(lt(rateLimitHits.at, new Date(now.getTime() - DAY_MS)));
  }
  return result;
}

/** Records this attempt against every limit, or refuses with 429 `message` when any is reached. */
export async function enforceLimits(db: Db, limits: Limit[], now: Date, message: string): Promise<void> {
  const slots = await takeSlots(db, limits, now);
  if (!slots.ok) throw new HttpError(429, message);
}

/** Gives back the one slot an attempt took at `at` (others under the same key, e.g. someone else's, stay). */
export async function releaseSlot(db: Db, key: string, at: Date): Promise<void> {
  const one = db
    .select({ id: rateLimitHits.id })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), eq(rateLimitHits.at, at)))
    .limit(1);
  await db.delete(rateLimitHits).where(inArray(rateLimitHits.id, one));
}

/** Gives back every slot of exactly this key, and lifts its lock. */
export async function clearKey(db: Db, key: string): Promise<void> {
  await db.delete(rateLimitHits).where(inArray(rateLimitHits.key, [key, lockKey(key)]));
}

/** Gives back every slot whose key starts with `prefix` (e.g. all addresses of one email), locks included. */
export async function clearSlots(db: Db, prefix: string): Promise<void> {
  await db.delete(rateLimitHits).where(like(rateLimitHits.key, `${prefix.replace(/[%_\\]/g, '\\$&')}%`));
}

/** No platform or proxy header: every client looks the same, so per-address limits must not apply. */
export const UNKNOWN_IP = 'unknown';

/**
 * Client address. Headers set by the platform come first (Vercel overwrites these). Otherwise the LAST
 * x-forwarded-for entry: the one our nearest proxy added, which the client cannot choose (earlier entries
 * can be anything the client sent). UNKNOWN_IP without any (local dev without a proxy).
 */
export function clientIp(c: Context): string {
  const platform = c.req.header('x-vercel-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip');
  const forwarded = c.req.header('x-forwarded-for')?.split(',').pop()?.trim();
  return platform || forwarded || UNKNOWN_IP;
}
