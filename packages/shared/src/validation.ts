import { z } from 'zod';
import { MAX_REPORT_DAYS, REJECT_NOTE_MAX, REJECT_REASON_KEYS } from './hiring.js';
import { daysBetween } from './job-status.js';
import {
  BENEFIT_MAX,
  CHOICE_MAX,
  CHOICES_MAX,
  DEFAULT_JOB_TEMPLATE,
  MAX_BENEFITS,
  OPENINGS_MAX,
  OPENINGS_MIN,
  ROADMAP_ITEM_MAX,
  ROADMAP_MILESTONES,
} from './job-template.js';
import { CALLOUT_TITLE_MAX, SUBJECT_MAX, TEMPLATE_BODY_MAX, TEMPLATE_SECTION_MAX } from './message-templates.js';
import { normalizeVietnamPhone } from './phone.js';

/** Postgres cannot store a NUL character: refused here, it would answer a server error instead. */
export const hasNoNul = (value: string) => !value.includes('\0');
export const NUL_MESSAGE = 'Có ký tự không hợp lệ, gõ lại giúp.';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(hasNoNul, NUL_MESSAGE)
    .nullish()
    .transform((v) => (v ? v : null));

// The form sends no field for an empty box: "message" also answers a missing value.
export const phoneSchema = z
  .string({ message: 'Nhập số điện thoại (Zalo).' })
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeVietnamPhone(value);
    if (!phone) {
      // Empty asks for the number; typed but wrong says what is wrong.
      const message = value ? 'Số điện thoại chưa đúng, cần 10 số, ví dụ 0912 345 678.' : 'Nhập số điện thoại (Zalo).';
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return phone;
  });

export const DEPARTMENT_MAX = 60;
export const NOTE_MAX = 2000;
export const CV_MAX_BYTES = 4 * 1024 * 1024; // Vercel function body limit is 4.5 MB.
export const MESSAGE_MAX = 500;
export const POLICY_VERSION = '2026-11-04';
/** In place of a policy version on an application HR added: no consent was confirmed. */
export const HR_ADDED_NO_CONSENT = 'hr-added';
export const NAME_MAX = 100;
export const CV_LINK_MAX = 2048;

/** Length is counted once composed: an NFD name is longer in characters, not in letters. */
export const fullNameSchema = z
  .string({ message: 'Nhập họ và tên.' })
  .trim()
  .normalize('NFC')
  .min(2, 'Nhập họ và tên.')
  .max(NAME_MAX, 'Họ tên quá dài.')
  .refine(hasNoNul, NUL_MESSAGE);

/** Empty means none. The spaces of a pasted address go first, so they never make it "wrong". */
export const optionalEmailSchema = z
  .string({ message: 'Email chưa đúng.' })
  .trim()
  .pipe(z.union([z.literal(''), z.email('Email chưa đúng.')]))
  .nullish();

/** A login in a link leaks to everyone who sees the profile, and "https://drive.google.com@x.example" hides its host. */
function hasLogin(link: string): boolean {
  if (!URL.canParse(link)) return false;
  const { username, password } = new URL(link);
  return username !== '' || password !== '';
}

/** A web link to a CV. The server only stores it and never fetches it (internal addresses are therefore allowed). */
export const cvLinkSchema = z
  .union([
    z.literal(''),
    z
      .url({ protocol: /^https?$/, message: 'Link CV phải bắt đầu bằng http:// hoặc https://' })
      .max(CV_LINK_MAX, `Link CV tối đa ${CV_LINK_MAX} ký tự.`)
      .refine(hasNoNul, NUL_MESSAGE)
      .refine((link) => !hasLogin(link), 'Link CV không được chứa tên đăng nhập hoặc mật khẩu.'),
  ])
  .nullish()
  .transform((v) => (v ? v : null));

/** Text fields of the application form. The CV file is checked separately. */
export const applicationFieldsSchema = z.object({
  jobId: z.string().min(1),
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema.transform((v) => (v ? v : null)),
  message: optionalText(MESSAGE_MAX),
  cvLink: cvLinkSchema,
  /** BR-11: must be ticked by the candidate, never pre-ticked. */
  consent: z.literal(true, { message: 'Hãy tích ô đồng ý để gửi hồ sơ.' }),
  formOpenedAt: z.number().int().positive(),
  /** Honeypot. Real users never see this field. */
  website: z.string().max(200).optional(),
});

