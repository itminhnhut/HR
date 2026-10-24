import { effectiveStatus, isListed, todayInVietnam, type JobListResponse, type JobPageResponse } from '@careers/shared';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { jobs, type Job } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { toCard, toDetail } from './job-mappers.js';

const SIMILAR_MAX = 3;

/** Jobs on the public board: published and not past the deadline (open or expiring). */
export async function listedJobs(db: Db, now: Date): Promise<Job[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.state, 'published'), gte(jobs.deadline, todayInVietnam(now))))
    .orderBy(desc(jobs.publishedOn), desc(jobs.createdAt));
  return rows.filter((job) => isListed(effectiveStatus(job, now)));
}

export async function listJobs(db: Db, now: Date): Promise<JobListResponse> {
  const cards = (await listedJobs(db, now)).map((job) => toCard(job, now));
  return { jobs: cards };
}

/** BR-05: a closed job still renders (200) with up to 3 similar open jobs. Only drafts are hidden. */
export async function getJobPage(db: Db, slug: string, now: Date): Promise<JobPageResponse> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.slug, slug) });
  if (!job || job.state === 'draft') throw notFound('Không tìm thấy tin tuyển dụng.');

  const others = (await listedJobs(db, now)).filter((other) => other.id !== job.id);
  const similar = [
    ...others.filter((other) => other.department === job.department),
    ...others.filter((other) => other.department !== job.department),
  ]
    .slice(0, SIMILAR_MAX)
    .map((other) => toCard(other, now));

  return { job: toDetail(job, now), similar };
}
