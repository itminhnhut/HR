import { sql } from 'drizzle-orm';
import type {
  ActivityKind,
  ApplicationStatus,
  ArticleHeadingRef,
  ArticleState,
  CvGender,
  EmployeeBlock,
  JobTemplate,
  MatchItem,
  NewsImage,
  PayrollFirstMonthItem,
  PayrollLogArea,
  PayrollPeriodStatus,
  RegionTone,
  RecruitmentLogGroup,
  RejectReason,
  AbsenceFileContentType,
  AbsenceReasonKey,
  AttendanceCode,
  BatchAudience,
  LeaveMode,
  SaturdayChange,
  StaffType,
  TimesheetClosingSource,
  TimesheetHolidayDto,
  TimesheetRegionDto,
  TimesheetTotals,
  WorkMode,
} from '@careers/shared';
import {
  boolean,
  check,
  jsonb,
  date,
  real,
  index,
  integer,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  type AnyPgColumn,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Stored lifecycle state. "open", "expiring" and "expired" are NOT stored:
 * `effectiveStatus` in @careers/shared derives them from `deadline` at read time,
 * so a job expires exactly at 23:59 Vietnam time without any cron.
 */
export const jobState = pgEnum('job_state', ['draft', 'published', 'closed']);
export const employmentType = pgEnum('employment_type', ['full_time', 'part_time', 'internship']);
export const interviewMode = pgEnum('interview_mode', ['onsite', 'online']);
export const templateKey = pgEnum('template_key', [
  'interview_onsite',
  'interview_online',
  'rejection',
  'rejection_interview',
  'call',
  'payslip',
]);
export const contactChannel = pgEnum('contact_channel', ['gmail', 'mailto', 'copy', 'copy_html']);
export const applicationStatus = pgEnum('application_status', [
  'new',
  'seen',
  /** "Chờ xếp lịch": called, no interview time agreed yet. */
  'scheduling',
  'interview',
  'rejected',
  'passed',
  'hired',
]);

/** draft: never published; hidden: was public, taken down by HR (keeps its address and first publish date). */
export const newsStatus = pgEnum('news_status', ['draft', 'published', 'hidden']);

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = tz('created_at').notNull().defaultNow();
const updatedAt = tz('updated_at')
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Fixed once the job is first published (BR-04). */
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    department: text('department').notNull(),
    employmentType: employmentType('employment_type').notNull(),
    /** null: the company office. */
    address: text('address'),
    workingHours: text('working_hours'),
    experience: text('experience'),
    education: text('education'),
    /** "Cấp bậc", "Số lượng tuyển" (1–100), "Hình thức làm việc": null when HR left them empty or on older jobs. */
    level: text('level'),
    openings: integer('openings'),
    workMode: text('work_mode').$type<WorkMode>(),
    /** VND per month. Both null means "Thỏa thuận". */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    /** Multi-line text, one bullet per line. Rendered as text, never as HTML. */
    responsibilities: text('responsibilities').notNull().default(''),
    requirements: text('requirements').notNull().default(''),
    /** "Ưu tiên (không bắt buộc)": nice-to-haves, one per line; listed as bonuses by the CV check, never in its percent. */
    preferred: text('preferred').notNull().default(''),
    benefits: text('benefits').array().notNull().default([]),
    /** One text per probation milestone (ROADMAP_MILESTONES); empty means no roadmap. */
    roadmap: text('roadmap').array().notNull().default([]),
    /** Last day applications are accepted, Vietnam local date (YYYY-MM-DD). */
    deadline: date('deadline', { mode: 'string' }).notNull(),
    state: jobState('state').notNull().default('draft'),
    /** Vietnam local date of the first publish; the public link is fixed from then on (BR-04). */
    publishedOn: date('published_on', { mode: 'string' }),
    /** Vietnam local date HR closed the job; applications are due for deletion 30 days later. */
    closedOn: date('closed_on', { mode: 'string' }),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('jobs_slug_idx').on(t.slug), index('jobs_state_idx').on(t.state)],
);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Restrict: losing a job must never silently delete candidates' applications. */
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    fullName: text('full_name').notNull(),
    /** Normalized to 0xxxxxxxxx. Links the application to a candidate account (BR-17). */
    phone: text('phone').notNull(),
    email: text('email'),
    message: text('message'),
    /** Pathname inside the PRIVATE blob store. Never exposed publicly. */
    cvPathname: text('cv_pathname'),
    cvFileName: text('cv_file_name'),
    cvLink: text('cv_link'),
    status: applicationStatus('status').notNull().default('new'),
    /** When HR set "Hẹn phỏng vấn" with a time. */
    interviewAt: tz('interview_at'),
    interviewMode: interviewMode('interview_mode'),
    /** Google Meet (or other) link for an online interview. */
    meetingUrl: text('meeting_url'),
    note: text('note'),
    noteUpdatedAt: tz('note_updated_at'),
    /** Name (or email) of the HR who last changed the note. */
    noteUpdatedBy: text('note_updated_by'),
    /** Consent evidence (BR-12). */
    consentAt: tz('consent_at').notNull(),
    policyVersion: text('policy_version').notNull(),
    /** Key in application_sources (spec-custom-sources.md); "website" = the public form. */
    source: text('source')
      .notNull()
      .default('website')
      .references((): AnyPgColumn => applicationSources.key, { onDelete: 'restrict' }),
    /** "Ai giới thiệu", for a referral. */
    referrer: text('referrer'),
    /** HR who added it (spec-cv-intake.md); null = sent by the candidate. */
    addedBy: text('added_by'),
    /** HR who confirmed the candidate's consent for an added application. */
    consentBy: text('consent_by'),
    /** Times the candidate replaced the CV (CANDIDATE_CV_CHANGES_MAX). */
    candidateCvChanges: integer('candidate_cv_changes').notNull().default(0),
    cvChangedAt: tz('cv_changed_at'),
    /** "candidate" or the HR's name. */
    cvChangedBy: text('cv_changed_by'),
    /** False after the candidate replaced the CV, until an HR opens the application. */
    cvChangeSeen: boolean('cv_change_seen').notNull().default(true),
    /** Gender HR set over what the CV says; null keeps the CV's. */
    hrGender: text('hr_gender').$type<CvGender>(),
    /** Why it became "Chưa phù hợp": a key of REJECT_REASONS, internal only; null for older ones. */
    rejectReason: text('reject_reason').$type<RejectReason>(),
    rejectNote: text('reject_note'),
    /** Time of the latest submission; a re-apply within 30 days moves it (BR-07). */
    createdAt,
    updatedAt,
  },
  (t) => [
    index('applications_job_phone_idx').on(t.jobId, t.phone),
    index('applications_phone_idx').on(t.phone),
    index('applications_created_idx').on(t.createdAt),
  ],
);

