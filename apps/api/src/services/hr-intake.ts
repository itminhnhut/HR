import {
  fieldErrors,
  hrApplicationSchema,
  hrContactSchema,
  HR_ADDED_NO_CONSENT,
  REFERRAL_SOURCE,
  type DuplicateApplicationDto,
  type HrMe,
} from '@careers/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { Db } from '../db/index.js';
import { applications, jobs, type NewApplication } from '../db/schema.js';
import { CV_PROBLEM_MESSAGE, checkCvFile, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid, type MultipartBody } from '../lib/request.js';
import { lockJobAndPhone } from './apply.js';
import { actorOf, logActivity } from './activity.js';
import { logStatus } from './status-log.js';
import { newCvFrom, replaceCv } from './cv-replace.js';
import { checkUsableSource } from './sources.js';

/** HR's side of "Thêm và cập nhật CV" (spec-cv-intake.md). */

const hrName = (hr: HrMe) => hr.name || hr.email;

/** Multipart sends text: turn the tick box back into a boolean for the shared schema. */

async function parseNewApplication(body: MultipartBody) {
  const parsed = hrApplicationSchema.safeParse(body.fields);
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) errors.cv = CV_PROBLEM_MESSAGE[problem];
  }
  if (!parsed.success || Object.keys(errors).length > 0) throw invalid('Kiểm tra lại các ô được đánh dấu.', errors);
  return parsed.data;
}

/** The newest application of this phone for this job, if HR or the candidate already added one. */
async function existingFor(db: Db, jobId: string, phone: string): Promise<DuplicateApplicationDto | null> {
  const [row] = await db
    .select({
      id: applications.id,
      fullName: applications.fullName,
      status: applications.status,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), eq(applications.phone, phone)))
    .orderBy(desc(applications.createdAt))
    .limit(1);
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

function newApplication(
  input: Awaited<ReturnType<typeof parseNewApplication>>,
  file: { pathname: string | null; name: string | null },
  hr: HrMe,
  at: Date,
): NewApplication {
  return {
    jobId: input.jobId,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    cvPathname: file.pathname,
    cvFileName: file.name,
    cvLink: file.pathname ? null : input.cvLink,
    note: input.note,
    noteUpdatedAt: input.note ? at : null,
    noteUpdatedBy: input.note ? hrName(hr) : null,
    status: 'seen',
    source: input.source,
    referrer: input.source === REFERRAL_SOURCE ? input.referrer : null,
    addedBy: hrName(hr),
    // HR added it and nobody confirmed a consent: the record says so instead of claiming one.
    consentBy: null,
    consentAt: at,
    policyVersion: HR_ADDED_NO_CONSENT,
    createdAt: at,
  };
}

/**
 * "Thêm hồ sơ": an application HR received outside the site. Starts as "Đã xem"; nothing is sent to the candidate.
 * 409 { code: "duplicate" } when this phone already applied for this job (HR updates that one instead).
 * The first check spares an upload; the one that counts runs under the lock, so a slow upload never holds it and two
 * forms sent together cannot both pass. A refused form leaves no file behind.
 */
export async function addApplication(deps: Deps, body: MultipartBody, hr: HrMe): Promise<{ id: string }> {
  const input = await parseNewApplication(body);
  const job = await deps.db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng.');
  if (job.state === 'draft')
    throw invalid('Tin còn là nháp, đăng tin trước rồi thêm hồ sơ.', { jobId: 'Tin còn là nháp.' });
  await checkUsableSource(deps.db, input.source);
  const earlier = await existingFor(deps.db, job.id, input.phone);
  if (earlier) throw duplicateError(earlier);
  const at = deps.now();
  const pathname = body.file ? await deps.cvStore.put(job.id, body.file) : null;
  const file = { pathname, name: body.file ? cvFileName(body.file) : null };
  try {
    return await deps.db.transaction(async (tx) => {
      await lockJobAndPhone(tx, job.id, input.phone);
      const duplicate = await existingFor(tx, job.id, input.phone);
      if (duplicate) throw duplicateError(duplicate);
      const [row] = await tx
        .insert(applications)
        .values(newApplication(input, file, hr, at))
        .returning();
      await logStatus(tx, row, 'new', null, at);
      return { id: row.id };
    });
  } catch (error) {
    await deleteFilesQuietly(deps.cvStore, [pathname]);
    throw error;
  }
}

const duplicateError = (existing: DuplicateApplicationDto) =>
  new HttpError(409, `Đã có hồ sơ của ${existing.fullName} cho vị trí này.`, {}, 'duplicate', { existing });

async function findApplication(deps: Deps, id: string) {
  const app = isUuid(id) ? await deps.db.query.applications.findFirst({ where: eq(applications.id, id) }) : undefined;
  if (!app) throw notFound('Không tìm thấy hồ sơ.');
  return app;
}

/** "Thêm CV" / "Đổi CV" by HR, on any application. */
export async function hrReplaceCv(deps: Deps, id: string, body: MultipartBody, hr: HrMe): Promise<void> {
  const app = await findApplication(deps, id);
  await replaceCv(deps, app, await newCvFrom(body), { hr: hrName(hr) });
}

/** Contact details and source of an application HR added; the candidate's own applications keep what they sent. */
export async function updateContact(deps: Deps, id: string, raw: unknown, hr: HrMe): Promise<void> {
  const app = await findApplication(deps, id);
  if (!app.addedBy) {
    throw new HttpError(409, 'Hồ sơ ứng viên tự nộp giữ nguyên thông tin ứng viên gửi.', {}, 'candidate_sent');
  }
  const parsed = hrContactSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại các ô được đánh dấu.', fieldErrors(parsed.error));
  const { phone, email, source, referrer } = parsed.data;
  await checkUsableSource(deps.db, source, app.source);
  await deps.db.transaction(async (tx) => {
    // Same lock as adding one: two edits at once cannot both take a phone that is free when each looks.
    if (phone !== app.phone) {
      await lockJobAndPhone(tx, app.jobId, phone);
      const duplicate = await existingFor(tx, app.jobId, phone);
      if (duplicate) throw duplicateError(duplicate);
    }
    await tx
      .update(applications)
      .set({ phone, email, source, referrer: source === REFERRAL_SOURCE ? referrer : null })
      .where(eq(applications.id, app.id));
    for (const [field, from, to] of [
      ['phone', app.phone, phone],
      ['email', app.email, email ?? null],
      ['source', app.source, source],
    ] as const) {
      if (from !== to) {
        await logActivity(tx, { applicationId: app.id, kind: 'contact', actor: actorOf(hr), from, to, detail: field });
      }
    }
  });
}
