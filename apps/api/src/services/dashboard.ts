import { addDays, effectiveStatus, todayInVietnam, type ApplicationSource, type DashboardDto } from '@careers/shared';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, jobs } from '../db/schema.js';
import { dueJobIds } from './hr-jobs.js';

const DAYS = 30;
const WAITING_DAYS = 3;
const INTERVIEWS_MAX = 8;
/** Expired jobs stay on the dashboard this long, as a reminder to reopen or close them. */
const RECENTLY_ENDED_DAYS = 14;

const firstLine = (text: string | null) =>
  text
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim() ?? null;

/** Where the last 30 days' applications came from, biggest first (spec-cv-intake.md). */
function countBySource(rows: { source: ApplicationSource }[]): DashboardDto['bySource'] {
  const counts = new Map<ApplicationSource, number>();
  for (const { source } of rows) counts.set(source, (counts.get(source) ?? 0) + 1);
  return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

/** The last 30 Vietnam days, oldest first. */
function lastDays(now: Date): string[] {
  const today = todayInVietnam(now);
  return Array.from({ length: DAYS }, (_, i) => addDays(today, i - (DAYS - 1)));
}

export async function dashboard(db: Db, now: Date): Promise<DashboardDto> {
  const days = lastDays(now);
  const since = new Date(`${days[0]}T00:00:00.000+07:00`);
  const [allJobs, recent, waiting, interviews] = await Promise.all([
    db.select().from(jobs),
    db
      .select({ jobId: applications.jobId, createdAt: applications.createdAt, source: applications.source })
      .from(applications)
      .where(gte(applications.createdAt, since)),
    db
      .select({ status: applications.status, createdAt: applications.createdAt })
      .from(applications)
      .where(eq(applications.status, 'new')),
    db
      .select({
        id: applications.id,
        fullName: applications.fullName,
        jobTitle: jobs.title,
        interviewAt: applications.interviewAt,
        note: applications.note,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(eq(applications.status, 'interview'))
      .orderBy(sql`${applications.interviewAt} asc nulls last`, asc(applications.createdAt))
      .limit(INTERVIEWS_MAX),
  ]);

  const index = new Map(days.map((d, i) => [d, i]));
  const perDay = days.map((day) => ({ day, count: 0 }));
  const perJob = new Map<string, number[]>();
  for (const app of recent) {
    const i = index.get(todayInVietnam(app.createdAt));
    if (i === undefined) continue;
    perDay[i].count += 1;
    const counts = perJob.get(app.jobId) ?? Array<number>(DAYS).fill(0);
    counts[i] += 1;
    perJob.set(app.jobId, counts);
  }
  const titles = new Map(allJobs.map((j) => [j.id, j.title]));

  const today = todayInVietnam(now);
  const endingJobs = allJobs
    .map((job) => ({ job, status: effectiveStatus(job, now) }))
    .filter(
      ({ job, status }) =>
        status === 'expiring' || (status === 'expired' && job.deadline >= addDays(today, -RECENTLY_ENDED_DAYS)),
    )
    .sort((a, b) => a.job.deadline.localeCompare(b.job.deadline))
    .map(({ job, status }) => ({ id: job.id, title: job.title, deadline: job.deadline, status }));

  const dueIds = dueJobIds(allJobs, now);
  const [{ due }] =
    dueIds.length === 0
      ? [{ due: 0 }]
      : await db
          .select({ due: sql<number>`count(*)`.mapWith(Number) })
          .from(applications)
          .where(and(inArray(applications.jobId, dueIds)));
  const waitSince = new Date(`${addDays(today, -WAITING_DAYS)}T00:00:00.000+07:00`);

  return {
    bySource: countBySource(recent),
    newApplications: waiting.length,
    waitingOver3Days: waiting.filter((a) => a.createdAt < waitSince).length,
    perDay,
    perJobPerDay: [...perJob.entries()].map(([jobId, counts]) => ({
      jobId,
      jobTitle: titles.get(jobId) ?? '—',
      counts,
    })),
    interviews: interviews.map((i) => ({
      id: i.id,
      fullName: i.fullName,
      jobTitle: i.jobTitle,
      interviewAt: i.interviewAt?.toISOString() ?? null,
      noteLine: firstLine(i.note),
    })),
    endingJobs,
    dueForDeletion: due,
  };
}