/** "Báo cho tôi khi có vị trí mới" sign-ups (BR-10). */
export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    department: text('department').notNull(),
    fromJobId: uuid('from_job_id').references(() => jobs.id, { onDelete: 'set null' }),
    /**
     * The account that turned this alert on, or null for a sign-up from a public page.
     * Accounts only see and change their own alerts: their phone is not verified.
     */
    candidateId: uuid('candidate_id').references((): AnyPgColumn => candidates.id, { onDelete: 'cascade' }),
    consentAt: tz('consent_at').notNull(),
    policyVersion: text('policy_version').notNull(),
    createdAt,
  },
  (t) => [unique('subscribers_phone_dept_owner_key').on(t.phone, t.department, t.candidateId).nullsNotDistinct()],
);

/** Optional candidate account. Google sign-in only; the verified Google email is the identity. */
export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Verified Google email, lowercase. Links applications sent with the same email. */
    email: text('email').notNull(),
    name: text('name'),
    /** Typed by the candidate, NOT verified. Pre-fills the form and receives job alerts. */
    phone: text('phone'),
    cvPathname: text('cv_pathname'),
    cvFileName: text('cv_file_name'),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('candidates_email_idx').on(t.email)],
);

/** HR accounts with their own password (no Google). Deleting a row revokes access at once. */
export const hrUsers = pgTable(
  'hr_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Login name, stored lowercase. Does not need to be a real mailbox. */
    email: text('email').notNull(),
    name: text('name'),
    /** scrypt, see lib/password.ts. */
    passwordHash: text('password_hash').notNull(),
    lastLoginAt: tz('last_login_at'),
    /** Filled into message templates as {SĐT HR}. */
    phone: text('phone'),
    /** The real mailbox this HR sends from; the sign-in email may not receive mail. */
    contactEmail: text('contact_email'),
    /** Shown in the mail signature and filled in as {Chức danh HR}, e.g. "HR Generalist". */
    /** Filled in from the start; clearing it (null) leaves the line out of the mail signature. */
    jobTitle: text('job_title').default('HR Generalist'),
    /** Shown in brackets in the mail signature and filled in as {Tên gọi khác}, e.g. "Ms. Lee". */
    alias: text('alias'),
    /** Lương (spec-luong.md 10.2): Xem, sửa lương. Nobody has it until granted, or PAYROLL_ADMINS bootstraps it. */
    canPayroll: boolean('can_payroll').notNull().default(false),
    /** Duyệt lương; only with Xem, sửa. */
    canApprovePayroll: boolean('can_approve_payroll').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('hr_users_email_idx').on(t.email),
    check('hr_users_approve_needs_payroll', sql`not ${t.canApprovePayroll} or ${t.canPayroll}`),
  ],
);