export type ApplicationFields = z.input<typeof applicationFieldsSchema>;

export const subscribeSchema = z.object({
  phone: phoneSchema,
  department: z.string().trim().min(1).max(DEPARTMENT_MAX),
  fromJobId: z.string().nullish(),
  consent: z.literal(true, { message: 'Hãy tích ô đồng ý để nhận tin.' }),
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

const OPENINGS_MESSAGE = `Số lượng tuyển từ ${OPENINGS_MIN} đến ${OPENINGS_MAX} người.`;

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
    /** "Cấp bậc", "Số lượng tuyển", "Hình thức làm việc": optional; older clients send none. */
    level: z
      .string()
      .trim()
      .max(CHOICE_MAX, `Cấp bậc tối đa ${CHOICE_MAX} ký tự.`)
      .nullish()
      .transform((v) => (v ? v : null)),
    openings: z
      .number({ message: OPENINGS_MESSAGE })
      .int(OPENINGS_MESSAGE)
      .min(OPENINGS_MIN, OPENINGS_MESSAGE)
      .max(OPENINGS_MAX, OPENINGS_MESSAGE)
      .nullish()
      .transform((v) => v ?? null),
    workMode: z
      .enum(['onsite', 'hybrid', 'remote'], { message: 'Chọn Tại văn phòng, Kết hợp hoặc Từ xa.' })
      .nullish()
      .transform((v) => v ?? null),
    salaryMin: money,
    salaryMax: money,
    responsibilities: z.string().trim().max(4000, 'Tối đa 4000 ký tự.'),
    requirements: z.string().trim().max(4000, 'Tối đa 4000 ký tự.'),
    /** Older clients send no "Ưu tiên". */
    preferred: z.string().trim().max(2000, 'Tối đa 2000 ký tự.').default(''),
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

const httpUrl = z
  .url({ protocol: /^https?$/, message: 'Link phải bắt đầu bằng http:// hoặc https://' })
  .max(500, 'Link tối đa 500 ký tự.');

export const applicationUpdateSchema = z.object({
  status: z.enum(['new', 'seen', 'interview', 'passed', 'hired', 'rejected']).optional(),
  /** Required when an application becomes "Chưa phù hợp" (spec-hiring-outcomes.md). */
  rejectReason: z.enum(REJECT_REASON_KEYS).optional(),
  rejectNote: z.string().trim().max(REJECT_NOTE_MAX, `Ghi chú tối đa ${REJECT_NOTE_MAX} ký tự.`).nullable().optional(),
  /** "Hoàn tác": the change never happened, so it leaves no mark in the numbers. */
  isUndo: z.boolean().optional(),
  interviewMode: z.enum(['onsite', 'online']).nullable().optional(),
  /** Google Meet (or other) link for an online interview; empty string clears it. */
  meetingUrl: z
    .union([z.literal(''), httpUrl])
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
  /** ISO time of the interview; null clears it. */
  interviewAt: z.iso.datetime({ offset: true }).nullable().optional(),
  note: z.string().max(NOTE_MAX, `Ghi chú tối đa ${NOTE_MAX} ký tự.`).nullable().optional(),
  /** "Vẫn hẹn": invite although the reviewer has not approved yet (spec-boss-review.md); logged for the reviewer. */
  reviewBypassReason: z
    .string()
    .trim()
    .min(5, 'Ghi lý do hẹn khi sếp chưa duyệt (ít nhất 5 ký tự).')
    .max(300, 'Lý do tối đa 300 ký tự.')
    .optional(),
});

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ.');

/** `?from=&to=` of the dashboard reports. */
export const reportPeriodSchema = z
  .object({ from: isoDay, to: isoDay })
  .refine(({ from, to }) => from <= to, { message: 'Ngày bắt đầu phải trước ngày kết thúc.', path: ['from'] })
  .refine(({ from, to }) => daysBetween(from, to) < MAX_REPORT_DAYS, {
    message: `Chọn tối đa ${MAX_REPORT_DAYS} ngày.`,
    path: ['from'],
  });

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

const choiceList = z
  .array(z.string().trim().min(1).max(CHOICE_MAX, `Mỗi lựa chọn tối đa ${CHOICE_MAX} ký tự.`))
  .max(CHOICES_MAX, `Tối đa ${CHOICES_MAX} lựa chọn.`)
  .transform((items) => [...new Set(items)]);

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
  // Older saved templates have no lists yet: they get the built-in ones.
  departments: choiceList.default(DEFAULT_JOB_TEMPLATE.departments),
  levels: choiceList.default(DEFAULT_JOB_TEMPLATE.levels),
  experiences: choiceList.default(DEFAULT_JOB_TEMPLATE.experiences),
  educations: choiceList.default(DEFAULT_JOB_TEMPLATE.educations),
  requirementOptions: z
    .array(z.string().trim().min(1).max(200, 'Mỗi dòng tối đa 200 ký tự.'))
    .max(CHOICES_MAX, `Tối đa ${CHOICES_MAX} dòng.`)
    .transform((items) => [...new Set(items)])
    .default(DEFAULT_JOB_TEMPLATE.requirementOptions),
  preferredOptions: z
    .array(z.string().trim().min(1).max(200, 'Mỗi dòng tối đa 200 ký tự.'))
    .max(CHOICES_MAX, `Tối đa ${CHOICES_MAX} dòng.`)
    .transform((items) => [...new Set(items)])
    .default(DEFAULT_JOB_TEMPLATE.preferredOptions),
});

