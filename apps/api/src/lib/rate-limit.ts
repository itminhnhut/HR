import { and, count, eq, gt, lt, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import type { Db } from '../db/index.js';
import { rateLimitHits } from '../db/schema.js';
import { HttpError } from './http-error.js';

export interface Limit {
  key: string;
  max: number;
  windowMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Counts earlier attempts and records this one, refusing when any limit is reached. Runs in one transaction
 * with a lock per key, so parallel requests are counted one after another (no burst slips through, and a
 * burst does not lock everybody out either).
 */
export async function enforceLimits(db: Db, limits: Limit[], now: Date, message: string): Promise<void> {
  const keys = [...limits].sort((a, b) => a.key.localeCompare(b.key));
  await db.transaction(async (tx) => {
    for (const { key } of keys) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    for (const { key, max, windowMs } of keys) {
      const [row] = await tx
        .select({ n: count() })
        .from(rateLimitHits)
        .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.at, new Date(now.getTime() - windowMs))));
      if ((row?.n ?? 0) >= max) throw new HttpError(429, message);
    }
    await tx.insert(rateLimitHits).values(keys.map(({ key }) => ({ key, at: now })));
  });
  // Housekeeping: nothing older than a day is ever counted.
  await db.delete(rateLimitHits).where(lt(rateLimitHits.at, new Date(now.getTime() - DAY_MS)));
}

/** Client address as Vercel (and most proxies) report it. Falls back to one shared bucket. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || c.req.header('x-real-ip') || 'unknown';
}