/** One row per attempt of a rate-limited action (e.g. phone lookup); counted per key within a time window. */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** e.g. "lookup:ip:1.2.3.4" or "lookup:phone:0912345678". */
    key: text('key').notNull(),
    at: tz('at').notNull(),
  },
  (t) => [index('rate_limit_hits_key_at_idx').on(t.key, t.at)],
);

/** Company defaults for new jobs ("Mẫu tin"); a single row, id = 1. */
export const jobTemplates = pgTable('job_template', {
  id: integer('id').primaryKey(),
  /** JobTemplate from @careers/shared. */
  data: jsonb('data').$type<JobTemplate>().notNull(),
  updatedAt,
});

/** HR's own wording of a message template; a missing row means the built-in text. */
export const messageTemplates = pgTable('message_templates', {
  key: templateKey('key').primaryKey(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  note: text('note').notNull().default(''),
  calloutTitle: text('callout_title').notNull().default(''),
  callout: text('callout').notNull().default(''),
  closing: text('closing').notNull().default(''),
  updatedAt,
});

/** "Đã soạn thư": HR opened a filled template in Gmail / a mail app, or copied it. Goes with the application. */
export const contactLog = pgTable(
  'contact_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    templateKey: templateKey('template_key').notNull(),
    channel: contactChannel('channel').notNull(),
    hrName: text('hr_name').notNull(),
    createdAt,
  },
  (t) => [index('contact_log_application_idx').on(t.applicationId)],
);

/**
 * Each step an application reached: the source report counts these. No link to `applications` and no personal data, so
 * the numbers outlive a deleted application: what is left is an id that no longer points anywhere.
 */
export const applicationStatusLog = pgTable(
  'application_status_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id').notNull(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    toStatus: text('to_status').notNull().$type<ApplicationStatus>(),
    rejectReason: text('reject_reason').$type<RejectReason>(),
    createdAt,
  },
  (t) => [
    index('application_status_log_application_idx').on(t.applicationId),
    index('application_status_log_created_idx').on(t.createdAt),
  ],
);

/** "Nhật ký hồ sơ": who changed what on an application. Unlike the status log it names people, so it goes with the application. */
export const applicationActivity = pgTable(
  'application_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<ActivityKind>(),
    actor: text('actor').notNull(),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    detail: text('detail'),
    createdAt,
  },
  (t) => [index('application_activity_application_idx').on(t.applicationId)],
);

/**
 * "Nhật ký tuyển dụng" (spec-nhat-ky-ho-so.md): everything done in the applicants area, in words. A line outlives its
 * application: deleting one drops the link and the candidate's name, the job title stays ("Ứng viên đã xoá (vị trí X)").
 */
export const recruitmentLog = pgTable(
  'recruitment_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'set null' }),
    candidateName: text('candidate_name'),
    jobTitle: text('job_title'),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    group: text('group').notNull().$type<RecruitmentLogGroup>(),
    detail: text('detail'),
    fromValue: text('from_value'),
    toValue: text('to_value'),
    at: tz('at').notNull(),
  },
  (t) => [
    index('recruitment_log_at_idx').on(t.at),
    index('recruitment_log_application_idx').on(t.applicationId),
  ],
);

/**
 * "Ghi chú nội bộ" as a timeline (spec-nhat-ky-ho-so.md): any HR may add, edit or delete an entry, the recruitment log
 * keeps the old words. Goes with the application. `applications.note` is kept, no longer read.
 */
export const applicationNotes = pgTable(
  'application_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    /** Null for an old note whose author was never written down. */
    createdBy: text('created_by'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('application_notes_application_idx').on(t.applicationId, t.createdAt)],
);

/** Last automatic CV check of an application against its job's requirements (spec-cv-match.md). */
export const cvScores = pgTable('cv_scores', {
  applicationId: uuid('application_id')
    .primaryKey()
    .references(() => applications.id, { onDelete: 'cascade' }),
  percent: integer('percent'),
  items: jsonb('items').$type<MatchItem[]>().notNull(),
  note: text('note'),
  /** What the CV itself says, kept with the score: deleted with the application. */
  gender: text('gender').$type<CvGender>(),
  birth: text('birth'),
  /** Scoring rules version, CV file and requirements the result was made from: any change means re-score. */
  version: integer('version').notNull(),
  cvPathname: text('cv_pathname'),
  requirementsKey: text('requirements_key').notNull(),
  scoredAt: tz('scored_at').notNull(),
});

