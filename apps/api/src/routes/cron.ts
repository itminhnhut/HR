import { effectiveStatus, formatDate } from '@careers/shared';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { applications, jobs } from '../db/schema.js';
import { deleteCvs } from '../lib/cv-storage.js';
import { notifyExpiringJobs } from '../lib/notify.js';

const RETENTION_DAYS = 365; // BR-09

export const cronRoutes = new Hono();

/**
 * Runs once a day (Hobby plan limit). Expiry itself is NOT done here: status is
 * derived from the deadline on every read, so it is exact to the minute.
 * This job only sends reminders (BR-03) and deletes old applications (BR-09).
 */
cronRoutes.get('/daily', async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const db = getDb();

  const candidates = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.state, 'published'), isNull(jobs.reminderSentAt)));
  const expiring = candidates.filter((job) => effectiveStatus(job) === 'expiring');
  await notifyExpiringJobs(expiring.map((job) => ({ title: job.title, deadline: formatDate(job.deadline) })));
  if (expiring.length > 0) {
    await db
      .update(jobs)
      .set({ reminderSentAt: new Date() })
      .where(
        inArray(
          jobs.id,
          expiring.map((job) => job.id),
        ),
      );
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const old = await db
    .select({ id: applications.id, cvPathname: applications.cvPathname })
    .from(applications)
    .where(lt(applications.createdAt, cutoff));
  if (old.length > 0) {
    await deleteCvs(old.flatMap((row) => (row.cvPathname ? [row.cvPathname] : [])));
    await db.delete(applications).where(
      inArray(
        applications.id,
        old.map((row) => row.id),
      ),
    );
  }

  return c.json({ reminded: expiring.length, deletedApplications: old.length });
});
