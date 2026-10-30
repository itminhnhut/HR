import { cvLinkInputSchema, fieldErrors } from '@careers/shared';
import { eq, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import { applications, cvChanges, cvScores, type Application } from '../db/schema.js';
import { CV_PROBLEM_MESSAGE, checkCvFile, cvFileName, deleteFilesQuietly } from '../lib/cv-store.js';
import { invalid } from '../lib/http-error.js';
import type { MultipartBody } from '../lib/request.js';

/**
 * Replacing an application's CV (spec-cv-intake.md), for HR and for the candidate: only the newest CV is kept,
 * the history keeps who changed it, when and what it was, and the old score goes so the CV is scored again.
 */

/** "candidate" or the HR's name. */
export type CvChanger = 'candidate' | { hr: string };

/** A new CV: a PDF file or a link. */
export type NewCv = { kind: 'file'; file: File } | { kind: 'link'; link: string };

/** The CV sent in a multipart body: the file, else the "cvLink" field. Checked like the public form. */
export async function newCvFrom(body: MultipartBody): Promise<NewCv> {
  if (body.file) {
    const problem = await checkCvFile(body.file);
    if (problem) throw invalid(CV_PROBLEM_MESSAGE[problem], { cv: CV_PROBLEM_MESSAGE[problem] });
    return { kind: 'file', file: body.file };
  }
  const parsed = cvLinkInputSchema.safeParse({ cvLink: body.fields.cvLink });
  if (!parsed.success)
    throw invalid('Link CV chưa đúng.', { cv: fieldErrors(parsed.error).cvLink ?? 'Link CV chưa đúng.' });
  if (!parsed.data.cvLink)
    throw invalid('Chọn file CV hoặc dán link CV.', { cv: 'Chọn file CV (PDF) hoặc dán link CV.' });
  return { kind: 'link', link: parsed.data.cvLink };
}

const describe = (app: Pick<Application, 'cvFileName' | 'cvLink' | 'cvPathname'>) =>
  app.cvPathname ? (app.cvFileName ?? 'CV.pdf') : app.cvLink;

/** Stores the new CV on the application; the old file is deleted only once the change is saved. */
export async function replaceCv(deps: Deps, app: Application, cv: NewCv, by: CvChanger): Promise<void> {
  const { db, cvStore, now } = deps;
  const at = now();
  const pathname = cv.kind === 'file' ? await cvStore.put(app.jobId, cv.file) : null;
  const fileName = cv.kind === 'file' ? cvFileName(cv.file) : null;
  const changedBy = by === 'candidate' ? 'candidate' : by.hr;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(applications)
        .set({
          cvPathname: pathname,
          cvFileName: fileName,
          cvLink: cv.kind === 'link' ? cv.link : null,
          cvChangedAt: at,
          cvChangedBy: changedBy,
          cvChangeSeen: by !== 'candidate',
          ...(by === 'candidate' ? { candidateCvChanges: sql`${applications.candidateCvChanges} + 1` } : {}),
        })
        .where(eq(applications.id, app.id));
      await tx.insert(cvChanges).values({ applicationId: app.id, changedBy, previous: describe(app), at });
      // The score belongs to the old CV; the background scorer picks the application up again.
      await tx.delete(cvScores).where(eq(cvScores.applicationId, app.id));
    });
  } catch (error) {
    await deleteFilesQuietly(cvStore, [pathname]);
    throw error;
  }
  await deleteFilesQuietly(cvStore, [app.cvPathname]);
}