/** "Chuyên mục" of news posts (spec-news.md). The slug never changes, so category links keep working. */
export const newsCategories = pgTable(
  'news_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    sort: integer('sort').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('news_categories_slug_idx').on(t.slug)],
);

/**
 * News posts. `content` is the Lexical editor state checked by parseArticleContent; `content_html`,
 * `plain_text` and `headings` are rendered from it on every save, so reads never parse or render.
 */
export const newsPosts = pgTable(
  'news_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Restrict: a category with posts cannot be deleted. Null only in drafts. */
    categoryId: uuid('category_id').references(() => newsCategories.id, { onDelete: 'restrict' }),
    title: text('title').notNull().default(''),
    /** Frozen once the post is first published (publishedAt set). */
    slug: text('slug').notNull(),
    status: newsStatus('status').notNull().default('draft'),
    summary: text('summary').notNull().default(''),
    cover: jsonb('cover').$type<NewsImage>(),
    content: jsonb('content').$type<ArticleState>(),
    contentHtml: text('content_html').notNull().default(''),
    plainText: text('plain_text').notNull().default(''),
    headings: jsonb('headings').$type<ArticleHeadingRef[]>().notNull().default([]),
    /** First publish; kept when the post is taken down and published again. */
    publishedAt: tz('published_at'),
    updatedAt,
    /** Name of the HR account that saved last. */
    updatedBy: text('updated_by'),
    createdAt,
  },
  (t) => [
    uniqueIndex('news_posts_slug_idx').on(t.slug),
    index('news_posts_status_published_idx').on(t.status, t.publishedAt),
    index('news_posts_category_idx').on(t.categoryId, t.status, t.publishedAt),
  ],
);

/** Hashtags of news posts. A tag outlives its posts; public pages only ever show tags of published posts. */
export const newsTags = pgTable(
  'news_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** As first typed ("Tuyển dụng"); later spellings with the same slug reuse it. */
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('news_tags_slug_idx').on(t.slug)],
);

/** Which tags a post has, in the order HR typed them. */
export const newsPostTags = pgTable(
  'news_post_tags',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => newsPosts.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => newsTags.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index('news_post_tags_tag_idx').on(t.tagId)],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type HrUser = typeof hrUsers.$inferSelect;
export type NewsCategory = typeof newsCategories.$inferSelect;
export type NewsPost = typeof newsPosts.$inferSelect;
export type NewNewsPost = typeof newsPosts.$inferInsert;
export type NewsTag = typeof newsTags.$inferSelect;

export const sourceKind = pgEnum('source_kind', ['system', 'builtin', 'custom']);

/**
 * HR's list of application sources (spec-custom-sources.md). The key never changes, so renaming keeps every
 * application and the statistics under the same source.
 */
export const applicationSources = pgTable(
  'application_sources',
  {
    key: text('key').primaryKey(),
    name: text('name').notNull(),
    /** sourceNameKey(name): two sources can never have the "same" name (case, tones, spaces). */
    nameKey: text('name_key').notNull(),
    kind: sourceKind('kind').notNull().default('custom'),
    hidden: boolean('hidden').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdBy: text('created_by'),
    createdAt,
  },
  (t) => [uniqueIndex('application_sources_name_key_idx').on(t.nameKey)],
);

/** "Lịch sử CV": who replaced an application's CV and what it was before (only the newest file is kept). */
export const cvChanges = pgTable(
  'cv_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    /** "candidate" or the HR's name. */
    changedBy: text('changed_by').notNull(),
    /** File name or link of the replaced CV; null when there was none. */
    previous: text('previous'),
    at: tz('at').notNull(),
  },
  (t) => [index('cv_changes_application_idx').on(t.applicationId, t.at)],
);

export const reviewDecision = pgEnum('review_decision', ['approve', 'reject', 'ask']);
export const reviewPick = pgEnum('review_pick', ['yes', 'maybe']);

/**
 * "Sếp duyệt ứng viên" (spec-boss-review.md): a batch of applications sent to a reviewer through a private link,
 * /duyet/<token>, that works without signing in until it expires or HR revokes it.
 */
