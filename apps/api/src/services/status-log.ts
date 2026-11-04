import type { ApplicationStatus, RejectReason } from '@careers/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applicationStatusLog } from '../db/schema.js';

interface LoggedApplication {
  id: string;
  jobId: string;
  source: string;
}

/** "Mới" and "Đã xem" say nothing of how far it went, and HR can go back and forth between them. */
export const isReportedStep = (status: ApplicationStatus) => status !== 'new' && status !== 'seen';

/** Writes down a step the application reached. The first one, "new", says when and from where it came in. */
export async function logStatus(
  db: Db,
  app: LoggedApplication,
  toStatus: ApplicationStatus,
  rejectReason: RejectReason | null = null,
  at?: Date,
): Promise<void> {
  await db.insert(applicationStatusLog).values({
    applicationId: app.id,
    jobId: app.jobId,
    source: app.source,
    toStatus,
    rejectReason,
    ...(at ? { createdAt: at } : {}),
  });
}

const STEPS_AFTER: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  new: ['interview', 'passed', 'hired', 'rejected'],
  seen: ['interview', 'passed', 'hired', 'rejected'],
  interview: ['passed', 'hired', 'rejected'],
  passed: ['hired', 'rejected'],
  hired: ['rejected'],
};

/** Going back corrects a mistake: the steps after it did not happen, so the report must not count them. */
export async function rewindSteps(db: Db, applicationId: string, to: ApplicationStatus): Promise<void> {
  const undone = STEPS_AFTER[to];
  if (!undone) return;
  await db
    .delete(applicationStatusLog)
    .where(and(eq(applicationStatusLog.applicationId, applicationId), inArray(applicationStatusLog.toStatus, undone)));
}

/** "Hoàn tác": the last step never happened. */
export async function dropLastStatus(db: Db, applicationId: string): Promise<void> {
  const [last] = await db
    .select({ id: applicationStatusLog.id })
    .from(applicationStatusLog)
    .where(eq(applicationStatusLog.applicationId, applicationId))
    .orderBy(desc(applicationStatusLog.createdAt))
    .limit(1);
  if (last) await db.delete(applicationStatusLog).where(eq(applicationStatusLog.id, last.id));
}
