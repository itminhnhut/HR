import {
  addDays,
  applicationFieldsSchema,
  acceptsApplications,
  effectiveStatus,
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
import {
  applications,
  jobs,
  subscribers,
  type Application,
  type Candidate,
  type Job,
  type NewApplication,
} from '../db/schema.js';
import { checkCvFile, CV_PROBLEM_MESSAGE, cvFileName, deleteFilesQuietly, type CvStore } from '../lib/cv-store.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid, type MultipartBody } from '../lib/request.js';

export const DEDUPE_DAYS = 30; // BR-07

/** Multipart sends everything as text; turn it back into what the shared schema expects. */
function formToInput(fields: Record<string, string>) {
  return {
    ...fields,
    consent: fields.consent === 'true',
    formOpenedAt: Number(fields.formOpenedAt),
  };
}

async function validate(body: MultipartBody, savedCv: SavedCv | null) {
  const parsed = applicationFieldsSchema.safeParse(formToInput(body.fields));
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (body.fields.useSavedCv === 'true' && !savedCv)
    errors.cv = 'Tài khoản chưa có CV đã lưu. Tải file hoặc dán link CV.';
  else if (!savedCv && !body.file && !body.fields.cvLink?.trim()) errors.cv = 'Đính kèm file CV hoặc dán link CV.';
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

async function openJobOrFail(db: Db, jobId: string, at: Date): Promise<Job> {
  const job = isUuid(jobId) ? await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }) : undefined;
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng.');
  if (!acceptsApplications(effectiveStatus(job, at))) {
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
      // The new submission replaces the content but keeps HR's status and note (BR-07);
      // the new time moves it to the top of HR's list.
      await tx
        .update(applications)
        .set({ ...record, createdAt: at })
        .where(eq(applications.id, existing.id));
    } else {
      await tx.insert(applications).values({ ...record, jobId, createdAt: at });
    }
    return existing;
  });
}

interface SavedCv {
  pathname: string;
  fileName: string;
}

/** The account's saved CV, when the form asks for it and the candidate is signed in and has one. */
function savedCvOf(body: MultipartBody, account: Candidate | null): SavedCv | null {
  if (body.fields.useSavedCv !== 'true' || !account?.cvPathname) return null;
  return { pathname: account.cvPathname, fileName: account.cvFileName ?? 'CV.pdf' };
}

/**
 * Each application keeps its own copy of the CV, so replacing or deleting the account CV later
 * never breaks an application that was already sent.
 */
async function copySavedCv(cvStore: CvStore, saved: SavedCv, folder: string): Promise<string> {
  const stream = await cvStore.get(saved.pathname);
  if (!stream) throw invalid('Không đọc được CV đã lưu. Tải lại file CV.', { cv: 'Không đọc được CV đã lưu.' });
  const bytes = await new Response(stream).arrayBuffer();
  return cvStore.put(folder, new File([bytes], saved.fileName, { type: 'application/pdf' }));
}

/**
 * `account`: the signed-in candidate, if any. Their Google email replaces whatever the form sent, so the
 * application always shows up in their account; their saved CV can be reused (one CV per account).
 */
export async function apply(
  { db, cvStore, now }: Deps,
  body: MultipartBody,
  account: Candidate | null = null,
): Promise<ApplyResponse> {
  const savedCv = savedCvOf(body, account);
  const input = await validate(body, savedCv);
  const accountEmail = account?.email ?? null;
  // Honeypot: bots get a success they cannot tell apart, nothing is stored.
  if (input.website) return { ok: true, firstName: '', phone: '', updatedExisting: false, previousDate: null };
  const at = now();
  const job = await openJobOrFail(db, input.jobId, at);

  const cvPathname = body.file
    ? await cvStore.put(job.id, body.file)
    : savedCv
      ? await copySavedCv(cvStore, savedCv, job.id)
      : null;
  const record: ApplicationRecord = {
    fullName: input.fullName,
    phone: input.phone,
    email: accountEmail ?? input.email,
    message: input.message,
    cvPathname,
    cvFileName: body.file ? cvFileName(body.file) : (savedCv?.fileName ?? null),
    cvLink: input.cvLink,
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