export const reviewBatches = pgTable(
  'review_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 32 random bytes, base64url: the whole secret of the reviewer's link. */
    token: text('token').notNull(),
    title: text('title').notNull(),
    /** As HR typed it, e.g. "Ngọc Anh (Phòng Nhân sự)". */
    senderName: text('sender_name').notNull(),
    /** Who the link is for, e.g. "anh Minh": shown on the page and in the CV watermark. */
    reviewerName: text('reviewer_name').notNull(),
    message: text('message'),
    respondBy: tz('respond_by').notNull(),
    /** respondBy + REVIEW_LINK_GRACE_DAYS: after it the page is read only. */
    expiresAt: tz('expires_at').notNull(),
    revokedAt: tz('revoked_at'),
    /** First time the reviewer opened the link. */
    openedAt: tz('opened_at'),
    /** "Báo HR: đã xem xong". */
    doneAt: tz('done_at'),
    /** Name (or email) of the HR who sent it. */
    createdBy: text('created_by').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('review_batches_token_idx').on(t.token)],
);

/** One application in a batch: HR's view when sending, the reviewer's decision, HR's reply to a question. */
export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => reviewBatches.id, { onDelete: 'cascade' }),
    /** Deleting an application (candidate's request, 30 days after the job) removes it from every batch. */
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    hrPick: reviewPick('hr_pick').notNull().default('maybe'),
    hrComment: text('hr_comment'),
    decision: reviewDecision('decision'),
    reviewerComment: text('reviewer_comment'),
    decidedAt: tz('decided_at'),
    hrReply: text('hr_reply'),
    hrRepliedAt: tz('hr_replied_at'),
    createdAt,
  },
  (t) => [
    unique('review_items_batch_application_unique').on(t.batchId, t.applicationId),
    index('review_items_application_idx').on(t.applicationId),
  ],
);

/** What happened to a batch, for HR's "Nhật ký". The application link is dropped if the application is deleted. */
export const reviewEvents = pgTable(
  'review_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => reviewBatches.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => applications.id, { onDelete: 'set null' }),
    /** ReviewEventKind from @careers/shared. */
    kind: text('kind').notNull(),
    decision: reviewDecision('decision'),
    /** The reviewer's name or "HR: <name>". */
    actor: text('actor').notNull(),
    detail: text('detail'),
    at: tz('at').notNull(),
  },
  (t) => [index('review_events_batch_idx').on(t.batchId, t.at)],
);

export type ReviewBatch = typeof reviewBatches.$inferSelect;
export type ApplicationSourceRow = typeof applicationSources.$inferSelect;
export type ReviewItem = typeof reviewItems.$inferSelect;

/** Chấm công (spec-cham-cong.md). A region's Saturdays are what its norm counts on top of Mon–Fri. */
export const timesheetRegions = pgTable(
  'timesheet_regions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    saturdays: integer('saturdays').notNull().default(0),
    /** Later numbers of Saturdays, each from its month on; months before the first keep `saturdays`. */
    saturdayChanges: jsonb('saturday_changes').$type<SaturdayChange[]>().notNull().default([]),
    tone: text('tone').$type<RegionTone>().notNull().default('blue'),
    hidden: boolean('hidden').notNull().default(false),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_regions_name_idx').on(t.name)],
);

/** Nobody is ever deleted: someone who left keeps their old periods. */
/** Kinds of staff: HR names them, and each counts for leave one of two ways. The first two are the sheet's own. */
export const timesheetStaffKinds = pgTable(
  'timesheet_staff_kinds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    rule: text('rule').$type<StaffType>().notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_staff_kinds_name_idx').on(sql`lower(${t.name})`)],
);

/** Departments offered for people. A person's department stays a name, as on the sheet and in closed periods. */
export const timesheetDepartments = pgTable(
  'timesheet_departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_departments_name_idx').on(sql`lower(${t.name})`)],
);

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    fullName: text('full_name').notNull(),
    department: text('department').notNull().default(''),
    title: text('title').notNull().default(''),
    regionId: uuid('region_id')
      .notNull()
      .references(() => timesheetRegions.id),
    employment: text('employment').$type<StaffType>().notNull().default('probation'),
    staffKindId: uuid('staff_kind_id').references(() => timesheetStaffKinds.id, { onDelete: 'set null' }),
    joinedOn: date('joined_on'),
    officialOn: date('official_on'),
    leftOn: date('left_on'),
    openingLeave: real('opening_leave').notNull().default(0),
    /** Khối (spec-luong.md 10.1); null until HR sets it. Each close keeps the one it had. */
    block: text('block').$type<EmployeeBlock>(),
    /** Email nhận phiếu lương; null until HR types it. Lowercase. */
    email: text('email'),
    /** HR checked the date: dates typed in from the old sheets are not until then (spec-luong.md 4.20). */
    joinedOnConfirmed: boolean('joined_on_confirmed').notNull().default(false),
    officialOnConfirmed: boolean('official_on_confirmed').notNull().default(false),
    leftOnConfirmed: boolean('left_on_confirmed').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('employees_code_idx').on(t.code), check('employees_block', sql`${t.block} in ('BO', 'KD')`)],
);

