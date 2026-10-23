import {
  acceptsApplications,
  candidateStage,
  DEPARTMENTS,
  effectiveStatus,
  formatSalary,
  isListed,
  locationLabel,
  POLICY_VERSION,
  type CandidateMe,
  type CandidateOverview,
} from '@careers/shared';
import { and, desc, eq, getTableColumns, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { applications, candidates, jobs, otpCodes, savedJobs, subscribers, type Candidate } from '../db/schema.js';
import type { Deps } from '../deps.js';
import { checkCvFile, CV_PROBLEM_MESSAGE, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { invalid, notFound } from '../lib/http-error.js';
import type { MultipartBody } from '../lib/request.js';
import { toCandidateMe } from './candidate-auth.js';
import { toCard } from './job-mappers.js';

export async function overview(db: Db, candidate: Candidate, now: Date): Promise<CandidateOverview> {
  const [apps, saved] = await Promise.all([
    db
      .select({ app: getTableColumns(applications), job: getTableColumns(jobs) })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(eq(applications.phone, candidate.phone))
      .orderBy(desc(applications.createdAt)),
    db
      .select(getTableColumns(jobs))
      .from(savedJobs)
      .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
      .where(eq(savedJobs.phone, candidate.phone))
      .orderBy(desc(savedJobs.createdAt)),
  ]);
  return {
    me: await toCandidateMe(db, candidate),
    applications: apps.map(({ app, job }) => {
      const status = effectiveStatus(job, now);
      return {
        id: app.id,
        jobSlug: job.slug,
        jobTitle: job.title,
        salary: formatSalary(job),
        place: locationLabel(job),
        createdAt: app.createdAt.toISOString(),
        stage: candidateStage(app.status, !acceptsApplications(status) && status !== 'paused'),
      };
    }),
    saved: saved.filter((job) => isListed(effectiveStatus(job, now))).map((job) => toCard(job, now)),
  };
}

const patchSchema = z.object({
  name: z.string().trim().max(100, 'Tên quá dài.').optional(),
  keepForOtherJobs: z.enum(['true', 'false']).optional(),
  alertDepartments: z.array(z.enum(DEPARTMENTS)).max(DEPARTMENTS.length).optional(),
});

function parseDepartments(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw invalid('Danh sách phòng ban không đọc được.', { alertDepartments: 'Danh sách phòng ban không hợp lệ.' });
  }
}

interface ProfileChanges {
  name?: string;
  keepForOtherJobs?: boolean;
  alertDepartments?: string[];
  cv?: { pathname: string; fileName: string };
}

async function saveProfile(db: Db, phone: string, changes: ProfileChanges, now: Date): Promise<void> {
  const { name, keepForOtherJobs, alertDepartments, cv } = changes;
  await db.transaction(async (tx) => {
    const patch = {
      ...(name !== undefined ? { name: name || null } : {}),
      ...(keepForOtherJobs !== undefined ? { keepForOtherJobs } : {}),
      ...(cv ? { cvPathname: cv.pathname, cvFileName: cv.fileName } : {}),
    };
    if (Object.keys(patch).length > 0) await tx.update(candidates).set(patch).where(eq(candidates.phone, phone));
    // BR-14: withdrawing the "keep for other jobs" consent applies to every application at once.
    if (keepForOtherJobs !== undefined) {
      await tx.update(applications).set({ keepForOtherJobs }).where(eq(applications.phone, phone));
    }
    if (alertDepartments) {
      const others = alertDepartments.length > 0 ? notInArray(subscribers.department, alertDepartments) : undefined;
      await tx.delete(subscribers).where(and(eq(subscribers.phone, phone), others));
      if (alertDepartments.length > 0) {
        await tx
          .insert(subscribers)
          .values(
            alertDepartments.map((department) => ({
              phone,
              department,
              consentAt: now,
              policyVersion: POLICY_VERSION,
            })),
          )
          .onConflictDoNothing();
      }
    }
  });
}

/** PATCH /candidate/me (multipart: name, keepForOtherJobs, alertDepartments as JSON, cv). */
export async function updateCandidate(
  { db, cvStore, now }: Deps,
  candidate: Candidate,
  body: MultipartBody,
): Promise<CandidateMe> {
  const parsed = patchSchema.safeParse({
    ...body.fields,
    alertDepartments: parseDepartments(body.fields.alertDepartments),
  });
  if (!parsed.success) throw invalid('Kiểm tra lại thông tin.', { form: parsed.error.issues[0]?.message ?? '' });
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) throw invalid(CV_PROBLEM_MESSAGE[problem], { cv: CV_PROBLEM_MESSAGE[problem] });
  }
  const { keepForOtherJobs, ...rest } = parsed.data;
  const cv = body.file
    ? { pathname: await cvStore.put('candidates', body.file), fileName: cvFileName(body.file) }
    : undefined;
  const changes: ProfileChanges = {
    ...rest,
    ...(keepForOtherJobs !== undefined ? { keepForOtherJobs: keepForOtherJobs === 'true' } : {}),
    cv,
  };
  try {
    await saveProfile(db, candidate.phone, changes, now());
  } catch (error) {
    await deleteFilesQuietly(cvStore, [cv?.pathname ?? null]);
    throw error;
  }
  if (cv) await deleteFilesQuietly(cvStore, [candidate.cvPathname]);

  const fresh = await db.query.candidates.findFirst({ where: eq(candidates.phone, candidate.phone) });
  if (!fresh) throw notFound('Không tìm thấy tài khoản.');
  return toCandidateMe(db, fresh);
}

export async function savedSlugs(db: Db, phone: string): Promise<string[]> {
  const rows = await db
    .select({ slug: jobs.slug })
    .from(savedJobs)
    .innerJoin(jobs, eq(jobs.id, savedJobs.jobId))
    .where(eq(savedJobs.phone, phone))
    .orderBy(desc(savedJobs.createdAt));
  return rows.map((row) => row.slug);
}

export async function setSaved(db: Db, phone: string, slug: string, saved: boolean): Promise<string[]> {
  const job = await db.query.jobs.findFirst({ where: eq(jobs.slug, slug) });
  if (!job || job.state === 'draft') throw notFound('Không tìm thấy tin tuyển dụng.');
  if (saved) await db.insert(savedJobs).values({ phone, jobId: job.id }).onConflictDoNothing();
  else await db.delete(savedJobs).where(and(eq(savedJobs.phone, phone), eq(savedJobs.jobId, job.id)));
  return savedSlugs(db, phone);
}

/** BR-14: a candidate's own deletion request removes everything right away, files included. */
export async function deleteCandidateData({ db, cvStore }: Deps, phone: string): Promise<{ ok: true }> {
  const [appFiles, account] = await Promise.all([
    db.select({ cv: applications.cvPathname }).from(applications).where(eq(applications.phone, phone)),
    db.query.candidates.findFirst({ where: eq(candidates.phone, phone) }),
  ]);
  const files = [...appFiles.map((f) => f.cv), account?.cvPathname ?? null].filter((p): p is string => !!p);
  // Files first: if storage fails nothing is deleted and a retry finds everything again.
  // The other order could leave CVs (personal data) that no row points to any more.
  await cvStore.delete(files);
  await db.transaction(async (tx) => {
    await tx.delete(applications).where(eq(applications.phone, phone));
    await tx.delete(candidates).where(eq(candidates.phone, phone));
    await tx.delete(subscribers).where(eq(subscribers.phone, phone));
    await tx.delete(otpCodes).where(eq(otpCodes.phone, phone));
  });
  return { ok: true };
}
