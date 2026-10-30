import {
  fieldErrors,
  hrApplicationSchema,
  hrContactSchema,
  POLICY_VERSION,
  REFERRAL_SOURCE,
  type DuplicateApplicationDto,
  type HrMe,
} from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { applications, jobs } from '../db/schema.js';
import { CV_PROBLEM_MESSAGE, checkCvFile, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid, type MultipartBody } from '../lib/request.js';
import { newCvFrom, replaceCv } from './cv-replace.js';
import { checkUsableSource } from './sources.js';

/** HR's side of "Thêm và cập nhật CV" (spec-cv-intake.md). */

const hrName = (hr: HrMe) => hr.name || hr.email;

/** Multipart sends text: turn the tick box back into a boolean for the shared schema. */
const formToInput = (fields: Record<string, string>) => ({ ...fields, consent: fields.consent === 'true' });

async function parseNewApplication(body: MultipartBody) {
  const parsed = hrApplicationSchema.safeParse(formToInput(body.fields));
  const errors = parsed.success ? {} : fieldErrors(parsed.error);
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) errors.cv = CV_PROBLEM_MESSAGE[problem];
  }
  if (!parsed.success || Object.keys(errors).length > 0) throw invalid('Kiểm tra lại các ô được đánh dấu.', errors);
  return parsed.data;
}

/** The application of this phone for this job, if HR or the candidate already added one. */
async function existingFor(deps: Deps, jobId: string, phone: string): Promise<DuplicateApplicationDto | null> {
  const [row] = await deps.db
    .select({
      id: applications.id,
      fullName: applications.fullName,
      status: applications.status,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .where(and(eq(applications.jobId, jobId), eq(applications.phone, phone)))
    .limit(1);
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

/**
 * "Thêm hồ sơ": an application HR received outside the site. Starts as "Đã xem"; nothing is sent to the candidate.
 * 409 { code: "duplicate" } when this phone already applied for this job (HR updates that one instead).
 */
export async function addApplication(deps: Deps, body: MultipartBody, hr: HrMe): Promise<{ id: string }> {
  const input = await parseNewApplication(body);
  const job = await deps.db.query.jobs.findFirst({ where: eq(jobs.id, input.jobId) });
  if (!job) throw notFound('Không tìm thấy tin tuyển dụng.');
  if (job.state === 'draft')
    throw invalid('Tin còn là nháp, đăng tin trước rồi thêm hồ sơ.', { jobId: 'Tin còn là nháp.' });
  await checkUsableSource(deps.db, input.source);
  const duplicate = await existingFor(deps, job.id, input.phone);
  if (duplicate) throw duplicateError(duplicate);
  const at = deps.now();
  const pathname = body.file ? await deps.cvStore.put(job.id, body.file) : null;
  try {
    const [row] = await deps.db
      .insert(applications)
      .values({
        jobId: job.id,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        cvPathname: pathname,
        cvFileName: body.file ? cvFileName(body.file) : null,
        cvLink: pathname ? null : input.cvLink,
        note: input.note,
        noteUpdatedAt: input.note ? at : null,
        noteUpdatedBy: input.note ? hrName(hr) : null,
        status: 'seen',
        source: input.source,
        referrer: input.source === REFERRAL_SOURCE ? input.referrer : null,
        addedBy: hrName(hr),
        consentBy: hrName(hr),
        consentAt: at,
        policyVersion: POLICY_VERSION,
        createdAt: at,
      })
      .returning({ id: applications.id });
    return { id: row.id };
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
export async function updateContact(deps: Deps, id: string, raw: unknown): Promise<void> {
  const app = await findApplication(deps, id);
  if (!app.addedBy) {
    throw new HttpError(409, 'Hồ sơ ứng viên tự nộp giữ nguyên thông tin ứng viên gửi.', {}, 'candidate_sent');
  }
  const parsed = hrContactSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại các ô được đánh dấu.', fieldErrors(parsed.error));
  const { phone, email, source, referrer } = parsed.data;
  await checkUsableSource(deps.db, source, app.source);
  if (phone !== app.phone) {
    const duplicate = await existingFor(deps, app.jobId, phone);
    if (duplicate) throw duplicateError(duplicate);
  }
  await deps.db
    .update(applications)
    .set({ phone, email, source, referrer: source === REFERRAL_SOURCE ? referrer : null })
    .where(eq(applications.id, app.id));
}
