import {
  acceptsApplications,
  candidateStage,
  effectiveStatus,
  formatSalary,
  isListed,
  placeLabel,
  normalizeVietnamPhone,
  POLICY_VERSION,
  type CandidateMe,
  type CandidateOverview,
} from '@careers/shared';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { applications, candidates, jobs, subscribers, type Candidate } from '../db/schema.js';
import type { Deps } from '../deps.js';
import { checkCvFile, CV_PROBLEM_MESSAGE, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { invalid, notFound } from '../lib/http-error.js';
import type { MultipartBody } from '../lib/request.js';
import { sentWith, toCandidateMe } from './candidate-auth.js';
import { toCard } from './job-mappers.js';

export async function overview(db: Db, candidate: Candidate, now: Date): Promise<CandidateOverview> {
  const apps = await db
    .select({ app: getTableColumns(applications), job: getTableColumns(jobs) })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(sentWith(candidate.email))
    .orderBy(desc(applications.createdAt));
  return {
    me: await toCandidateMe(db, candidate),
    applications: apps.map(({ app, job }) => {
      const status = effectiveStatus(job, now);
      return {
        id: app.id,
        jobSlug: job.slug,
        jobTitle: job.title,
        salary: formatSalary(job),
        place: placeLabel(job.address),
        createdAt: app.createdAt.toISOString(),
        stage: candidateStage(app.status, !acceptsApplications(status)),
      };
    }),
  };
}

const NEEDS_PHONE = 'Nhập số điện thoại (Zalo) để nhận báo việc mới.';

const patchSchema = z.object({
  name: z.string().trim().max(100, 'Tên quá dài.').optional(),
  /** Empty string removes the number. */
  phone: z.string().trim().max(30).optional(),
  alertDepartments: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
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
  /** null removes the number. */
  phone?: string | null;
  alertDepartments?: string[];
  cv?: { pathname: string; fileName: string };
}

async function parseChanges(body: MultipartBody): Promise<Omit<ProfileChanges, 'cv'>> {
  const parsed = patchSchema.safeParse({
    ...body.fields,
    alertDepartments: parseDepartments(body.fields.alertDepartments),
  });
  if (!parsed.success) throw invalid('Kiểm tra lại thông tin.', { form: parsed.error.issues[0]?.message ?? '' });
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) throw invalid(CV_PROBLEM_MESSAGE[problem], { cv: CV_PROBLEM_MESSAGE[problem] });
  }
  const { phone: rawPhone, ...rest } = parsed.data;
  let phone: string | null | undefined;
  if (rawPhone !== undefined) {
    phone = rawPhone ? normalizeVietnamPhone(rawPhone) : null;
    if (rawPhone && !phone) {
      throw invalid('Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
    }
  }
  return {
    ...rest,
    ...(phone !== undefined ? { phone } : {}),
  };
}

/**
 * The account's own job alerts (BR-10), sent to the phone in its profile.
 * - `wanted` given: exactly those departments.
 * - Only the phone changes: the same departments move to the new number.
 * Consent time is kept for departments that were already on. Alerts without a phone are refused.
 */
async function syncAlerts(tx: Db, candidateId: string, phone: string | null, wanted: string[] | undefined, now: Date) {
  const own = await tx.select().from(subscribers).where(eq(subscribers.candidateId, candidateId));
  const departments = wanted ?? own.map((s) => s.department);
  if (departments.length > 0 && !phone) throw invalid(NEEDS_PHONE, { alertDepartments: NEEDS_PHONE });
  const consentedAt = new Map(own.map((s) => [s.department, s.consentAt]));
  await tx.delete(subscribers).where(eq(subscribers.candidateId, candidateId));
  if (!phone || departments.length === 0) return;
  await tx.insert(subscribers).values(
    departments.map((department) => ({
      phone,
      department,
      candidateId,
      consentAt: consentedAt.get(department) ?? now,
      policyVersion: POLICY_VERSION,
    })),
  );
}

async function saveProfile(db: Db, candidate: Candidate, changes: ProfileChanges, now: Date): Promise<void> {
  const { name, phone, alertDepartments, cv } = changes;
  const newPhone = phone === undefined ? candidate.phone : phone;
  await db.transaction(async (tx) => {
    if (alertDepartments !== undefined || newPhone !== candidate.phone) {
      await syncAlerts(tx, candidate.id, newPhone, alertDepartments, now);
    }
    const patch = {
      ...(name !== undefined ? { name: name || null } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(cv ? { cvPathname: cv.pathname, cvFileName: cv.fileName } : {}),
    };
    if (Object.keys(patch).length > 0) await tx.update(candidates).set(patch).where(eq(candidates.id, candidate.id));
  });
}

/** PATCH /candidate/me (multipart: name, phone, alertDepartments as JSON, cv). */
export async function updateCandidate(
  { db, cvStore, now }: Deps,
  candidate: Candidate,
  body: MultipartBody,
): Promise<CandidateMe> {
  const changes = await parseChanges(body);
  const cv = body.file
    ? { pathname: await cvStore.put('candidates', body.file), fileName: cvFileName(body.file) }
    : undefined;
  try {
    await saveProfile(db, candidate, { ...changes, cv }, now());
  } catch (error) {
    await deleteFilesQuietly(cvStore, [cv?.pathname ?? null]);
    throw error;
  }
  if (cv) await deleteFilesQuietly(cvStore, [candidate.cvPathname]);

  const fresh = await db.query.candidates.findFirst({ where: eq(candidates.id, candidate.id) });
  if (!fresh) throw notFound('Không tìm thấy tài khoản.');
  return toCandidateMe(db, fresh);
}

/** BR-14: a candidate's own deletion request removes everything right away, files included. */
export async function deleteCandidateData({ db, cvStore }: Deps, candidate: Candidate): Promise<{ ok: true }> {
  const appFiles = await db.select({ cv: applications.cvPathname }).from(applications).where(sentWith(candidate.email));
  const files = [...appFiles.map((f) => f.cv), candidate.cvPathname].filter((p): p is string => !!p);
  // Files first: if storage fails nothing is deleted and a retry finds everything again.
  // The other order could leave CVs (personal data) that no row points to any more.
  await cvStore.delete(files);
  await db.transaction(async (tx) => {
    await tx.delete(applications).where(sentWith(candidate.email));
    // The account's own alerts go with it (ON DELETE CASCADE).
    await tx.delete(candidates).where(eq(candidates.id, candidate.id));
  });
  return { ok: true };
}
