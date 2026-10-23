import {
  addDays,
  applicationUpdateSchema,
  effectiveStatus,
  extendedDeadline,
  fieldErrors,
  jobInputSchema,
  todayInVietnam,
  validateDeadline,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationsResponse,
  type ApplicationStatus,
  type EffectiveStatus,
  type HrJobRowDto,
  type HrJobsResponse,
  type JobInput,
  type SubscriberDto,
} from '@careers/shared';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { applications, jobs, subscribers, type Job, type NewJob } from '../db/schema.js';
import { readCv } from '../lib/cv-storage.js';
import { toHrJob } from '../lib/mappers.js';
import { requireHr, type HrEnv } from '../lib/session.js';
import { slugify } from '../lib/slug.js';

export const hrRoutes = new Hono<HrEnv>();
hrRoutes.use('*', requireHr);
hrRoutes.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'private, no-store');
});

const DEADLINE_MESSAGE = {
  missing: 'Chọn hạn nộp.',
  past: 'Hạn nộp không được ở quá khứ.',
  too_far: 'Hạn nộp tối đa 60 ngày kể từ hôm nay.',
} as const;

async function findJob(id: string): Promise<Job | undefined> {
  const [job] = await getDb().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return job;
}

function jobColumns(input: JobInput): Omit<NewJob, 'slug' | 'state'> {
  return {
    title: input.title,
    department: input.department,
    employmentType: input.employmentType,
    remote: input.remote,
    city: input.city,
    address: input.address,
    workingHours: input.workingHours,
    experience: input.experience,
    headcount: input.headcount,
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    salaryNote: input.salaryNote,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    benefits: input.benefits,
    plan30: input.plan30,
    plan60: input.plan60,
    plan90: input.plan90,
    deadline: input.deadline,
  };
}

async function parseJobInput(body: unknown) {
  const parsed = jobInputSchema.safeParse(body);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) } as const;
  const problem = validateDeadline(parsed.data.deadline);
  if (problem) return { errors: { deadline: DEADLINE_MESSAGE[problem] } } as const;
  return { input: parsed.data } as const;
}

/* ---------- Jobs ---------- */

hrRoutes.get('/jobs', async (c) => {
  const db = getDb();
  const now = new Date();
  const [allJobs, counts] = await Promise.all([
    db.select().from(jobs).orderBy(desc(jobs.createdAt)),
    db
      .select({
        jobId: applications.jobId,
        total: count(),
        fresh: sql<number>`count(*) filter (where ${applications.status} = 'new')`.mapWith(Number),
      })
      .from(applications)
      .groupBy(applications.jobId),
  ]);
  const byJob = new Map(counts.map((row) => [row.jobId, row]));
  const rows: HrJobRowDto[] = allJobs.map((job) => ({
    id: job.id,
    slug: job.slug,
    title: job.title,
    department: job.department,
    deadline: job.deadline,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryNote: job.salaryNote,
    status: effectiveStatus(job, now),
    totalApplications: byJob.get(job.id)?.total ?? 0,
    newApplications: byJob.get(job.id)?.fresh ?? 0,
  }));
  const body: HrJobsResponse = { jobs: rows };
  return c.json(body);
});

hrRoutes.get('/jobs/:id', async (c) => {
  const job = await findJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Không tìm thấy tin.' }, 404);
  return c.json(toHrJob(job));
});

hrRoutes.post('/jobs', async (c) => {
  const result = await parseJobInput(await c.req.json().catch(() => null));
  if ('errors' in result)
    return c.json({ error: 'Kiểm tra lại thông tin tin tuyển dụng.', fieldErrors: result.errors }, 400);
  const { input } = result;
  const publish = input.intent === 'publish';
  const [job] = await getDb()
    .insert(jobs)
    .values({
      ...jobColumns(input),
      slug: slugify(input.title),
      state: publish ? 'published' : 'draft',
      publishedAt: publish ? new Date() : null,
    })
    .returning();
  return c.json(toHrJob(job!), 201);
});

hrRoutes.put('/jobs/:id', async (c) => {
  const job = await findJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Không tìm thấy tin.' }, 404);
  const result = await parseJobInput(await c.req.json().catch(() => null));
  if ('errors' in result)
    return c.json({ error: 'Kiểm tra lại thông tin tin tuyển dụng.', fieldErrors: result.errors }, 400);
  const { input } = result;

  if (input.intent === 'draft' && job.state !== 'draft') {
    return c.json({ error: 'Tin đã đăng không chuyển về bản nháp được. Dùng Tạm dừng nếu muốn ẩn tin.' }, 400);
  }
  const state = job.state === 'draft' && input.intent === 'publish' ? 'published' : job.state;
  const [updated] = await getDb()
    .update(jobs)
    .set({
      ...jobColumns(input),
      state,
      publishedAt: job.publishedAt ?? (state === 'published' ? new Date() : null),
      // A new deadline needs a new reminder (BR-03).
      reminderSentAt: input.deadline === job.deadline ? job.reminderSentAt : null,
    })
    .where(eq(jobs.id, job.id))
    .returning();
  return c.json(toHrJob(updated!));
});

hrRoutes.delete('/jobs/:id', async (c) => {
  const job = await findJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Không tìm thấy tin.' }, 404);
  if (job.state !== 'draft') return c.json({ error: 'Chỉ xóa được bản nháp.' }, 400);
  await getDb().delete(jobs).where(eq(jobs.id, job.id));
  return c.json({ ok: true });
});

type JobAction = 'extend' | 'pause' | 'resume' | 'fill' | 'repost';

