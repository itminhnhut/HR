import {
  applicationFieldsSchema,
  canSubmit,
  fieldErrors,
  isListed,
  lastName,
  subscribeSchema,
  type ApplyResponse,
  type JobCardDto,
  type JobListResponse,
  type JobPageResponse,
} from '@careers/shared';
import { and, desc, eq, gte, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { getDb } from '../db/index.js';
import { applications, jobs, subscribers, type Job } from '../db/schema.js';
import { CV_PROBLEM_MESSAGE, checkCvFile, deleteCvs, storeCv } from '../lib/cv-storage.js';
import { toJobCard, toJobDetail } from '../lib/mappers.js';
import { notifyNewApplication } from '../lib/notify.js';

const DEDUPE_DAYS = 30; // BR-07

export const publicRoutes = new Hono();

async function listedJobs(now: Date): Promise<Job[]> {
  const rows = await getDb().select().from(jobs).where(eq(jobs.state, 'published')).orderBy(desc(jobs.publishedAt));
  return rows.filter((job) => isListed(toJobCard(job, now).status));
}

function matchesType(card: JobCardDto, type: string | undefined): boolean {
  if (!type) return true;
  if (type === 'remote') return card.remote;
  return card.employmentType === type;
}

function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

publicRoutes.get('/jobs', async (c) => {
  const now = new Date();
  const { department, type, city, q } = c.req.query();
  const cards = (await listedJobs(now)).map((job) => toJobCard(job, now));
  const needle = q ? normalizeSearch(q.trim()) : '';

  const filtered = cards.filter(
    (card) =>
      (!department || card.department === department) &&
      (!city || card.city === city) &&
      matchesType(card, type) &&
      (!needle || normalizeSearch(`${card.title} ${card.department}`).includes(needle)),
  );

  const body: JobListResponse = {
    jobs: filtered,
    cities: [...new Set(cards.map((card) => card.city))].sort((a, b) => a.localeCompare(b, 'vi')),
  };
  c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return c.json(body);
});

publicRoutes.get('/jobs/:slug', async (c) => {
  const now = new Date();
  const [job] = await getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.slug, c.req.param('slug')), ne(jobs.state, 'draft')))
    .limit(1);
  if (!job) return c.json({ error: 'Không tìm thấy vị trí này.' }, 404);

  // BR-05: suggest up to 3 open jobs, same department first, then same city.
  const others = (await listedJobs(now)).filter((other) => other.id !== job.id);
  const score = (other: Job) => (other.department === job.department ? 2 : 0) + (other.city === job.city ? 1 : 0);
  const similar = others
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)
    .map((other) => toJobCard(other, now));

  const body: JobPageResponse = { job: toJobDetail(job, now), similar };
  c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  return c.json(body);
});

publicRoutes.post('/applications', async (c) => {
  const form = await c.req.parseBody();
  const parsed = applicationFieldsSchema.safeParse(form);
  if (!parsed.success) {
    return c.json({ error: 'Kiểm tra lại thông tin.', fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  const input = parsed.data;
  if (input.website) return c.json({ error: 'Không gửi được hồ sơ.' }, 400); // honeypot hit

  const cvFile = form.cv instanceof File && form.cv.size > 0 ? form.cv : null;
  if (!cvFile && !input.cvLink) {
    return c.json({ error: 'Thiếu CV.', fieldErrors: { cv: 'Đính kèm file CV hoặc dán link CV.' } }, 400);
  }
  if (cvFile) {
    const problem = await checkCvFile(cvFile);
    if (problem)
      return c.json({ error: 'File CV chưa hợp lệ.', fieldErrors: { cv: CV_PROBLEM_MESSAGE[problem] } }, 400);
  }

  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
  if (!job || !canSubmit(job, new Date(input.formOpenedAt))) {
    return c.json({ error: 'Vị trí này đã ngừng nhận hồ sơ. Thông tin bạn nhập vẫn được giữ trên màn hình.' }, 409);
  }

  // BR-07: same phone + same job within 30 days updates the earlier application.
  const since = new Date(Date.now() - DEDUPE_DAYS * 24 * 60 * 60 * 1000);
  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.jobId, job.id), eq(applications.phone, input.phone), gte(applications.createdAt, since)))
    .limit(1);

  const cvPathname = cvFile ? await storeCv(job.id, cvFile) : null;
  const values = {
    fullName: input.fullName,
    phone: input.phone,
    message: input.message,
    cvLink: input.cvLink,
    consentAt: new Date(),
    ...(cvFile ? { cvPathname, cvFileName: cvFile.name.slice(0, 200) } : {}),
  };

  if (existing) {
    await db
      .update(applications)
      .set({ ...values, status: 'new' })
      .where(eq(applications.id, existing.id));
    if (cvFile && existing.cvPathname) await deleteCvs([existing.cvPathname]).catch(() => undefined);
  } else {
    await db.insert(applications).values({ jobId: job.id, ...values });
  }

  await notifyNewApplication({ jobTitle: job.title, fullName: input.fullName, phone: input.phone });

  const body: ApplyResponse = {
    ok: true,
    firstName: lastName(input.fullName),
    phone: input.phone,
    updatedExisting: Boolean(existing),
  };
  return c.json(body, existing ? 200 : 201);
});

publicRoutes.post('/subscribers', async (c) => {
  const parsed = subscribeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'Kiểm tra lại số Zalo.', fieldErrors: fieldErrors(parsed.error) }, 400);
  }
  await getDb().insert(subscribers).values(parsed.data).onConflictDoNothing();
  return c.json({ ok: true }, 201);
});
