import {
  addDays,
  effectiveStatus,
  fieldErrors,
  foldVietnamese,
  hasEnded,
  jobInputSchema,
  todayInVietnam,
  validateDeadline,
  type EffectiveStatus,
  type HrJobDto,
  type HrJobsResponse,
} from '@careers/shared';
import { and, count, eq, like, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, jobs, type Job, type NewJob } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { toHrJob } from './job-mappers.js';

export type JobAction = 'publish' | 'close';

const LIST_ORDER: Record<EffectiveStatus, number> = {
  expiring: 0,
  open: 1,
  draft: 2,
  expired: 3,
  closed: 4,
};

const DEADLINE_MESSAGE = {
  missing: 'Chọn hạn nộp.',
  past: 'Hạn nộp không được ở quá khứ.',
  too_far: 'Hạn nộp tối đa 60 ngày từ hôm nay.',
} as const;

export async function findJob(db: Db, id: string): Promise<Job> {
  const job = isUuid(id) ? await db.query.jobs.findFirst({ where: eq(jobs.id, id) }) : undefined;
  if (!job) throw notFound('Không tìm thấy tin.');
  return job;
}

export async function listHrJobs(db: Db, now: Date): Promise<HrJobsResponse> {
  const [rows, counts] = await Promise.all([
    db.select().from(jobs),
    db
      .select({
        jobId: applications.jobId,
        total: count(),
        fresh: sql<number>`count(*) filter (where ${applications.status} = 'new')`.mapWith(Number),
      })
      .from(applications)
      .groupBy(applications.jobId),
  ]);
  const byJob = new Map(counts.map((c) => [c.jobId, c]));
  const list = rows
    .map((job) => {
      const status = effectiveStatus(job, now);
      return {
        id: job.id,
        slug: job.slug,
        title: job.title,
        department: job.department,
        deadline: job.deadline,
        status,
        totalApplications: byJob.get(job.id)?.total ?? 0,
        newApplications: byJob.get(job.id)?.fresh ?? 0,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        createdAt: job.createdAt.getTime(),
      };
    })
    .sort((a, b) => LIST_ORDER[a.status] - LIST_ORDER[b.status] || b.createdAt - a.createdAt)
    .map(({ createdAt: _c, ...row }) => row);
  return {
    jobs: list,
    newApplications: counts.reduce((sum, c) => sum + c.fresh, 0),
    dueForDeletion: dueJobIds(rows, now).reduce((sum, id) => sum + (byJob.get(id)?.total ?? 0), 0),
  };
}

