import {
  addDays,
  applicationFieldsSchema,
  canSubmit,
  fieldErrors,
  lastName,
  POLICY_VERSION,
  subscribeSchema,
  todayInVietnam,
  type ApplyResponse,
} from '@careers/shared';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { Db } from '../db/index.js';
import { applications, jobs, subscribers, type Application, type Job, type NewApplication } from '../db/schema.js';
import { checkCvFile, CV_PROBLEM_MESSAGE, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid, type MultipartBody } from '../lib/request.js';

export const DEDUPE_DAYS = 30; // BR-07

/** Multipart sends everything as text; turn it back into what the shared schema expects. */
function formToInput(fields: Record<string, string>) {
  return {
    ...fields,
    consent: fields.consent === 'true',
    keepForOtherJobs: fields.keepForOtherJobs === 'true',
    formOpenedAt: Number(fields.formOpenedAt),
  };
}

async function validate(body: MultipartBody) {
  const parsed = applicationFieldsSchema.safeParse(formToInput(body.fields));
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (!body.file && !body.fields.cvLink?.trim()) errors.cv = 'Đính kèm file CV hoặc dán link CV.';
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) errors.cv = CV_PROBLEM_MESSAGE[problem];
  }
  if (!parsed.success || Object.keys(errors).length > 0) throw invalid('Kiểm tra lại các ô được đánh dấu.', errors);
  return parsed.data;
}

/** Start of the Vietnam day DEDUPE_DAYS ago: BR-07 counts calendar days like the mock. */
function dedupeSince(now: Date): Date {
  return new Date(`${addDays(todayInVietnam(now), -DEDUPE_DAYS)}T00:00:00.000+07:00`);
}

async function openJobOrFail(db: Db, jobId: string, formOpenedAt: number, at: Date): Promise<Job> {
  const job = isUuid(jobId) ? await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }) : undefined;
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng.');
  if (!canSubmit(job, new Date(formOpenedAt), at)) {
    throw new HttpError(
      409,
      'Vị trí này vừa ngừng nhận hồ sơ. Thông tin bạn nhập vẫn còn, xem vị trí tương tự bên dưới.',
      {},
      'job_closed',
    );
  }
  return job;
}

type ApplicationRecord = Omit<NewApplication, 'id' | 'jobId' | 'status' | 'createdAt'>;

/** Inserts, or updates the application from the last 30 days (BR-07). Returns the replaced one, if any. */
async function upsertApplication(db: Db, jobId: string, record: ApplicationRecord, at: Date) {
  return db.transaction(async (tx) => {
    // Serialize submissions for the same job and phone, so a double click cannot create two applications.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${jobId}:${record.phone}`}))`);
    const [existing] = await tx
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.jobId, jobId),
          eq(applications.phone, record.phone),
          gte(applications.createdAt, dedupeSince(at)),
        ),
      )
      .orderBy(desc(applications.createdAt))
      .limit(1);
    if (existing) {
      // The new submission replaces the earlier one and goes back to "new".
      await tx
        .update(applications)
        .set({ ...record, status: 'new', createdAt: at })
        .where(eq(applications.id, existing.id));
    } else {
      await tx.insert(applications).values({ ...record, jobId, createdAt: at });
    }
    return existing;
  });
}

export async function apply({ db, cvStore, now }: Deps, body: MultipartBody): Promise<ApplyResponse> {
  const input = await validate(body);
  // Honeypot: bots get a success they cannot tell apart, nothing is stored.
  if (input.website) return { ok: true, firstName: '', phone: '', updatedExisting: false, previousDate: null };
  const at = now();
  const job = await openJobOrFail(db, input.jobId, input.formOpenedAt, at);

  const cvPathname = body.file ? await cvStore.put(job.id, body.file) : null;
  const record: ApplicationRecord = {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    message: input.message,
    cvPathname,
    cvFileName: body.file ? cvFileName(body.file) : null,
    cvLink: input.cvLink,
    keepForOtherJobs: input.keepForOtherJobs,
    consentAt: at,
    policyVersion: POLICY_VERSION,
  };
  let previous: Application | undefined;
  try {
    previous = await upsertApplication(db, job.id, record, at);
  } catch (error) {
    await deleteFilesQuietly(cvStore, [cvPathname]);
    throw error;
  }
  if (previous && previous.cvPathname !== cvPathname) await deleteFilesQuietly(cvStore, [previous.cvPathname]);

  return {
    ok: true,
    firstName: lastName(input.fullName),
    phone: input.phone,
    updatedExisting: !!previous,
    previousDate: previous ? previous.createdAt.toISOString() : null,
  };
}

export async function subscribe({ db, now }: Deps, raw: unknown): Promise<{ ok: true }> {
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại thông tin.', fieldErrors(parsed.error));
  const { phone, department, fromJobId } = parsed.data;
  const fromJob = isUuid(fromJobId) ? await db.query.jobs.findFirst({ where: eq(jobs.id, fromJobId) }) : undefined;
  await db
    .insert(subscribers)
    .values({
      phone,
      department,
      fromJobId: fromJob?.id ?? null,
      consentAt: now(),
      policyVersion: POLICY_VERSION,
    })
    .onConflictDoNothing();
  return { ok: true };
}
