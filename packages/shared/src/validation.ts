import { z } from 'zod';
import { BENEFIT_MAX, MAX_BENEFITS, ROADMAP_ITEM_MAX, ROADMAP_MILESTONES } from './job-template.js';
import { normalizeVietnamPhone } from './phone.js';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeVietnamPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
      return z.NEVER;
    }
    return phone;
  });

export const DEPARTMENT_MAX = 60;
export const NOTE_MAX = 2000;
export const CV_MAX_BYTES = 4 * 1024 * 1024; // Vercel function body limit is 4.5 MB.
export const MESSAGE_MAX = 500;
export const POLICY_VERSION = '2026-10';

/** Text fields of the application form. The CV file is checked separately. */
export const applicationFieldsSchema = z.object({
  jobId: z.string().min(1),
  fullName: z.string().trim().min(2, 'Nhập họ và tên.').max(100, 'Họ tên quá dài.'),
  phone: phoneSchema,
  email: z
    .union([z.literal(''), z.email('Email chưa đúng.')])
    .nullish()
    .transform((v) => (v ? v : null)),
  message: optionalText(MESSAGE_MAX),
  cvLink: z
    .union([z.literal(''), z.url({ protocol: /^https?$/, message: 'Link CV phải bắt đầu bằng http:// hoặc https://' })])
    .nullish()
    .transform((v) => (v ? v : null)),
  /** BR-11: must be ticked by the candidate, never pre-ticked. */
  consent: z.literal(true, { message: 'Cần tích ô đồng ý đầu tiên để gửi hồ sơ.' }),
  formOpenedAt: z.number().int().positive(),
  /** Honeypot. Real users never see this field. */
  website: z.string().max(200).optional(),
});

export type ApplicationFields = z.input<typeof applicationFieldsSchema>;

export const subscribeSchema = z.object({
  phone: phoneSchema,
  department: z.string().trim().min(1).max(DEPARTMENT_MAX),
  fromJobId: z.string().nullish(),
  consent: z.literal(true, { message: 'Cần tích ô đồng ý để nhận tin.' }),
});

export const SALARY_MIN_VND = 1_000_000;
export const SALARY_MAX_VND = 500_000_000;
export const SALARY_STEP_VND = 100_000;

const money = z
  .number({ message: 'Nhập số tiền, ví dụ 15.000.000.' })
  .int('Nhập số tiền, ví dụ 15.000.000.')
  .min(SALARY_MIN_VND, 'Dưới 1.000.000 đ. Có thiếu số 0 không?')
  .max(SALARY_MAX_VND, 'Tối đa 500.000.000 đ.')
  .nullable();

export const jobInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Tên vị trí cần ít nhất 3 ký tự.').max(120, 'Tên vị trí tối đa 120 ký tự.'),
    department: z.string().trim().min(1, 'Nhập phòng ban.').max(DEPARTMENT_MAX, 'Phòng ban tối đa 60 ký tự.'),
    employmentType: z.enum(['full_time', 'part_time', 'internship'], { message: 'Chọn hình thức làm việc.' }),
    /** null: the company office. */
    address: optionalText(200),
    workingHours: optionalText(100),
    experience: optionalText(60),
    education: optionalText(60),
    salaryMin: money,
    salaryMax: money,
    responsibilities: z.string().trim().max(4000, 'Tối đa 4000 ký tự.'),
    requirements: z.string().trim().max(4000, 'Tối đa 4000 ký tự.'),
    benefits: z
      .array(z.string().trim().min(1).max(BENEFIT_MAX, `Mỗi quyền lợi tối đa ${BENEFIT_MAX} ký tự.`))
      .max(MAX_BENEFITS, `Tối đa ${MAX_BENEFITS} quyền lợi.`),
    roadmap: z.union([
      z
        .array(z.string().trim().max(ROADMAP_ITEM_MAX, `Mỗi mốc tối đa ${ROADMAP_ITEM_MAX} ký tự.`))
        .length(ROADMAP_MILESTONES.length),
      z.array(z.string()).length(0),
    ]),
    deadline: z.string().trim(),
    intent: z.enum(['draft', 'publish']),
  })
  .superRefine((job, ctx) => {
    // Drafts may be half-written; a published job needs the duties and the requirements.
    if (job.intent === 'publish' && !job.responsibilities) {
      ctx.addIssue({
        code: 'custom',
        path: ['responsibilities'],
        message: 'Nhập ít nhất một ý cho "Mô tả công việc".',
      });
    }
    if (job.intent === 'publish' && !job.requirements) {
      ctx.addIssue({ code: 'custom', path: ['requirements'], message: 'Nhập ít nhất một ý cho "Yêu cầu".' });
    }
    if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
      ctx.addIssue({ code: 'custom', path: ['salaryMax'], message: 'Lương "Đến" phải lớn hơn hoặc bằng lương "Từ".' });
    }
  });

export type JobInput = z.input<typeof jobInputSchema>;

export const applicationUpdateSchema = z.object({
  status: z.enum(['new', 'seen', 'interview', 'rejected']).optional(),
  /** ISO time of the interview; null clears it. */
  interviewAt: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().max(NOTE_MAX, `Ghi chú tối đa ${NOTE_MAX} ký tự.`).nullable().optional(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "Mẫu tin": company defaults for new jobs. */
export const jobTemplateSchema = z.object({
  workDays: z.string().trim().min(1).max(60),
  startTime: z.string().regex(HH_MM),
  endTime: z.string().regex(HH_MM),
  benefits: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(BENEFIT_MAX, `Mỗi quyền lợi tối đa ${BENEFIT_MAX} ký tự.`),
        standard: z.boolean(),
      }),
    )
    .max(30, 'Tối đa 30 quyền lợi.'),
  roadmap: z
    .array(z.string().trim().max(ROADMAP_ITEM_MAX, `Mỗi mốc tối đa ${ROADMAP_ITEM_MAX} ký tự.`))
    .length(ROADMAP_MILESTONES.length),
});
