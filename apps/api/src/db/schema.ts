import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Stored lifecycle state. "open", "expiring" and "expired" are NOT stored:
 * they are derived from `deadline` at read time (see lib/job-status.ts),
 * so a job expires exactly at 23:59 even though Hobby cron runs once a day.
 */
export const jobState = pgEnum('job_state', ['draft', 'published', 'paused', 'filled']);

export const employmentType = pgEnum('employment_type', ['full_time', 'part_time', 'internship', 'contract']);

export const applicationStatus = pgEnum('application_status', ['new', 'seen', 'interview', 'passed', 'rejected']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    department: text('department').notNull(),
    employmentType: employmentType('employment_type').notNull().default('full_time'),
    remote: boolean('remote').notNull().default(false),
    city: text('city').notNull(),
    address: text('address'),
    workingHours: text('working_hours'),
    experience: text('experience'),
    headcount: integer('headcount'),
    /** Millions of VND per month. Both null means "Thỏa thuận". */
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    /** Extra pay info shown after the range, e.g. "hoa hồng". */
    salaryNote: text('salary_note'),
    /** Multi-line text, one bullet per line. Rendered as text, never as HTML. */
    responsibilities: text('responsibilities').notNull().default(''),
    requirements: text('requirements').notNull().default(''),
    benefits: text('benefits').notNull().default(''),
    plan30: text('plan_30'),
    plan60: text('plan_60'),
    plan90: text('plan_90'),
    /** Last day applications are accepted, Vietnam local date (YYYY-MM-DD). */
    deadline: date('deadline', { mode: 'string' }).notNull(),
    state: jobState('state').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('jobs_slug_idx').on(t.slug), index('jobs_state_idx').on(t.state)],
);

export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    /** Normalized to 0xxxxxxxxx. Used for dedupe (BR-07). */
    phone: text('phone').notNull(),
    email: text('email'),
    message: text('message'),
    /** Pathname inside the PRIVATE blob store. Never exposed publicly. */
    cvPathname: text('cv_pathname'),
    cvFileName: text('cv_file_name'),
    cvLink: text('cv_link'),
    status: applicationStatus('status').notNull().default('new'),
    note: text('note'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('applications_job_phone_idx').on(t.jobId, t.phone),
    index('applications_status_idx').on(t.status),
    index('applications_created_idx').on(t.createdAt),
  ],
);

/** "Báo cho tôi khi có vị trí mới" sign-ups from closed job pages (BR-10). */
export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull(),
    department: text('department').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('subscribers_phone_dept_idx').on(t.phone, t.department)],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