/** A real calendar date, so Postgres never sees "2026-02-30". */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function uniqueSlug(db: Db, title: string, selfId: string | null): Promise<string> {
  const base =
    foldVietnamese(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'viec-lam';
  const taken = await db
    .select({ slug: jobs.slug })
    .from(jobs)
    .where(and(like(jobs.slug, `${base}%`), selfId ? ne(jobs.id, selfId) : undefined));
  const used = new Set(taken.map((row) => row.slug));
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

function deadlineErrors(deadline: string, goesLive: boolean, now: Date): Record<string, string> {
  if (!goesLive) {
    return deadline && !isIsoDate(deadline) ? { deadline: 'Ngày chưa đúng.' } : {};
  }
  const problem = validateDeadline(deadline, now) ?? (isIsoDate(deadline) ? null : 'missing');
  return problem ? { deadline: DEADLINE_MESSAGE[problem] } : {};
}

/** Create (id = null) or update a job from the HR form. */
export async function saveJob(db: Db, id: string | null, raw: unknown, now: Date): Promise<HrJobDto> {
  const existing = id ? await findJob(db, id) : null;
  const parsed = jobInputSchema.safeParse(raw);
  const input = (raw ?? {}) as { intent?: unknown; deadline?: unknown };
  // A published job is validated like a publish, so an edit cannot dodge BR-01.
  const goesLive = input.intent === 'publish' || existing?.state === 'published';
  const deadline = typeof input.deadline === 'string' ? input.deadline.trim() : '';
  const errors = {
    ...(parsed.success ? {} : fieldErrors(parsed.error)),
    ...deadlineErrors(deadline, goesLive, now),
  };
  if (!parsed.success || Object.keys(errors).length > 0) {
    throw invalid('Chưa lưu được, kiểm tra các ô được đánh dấu.', errors);
  }

  const { intent, ...data } = parsed.data;
  const today = todayInVietnam(now);
  const values: Omit<NewJob, 'id'> = {
    ...data,
    // A published link never changes (BR-04).
    slug: existing?.publishedOn ? existing.slug : await uniqueSlug(db, data.title, existing?.id ?? null),
    deadline: data.deadline || existing?.deadline || addDays(today, 30),
    state: intent === 'publish' ? 'published' : (existing?.state ?? 'draft'),
    publishedOn: intent === 'publish' ? (existing?.publishedOn ?? today) : (existing?.publishedOn ?? null),
  };
  const [saved] = existing
    ? await db.update(jobs).set(values).where(eq(jobs.id, existing.id)).returning()
    : await db.insert(jobs).values(values).returning();
  return toHrJob(saved, now);
}

const ruleBroken = (message: string) => new HttpError(422, message);

function nextState(job: Job, action: JobAction, now: Date): Partial<NewJob> {
  const status = effectiveStatus(job, now);
  switch (action) {
    case 'publish':
      if (job.state !== 'draft') throw ruleBroken('Tin này đã được đăng.');
      if (validateDeadline(job.deadline, now)) throw ruleBroken('Hạn nộp chưa hợp lệ. Mở tin để sửa hạn nộp rồi đăng.');
      if (!job.responsibilities.trim() || !job.requirements.trim()) {
        throw ruleBroken('Nhập "Mô tả công việc" và "Yêu cầu" rồi đăng.');
      }
      return { state: 'published', publishedOn: job.publishedOn ?? todayInVietnam(now) };
    case 'close':
      if (job.state !== 'published') throw ruleBroken('Chỉ đóng được tin đang đăng.');
      // An expired job keeps its deadline as the end day.
      return { state: 'closed', closedOn: status === 'expired' ? job.deadline : todayInVietnam(now) };
  }
}

export async function runJobAction(db: Db, id: string, action: JobAction, now: Date): Promise<{ ok: true }> {
  const job = await findJob(db, id);
  await db
    .update(jobs)
    .set(nextState(job, action, now))
    .where(eq(jobs.id, job.id));
  return { ok: true };
}

/**
 * "Sửa hạn nộp": any job that was published (open, expired or closed) gets a new deadline,
 * at most 60 days from today, and takes applications again.
 */
export async function setDeadline(db: Db, id: string, raw: unknown, now: Date): Promise<{ ok: true }> {
  const job = await findJob(db, id);
  if (job.state === 'draft') throw ruleBroken('Bản nháp: mở tin để chọn hạn nộp rồi đăng.');
  const deadline =
    typeof (raw as { deadline?: unknown } | null)?.deadline === 'string'
      ? (raw as { deadline: string }).deadline.trim()
      : '';
  const errors = deadlineErrors(deadline, true, now);
  if (errors.deadline) throw invalid(errors.deadline, errors);
  await db.update(jobs).set({ deadline, state: 'published', closedOn: null }).where(eq(jobs.id, job.id));
  return { ok: true };
}

const DELETE_AFTER_DAYS = 30;

/** Jobs whose applications are due for deletion: ended (closed or expired) more than 30 days ago. */
export function dueJobIds(rows: Job[], now: Date): string[] {
  const cutoff = addDays(todayInVietnam(now), -DELETE_AFTER_DAYS);
  return rows
    .filter((job) => {
      const status = effectiveStatus(job, now);
      if (!hasEnded(status)) return false;
      const ended = status === 'closed' ? (job.closedOn ?? job.deadline) : job.deadline;
      return ended < cutoff;
    })
    .map((job) => job.id);
}

/** Only drafts can be deleted; anything that was public keeps its link and applications. */
export async function deleteDraft(db: Db, id: string): Promise<{ ok: true }> {
  const job = await findJob(db, id);
  if (job.state !== 'draft') throw ruleBroken('Chỉ xóa được bản nháp.');
  await db.delete(jobs).where(eq(jobs.id, job.id));
  return { ok: true };
}
