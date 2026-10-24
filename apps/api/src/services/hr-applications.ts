import {
  applicationUpdateSchema,
  fieldErrors,
  matchesQuery,
  type ApplicationDetailDto,
  type ApplicationRowDto,
  type ApplicationsResponse,
  type ApplicationStatus,
  type HrMe,
  type SubscriberDto,
} from '@careers/shared';
import { and, desc, eq, getTableColumns, inArray, ne } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { Db } from '../db/index.js';
import { applications, jobs, subscribers, type Application } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { dueJobIds } from './hr-jobs.js';

const STATUSES: ApplicationStatus[] = ['new', 'seen', 'interview', 'rejected'];

type ApplicationWithJob = Application & { jobTitle: string };

const withJobTitle = (db: Db) =>
  db
    .select({ ...getTableColumns(applications), jobTitle: jobs.title })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId));

const firstLine = (text: string | null) =>
  text
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim() ?? null;

function toRow(a: ApplicationWithJob): ApplicationRowDto {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: a.jobTitle,
    fullName: a.fullName,
    phone: a.phone,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    hasCv: !!(a.cvPathname || a.cvLink),
    noteLine: firstLine(a.note),
    interviewAt: a.interviewAt?.toISOString() ?? null,
  };
}

async function toDetail(db: Db, a: ApplicationWithJob): Promise<ApplicationDetailDto> {
  const others = await withJobTitle(db)
    .where(and(eq(applications.phone, a.phone), ne(applications.id, a.id)))
    .orderBy(desc(applications.createdAt));
  return {
    ...toRow(a),
    email: a.email,
    message: a.message,
    cvFileName: a.cvFileName,
    cvLink: a.cvLink,
    note: a.note,
    noteUpdatedAt: a.noteUpdatedAt?.toISOString() ?? null,
    noteUpdatedBy: a.noteUpdatedBy,
    otherApplications: others.map((o) => ({
      id: o.id,
      jobTitle: o.jobTitle,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

const emptyCounts = (): ApplicationsResponse['counts'] =>
  ({ all: 0, ...Object.fromEntries(STATUSES.map((s) => [s, 0])) }) as ApplicationsResponse['counts'];

/** `q`: name or phone, any order, without tones ("huy 0797" finds Phạm Quốc Huy, 0797 586 611). */
export async function listApplications(db: Db, jobId: string | undefined, q = ''): Promise<ApplicationsResponse> {
  if (jobId !== undefined && !isUuid(jobId)) return { applications: [], counts: emptyCounts(), jobs: [] };
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
  const digits = q.replace(/\D/g, '');
  const found = rows.filter(
    (row) => matchesQuery(`${row.fullName} ${row.phone}`, q) || (digits.length >= 3 && row.phone.includes(digits)),
  );
  const counts = emptyCounts();
  counts.all = found.length;
  for (const row of found) counts[row.status] += 1;
  return { applications: found.map(toRow), counts, jobs: jobsWithApplications };
}

async function findApplication(db: Db, id: string): Promise<ApplicationWithJob> {
  const [row] = isUuid(id) ? await withJobTitle(db).where(eq(applications.id, id)) : [];
  if (!row) throw notFound('Không tìm thấy hồ sơ.');
  return row;
}

/** Opening an application marks it "seen" (the candidate sees "HR đã xem"). */
export async function openApplication(db: Db, id: string): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  if (row.status !== 'new') return toDetail(db, row);
  await db.update(applications).set({ status: 'seen' }).where(eq(applications.id, id));
  return toDetail(db, { ...row, status: 'seen' });
}

export async function updateApplication(
  db: Db,
  id: string,
  raw: unknown,
  now: Date,
  hr: HrMe,
): Promise<ApplicationDetailDto> {
  const row = await findApplication(db, id);
  const parsed = applicationUpdateSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Dữ liệu không hợp lệ.', fieldErrors(parsed.error));
  const { status, note, interviewAt } = parsed.data;
  // An interview time only belongs to "Hẹn phỏng vấn".
  if (interviewAt && (status ?? row.status) !== 'interview') {
    throw invalid('Chỉ hồ sơ "Hẹn phỏng vấn" mới có giờ phỏng vấn.', { interviewAt: 'Chọn "Hẹn phỏng vấn" trước.' });
  }
  const noteChanged = note !== undefined && (note?.trim() || null) !== row.note;
  const patch = {
    ...(status ? { status } : {}),
    // Leaving "Hẹn phỏng vấn" drops the interview time.
    ...(status && status !== 'interview' ? { interviewAt: null } : {}),
    ...(interviewAt !== undefined ? { interviewAt: interviewAt ? new Date(interviewAt) : null } : {}),
    ...(noteChanged ? { note: note?.trim() || null, noteUpdatedAt: now, noteUpdatedBy: hr.name || hr.email } : {}),
  };
  if (Object.keys(patch).length === 0) return toDetail(db, row);
  const [updated] = await db.update(applications).set(patch).where(eq(applications.id, id)).returning();
  return toDetail(db, { ...updated, jobTitle: row.jobTitle });
}

export async function cvOf(db: Db, id: string): Promise<{ pathname: string; fullName: string }> {
  const row = await findApplication(db, id);
  if (!row.cvPathname) throw notFound('Hồ sơ không có file CV.');
  return { pathname: row.cvPathname, fullName: row.fullName };
}

/** Files first: if storage fails nothing is deleted, and a retry finds everything again. */
async function deleteWithFiles({ db, cvStore }: Deps, rows: Pick<Application, 'id' | 'cvPathname'>[]) {
  await cvStore.delete(rows.map((r) => r.cvPathname).filter((p): p is string => !!p));
  if (rows.length > 0)
    await db.delete(applications).where(
      inArray(
        applications.id,
        rows.map((r) => r.id),
      ),
    );
}

/** "Xoá hồ sơ": the candidate asked, or HR does not need it any more. CV file included. */
export async function deleteApplication(deps: Deps, id: string): Promise<{ ok: true }> {
  const row = await findApplication(deps.db, id);
  await deleteWithFiles(deps, [row]);
  return { ok: true };
}

/** "Xoá hồ sơ đến hạn": every application of a job that ended more than 30 days ago. */
export async function deleteDueApplications(deps: Deps): Promise<{ deleted: number }> {
  const ids = dueJobIds(await deps.db.select().from(jobs), deps.now());
  if (ids.length === 0) return { deleted: 0 };
  const rows = await deps.db
    .select({ id: applications.id, cvPathname: applications.cvPathname })
    .from(applications)
    .where(inArray(applications.jobId, ids));
  await deleteWithFiles(deps, rows);
  return { deleted: rows.length };
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