/** One period per month; its norms and leave rule stay with it, so changing a setting never rewrites the past. */
export const timesheetPeriods = pgTable(
  'timesheet_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    fromOn: date('from_on').notNull(),
    toOn: date('to_on').notNull(),
    status: text('status').$type<'open' | 'closed'>().notNull().default('open'),
    norms: jsonb('norms').$type<Record<string, number>>().notNull().default({}),
    leaveThreshold: real('leave_threshold').notNull().default(14),
    leavePerPeriod: real('leave_per_period').notNull().default(1),
    /** How annual leave counts in this period: NĐ 145 (law) or as HR's workbook did (excel). */
    leaveMode: text('leave_mode').$type<LeaveMode>().notNull().default('law'),
    closedAt: tz('closed_at'),
    closedBy: text('closed_by'),
    /** What the sheet said about holidays and regions when it closed; empty while open. */
    frozen: jsonb('frozen').$type<{ holidays: TimesheetHolidayDto[]; regions: TimesheetRegionDto[] }>(),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_periods_month_idx').on(t.year, t.month)],
);

/** Only what HR entered: a day with no row counts by the rules. */
export const timesheetEntries = pgTable(
  'timesheet_entries',
  {
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    day: date('day').notNull(),
    code: text('code'),
    note: text('note'),
    updatedBy: text('updated_by').notNull(),
    updatedAt,
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.day] }), index('timesheet_entries_day_idx').on(t.day)],
);

/** "YYYY-MM" periods it covers; toPeriod null means every period from then on. */
export const timesheetAdjustments = pgTable(
  'timesheet_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    amount: real('amount').notNull(),
    reason: text('reason').notNull(),
    fromPeriod: text('from_period').notNull(),
    toPeriod: text('to_period'),
    createdBy: text('created_by').notNull(),
    createdAt,
  },
  (t) => [index('timesheet_adjustments_employee_idx').on(t.employeeId)],
);

export const timesheetHolidays = pgTable('timesheet_holidays', {
  day: date('day').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt,
});

/** What a closed period said about each person: later edits to the person or settings leave it alone. */
/** Days HR added to or took off a balance by hand, in the period where it applies. */
export const timesheetLeaveChanges = pgTable(
  'timesheet_leave_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => timesheetPeriods.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt,
  },
  (t) => [index('timesheet_leave_changes_period_idx').on(t.periodId, t.employeeId)],
);

/** Who approves absences: HR adds them, and a name typed on a line is remembered. */
export const timesheetApprovers = pgTable(
  'timesheet_approvers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_approvers_name_idx').on(sql`lower(${t.name})`)],
);

/** Kinds of absence HR added beside those in the law, each with the way it counts. */
export const timesheetAbsenceKinds = pgTable('timesheet_absence_kinds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code').$type<AttendanceCode>().notNull(),
  days: integer('days'),
  /** Whether an absence of this kind should have papers kept with it (spec-giay-to-nghi.md). */
  needsPaper: boolean('needs_paper').notNull().default(false),
  createdBy: text('created_by').notNull(),
  createdAt,
});

/** HR's choice for a reason in the law; a reason without a row keeps PAPER_REASONS_DEFAULT. */
export const timesheetReasonSettings = pgTable('timesheet_reason_settings', {
  reasonKey: text('reason_key').$type<AbsenceReasonKey>().primaryKey(),
  needsPaper: boolean('needs_paper').notNull(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: tz('updated_at').notNull().defaultNow(),
});

/** What HR registered on a person; the days themselves are in `timesheetEntries`, where HR can still change each. */
/**
 * A company day off (tab Nghỉ công ty): one record, one absence per person it came to. `audience` is how HR chose the
 * people, `employeeIds` who they came to. `version` goes up on each change, so two saves at once cannot both apply.
 */
export const timesheetAbsenceBatches = pgTable(
  'timesheet_absence_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    reason: text('reason').notNull(),
    label: text('label').notNull(),
    code: text('code').notNull(),
    fromOn: date('from_on').notNull(),
    toOn: date('to_on').notNull(),
    approvedBy: text('approved_by'),
    note: text('note').notNull().default(''),
    audience: jsonb('audience').$type<BatchAudience>().notNull(),
    employeeIds: jsonb('employee_ids').$type<string[]>().notNull().default([]),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [index('timesheet_absence_batches_from_idx').on(t.fromOn)],
);

export const timesheetAbsences = pgTable(
  'timesheet_absences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    code: text('code').notNull(),
    fromOn: date('from_on').notNull(),
    toOn: date('to_on').notNull(),
    days: real('days').notNull(),
    note: text('note').notNull(),
    /** The kind's name then: the kind itself may be removed later. */
    label: text('label').notNull().default(''),
    /** Null while it waits: nothing is written to the sheet until someone has approved. */
    approvedBy: text('approved_by'),
    handover: text('handover').notNull().default(''),
    /** The company day off it belongs to; cancelled with it, never on its own. */
    batchId: uuid('batch_id').references(() => timesheetAbsenceBatches.id),
    createdBy: text('created_by').notNull(),
    createdAt,
  },
  (t) => [index('timesheet_absences_employee_idx').on(t.employeeId, t.fromOn), index('timesheet_absences_batch_idx').on(t.batchId)],
);

