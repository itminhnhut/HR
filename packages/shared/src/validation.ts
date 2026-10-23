import { z } from 'zod';
import { DEPARTMENTS } from './format.js';
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
  /** BR-09: optional second purpose. */
  keepForOtherJobs: z.boolean(),
  formOpenedAt: z.number().int().positive(),
  /** Honeypot. Real users never see this field. */
  website: z.string().max(200).optional(),
});

export type ApplicationFields = z.input<typeof applicationFieldsSchema>;

export const subscribeSchema = z.object({
  phone: phoneSchema,
  department: z.enum(DEPARTMENTS),
  fromJobId: z.string().nullish(),
  consent: z.literal(true, { message: 'Cần tích ô đồng ý để nhận tin.' }),
});

const money = z.number().int().min(0).max(1000).nullable();

export const jobInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Nhập tên vị trí.').max(120),
    department: z.enum(DEPARTMENTS),
    employmentType: z.enum(['full_time', 'part_time', 'internship', 'contract']),
    remote: z.boolean(),
    city: z.string().trim().min(2, 'Nhập thành phố.').max(60),
    address: optionalText(200),
    workingHours: optionalText(100),
    level: optionalText(60),
    experience: optionalText(60),
    education: optionalText(60),
    language: optionalText(60),
    headcount: z.number().int().min(1).max(999).nullable(),
    salaryMin: money,
    salaryMax: money,
    salaryNote: optionalText(60),
    skills: z.array(z.string().trim().min(1).max(40)).max(6, 'Tối đa 6 kỹ năng.'),
    summary: optionalText(600),
    teamNote: optionalText(200),
    responsibilities: z.string().trim().max(4000),
    requirements: z.string().trim().max(4000),
    niceToHave: z.string().trim().max(4000),
    benefitIncome: z.string().trim().max(2000),
    benefitInsurance: z.string().trim().max(2000),
    benefitTimeOff: z.string().trim().max(2000),
    benefitGrowth: z.string().trim().max(2000),
    benefitEnvironment: z.string().trim().max(2000),
    plan30: optionalText(300),
    plan60: optionalText(300),
    plan90: optionalText(300),
    deadline: z.string().trim(),
    intent: z.enum(['draft', 'publish']),
  })
  .superRefine((job, ctx) => {
    // Drafts may be half-written; a published job needs at least the duties.
    if (job.intent === 'publish' && !job.responsibilities) {
      ctx.addIssue({ code: 'custom', path: ['responsibilities'], message: 'Nhập ít nhất một ý cho "Bạn sẽ làm gì".' });
    }
    if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
      ctx.addIssue({
        code: 'custom',
        path: ['salaryMax'],
        message: 'Lương "đến" phải lớn hơn hoặc bằng lương "từ".',
      });
    }
  });

export type JobInput = z.input<typeof jobInputSchema>;

export const applicationUpdateSchema = z.object({
  status: z.enum(['new', 'seen', 'interview', 'passed', 'rejected']).optional(),
  note: z.string().max(2000).nullable().optional(),
  thanked: z.boolean().optional(),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
