import {
  acceptsApplications,
  addDays,
  daysBetween,
  effectiveStatus,
  extendTarget,
  fieldErrors,
  foldVietnamese,
  formatDate,
  jobInputSchema,
  MAX_OPEN_DAYS,
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

export type JobAction = 'publish' | 'extend' | 'pause' | 'resume' | 'fill';

const LIST_ORDER: Record<EffectiveStatus, number> = {
  expiring: 0,
  open: 1,
  paused: 2,
  draft: 3,
  expired: 4,
  filled: 5,
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
        salaryNote: job.salaryNote,
        extendTo: canExtend(status) ? extendTarget(job.deadline, job.publishedOn, now) : null,
        createdAt: job.createdAt.getTime(),
      };
    })
    .sort((a, b) => LIST_ORDER[a.status] - LIST_ORDER[b.status] || b.createdAt - a.createdAt)
    .map(({ createdAt: _c, ...row }) => row);
  return { jobs: list, newApplications: counts.reduce((sum, c) => sum + c.fresh, 0) };
}

const canExtend = (status: EffectiveStatus) => status === 'expiring' || status === 'expired';

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

function deadlineErrors(existing: Job | null, deadline: string, goesLive: boolean, now: Date): Record<string, string> {
  if (!goesLive) {
    return deadline && !isIsoDate(deadline) ? { deadline: 'Ngày chưa đúng.' } : {};
  }
  const problem = validateDeadline(deadline, now) ?? (isIsoDate(deadline) ? null : 'missing');
  if (problem) return { deadline: DEADLINE_MESSAGE[problem] };
  // BR-18: editing a live job cannot stretch it past 60 days from its first publish.
  if (existing?.publishedOn && daysBetween(existing.publishedOn, deadline) > MAX_OPEN_DAYS) {
    return {
      deadline: `Tin đăng ngày ${formatDate(existing.publishedOn)} chỉ nhận hồ sơ tối đa 60 ngày. Muốn tuyển tiếp hãy "Đăng lại".`,
    };
  }
  return {};
}

/** Create (id = null) or update a job from the HR form. */
export async function saveJob(db: Db, id: string | null, raw: unknown, now: Date): Promise<HrJobDto> {
  const existing = id ? await findJob(db, id) : null;
  const parsed = jobInputSchema.safeParse(raw);
  const input = (raw ?? {}) as { intent?: unknown; deadline?: unknown };
  // Live and paused jobs are validated like a publish, so an edit cannot dodge BR-01/BR-18.
  const goesLive = input.intent === 'publish' || (existing !== null && existing.state !== 'draft');
  const deadline = typeof input.deadline === 'string' ? input.deadline.trim() : '';
  const errors = {
    ...(parsed.success ? {} : fieldErrors(parsed.error)),
    ...deadlineErrors(existing, deadline, goesLive, now),
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
      if (!job.responsibilities.trim()) throw ruleBroken('Nhập ít nhất một ý cho "Bạn sẽ làm gì" rồi đăng.');
      return { state: 'published', publishedOn: job.publishedOn ?? todayInVietnam(now) };
    case 'extend': {
      if (!canExtend(status)) throw ruleBroken('Chỉ gia hạn được tin sắp hết hạn hoặc đã hết hạn.');
      const target = extendTarget(job.deadline, job.publishedOn, now);
      if (!target) throw ruleBroken('Tin đã mở đủ 60 ngày. Dùng "Đăng lại" để tuyển đợt mới.');
      return { deadline: target, state: 'published' };
    }
    case 'pause':
      if (!acceptsApplications(status)) throw ruleBroken('Chỉ tạm dừng được tin đang tuyển.');
      return { state: 'paused' };
    case 'resume':
      // BR-19: a paused job past its deadline is expired and cannot simply reopen.
      if (status !== 'paused') throw ruleBroken('Tin này không ở trạng thái tạm dừng.');
      return { state: 'published' };
    case 'fill':
      if (status === 'draft' || status === 'filled') throw ruleBroken('Chỉ đóng được tin đã đăng.');
      return { state: 'filled' };
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

/** Only drafts can be deleted; anything that was public keeps its link and applications. */
export async function deleteDraft(db: Db, id: string): Promise<{ ok: true }> {
  const job = await findJob(db, id);
  if (job.state !== 'draft') throw ruleBroken('Chỉ xóa được bản nháp.');
  await db.delete(jobs).where(eq(jobs.id, job.id));
  return { ok: true };
}