const templateSection = (label: string, max: number) =>
  z.string().trim().max(max, `${label} tối đa ${max} ký tự.`).default('');

export const messageTemplateSchema = z.object({
  subject: z.string().trim().min(1, 'Nhập tiêu đề.').max(SUBJECT_MAX, `Tiêu đề tối đa ${SUBJECT_MAX} ký tự.`),
  body: z
    .string()
    .trim()
    .min(1, 'Nhập nội dung.')
    .max(TEMPLATE_BODY_MAX, `Nội dung tối đa ${TEMPLATE_BODY_MAX} ký tự để link Gmail không bị cắt.`),
  // Clients from before the mail design send only subject and body.
  note: templateSection('Đoạn sau khối thông tin', TEMPLATE_SECTION_MAX),
  calloutTitle: templateSection('Tiêu đề khối nổi bật', CALLOUT_TITLE_MAX),
  callout: templateSection('Khối nổi bật', TEMPLATE_SECTION_MAX),
  closing: templateSection('Phần kết', TEMPLATE_SECTION_MAX),
});

/** "Thông tin người gửi": what an HR fills in about themselves. */
export const hrProfileSchema = z.object({
  name: z.string().trim().max(100, 'Tên tối đa 100 ký tự.'),
  phone: z.string().trim().max(30, 'Số điện thoại tối đa 30 ký tự.'),
  contactEmail: z
    .string()
    .trim()
    .pipe(z.union([z.literal(''), z.email('Email chưa đúng.').max(200)])),
  // Left out by clients that do not know these fields yet: the saved values stay. Empty or null clears them.
  jobTitle: z.string().trim().max(100, 'Chức danh tối đa 100 ký tự.').nullable().optional(),
  alias: z.string().trim().max(100, 'Tên gọi khác tối đa 100 ký tự.').nullable().optional(),
});

export const contactLogSchema = z.object({
  templateKey: z.enum(['interview_onsite', 'interview_online', 'rejection', 'rejection_interview', 'call']),
  channel: z.enum(['gmail', 'mailto', 'copy', 'copy_html']),
});

/** "+ Thêm mới" in a job form dropdown: one value appended to one list of the job template, on the server. */
export const addChoiceSchema = z.object({
  list: z.enum(['departments', 'levels', 'experiences', 'educations']),
  value: z.string().trim().min(1).max(CHOICE_MAX, `Tối đa ${CHOICE_MAX} ký tự.`),
});

/** The template lists a job form dropdown can add to. */
export type TemplateChoiceList = z.infer<typeof addChoiceSchema>['list'];
