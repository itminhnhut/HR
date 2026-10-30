import { acceptsApplications, candidateCvBlock, effectiveStatus } from '@careers/shared';
import { and, eq } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { applications, jobs, type Candidate } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid, type MultipartBody } from '../lib/request.js';
import { sentWith } from './candidate-auth.js';
import { newCvFrom, replaceCv, type NewCv } from './cv-replace.js';

/**
 * "Cập nhật CV" from "Hồ sơ của tôi" (spec-cv-intake.md): only the signed-in owner (Google email = the application's
 * email), while HR has not decided, the job is open, and the candidate has changes left.
 */

/** The account's saved CV as a new file of its own, so later account changes never touch this application. */
async function savedCv(deps: Deps, candidate: Candidate): Promise<NewCv> {
  const stream = candidate.cvPathname ? await deps.cvStore.get(candidate.cvPathname) : null;
  if (!stream) throw invalid('Tài khoản chưa có CV đã lưu. Tải file hoặc dán link CV.', { cv: 'Chưa có CV đã lưu.' });
  const bytes = await new Response(stream).arrayBuffer();
  return { kind: 'file', file: new File([bytes], candidate.cvFileName ?? 'CV.pdf', { type: 'application/pdf' }) };
}

export async function candidateReplaceCv(deps: Deps, candidate: Candidate, id: string, body: MultipartBody) {
  const [row] = isUuid(id)
    ? await deps.db
        .select({ app: applications, job: jobs })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(and(eq(applications.id, id), sentWith(candidate.email)))
    : [];
  // Someone else's application answers like a missing one.
  if (!row) throw notFound('Không tìm thấy hồ sơ.');
  const block = candidateCvBlock({
    status: row.app.status,
    jobOpen: acceptsApplications(effectiveStatus(row.job, deps.now())),
    changes: row.app.candidateCvChanges,
  });
  if (block) throw new HttpError(409, block, {}, 'cv_locked');
  const cv = body.fields.useSavedCv === 'true' ? await savedCv(deps, candidate) : await newCvFrom(body);
  await replaceCv(deps, row.app, cv, 'candidate');
}
