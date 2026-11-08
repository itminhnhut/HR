import {
  addDays,
  daysBetween,
  DEFAULT_REPORT_DAYS,
  effectiveStatus,
  todayInVietnam,
  type ApplicationSource,
  type DashboardDto,
  type ReportPeriod,
} from '@careers/shared';
import { and, asc, count, eq, gte, lt } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, applicationStatusLog, cvScores, jobs } from '../db/schema.js';
import { sourceFunnel } from './source-funnel.js';
import { newestNotes } from './application-notes.js';

const WAITING_DAYS = 3;
/** Expired jobs stay on the dashboard this long, as a reminder to reopen or close them. */
const RECENTLY_ENDED_DAYS = 14;

const firstLine = (text: string | null) =>
  text
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim() ?? null;

/** Soonest first, then those already over with the latest first, then those without a time. */
function byAgenda<T extends { interviewAt: Date | null }>(rows: readonly T[], now: Date): T[] {
  const time = (row: T) => row.interviewAt?.getTime() ?? 0;
  const upcoming = rows.filter((r) => r.interviewAt && r.interviewAt >= now).sort((a, b) => time(a) - time(b));
  const past = rows.filter((r) => r.interviewAt && r.interviewAt < now).sort((a, b) => time(b) - time(a));
  return [...upcoming, ...past, ...rows.filter((r) => !r.interviewAt)];
}

/** Where the period's applications came from, biggest first (spec-cv-intake.md). */
function countBySource(rows: { source: ApplicationSource }[]): DashboardDto['bySource'] {
  const counts = new Map<ApplicationSource, number>();
  for (const { source } of rows) counts.set(source, (counts.get(source) ?? 0) + 1);
  return [...counts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

/** The Vietnam days of the period, oldest first. */
function daysOf({ from, to }: ReportPeriod): string[] {
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
}

const dayStart = (day: string) => new Date(`${day}T00:00:00.000+07:00`);

export const defaultPeriod = (now: Date): ReportPeriod => {
  const to = todayInVietnam(now);
  return { from: addDays(to, 1 - DEFAULT_REPORT_DAYS), to };
};

const cameInBetween = (since: Date, until?: Date) =>
  and(
    eq(applicationStatusLog.toStatus, 'new'),
    gte(applicationStatusLog.createdAt, since),
    until ? lt(applicationStatusLog.createdAt, until) : undefined,
  );

async function countByStatus(db: Db): Promise<DashboardDto['statusCounts']> {
  const rows = await db
    .select({ status: applications.status, total: count() })
    .from(applications)
    .groupBy(applications.status);
  const counts = { new: 0, seen: 0, scheduling: 0, interview: 0, passed: 0, hired: 0, rejected: 0 };
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

async function countSince(db: Db, since: Date): Promise<number> {
  const [row] = await db.select({ total: count() }).from(applicationStatusLog).where(cameInBetween(since));
  return row?.total ?? 0;
}

export async function dashboard(db: Db, now: Date, period = defaultPeriod(now)): Promise<DashboardDto> {
  const days = daysOf(period);
  const since = dayStart(period.from);
  const until = dayStart(addDays(period.to, 1));
  const [allJobs, recent, waiting, interviews] = await Promise.all([
    db.select().from(jobs),
    // From the log, written once per application: a deleted application still counts in a report over the years.
    db
      .select({
        jobId: applicationStatusLog.jobId,
        createdAt: applicationStatusLog.createdAt,
        source: applicationStatusLog.source,
      })
      .from(applicationStatusLog)
      .where(cameInBetween(since, until)),
    db
      .select({ status: applications.status, createdAt: applications.createdAt })
      .from(applications)
      .where(eq(applications.status, 'new')),
    db
      .select({
        id: applications.id,
        fullName: applications.fullName,
        jobTitle: jobs.title,
        createdAt: applications.createdAt,
        interviewAt: applications.interviewAt,
        phone: applications.phone,
        matchPercent: cvScores.percent,
        cvGender: cvScores.gender,
        cvBirth: cvScores.birth,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .leftJoin(cvScores, eq(cvScores.applicationId, applications.id))
      .where(eq(applications.status, 'interview'))
      .orderBy(asc(applications.createdAt)),
  ]);

  const index = new Map(days.map((d, i) => [d, i]));
  const perDay = days.map((day) => ({ day, count: 0 }));
  const perJob = new Map<string, number[]>();
  const perSource = new Map<ApplicationSource, number[]>();
  for (const app of recent) {
    const i = index.get(todayInVietnam(app.createdAt));
    if (i === undefined) continue;
    perDay[i].count += 1;
    const counts = perJob.get(app.jobId) ?? Array<number>(days.length).fill(0);
    counts[i] += 1;
    perJob.set(app.jobId, counts);
    const ofSource = perSource.get(app.source) ?? Array<number>(days.length).fill(0);
    ofSource[i] += 1;
    perSource.set(app.source, ofSource);
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

  const waitSince = new Date(`${addDays(today, -WAITING_DAYS)}T00:00:00.000+07:00`);
  const notes = await newestNotes(
    db,
    interviews.map((i) => i.id),
  );

  return {
    bySource: countBySource(recent),
    statusCounts: await countByStatus(db),
    awaitingResults: interviews.filter((i) => i.interviewAt && i.interviewAt <= now).length,
    sourceFunnel: await sourceFunnel(db, since, until),
    last7Days: await countSince(db, dayStart(addDays(todayInVietnam(now), -6))),
    bySourcePerDay: [...perSource.entries()].map(([source, counts]) => ({ source, counts })),
    newApplications: waiting.length,
    waitingOver3Days: waiting.filter((a) => a.createdAt < waitSince).length,
    perDay,
    perJobPerDay: [...perJob.entries()].map(([jobId, counts]) => ({
      jobId,
      jobTitle: titles.get(jobId) ?? '—',
      counts,
    })),
    interviewCounts: { total: interviews.length, noTime: interviews.filter((i) => !i.interviewAt).length },
    interviews: byAgenda(interviews, now).map((i) => ({
      id: i.id,
      fullName: i.fullName,
      jobTitle: i.jobTitle,
      appliedAt: i.createdAt.toISOString(),
      interviewAt: i.interviewAt?.toISOString() ?? null,
      noteLine: firstLine(notes.get(i.id) ?? null),
      phone: i.phone,
      matchPercent: i.matchPercent,
      cvGender: i.cvGender,
      cvBirth: i.cvBirth,
    })),
    endingJobs,
  };
}
