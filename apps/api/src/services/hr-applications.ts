import {
  applicationUpdateSchema,
  fieldErrors,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationsResponse,
  type ApplicationStatus,
  type SubscriberDto,
} from '@careers/shared';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applications, jobs, subscribers, type Application } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';

const STATUSES: ApplicationStatus[] = ['new', 'seen', 'interview', 'passed', 'rejected'];

type ApplicationWithJob = Application & { jobTitle: string };

const withJobTitle = (db: Db) =>
  db
    .select({ ...getTableColumns(applications), jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId));

function toRow(a: ApplicationWithJob): ApplicationRowDto {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: a.jobTitle,
    fullName: a.fullName,
    phone: a.phone,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

function toDetail(a: ApplicationWithJob): ApplicationDetailDto {
  return {
    ...toRow(a),
    email: a.email,
    message: a.message,
    cvFileName: a.cvFileName,
    cvLink: a.cvLink,
    note: a.note,
    keepForOtherJobs: a.keepForOtherJobs,
    thankedAt: a.thankedAt?.toISOString() ?? null,
  };
}

export async function listApplications(db: Db, jobId: string | undefined): Promise<ApplicationsResponse> {
  if (jobId !== undefined && !isUuid(jobId)) {
    return { applications: [], counts: { all: 0, new: 0, seen: 0, interview: 0, passed: 0, rejected: 0 }, jobs: [] };
  }
  const [rows, jobsWithApplications] = await Promise.all([
    withJobTitle(db)
      .where(jobId ? eq(applications.jobId, jobId) : undefined)
      .orderBy(desc(applications.createdAt)),
    db
      .selectDistinct({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .innerJoin(applications, eq(applications.jobId, jobs.id))
      .orderBy(jobs.title),
  ]);
  const counts = {
    all: rows.length,
    ...Object.fromEntries(STATUSES.map((s) => [s, 0])),
  } as ApplicationsResponse['counts'];
  for (const row of rows) counts[row.status] += 1;
  return { applications: rows.map(toRow), counts, jobs: jobsWithApplications };
}

async function findApplication(db: Db, id: string): Promise<ApplicationWithJob> {
  const [row] = isUuid(id) ? await withJobTitle(db).where(eq(applications.id, id)) : [];
  if (!row) throw notFound('Không tìm thấy hồ sơ.');
  return row;
}

/** Opening an application marks it "seen" so the candidate sees "HR đã xem". */
export async function openApplication(db: Db, id: string): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  if (row.status !== 'new') return toDetail(row);
  await db
    .update(applications)
    .set({ status: 'seen' })
    .where(and(eq(applications.id, id), eq(applications.status, 'new')));
  return toDetail({ ...row, status: 'seen' });
}

export async function updateApplication(db: Db, id: string, raw: unknown, now: Date): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  const parsed = applicationUpdateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  const { status, note, thanked } = parsed.data;
  const patch = {
    ...(status ? { status } : {}),
    ...(note !== undefined ? { note: note?.trim() || null } : {}),
    ...(thanked ? { thankedAt: now } : {}),
  };
  if (Object.keys(patch).length === 0) return toDetail(row);
  const [updated] = await db.update(applications).set(patch).where(eq(applications.id, id)).returning();
  return toDetail({ ...updated, jobTitle: row.jobTitle });
}

export async function cvOf(db: Db, id: string): Promise<{ pathname: string; fullName: string }> {
  const row = await findApplication(db, id);
  if (!row.cvPathname) throw notFound('Hồ sơ không có file CV.');
  return { pathname: row.cvPathname, fullName: row.fullName };
}

export async function listSubscribers(db: Db): Promise<SubscriberDto[]> {
  const rows = await db
    .select({
      id: subscribers.id,
      phone: subscribers.phone,
      department: subscribers.department,
      fromJobTitle: jobs.title,
      createdAt: subscribers.createdAt,
    })
    .from(subscribers)
    .leftJoin(jobs, eq(jobs.id, subscribers.fromJobId))
    .orderBy(desc(subscribers.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Idempotent: deleting a number that is already gone still answers ok. */
export async function deleteSubscriber(db: Db, id: string): Promise<{ ok: true }> {
  if (isUuid(id)) await db.delete(subscribers).where(eq(subscribers.id, id));
  return { ok: true };
}
