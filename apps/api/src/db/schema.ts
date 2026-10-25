import type { JobTemplate, MatchItem } from '@careers/shared';
import {
  boolean,
  jsonb,
  date,
  index,
  integer,
  pgEnum,
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
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: tz('locked_until'),
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

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type HrUser = typeof hrUsers.$inferSelect;