const ALLOWED_FROM: Record<JobAction, EffectiveStatus[]> = {
  extend: ['expiring', 'expired'],
  pause: ['open', 'expiring'],
  resume: ['paused'],
  fill: ['open', 'expiring', 'paused', 'expired'],
  repost: ['expired', 'filled'],
};

hrRoutes.post('/jobs/:id/:action{extend|pause|resume|fill|repost}', async (c) => {
  const action = c.req.param('action') as JobAction;
  const job = await findJob(c.req.param('id'));
  if (!job) return c.json({ error: 'Không tìm thấy tin.' }, 404);
  const status = effectiveStatus(job);
  if (!ALLOWED_FROM[action].includes(status)) {
    return c.json({ error: 'Thao tác này không áp dụng cho trạng thái hiện tại của tin.' }, 409);
  }
  const db = getDb();

  if (action === 'repost') {
    // BR-04: a new hiring round is a new job with its own link; old applications stay put.
    const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ...copy } = job;
    const [draft] = await db
      .insert(jobs)
      .values({
        ...copy,
        slug: slugify(job.title),
        state: 'draft',
        publishedAt: null,
        reminderSentAt: null,
        deadline: addDays(todayInVietnam(), 30),
      })
      .returning();
    return c.json(toHrJob(draft!), 201);
  }

  const patch: Partial<NewJob> =
    action === 'extend'
      ? { state: 'published', deadline: extendedDeadline(job.deadline), reminderSentAt: null }
      : action === 'pause'
        ? { state: 'paused' }
        : action === 'resume'
          ? { state: 'published' }
          : { state: 'filled' };
  const [updated] = await db.update(jobs).set(patch).where(eq(jobs.id, job.id)).returning();
  return c.json(toHrJob(updated!));
});

/* ---------- Applications ---------- */

const STATUSES: ApplicationStatus[] = ['new', 'seen', 'interview', 'passed', 'rejected'];

hrRoutes.get('/applications', async (c) => {
  const db = getDb();
  const status = c.req.query('status');
  const jobId = c.req.query('jobId');
  const jobFilter = jobId ? eq(applications.jobId, jobId) : undefined;
  const statusFilter =
    status && STATUSES.includes(status as ApplicationStatus)
      ? eq(applications.status, status as ApplicationStatus)
      : undefined;

  const [rows, statusCounts, jobList] = await Promise.all([
    db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        jobTitle: jobs.title,
        fullName: applications.fullName,
        phone: applications.phone,
        status: applications.status,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(and(jobFilter, statusFilter))
      .orderBy(desc(applications.createdAt))
      .limit(300),
    db
      .select({ status: applications.status, total: count() })
      .from(applications)
      .where(jobFilter)
      .groupBy(applications.status),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).orderBy(desc(jobs.createdAt)),
  ]);

  const counts = Object.fromEntries([['all', 0], ...STATUSES.map((s) => [s, 0])]) as ApplicationsResponse['counts'];
  for (const row of statusCounts) {
    counts[row.status] = row.total;
    counts.all += row.total;
  }
  const body: ApplicationsResponse = {
    applications: rows.map((row): ApplicationRowDto => ({ ...row, createdAt: row.createdAt.toISOString() })),
    counts,
    jobs: jobList,
  };
  return c.json(body);
});

hrRoutes.get('/applications/:id', async (c) => {
  const [row] = await getDb()
    .select({ app: applications, jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, c.req.param('id')))
    .limit(1);
  if (!row) return c.json({ error: 'Không tìm thấy hồ sơ.' }, 404);
  const { app } = row;
  const body: ApplicationDetailDto = {
    id: app.id,
    jobId: app.jobId,
    jobTitle: row.jobTitle,
    fullName: app.fullName,
    phone: app.phone,
    status: app.status,
    createdAt: app.createdAt.toISOString(),
    email: app.email,
    message: app.message,
    hasCvFile: Boolean(app.cvPathname),
    cvFileName: app.cvFileName,
    cvLink: app.cvLink,
    note: app.note,
  };
  return c.json(body);
});

hrRoutes.patch('/applications/:id', async (c) => {
  const parsed = applicationUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  const [updated] = await getDb()
    .update(applications)
    .set(parsed.data)
    .where(eq(applications.id, c.req.param('id')))
    .returning({ id: applications.id, status: applications.status, note: applications.note });
  if (!updated) return c.json({ error: 'Không tìm thấy hồ sơ.' }, 404);
  return c.json(updated);
});

/** Streams a CV from the PRIVATE blob store. Auth is checked by requireHr above. */
hrRoutes.get('/applications/:id/cv', async (c) => {
  const [app] = await getDb()
    .select({ cvPathname: applications.cvPathname, fullName: applications.fullName })
    .from(applications)
    .where(eq(applications.id, c.req.param('id')))
    .limit(1);
  if (!app?.cvPathname) return c.json({ error: 'Hồ sơ không có file CV.' }, 404);

  const result = await readCv(app.cvPathname);
  if (!result || result.statusCode !== 200) return c.json({ error: 'Không đọc được file CV.' }, 404);

  const fileName = `CV-${app.fullName}.pdf`;
  return new Response(result.stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});

/* ---------- Subscribers ---------- */

hrRoutes.get('/subscribers', async (c) => {
  const rows = await getDb().select().from(subscribers).orderBy(desc(subscribers.createdAt));
  const body: SubscriberDto[] = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  return c.json(body);
});

hrRoutes.delete('/subscribers/:id', async (c) => {
  await getDb()
    .delete(subscribers)
    .where(eq(subscribers.id, c.req.param('id')));
  return c.json({ ok: true });
});
