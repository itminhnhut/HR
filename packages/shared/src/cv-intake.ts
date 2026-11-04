import { z } from 'zod';
import type { ApplicationStatus } from './types.js';
import { REFERRAL_SOURCE, SOURCE_KEY_MAX } from './sources.js';
import {
  cvLinkSchema,
  fullNameSchema,
  hasNoNul,
  NOTE_MAX,
  NUL_MESSAGE,
  optionalEmailSchema,
  phoneSchema,
} from './validation.js';

/**
 * "Thêm và cập nhật CV" (spec-cv-intake.md): HR adds applications received outside the site, HR adds or replaces a
 * CV, and a signed-in candidate updates the CV of an application already sent.
 */

/**
 * Where an application came from: the key of a row of HR's source list (spec-custom-sources.md). "website" = sent
 * by the candidate through the form; HR adds and renames the others.
 */
export type ApplicationSource = string;

/** How many times a candidate may replace the CV of one application. */
export const CANDIDATE_CV_CHANGES_MAX = 3;
export const REFERRER_MAX = 100;

/** Why a link has no score: the server stores a link and never opens it. */
export const CV_LINK_NOTE = 'CV là link, không đọc được tự động: HR mở link để xem.';

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .refine(hasNoNul, NUL_MESSAGE)
    .nullish()
    .transform((v) => (v ? v : null));

const email = optionalEmailSchema.transform((v) => (v ? v.toLowerCase() : null));

/**
 * "Ai giới thiệu" counts only for a referral: under another source its box is hidden, so whatever was left in it can
 * neither be seen nor corrected, and the server does not keep it.
 */
const withReferrer = <T extends { source: string; referrer: string | null }>(v: T, ctx: z.RefinementCtx) => {
  if (v.source !== REFERRAL_SOURCE) return;
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['referrer'], message });
  if (!v.referrer) issue('Ghi tên người giới thiệu.');
  else if (v.referrer.length > REFERRER_MAX) issue(`Tối đa ${REFERRER_MAX} ký tự.`);
  else if (!hasNoNul(v.referrer)) issue(NUL_MESSAGE);
};

const contactFields = {
  phone: phoneSchema,
  email,
  /** A key of the source list; the server checks it exists, is not "website" and is not hidden. */
  source: z
    .string({ message: 'Chọn nguồn hồ sơ.' })
    .trim()
    .min(1, 'Chọn nguồn hồ sơ.')
    .max(SOURCE_KEY_MAX, 'Nguồn không hợp lệ.')
    .refine(hasNoNul, 'Nguồn không hợp lệ.'),
  referrer: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
};

/** "Thêm hồ sơ": text fields (the CV file comes separately, like the public form). */
export const hrApplicationSchema = z
  .object({
    jobId: z.uuid('Chọn vị trí ứng tuyển.'),
    fullName: fullNameSchema,
    ...contactFields,
    note: optionalText(NOTE_MAX, `Ghi chú tối đa ${NOTE_MAX} ký tự.`),
    cvLink: cvLinkSchema,
  })
  .superRefine(withReferrer);
export type HrApplicationInput = z.input<typeof hrApplicationSchema>;

/** Contact details of an application HR added (a candidate's own application keeps what they sent). */
export const hrContactSchema = z.object(contactFields).superRefine(withReferrer);
export type HrContactInput = z.input<typeof hrContactSchema>;

/** A new CV given as a link (a file comes as multipart instead). */
export const cvLinkInputSchema = z.object({ cvLink: cvLinkSchema });

/**
 * Why the candidate cannot replace this application's CV, or null when they can: HR has not decided yet, the job
 * still takes applications, and the candidate has changes left.
 */
export function candidateCvBlock(a: { status: ApplicationStatus; jobOpen: boolean; changes: number }): string | null {
  if (a.status !== 'new' && a.status !== 'seen') return 'Hồ sơ đã được xử lý, liên hệ HR nếu cần gửi thêm.';
  if (!a.jobOpen) return 'Tin đã đóng, liên hệ HR nếu cần gửi thêm.';
  if (a.changes >= CANDIDATE_CV_CHANGES_MAX) {
    return `Đã cập nhật CV tối đa ${CANDIDATE_CV_CHANGES_MAX} lần, liên hệ HR nếu cần.`;
  }
  return null;
}

/** One line of "Lịch sử CV": who replaced it, when, and what it was before (the old file itself is deleted). */
export interface CvChangeDto {
  /** "Ứng viên" or the HR's name. */
  by: string;
  at: string;
  /** File name or link of the CV that was replaced; null when there was none. */
  previous: string | null;
}

/** HR's answer when the application already exists for this phone and job. */
export interface DuplicateApplicationDto {
  id: string;
  fullName: string;
  status: ApplicationStatus;
  createdAt: string;
}

/**
 * "Đọc CV" in "Thêm hồ sơ": contact details read from a PDF to pre-fill the form (the file is not stored).
 * readable is false when the PDF has no text layer (a scan), and then every field is null.
 */
export interface ParsedCvDto {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  readable: boolean;
  /** Why a file that is not a scan could not be read (locked, broken): a sentence for HR, in Vietnamese. */
  problem?: string;
}
