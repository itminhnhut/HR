import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Stored lifecycle state. "open", "expiring" and "expired" are NOT stored:
 * `effectiveStatus` in @careers/shared derives them from `deadline` at read time,
 * so a job expires exactly at 23:59 Vietnam time without any cron.
 */
export const jobState = pgEnum('job_state', ['draft', 'published', 'paused', 'filled']);
export const employmentType = pgEnum('employment_type', ['full_time', 'part_time', 'internship', 'contract']);
export const applicationStatus = pgEnum('application_status', ['new', 'seen', 'interview', 'passed', 'rejected']);

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
    remote: boolean('remote').notNull().default(false),
    city: text('city').notNull(),
    address: text('address'),
    workingHours: text('working_hours'),
    level: text('level'),
    experience: text('experience'),
    education: text('education'),
    language: text('language'),
    headcount: integer('headcount'),
    /** Millions of VND per month. Both null means "Thỏa thuận". */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryNote: text('salary_note'),
    skills: text('skills').array().notNull().default([]),
    summary: text('summary'),
    teamNote: text('team_note'),
    /** Multi-line text, one bullet per line. Rendered as text, never as HTML. */
    responsibilities: text('responsibilities').notNull().default(''),
    requirements: text('requirements').notNull().default(''),
    niceToHave: text('nice_to_have').notNull().default(''),
    benefitIncome: text('benefit_income').notNull().default(''),
    benefitInsurance: text('benefit_insurance').notNull().default(''),
    benefitTimeOff: text('benefit_time_off').notNull().default(''),
    benefitGrowth: text('benefit_growth').notNull().default(''),
    benefitEnvironment: text('benefit_environment').notNull().default(''),
    plan30: text('plan_30'),
    plan60: text('plan_60'),
    plan90: text('plan_90'),
    /** Last day applications are accepted, Vietnam local date (YYYY-MM-DD). */
    deadline: date('deadline', { mode: 'string' }).notNull(),
    state: jobState('state').notNull().default('draft'),
    /** Vietnam local date of the first publish; anchors the 60-day cap (BR-01, BR-18). */
    publishedOn: date('published_on', { mode: 'string' }),
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
    /** Optional second consent purpose (BR-09). */
    keepForOtherJobs: boolean('keep_for_other_jobs').notNull().default(false),
    status: applicationStatus('status').notNull().default('new'),
    note: text('note'),
    thankedAt: tz('thanked_at'),
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
    consentAt: tz('consent_at').notNull(),
    policyVersion: text('policy_version').notNull(),
    createdAt,
  },
  (t) => [uniqueIndex('subscribers_phone_dept_idx').on(t.phone, t.department)],
);

/** Optional candidate account, keyed by verified phone (BR-17, BR-22). */
export const candidates = pgTable(
  'candidates',
  {
    phone: text('phone').primaryKey(),
    name: text('name'),
    /** Google account linked after the one-time phone check (BR-22). */
    email: text('email'),
    cvPathname: text('cv_pathname'),
    cvFileName: text('cv_file_name'),
    keepForOtherJobs: boolean('keep_for_other_jobs').notNull().default(false),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('candidates_email_idx').on(t.email)],
);

export const savedJobs = pgTable(
  'saved_jobs',
  {
    phone: text('phone')
      .notNull()
      .references(() => candidates.phone, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    createdAt,
  },
  (t) => [primaryKey({ columns: [t.phone, t.jobId] })],
);

/** One pending code per phone; a new request replaces the old one. */
export const otpCodes = pgTable('otp_codes', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: tz('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  sentAt: tz('sent_at').notNull(),
});

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
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('hr_users_email_idx').on(t.email)],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type HrUser = typeof hrUsers.$inferSelect;
