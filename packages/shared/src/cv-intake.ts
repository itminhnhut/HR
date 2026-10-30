import { z } from 'zod';
import type { ApplicationStatus } from './types.js';
import { phoneSchema } from './validation.js';

/**
 * "Thêm và cập nhật CV" (spec-cv-intake.md): HR adds applications received outside the site, HR adds or replaces a
 * CV, and a signed-in candidate updates the CV of an application already sent.
 */

/** Where an application came from. "website" = sent by the candidate through the form. */
export type ApplicationSource =
  'website' | 'email' | 'zalo' | 'referral' | 'topcv' | 'vietnamworks' | 'facebook' | 'other';

export const APPLICATION_SOURCE_LABEL: Record<ApplicationSource, string> = {
  website: 'Website',
  email: 'Email',
  zalo: 'Zalo',
  referral: 'Người giới thiệu',
  topcv: 'TopCV',
  vietnamworks: 'VietnamWorks',
  facebook: 'Facebook',
  other: 'Khác',
};

/** Sources HR can pick when adding an application (website is only the form). */
export const HR_SOURCES = ['email', 'zalo', 'referral', 'topcv', 'vietnamworks', 'facebook', 'other'] as const;
export type HrSource = (typeof HR_SOURCES)[number];

export const ALL_SOURCES: readonly ApplicationSource[] = ['website', ...HR_SOURCES];

export const isApplicationSource = (v: unknown): v is ApplicationSource =>
  typeof v === 'string' && (ALL_SOURCES as readonly string[]).includes(v);

/** How many times a candidate may replace the CV of one application. */
export const CANDIDATE_CV_CHANGES_MAX = 3;
export const REFERRER_MAX = 100;
export const NAME_MAX = 100;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullish()
    .transform((v) => (v ? v : null));

const email = z
  .union([z.literal(''), z.email('Email chưa đúng.')])
  .nullish()
  .transform((v) => (v ? v.trim().toLowerCase() : null));

export const cvLinkSchema = z
  .union([z.literal(''), z.url({ protocol: /^https?$/, message: 'Link CV phải bắt đầu bằng http:// hoặc https://' })])
  .nullish()
  .transform((v) => (v ? v : null));

/** "Ai giới thiệu" is needed only for a referral. */
const withReferrer = <T extends { source: HrSource; referrer: string | null }>(v: T, ctx: z.RefinementCtx) => {
  if (v.source === 'referral' && !v.referrer) {
    ctx.addIssue({ code: 'custom', path: ['referrer'], message: 'Ghi tên người giới thiệu.' });
  }
};

const contactFields = {
  phone: phoneSchema,
  email,
  source: z.enum(HR_SOURCES, { message: 'Chọn nguồn hồ sơ.' }),
  referrer: optionalText(REFERRER_MAX, `Tối đa ${REFERRER_MAX} ký tự.`),
};

/** "Thêm hồ sơ": text fields (the CV file comes separately, like the public form). */
export const hrApplicationSchema = z
  .object({
    jobId: z.uuid('Chọn vị trí ứng tuyển.'),
    fullName: z.string().trim().min(2, 'Nhập họ và tên.').max(NAME_MAX, 'Họ tên quá dài.'),
    ...contactFields,
    note: optionalText(2000, 'Ghi chú tối đa 2000 ký tự.'),
    cvLink: cvLinkSchema,
    /** HR confirms the candidate sent the CV to apply and agreed (Nghị định 13); the HR's name is stored. */
    consent: z.literal(true, { message: 'Xác nhận ứng viên đã đồng ý trước khi lưu.' }),
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
  if (a.status === 'interview' || a.status === 'rejected') return 'Hồ sơ đã được xử lý, liên hệ HR nếu cần gửi thêm.';
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
}