/** Papers kept with an absence: photos and PDFs in the private Blob store, read only through the API. */
export const timesheetAbsenceFiles = pgTable(
  'timesheet_absence_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    absenceId: uuid('absence_id')
      .notNull()
      .references(() => timesheetAbsences.id, { onDelete: 'cascade' }),
    /** Where the file is in the store; never shown to anyone. */
    pathname: text('pathname').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').$type<AbsenceFileContentType>().notNull(),
    size: integer('size').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt,
  },
  (t) => [index('timesheet_absence_files_absence_idx').on(t.absenceId, t.createdAt)],
);

export const timesheetSnapshots = pgTable(
  'timesheet_snapshots',
  {
    periodId: uuid('period_id')
      .notNull()
      .references(() => timesheetPeriods.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id),
    code: text('code').notNull(),
    fullName: text('full_name').notNull(),
    department: text('department').notNull(),
    title: text('title').notNull(),
    regionId: uuid('region_id').notNull(),
    employment: text('employment').$type<StaffType>().notNull(),
    /** The kind's name as it closed; empty on periods closed before kinds could be named. */
    staffLabel: text('staff_label'),
    joinedOn: date('joined_on'),
    leftOn: date('left_on'),
    norm: real('norm').notNull(),
    leaveOpening: real('leave_opening').notNull(),
    leaveClosing: real('leave_closing').notNull(),
    /** All the totals as the period closed. */
    totals: jsonb('totals').$type<TimesheetTotals>(),
  },
  (t) => [primaryKey({ columns: [t.periodId, t.employeeId] })],
);

/** Who changed what in a timesheet, in words. */
export const timesheetLog = pgTable(
  'timesheet_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id').references(() => timesheetPeriods.id, { onDelete: 'set null' }),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    detail: text('detail').notNull(),
    at: tz('at').notNull(),
  },
  (t) => [index('timesheet_log_period_idx').on(t.periodId, t.at)],
);

/**
 * Lần chốt kỳ công (spec-luong.md 10.1): one row per close, never changed or removed (a trigger refuses it). Closing again
 * after a reopen adds the next `closeNo`; the snapshots above stay what Chấm công reads.
 */
export const timesheetClosings = pgTable(
  'timesheet_closings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => timesheetPeriods.id, { onDelete: 'restrict' }),
    closeNo: integer('close_no').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    fromOn: date('from_on').notNull(),
    toOn: date('to_on').notNull(),
    closedAt: tz('closed_at').notNull(),
    closedBy: text('closed_by').notNull(),
    source: text('source').$type<TimesheetClosingSource>().notNull().default('web'),
    holidays: jsonb('holidays').$type<TimesheetHolidayDto[]>().notNull(),
    regions: jsonb('regions').$type<TimesheetRegionDto[]>().notNull(),
    norms: jsonb('norms').$type<Record<string, number>>().notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('timesheet_closings_period_no_idx').on(t.periodId, t.closeNo)],
);

