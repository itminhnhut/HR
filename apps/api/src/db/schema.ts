import type { ArticleHeadingRef, ArticleState, JobTemplate, MatchItem, NewsImage } from '@careers/shared';
import {
  boolean,
  jsonb,
  date,
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
export const templateKey = pgEnum('template_key', ['interview_onsite', 'interview_online', 'rejection', 'call']);
export const contactChannel = pgEnum('contact_channel', ['gmail', 'mailto', 'copy']);
export const applicationStatus = pgEnum('application_status', ['new', 'seen', 'interview', 'rejected']);

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
    /** VND per month. Both null means "Thỏa thuận". */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    /** Multi-line text, one bullet per line. Rendered as text, never as HTML. */
    responsibilities: text('responsibilities').notNull().default(''),
    requirements: text('requirements').notNull().default(''),
    /** "Ưu tiên (không bắt buộc)": nice-to-haves, one per line; never scored as requirements. */
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
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('hr_users_email_idx').on(t.email)],
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

/** Last automatic CV check of an application against its job's requirements (spec-cv-match.md). */
export const cvScores = pgTable('cv_scores', {
  applicationId: uuid('application_id')
    .primaryKey()
    .references(() => applications.id, { onDelete: 'cascade' }),
  percent: integer('percent'),
  items: jsonb('items').$type<MatchItem[]>().notNull(),
  note: text('note'),
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