/** Each person of a close as it was: who, where, what kind, the dates, the totals and the code of every day. */
export const timesheetClosingRows = pgTable(
  'timesheet_closing_rows',
  {
    closingId: uuid('closing_id')
      .notNull()
      .references(() => timesheetClosings.id, { onDelete: 'restrict' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    fullName: text('full_name').notNull(),
    department: text('department').notNull(),
    title: text('title').notNull(),
    block: text('block').$type<EmployeeBlock>(),
    regionId: uuid('region_id').notNull(),
    /** No foreign key: a kind removed later must not change a close. `staffLabel` keeps its name. */
    staffKindId: uuid('staff_kind_id'),
    staffLabel: text('staff_label'),
    employment: text('employment').$type<StaffType>().notNull(),
    joinedOn: date('joined_on'),
    officialOn: date('official_on'),
    leftOn: date('left_on'),
    norm: real('norm').notNull(),
    totals: jsonb('totals').$type<TimesheetTotals>(),
    /** "YYYY-MM-DD" → code for every day of the period; null when a backfill could not rebuild them. */
    codes: jsonb('codes').$type<Record<string, AttendanceCode | null>>(),
    cannotRebuild: boolean('cannot_rebuild').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.closingId, t.employeeId] }),
    index('timesheet_closing_rows_employee_idx').on(t.employeeId),
    check('timesheet_closing_rows_codes_or_flag', sql`${t.cannotRebuild} = (${t.codes} is null)`),
  ],
);

/**
 * Danh sách kiểm trước tháng lương đầu (spec-luong.md 17.2): what HR has checked before the first payroll month. One row
 * per item and person or close; a person's item has `employeeId`, the close of a period done by a script has `closingId`.
 */
export const payrollFirstMonthChecks = pgTable(
  'payroll_first_month_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    item: text('item').$type<PayrollFirstMonthItem>().notNull(),
    employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }),
    closingId: uuid('closing_id').references(() => timesheetClosings.id, { onDelete: 'restrict' }),
    confirmed: boolean('confirmed').notNull().default(false),
    confirmedAt: tz('confirmed_at').notNull(),
    confirmedBy: text('confirmed_by').notNull(),
  },
  (t) => [unique('payroll_first_month_checks_item_idx').on(t.item, t.employeeId, t.closingId).nullsNotDistinct()],
);

/**
 * A payroll month (spec-luong.md 10.2), created only when HR types or computes in it. Only what Chấm công tells it is
 * here yet: its status, the close it reads, and the label of a reopened timesheet period (R7), plus the pay date, the
 * approval in force and the transfer day the month view shows (step 15; approving writes them in step 16).
 */
export const payrollPeriods = pgTable(
  'payroll_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    status: text('status').$type<PayrollPeriodStatus>().notNull().default('waiting'),
    /** The close of the timesheet period it reads; an approved month keeps the one it was approved on. */
    closingId: uuid('closing_id').references(() => timesheetClosings.id, { onDelete: 'restrict' }),
    /** Set while the timesheet period of an approved month is reopened, or closed again with other figures. */
    timesheetReopenedAt: tz('timesheet_reopened_at'),
    timesheetReopenedBy: text('timesheet_reopened_by'),
    timesheetReopenReason: text('timesheet_reopen_reason'),
    /** Ngày chi trả HR set for this month; null reads `quy-tac.ngay-chi-tra` (R2). */
    payDate: date('pay_date'),
    /** The approval in force (R4): its number N, when and by whom. Null while waiting or a draft. */
    approvalNo: integer('approval_no'),
    approvedAt: tz('approved_at'),
    approvedBy: text('approved_by'),
    /** Đã chuyển khoản: the transfer day. */
    paidOn: date('paid_on'),
    /** Two people saving at once: the later one is told to reload (spec-luong.md 4.23). */
    rowVersion: integer('row_version').notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('payroll_periods_month_idx').on(t.year, t.month),
    check('payroll_periods_status', sql`${t.status} in ('waiting', 'draft', 'approved', 'paid')`),
    check(
      'payroll_periods_approved_on_a_close',
      sql`${t.status} in ('waiting', 'draft') or ${t.closingId} is not null`,
    ),
    check(
      'payroll_periods_approval',
      sql`(${t.approvalNo} is null) = (${t.approvedAt} is null) and (${t.approvalNo} is null) = (${t.approvedBy} is null) and coalesce(${t.approvalNo}, 1) > 0`,
    ),
    check('payroll_periods_paid', sql`${t.paidOn} is null or ${t.status} = 'paid'`),
  ],
);

/** Nhật ký lương (spec-luong.md 10.2, 11.9): its own table, never the timesheet log. Only added to (a trigger refuses the rest). */
export const payrollLog = pgTable(
  'payroll_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    area: text('area').$type<PayrollLogArea>().notNull(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    /** In words, old → new. */
    detail: text('detail').notNull(),
    /** The payroll month it touches, "YYYY-MM"; null when none (rights). */
    month: text('month'),
    at: tz('at').notNull(),
  },
  (t) => [index('payroll_log_at_idx').on(t.at), index('payroll_log_month_idx').on(t.month, t.at)],
);

export * from './schema-payroll.js';
export * from './schema-payslips.js';
