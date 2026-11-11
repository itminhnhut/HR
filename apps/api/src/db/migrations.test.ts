import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { dayCode, periodDays, restDayWork, timesheetTotals, type AttendanceCode } from '@careers/shared';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from './schema.js';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'migrations-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Each test boots its own Postgres and runs every migration: slow when the whole suite runs in parallel. */
const SLOW = { timeout: 30_000 };

/** A copy of the migrations folder that stops after the first `count` migrations. */
function migrationsUpTo(count: number): string {
  const dir = join(tmp, `upto-${count}`);
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, count) }));
  return dir;
}

/** How many migrations come before the one named `name` (its tag without the number), so renumbering keeps tests right. */
function countBefore(name: string): number {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
  const index = journal.entries.findIndex((e) => e.tag.replace(/^\d+_/, '') === name);
  if (index < 0) throw new Error(`No migration named ${name}`);
  return index;
}

describe('migration 0002: candidates by Google email', SLOW, () => {
  it('keeps accounts that have an email, re-links their saved jobs and drops OTP codes', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(2) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, city, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', 'HN', '2026-12-01');
      insert into candidates (phone, name, email, keep_for_other_jobs)
        values ('0912000001', 'Có email', 'AN@Gmail.com', true), ('0912000002', 'Không email', null, false);
      insert into saved_jobs (phone, job_id) values
        ('0912000001', '11111111-1111-1111-1111-111111111111'),
        ('0912000002', '11111111-1111-1111-1111-111111111111');
      insert into otp_codes (phone, code_hash, expires_at, sent_at) values ('0912000001', 'h', now(), now());
    `);

    await migrate(db, { migrationsFolder: migrationsUpTo(3) });

    const people = await pg.query<{ id: string; email: string; name: string; phone: string; keep: boolean }>(
      `select id, email, name, phone, keep_for_other_jobs as keep from candidates`,
    );
    expect(people.rows).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        email: 'an@gmail.com',
        name: 'Có email',
        phone: '0912000001',
        keep: true,
      },
    ]);
    const saved = await pg.query<{ candidate_id: string }>(`select candidate_id from saved_jobs`);
    expect(saved.rows).toEqual([{ candidate_id: people.rows[0].id }]);
    const otp = await pg.query(`select to_regclass('public.otp_codes') as t`);
    expect(otp.rows).toEqual([{ t: null }]);
  });

  it('enforces one account per email and cascades saved jobs when an account goes', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(3) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, city, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'b', 'B', 'Kỹ thuật', 'full_time', 'HN', '2026-12-01');
      insert into candidates (id, email) values ('22222222-2222-2222-2222-222222222222', 'an@gmail.com');
      insert into saved_jobs (candidate_id, job_id)
        values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
    `);
    await expect(pg.exec(`insert into candidates (email) values ('an@gmail.com')`)).rejects.toThrow();

    await pg.exec(`delete from candidates`);

    expect((await pg.query(`select * from saved_jobs`)).rows).toEqual([]);
  });

  it('still enforces one account per email after every migration', async () => {
    const db = drizzle({ client: new PGlite(), schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    await db.insert(schema.candidates).values({ email: 'an@gmail.com' });
    await expect(db.insert(schema.candidates).values({ email: 'an@gmail.com' })).rejects.toThrow();
  });
});

describe('migration 0005: lean jobs', SLOW, () => {
  it('merges benefits and extras, converts salary to VND and drops the contract type', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(5) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, city, deadline, salary_min, salary_max,
                        requirements, nice_to_have, benefit_income, benefit_insurance, benefit_environment)
        values ('a', 'A', 'Kỹ thuật', 'contract', 'HN', '2026-12-01', 15, 20,
                '- Biết SQL', 'Biết Docker', E'- Lương tháng 13\n\n• Thưởng quý', 'BHXH đầy đủ', 'Văn phòng đẹp');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const [job] = await db.select().from(schema.jobs);
    expect(job).toMatchObject({
      employmentType: 'full_time',
      salaryMin: 15_000_000,
      salaryMax: 20_000_000,
      requirements: '- Biết SQL\nBiết Docker',
      benefits: ['Lương tháng 13', 'Thưởng quý', 'BHXH đầy đủ', 'Văn phòng đẹp'],
    });
    expect(job.roadmap).toHaveLength(5);
  });
});

describe('migration 0006: lean rest', SLOW, () => {
  it('turns paused and filled jobs into closed ones, closed on their last change in Vietnam', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(6) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, deadline, state, updated_at) values
        ('paused', 'Tạm dừng', 'Kỹ thuật', 'full_time', '2026-12-01', 'paused', '2026-10-10T18:00:00Z'),
        ('filled', 'Đủ người', 'Kỹ thuật', 'full_time', '2026-12-01', 'filled', '2026-10-05T03:00:00Z'),
        ('live', 'Đang tuyển', 'Kỹ thuật', 'full_time', '2026-12-01', 'published', '2026-10-05T03:00:00Z'),
        ('draft', 'Nháp', 'Kỹ thuật', 'full_time', '2026-12-01', 'draft', '2026-10-05T03:00:00Z');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const rows = await db.select().from(schema.jobs).orderBy(schema.jobs.slug);
    expect(rows.map((j) => [j.slug, j.state, j.closedOn])).toEqual([
      ['draft', 'draft', null],
      ['filled', 'closed', '2026-10-05'],
      ['live', 'published', null],
      ['paused', 'closed', '2026-10-11'],
    ]);
  });

  it('turns "passed" applications into interviews and keeps the other statuses', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(6) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', '2026-12-01');
      insert into applications (job_id, full_name, phone, status, consent_at, policy_version) values
        ('11111111-1111-1111-1111-111111111111', 'Đạt', '0912000001', 'passed', now(), 'v'),
        ('11111111-1111-1111-1111-111111111111', 'Loại', '0912000002', 'rejected', now(), 'v');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const rows = await db.select().from(schema.applications).orderBy(schema.applications.phone);
    expect(rows.map((a) => [a.fullName, a.status, a.interviewAt])).toEqual([
      ['Đạt', 'interview', null],
      ['Loại', 'rejected', null],
    ]);
  });

  it('drops saved jobs and the removed application columns', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(6) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', '2026-12-01');
      insert into candidates (id, email) values ('22222222-2222-2222-2222-222222222222', 'an@gmail.com');
      insert into saved_jobs (candidate_id, job_id)
        values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const saved = await pg.query(`select to_regclass('public.saved_jobs') as t`);
    expect(saved.rows).toEqual([{ t: null }]);
    const columns = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_name in ('applications', 'candidates')
          and column_name in ('keep_for_other_jobs', 'thanked_at', 'candidate_updated_at')`,
    );
    expect(columns.rows).toEqual([]);
    expect(await db.select().from(schema.candidates)).toHaveLength(1);
  });
});

describe('migration 0012: hidden news posts', SLOW, () => {
  it('adds the hidden status and turns drafts that were once published into hidden posts', async () => {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(12) });
    await pg.exec(`
      insert into news_posts (slug, status, published_at) values
        ('chua-dang', 'draft', null),
        ('da-go', 'draft', '2026-10-20T03:00:00Z'),
        ('dang-hien', 'published', '2026-10-20T03:00:00Z');
    `);

    await migrate(db, { migrationsFolder: MIGRATIONS });

    const rows = await db.select().from(schema.newsPosts).orderBy(schema.newsPosts.slug);
    expect(rows.map((p) => [p.slug, p.status])).toEqual([
      ['chua-dang', 'draft'],
      ['da-go', 'hidden'],
      ['dang-hien', 'published'],
    ]);
    await db.insert(schema.newsPosts).values({ slug: 'moi-an', status: 'hidden' });
    const [fresh] = await db.insert(schema.newsPosts).values({ slug: 'mac-dinh' }).returning();
    expect(fresh.status).toBe('draft');
    const indexes = await pg.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'news_posts' order by indexname`,
    );
    expect(indexes.rows.map((r) => r.indexname)).toEqual([
      'news_posts_category_idx',
      'news_posts_pkey',
      'news_posts_slug_idx',
      'news_posts_status_published_idx',
    ]);
  });
});

describe('migration 0013: preferred qualifications on jobs', SLOW, () => {
  it('should give existing jobs an empty "Ưu tiên" list and keep their requirements', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(13) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, requirements, deadline)
        values ('cu', 'Cũ', 'Kinh doanh', 'full_time', 'Biết Excel', '2026-12-01');
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [job] = await db.select().from(schema.jobs);
    expect(job).toMatchObject({ slug: 'cu', requirements: 'Biết Excel', preferred: '' });
  });
});

describe('migration 0016: HR-managed sources', SLOW, () => {
  it('keeps every application on its source and turns the old list into rows HR can edit', async () => {
    // Arrange: an application from Zalo and one from the site, before the list exists.
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(16) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, deadline)
        values ('ke-toan', 'Kế toán', 'Tài chính', 'full_time', '2099-01-01');
      insert into applications (job_id, full_name, phone, consent_at, policy_version, source)
        select id, 'Qua Zalo', '0912000001', now(), 'v', 'zalo' from jobs;
      insert into applications (job_id, full_name, phone, consent_at, policy_version)
        select id, 'Tự nộp', '0912000002', now(), 'v' from jobs;
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const apps = await db.select().from(schema.applications).orderBy(schema.applications.fullName);
    expect(apps.map((a) => [a.fullName, a.source])).toEqual([
      ['Qua Zalo', 'zalo'],
      ['Tự nộp', 'website'],
    ]);
    const sources = await db.select().from(schema.applicationSources).orderBy(schema.applicationSources.position);
    expect(sources.map((s) => [s.key, s.name, s.kind])).toEqual([
      ['website', 'Website', 'system'],
      ['email', 'Email', 'builtin'],
      ['zalo', 'Zalo', 'builtin'],
      ['referral', 'Người giới thiệu', 'builtin'],
      ['topcv', 'TopCV', 'builtin'],
      ['vietnamworks', 'VietnamWorks', 'builtin'],
      ['facebook', 'Facebook', 'builtin'],
      ['other', 'Khác', 'builtin'],
    ]);
    // A source that is not in the list cannot be stored.
    await expect(pg.exec(`update applications set source = 'khong-co' where full_name = 'Qua Zalo'`)).rejects.toThrow();
  });
});

describe('migration 0017: level, openings and work mode on jobs', SLOW, () => {
  it('should keep existing jobs as they were, with the three new fields empty', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(17) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, requirements, deadline)
        values ('cu', 'Cũ', 'Kinh doanh', 'full_time', 'Biết Excel', '2026-12-01');
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [job] = await db.select().from(schema.jobs);
    expect(job).toMatchObject({
      slug: 'cu',
      requirements: 'Biết Excel',
      level: null,
      openings: null,
      workMode: null,
    });
  });
});

describe('migration 0018: mail templates', SLOW, () => {
  /** Everything an earlier version could have saved, on the schema before this migration. */
  async function databaseBefore0018() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(18) });
    await pg.exec(`
      insert into jobs (slug, title, department, employment_type, deadline)
        values ('ke-toan', 'Kế toán', 'Tài chính', 'full_time', '2099-01-01');
      insert into applications (job_id, full_name, phone, consent_at, policy_version)
        select id, 'Phạm Quốc Huy', '0912000001', now(), 'v' from jobs;
      insert into contact_log (application_id, template_key, channel, hr_name)
        select id, 'rejection', 'gmail', 'Phòng Nhân sự' from applications;
      insert into message_templates (key, subject, body) values ('rejection', 'Cũ', 'Một khối chữ cũ');
      insert into hr_users (email, name, password_hash, phone) values ('hr@congty.vn', 'Lan', 'h', '0909000111');
    `);
    return { pg, db };
  }

  it('should keep applications and their contact history', async () => {
    // Arrange
    const { db } = await databaseBefore0018();

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [application] = await db.select().from(schema.applications);
    expect(application.fullName).toBe('Phạm Quốc Huy');
    const contacts = await db.select().from(schema.contactLog);
    expect(contacts.map((c) => [c.applicationId, c.templateKey, c.channel, c.hrName])).toEqual([
      [application.id, 'rejection', 'gmail', 'Phòng Nhân sự'],
    ]);
  });

  it('should drop saved templates so the new built-in texts apply', async () => {
    // Arrange
    const { db } = await databaseBefore0018();

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    expect(await db.select().from(schema.messageTemplates)).toEqual([]);
  });

  it('should keep HR accounts, with job title and alias empty', async () => {
    // Arrange
    const { db } = await databaseBefore0018();

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [user] = await db.select().from(schema.hrUsers);
    expect(user).toMatchObject({ email: 'hr@congty.vn', phone: '0909000111', jobTitle: 'HR Generalist', alias: null });
  });

  it('should accept the new template and channels once applied', async () => {
    // Arrange
    const { db } = await databaseBefore0018();
    await migrate(db, { migrationsFolder: MIGRATIONS });
    const [application] = await db.select().from(schema.applications);

    // Act
    await db.insert(schema.contactLog).values([
      { applicationId: application.id, templateKey: 'rejection_interview', channel: 'copy_html', hrName: 'Lan' },
      { applicationId: application.id, templateKey: 'call', channel: 'copy_html', hrName: 'Lan' },
    ]);
    await db.insert(schema.messageTemplates).values({ key: 'rejection_interview', subject: 's', body: 'b' });

    // Assert
    expect(await db.select().from(schema.contactLog)).toHaveLength(3);
    const [template] = await db.select().from(schema.messageTemplates);
    expect(template).toMatchObject({ note: '', calloutTitle: '', callout: '', closing: '' });
  });
});

describe('migration 0030: how annual leave counts in each period', SLOW, () => {
  it('RV2-01: should mark periods closed before it as counted the workbook way, and open ones by the law', async () => {
    // Arrange: October closed, November open, as on 06/11/2026
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(30) });
    await pg.exec(`
      insert into timesheet_periods (year, month, from_on, to_on, status) values
        (2026, 10, '2026-09-26', '2026-10-25', 'closed'),
        (2026, 11, '2026-10-26', '2026-11-25', 'open');
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const modes = await pg.query<{ month: number; leave_mode: string }>(`select month, leave_mode from timesheet_periods order by month`);
    expect(modes.rows).toEqual([{ month: 10, leave_mode: 'excel' }, { month: 11, leave_mode: 'law' }]);
  });
});

describe('migration 0031: "Chờ xếp lịch"', SLOW, () => {
  it('TC-XL-06: should keep every application\'s status, and take the new one after', async () => {
    // Arrange: one invited, one seen, before 0031
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(31) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', '2026-12-01');
      insert into applications (job_id, full_name, phone, status, consent_at, policy_version) values
        ('11111111-1111-1111-1111-111111111111', 'Đã hẹn', '0912000001', 'interview', now(), 'v'),
        ('11111111-1111-1111-1111-111111111111', 'Đã xem', '0912000002', 'seen', now(), 'v');
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });
    await pg.exec(`update applications set status = 'scheduling' where full_name = 'Đã xem'`);

    // Assert
    const rows = await pg.query<{ full_name: string; status: string }>(`select full_name, status from applications order by full_name`);
    expect(rows.rows).toEqual([{ full_name: 'Đã hẹn', status: 'interview' }, { full_name: 'Đã xem', status: 'scheduling' }]);
  });
});

describe('migration 0035: papers kept with an absence', SLOW, () => {
  /** A database at 0034 with one person, one kind HR added and one absence. */
  async function databaseBefore0031() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(35) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('22222222-2222-2222-2222-222222222222', 'Vùng thử');
      insert into employees (id, code, full_name, region_id) values ('33333333-3333-3333-3333-333333333333', 'A01', 'Người thử', '22222222-2222-2222-2222-222222222222');
      insert into timesheet_absence_kinds (name, code, created_by) values ('Khám thai', 'CL', 'hr');
      insert into timesheet_absences (id, employee_id, reason, code, from_on, to_on, days, note, created_by)
        values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'sick', 'OM', '2026-11-02', '2026-11-03', 2, '', 'hr');
    `);
    return { pg, db };
  }

  it('TC-GT-30: should ask for no papers on a kind HR added before', async () => {
    // Arrange
    const { db } = await databaseBefore0031();

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [kind] = await db.select().from(schema.timesheetAbsenceKinds);
    expect(kind).toMatchObject({ name: 'Khám thai', needsPaper: false });
    expect(await db.select().from(schema.timesheetReasonSettings)).toEqual([]);
  });

  it('TC-GT-31: should keep files with their absence, and remove them with it', async () => {
    // Arrange
    const { db } = await databaseBefore0031();
    await migrate(db, { migrationsFolder: MIGRATIONS });
    const absenceId = '44444444-4444-4444-4444-444444444444';
    await db.insert(schema.timesheetAbsenceFiles).values([
      { absenceId, pathname: 'absence/a/1.jpg', name: 'giay-om-1.jpg', contentType: 'image/jpeg', size: 812_000, createdBy: 'hr' },
      { absenceId, pathname: 'absence/a/2.pdf', name: 'ra-vien.pdf', contentType: 'application/pdf', size: 95_000, createdBy: 'hr' },
    ]);

    // Act
    const kept = await db.select().from(schema.timesheetAbsenceFiles);
    await db.delete(schema.timesheetAbsences);

    // Assert
    expect(kept).toHaveLength(2);
    expect(await db.select().from(schema.timesheetAbsenceFiles)).toEqual([]);
  });

  it('TC-GT-32: should keep one setting a reason in the law', async () => {
    // Arrange
    const { db } = await databaseBefore0031();
    await migrate(db, { migrationsFolder: MIGRATIONS });
    await db.insert(schema.timesheetReasonSettings).values({ reasonKey: 'sick', needsPaper: false, updatedBy: 'hr' });

    // Act
    const again = db.insert(schema.timesheetReasonSettings).values({ reasonKey: 'sick', needsPaper: true, updatedBy: 'hr' });

    // Assert
    await expect(again).rejects.toThrow();
  });
});

describe('migration 0037: notes become a timeline', SLOW, () => {
  it('should copy each old note into a first entry, word for word, with its time and author', async () => {
    // Arrange: before 0036, four applications: a note with its author, an old note with neither, a blank one, none
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(36) });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', '2026-12-01');
      insert into applications
        (id, job_id, full_name, phone, consent_at, policy_version, note, note_updated_at, note_updated_by, updated_at)
      values
        ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Có ghi chú', '0912000001',
          now(), 'v', E'T7 gọi chưa được\\nT2 gọi lại', '2026-10-01T02:00:00Z', 'Chị Mẫu', '2026-10-05T02:00:00Z'),
        ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Ghi chú cũ', '0912000002',
          now(), 'v', 'Hẹn PV', null, null, '2026-09-01T02:00:00Z'),
        ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Trống', '0912000003',
          now(), 'v', '   ', '2026-10-01T02:00:00Z', 'Chị Mẫu', now()),
        ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Không có', '0912000004',
          now(), 'v', null, null, null, now());
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const notes = await pg.query<{ application_id: string; body: string; created_by: string | null; created_at: Date; updated_at: Date }>(
      `select application_id, body, created_by, created_at, updated_at from application_notes order by application_id`,
    );
    expect(notes.rows).toEqual([
      {
        application_id: '22222222-2222-2222-2222-222222222221',
        body: 'T7 gọi chưa được\nT2 gọi lại',
        created_by: 'Chị Mẫu',
        created_at: new Date('2026-10-01T02:00:00Z'),
        updated_at: new Date('2026-10-01T02:00:00Z'),
      },
      {
        application_id: '22222222-2222-2222-2222-222222222222',
        body: 'Hẹn PV',
        created_by: null,
        created_at: new Date('2026-09-01T02:00:00Z'),
        updated_at: new Date('2026-09-01T02:00:00Z'),
      },
    ]);
    const kept = await pg.query<{ note: string | null }>(`select note from applications order by phone`);
    expect(kept.rows.map((r) => r.note)).toEqual(['T7 gọi chưa được\nT2 gọi lại', 'Hẹn PV', '   ', null]);
  });

  it('should take the notes away with their application', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    await pg.exec(`
      insert into jobs (id, slug, title, department, employment_type, deadline)
        values ('11111111-1111-1111-1111-111111111111', 'a', 'A', 'Kỹ thuật', 'full_time', '2026-12-01');
      insert into applications (id, job_id, full_name, phone, consent_at, policy_version)
        values ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Mẫu', '0912000001', now(), 'v');
      insert into application_notes (application_id, body, created_by)
        values ('22222222-2222-2222-2222-222222222221', 'Gọi lại', 'Chị Mẫu');
    `);

    // Act
    await pg.exec(`delete from applications`);

    // Assert
    expect((await pg.query(`select * from application_notes`)).rows).toEqual([]);
  });
});

describe('migration 0038: company days off (Nghỉ công ty)', SLOW, () => {
  /** A database at 0037 with one fake person and one absence of their own. */
  async function databaseBefore0038() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(38) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('22222222-2222-2222-2222-222222222222', 'Vùng thử');
      insert into employees (id, code, full_name, region_id) values ('33333333-3333-3333-3333-333333333333', 'T01', 'Người thử', '22222222-2222-2222-2222-222222222222');
      insert into timesheet_absences (id, employee_id, reason, code, from_on, to_on, days, note, created_by)
        values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'annual', 'P', '2026-11-02', '2026-11-03', 2, '', 'hr');
    `);
    return { pg, db };
  }

  it('TC-NCT-30: should keep every absence there was, belonging to no batch', async () => {
    // Arrange
    const { db } = await databaseBefore0038();

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const [absence] = await db.select().from(schema.timesheetAbsences);
    expect(absence).toMatchObject({ id: '44444444-4444-4444-4444-444444444444', batchId: null, days: 2 });
    expect(await db.select().from(schema.timesheetAbsenceBatches)).toEqual([]);
  });

  it('TC-NCT-31: should link an absence to its batch, starting at version 1, and keep a batch that still has absences', async () => {
    // Arrange
    const { db } = await databaseBefore0038();
    await migrate(db, { migrationsFolder: MIGRATIONS });
    const [batch] = await db
      .insert(schema.timesheetAbsenceBatches)
      .values({ name: 'Nghỉ thử', reason: 'other-paid', label: 'Nghỉ có lương khác', code: 'CL', fromOn: '2026-11-09', toOn: '2026-11-09', audience: { kind: 'all' }, employeeIds: ['33333333-3333-3333-3333-333333333333'], createdBy: 'hr' })
      .returning();
    await db.insert(schema.timesheetAbsences).values({ employeeId: '33333333-3333-3333-3333-333333333333', reason: 'other-paid', code: 'CL', fromOn: '2026-11-09', toOn: '2026-11-09', days: 1, note: 'Nghỉ thử', batchId: batch?.id, createdBy: 'hr' });

    // Act
    const removing = db.delete(schema.timesheetAbsenceBatches);

    // Assert
    expect(batch).toMatchObject({ version: 1, note: '', approvedBy: null });
    await expect(removing).rejects.toThrow();
    expect(await db.select().from(schema.timesheetAbsences)).toHaveLength(2);
  });
});

describe('migration payroll_rights: Quyền Lương and its own log', SLOW, () => {
  it('L-H07: should leave every existing HR account without a payroll right, and refuse Duyệt without Xem, sửa', async () => {
    // Arrange: one HR account before the migration
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_rights')) });
    await pg.exec(`insert into hr_users (email, password_hash) values ('hr@congty.vn', 'h')`);

    // Act
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_rights') + 1) });

    // Assert
    const rights = await pg.query(`select can_payroll, can_approve_payroll from hr_users`);
    expect(rights.rows).toEqual([{ can_payroll: false, can_approve_payroll: false }]);
    await expect(pg.exec(`update hr_users set can_approve_payroll = true`)).rejects.toThrow();
  });

  it('L-I10: should keep the payroll log only added to', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_rights') + 1) });

    // Act
    await pg.exec(`insert into payroll_log (area, actor, action, detail, at) values ('quyen', 'Lan', 'Cấp quyền', 'x', now())`);

    // Assert
    await expect(pg.exec(`update payroll_log set detail = 'y'`)).rejects.toThrow(/only added to/);
    await expect(pg.exec(`delete from payroll_log`)).rejects.toThrow(/only added to/);
    expect((await pg.query(`select detail from payroll_log`)).rows).toEqual([{ detail: 'x' }]);
  });
});

describe('migration timesheet_closings: each close kept for good', SLOW, () => {
  const REGION = '11111111-1111-4111-8111-111111111111';
  const A = '22222222-2222-4222-8222-22222222222a';
  const B = '22222222-2222-4222-8222-22222222222b';
  const C = '22222222-2222-4222-8222-22222222222c';
  const HOLIDAY = '2026-10-01';
  const ENTERED: Record<string, AttendanceCode> = { '2026-10-01': '1', '2026-10-04': '1', '2026-10-05': 'P', '2026-10-06': 'KL' };

  /** What the close of 26/10 counted for someone who joined on 29/09, by the rules in @careers/shared. */
  function closedTotals() {
    const days = periodDays({ from: '2026-09-26', to: '2026-10-25' });
    const codes = days.map((day) =>
      dayCode({ day, entered: ENTERED[day] ?? null, isHoliday: day === HOLIDAY, today: '2026-10-26', joinedOn: '2026-09-29', leftOn: null }),
    );
    const totals = timesheetTotals({ codes, norm: 22, leaveOpening: 2, employment: 'official', rule: { threshold: 14, perPeriod: 1, mode: 'excel' } });
    return { ...totals, ...restDayWork(days, codes, new Set([HOLIDAY])) };
  }

  async function beforeClosings() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('timesheet_closings')) });
    const totals = closedTotals();
    const tampered = { ...totals, actual: totals.actual + 1 };
    const entries = Object.entries(ENTERED).flatMap(([day, code]) => [A, B, C].map((id) => `('${id}', '${day}', '${code}', 'Lan')`));
    await pg.exec(`
      insert into timesheet_regions (id, name, saturdays) values ('${REGION}', 'Vùng thử', 2);
      insert into employees (id, code, full_name, region_id, employment, joined_on, official_on) values
        ('${A}', 'NV01', 'NV A', '${REGION}', 'official', '2026-09-29', '2026-08-01'),
        ('${B}', 'NV02', 'NV B', '${REGION}', 'official', '2026-09-29', null),
        ('${C}', 'NV03', 'NV C', '${REGION}', 'official', '2026-09-29', null);
      insert into timesheet_periods (id, year, month, from_on, to_on, status, norms, closed_at, closed_by, frozen) values
        ('33333333-3333-4333-8333-333333333310', 2026, 10, '2026-09-26', '2026-10-25', 'closed', '{"${REGION}": 22}',
          '2026-10-26T03:00:00Z', 'Lan', '{"holidays": [{"day": "${HOLIDAY}", "name": "Lễ thử"}], "regions": []}'),
        ('33333333-3333-4333-8333-333333333311', 2026, 11, '2026-10-26', '2026-11-25', 'open', '{}', null, null, null);
      insert into timesheet_entries (employee_id, day, code, updated_by) values ${entries.join(', ')};
      insert into timesheet_snapshots (period_id, employee_id, code, full_name, department, title, region_id, employment, staff_label, joined_on, norm, leave_opening, leave_closing, totals) values
        ('33333333-3333-4333-8333-333333333310', '${A}', 'NV01', 'NV A', 'Kinh doanh', 'Nhân viên', '${REGION}', 'official', 'Chính thức', '2026-09-29', 22, 2, ${totals.leaveClosing}, '${JSON.stringify(totals)}'),
        ('33333333-3333-4333-8333-333333333310', '${B}', 'NV02', 'NV B', '', '', '${REGION}', 'official', null, '2026-09-29', 22, 2, ${totals.leaveClosing}, '${JSON.stringify(tampered)}'),
        ('33333333-3333-4333-8333-333333333310', '${C}', 'NV03', 'NV C', '', '', '${REGION}', 'official', null, '2026-09-29', 22, 2, 0, null),
        ('33333333-3333-4333-8333-333333333311', '${A}', 'NV01', 'NV A', '', '', '${REGION}', 'official', null, null, 22, 2, 2, null);
    `);
    return { pg, db };
  }

  it('L-L28: should keep each closed period as close number 1, copied from its snapshot, and nothing for an open one', async () => {
    // Arrange
    const { pg, db } = await beforeClosings();

    // Act
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('timesheet_closings') + 1) });

    // Assert
    const closings = await pg.query(`select year, month, close_no, closed_by, source, closed_at, norms, holidays from timesheet_closings`);
    expect(closings.rows).toEqual([
      {
        year: 2026,
        month: 10,
        close_no: 1,
        closed_by: 'Lan',
        source: 'backfill',
        closed_at: new Date('2026-10-26T03:00:00Z'),
        norms: { [REGION]: 22 },
        holidays: [{ day: HOLIDAY, name: 'Lễ thử' }],
      },
    ]);
    const rows = await pg.query<{ code: string; department: string; staff_label: string | null; official_on: string | null }>(
      `select code, department, staff_label, official_on::text from timesheet_closing_rows order by code`,
    );
    expect(rows.rows).toEqual([
      { code: 'NV01', department: 'Kinh doanh', staff_label: 'Chính thức', official_on: '2026-08-01' },
      { code: 'NV02', department: '', staff_label: null, official_on: null },
      { code: 'NV03', department: '', staff_label: null, official_on: null },
    ]);
  });

  it('L-C02: should rebuild the code of every day from the cells and the holidays of the close, matching its totals', async () => {
    // Arrange
    const { pg, db } = await beforeClosings();

    // Act
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('timesheet_closings') + 1) });

    // Assert
    const [row] = (
      await pg.query<{ codes: Record<string, string | null>; cannot_rebuild: boolean; kind: string | null }>(
        `select r.codes, r.cannot_rebuild, k.name as kind from timesheet_closing_rows r left join timesheet_staff_kinds k on k.id = r.staff_kind_id where r.code = 'NV01'`,
      )
    ).rows;
    expect(row?.cannot_rebuild).toBe(false);
    expect(row?.kind).toBe('Chính thức');
    expect(Object.keys(row?.codes ?? {})).toHaveLength(30);
    expect(row?.codes).toMatchObject({
      '2026-09-26': null,
      '2026-09-28': null,
      '2026-09-29': '1',
      '2026-10-01': '1',
      '2026-10-02': '1',
      '2026-10-04': '1',
      '2026-10-05': 'P',
      '2026-10-06': 'KL',
      '2026-10-11': null,
    });
  });

  it('L-C02: should mark a person whose totals the cells no longer give, or who has no totals, as not rebuilt, without codes', async () => {
    // Arrange
    const { pg, db } = await beforeClosings();

    // Act
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('timesheet_closings') + 1) });

    // Assert
    const rows = await pg.query(`select code, cannot_rebuild, codes from timesheet_closing_rows where code <> 'NV01' order by code`);
    expect(rows.rows).toEqual([
      { code: 'NV02', cannot_rebuild: true, codes: null },
      { code: 'NV03', cannot_rebuild: true, codes: null },
    ]);
  });

  it('L-L28: should refuse to change or remove a close, and to delete its period', async () => {
    // Arrange
    const { pg, db } = await beforeClosings();
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('timesheet_closings') + 1) });

    // Act + Assert
    await expect(pg.exec(`update timesheet_closing_rows set full_name = 'x'`)).rejects.toThrow(/never changed/);
    await expect(pg.exec(`delete from timesheet_closings`)).rejects.toThrow(/never changed/);
    await expect(pg.exec(`delete from timesheet_periods where month = 10`)).rejects.toThrow();
  });
});

describe('migration payroll_timesheet_link: khối, confirmed dates and the payroll month', SLOW, () => {
  const REGION = '11111111-1111-4111-8111-111111111111';

  it('L-L29: should leave every person without khối and with no date confirmed, as HR has not checked them yet', async () => {
    // Arrange: a person whose dates were typed in before the migration
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_timesheet_link')) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('${REGION}', 'Vùng thử');
      insert into employees (code, full_name, region_id, joined_on, official_on) values ('NV01', 'NV A', '${REGION}', '2026-01-05', '2026-03-05');
    `);

    // Act
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_timesheet_link') + 1) });

    // Assert
    const people = await pg.query(`select block, joined_on_confirmed, official_on_confirmed, left_on_confirmed from employees`);
    expect(people.rows).toEqual([{ block: null, joined_on_confirmed: false, official_on_confirmed: false, left_on_confirmed: false }]);
    await expect(pg.exec(`update employees set block = 'XX'`)).rejects.toThrow();
  });

  it('L-C04: should keep a payroll month on a close, refuse an approved one without it, and refuse an unknown status', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_timesheet_link') + 1) });

    // Act + Assert
    await expect(pg.exec(`insert into payroll_periods (year, month, status) values (2026, 10, 'approved')`)).rejects.toThrow();
    await expect(pg.exec(`insert into payroll_periods (year, month, status) values (2026, 10, 'other')`)).rejects.toThrow();
    await pg.exec(`insert into payroll_periods (year, month) values (2026, 10)`);
    const rows = await pg.query(`select status, closing_id, row_version from payroll_periods`);
    expect(rows.rows).toEqual([{ status: 'waiting', closing_id: null, row_version: 0 }]);
    await expect(pg.exec(`insert into payroll_periods (year, month) values (2026, 10)`)).rejects.toThrow();
  });

  it('L-L30: should keep one check per item and close, the close of a check kept (RESTRICT)', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_timesheet_link') + 1) });
    await pg.exec(`
      insert into timesheet_periods (id, year, month, from_on, to_on, status) values ('33333333-3333-4333-8333-333333333310', 2026, 10, '2026-09-26', '2026-10-25', 'closed');
      insert into timesheet_closings (id, period_id, close_no, year, month, from_on, to_on, closed_at, closed_by, source, holidays, regions, norms)
        values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333310', 1, 2026, 10, '2026-09-26', '2026-10-25', now(), 'Lan', 'backfill', '[]', '[]', '{}');
    `);
    const check = `insert into payroll_first_month_checks (item, closing_id, confirmed, confirmed_at, confirmed_by) values ('lan-chot-ky-cong', '44444444-4444-4444-8444-444444444444', true, now(), 'Lan')`;

    // Act
    await pg.exec(check);

    // Assert
    await expect(pg.exec(check)).rejects.toThrow();
    await expect(pg.exec(`delete from timesheet_closings`)).rejects.toThrow();
    expect((await pg.query(`select item, employee_id, confirmed from payroll_first_month_checks`)).rows).toEqual([
      { item: 'lan-chot-ky-cong', employee_id: null, confirmed: true },
    ]);
  });
});

describe('migration payroll_settings: versioned configuration rows', SLOW, () => {
  const A = '22222222-2222-4222-8222-22222222222a';
  const REGION = '11111111-1111-4111-8111-111111111111';

  async function migrated() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_settings') + 1) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('${REGION}', 'Vùng thử');
      insert into employees (id, code, full_name, region_id) values ('${A}', 'NV01', 'NV A', '${REGION}');
    `);
    return pg;
  }

  const row = (from: string, employee = 'null', superseded = 'null') =>
    `insert into payroll_settings (key, employee_id, applies_from, value, superseded_by, created_by)
       values ('quy-tac.gio-mot-ngay', ${employee}, '${from}', '8', ${superseded}, 'Lan')`;

  it('L-A13: should keep one live row per key, scope and date, a corrected row and a person’s row aside', async () => {
    // Arrange
    const pg = await migrated();
    await pg.exec(row('2026-12'));

    // Act + Assert
    await expect(pg.exec(row('2026-12'))).rejects.toThrow();
    await pg.exec(row('2026-12', `'${A}'`));
    await expect(pg.exec(row('2026-12', `'${A}'`))).rejects.toThrow();
    await pg.exec(row('2026-12', 'null', `'33333333-3333-4333-8333-333333333333'`));
    const rows = await pg.query(`select employee_id, superseded_by is not null as replaced from payroll_settings order by 1, 2`);
    expect(rows.rows).toEqual([
      { employee_id: A, replaced: false },
      { employee_id: null, replaced: false },
      { employee_id: null, replaced: true },
    ]);
  });

  it('L-L01: should refuse a row that is neither a value nor a stop, and a date in another shape', async () => {
    // Arrange
    const pg = await migrated();

    // Act + Assert
    await expect(
      pg.exec(`insert into payroll_settings (key, applies_from, created_by) values ('khoan.com.thue', '2026-12', 'Lan')`),
    ).rejects.toThrow();
    await expect(pg.exec(row('12/2026'))).rejects.toThrow();
    await pg.exec(`insert into payroll_settings (key, employee_id, applies_from, stop, created_by) values ('khoan.com.thue', '${A}', '2027-03', true, 'Lan')`);
    await expect(pg.exec(`delete from employees`)).rejects.toThrow();
  });
});

describe('migration payroll_profiles: hồ sơ lương', SLOW, () => {
  const A = '22222222-2222-4222-8222-22222222222a';
  const REGION = '11111111-1111-4111-8111-111111111111';
  const P = '55555555-5555-4555-8555-555555555555';

  async function migrated() {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_profiles') + 1) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('${REGION}', 'Vùng thử');
      insert into employees (id, code, full_name, region_id) values ('${A}', 'NV01', 'NV A', '${REGION}');
    `);
    return pg;
  }

  it('L-B11: should keep one level per person and date, its amounts going with it, the person kept (RESTRICT)', async () => {
    // Arrange
    const pg = await migrated();
    const level = (id: string) =>
      `insert into payroll_profiles (id, employee_id, effective_on, contract_type_id, created_by) values ('${id}', '${A}', '2026-11-01', 'khong-thoi-han', 'Lan')`;
    await pg.exec(level(P));
    await pg.exec(`insert into payroll_profile_amounts (profile_id, component_id, amount) values ('${P}', 'luong', 10000000000)`);

    // Act + Assert
    await expect(pg.exec(level('55555555-5555-4555-8555-555555555556'))).rejects.toThrow();
    await expect(pg.exec(`insert into payroll_profile_amounts (profile_id, component_id, amount) values ('${P}', 'com', -1)`)).rejects.toThrow();
    expect((await pg.query(`select amount from payroll_profile_amounts`)).rows).toEqual([{ amount: 10000000000 }]);
    await expect(pg.exec(`delete from employees`)).rejects.toThrow();
    await pg.exec(`delete from payroll_profiles`);
    expect((await pg.query(`select count(*)::int as n from payroll_profile_amounts`)).rows).toEqual([{ n: 0 }]);
  });

  it('L-B24: should have no column for the plain account number, only the cipher, its key version and last four digits', async () => {
    // Arrange
    const pg = await migrated();

    // Act
    const columns = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'payroll_bank_accounts' order by column_name`,
    );

    // Assert
    expect(columns.rows.map((c) => c.column_name)).toEqual([
      'account_cipher', 'bank', 'changed_on', 'created_at', 'created_by', 'employee_id', 'id', 'key_version', 'last4', 'payslip_email',
    ]);
    await expect(
      pg.exec(`insert into payroll_bank_accounts (employee_id, bank, account_cipher, key_version, last4, changed_on, created_by) values ('${A}', 'B', 'x', 1, '12a4', '2026-11-01', 'Lan')`),
    ).rejects.toThrow();
  });

  it('L-B21, L-E07: should keep one commitment and one opening balance per person and tax year', async () => {
    // Arrange
    const pg = await migrated();
    const commitment = `insert into payroll_tax_commitments (employee_id, year, signed_on, created_by) values ('${A}', 2026, '2026-11-20', 'Lan')`;
    const opening = `insert into payroll_opening (employee_id, tax_year, overtime_hours, updated_by, updated_at) values ('${A}', 2026, 12.5, 'Lan', now())`;

    // Act
    await pg.exec(commitment);
    await pg.exec(opening);

    // Assert
    await expect(pg.exec(commitment)).rejects.toThrow();
    await expect(pg.exec(opening)).rejects.toThrow();
    expect((await pg.query(`select overtime_hours::text as h from payroll_opening`)).rows).toEqual([{ h: '12.5' }]);
  });
});

describe('migration payroll_month_inputs: what HR types for a month', SLOW, () => {
  const A = '22222222-2222-4222-8222-22222222222a';
  const REGION = '11111111-1111-4111-8111-111111111111';

  it('L-D08, L-D09: should keep one row per person and month, and refuse a KPI over 200% or negative hours', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_month_inputs') + 1) });
    await pg.exec(`
      insert into timesheet_regions (id, name) values ('${REGION}', 'Vùng thử');
      insert into employees (id, code, full_name, region_id) values ('${A}', 'NV01', 'NV A', '${REGION}');
    `);
    const row = (kpi: string, hours: string) =>
      `insert into payroll_month_inputs (year, month, employee_id, kpi_percent, overtime_hours, updated_by, updated_at) values (2026, 11, '${A}', ${kpi}, ${hours}, 'Lan', now())`;

    // Act
    await pg.exec(row('0.875', '10.5'));

    // Assert
    await expect(pg.exec(row('0.5', '0'))).rejects.toThrow();
    await pg.exec(`delete from payroll_month_inputs`);
    await expect(pg.exec(row('2.5', '0'))).rejects.toThrow();
    await expect(pg.exec(row('null', '-1'))).rejects.toThrow();
    await pg.exec(row('null', '0'));
    const stored = await pg.query(`select kpi_percent, other_income, cash, note from payroll_month_inputs`);
    expect(stored.rows).toEqual([{ kpi_percent: null, other_income: [], cash: [], note: '' }]);
    await expect(pg.exec(`delete from employees`)).rejects.toThrow();
  });
});

describe('migration payroll_runs: bản duyệt lần N', SLOW, () => {
  const PERIOD = '33333333-3333-4333-8333-333333333333';
  const CLOSING = '44444444-4444-4444-8444-444444444444';
  const MONTH = '55555555-5555-4555-8555-555555555555';

  /** A closed November with its payroll month, before any approval. */
  async function closedMonth(): Promise<PGlite> {
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsUpTo(countBefore('payroll_runs') + 1) });
    await pg.exec(`
      insert into timesheet_periods (id, year, month, from_on, to_on, status, closed_by, closed_at)
        values ('${PERIOD}', 2026, 11, '2026-10-26', '2026-11-25', 'closed', 'Lan', now());
      insert into timesheet_closings (id, period_id, year, month, from_on, to_on, close_no, closed_at, closed_by, holidays, regions, norms)
        values ('${CLOSING}', '${PERIOD}', 2026, 11, '2026-10-26', '2026-11-25', 1, now(), 'Lan', '[]', '[]', '{}');
      insert into payroll_periods (id, year, month, status) values ('${MONTH}', 2026, 11, 'draft');
    `);
    return pg;
  }

  it('L-E05, L-E12: should keep an approval unchanged, only marked once as reopened, and never deleted', async () => {
    // Arrange
    const pg = await closedMonth();
    await pg.exec(`insert into payroll_runs (period_id, approval_no, closing_id, snapshot, approved_at, approved_by)
      values ('${MONTH}', 1, '${CLOSING}', '{"totals": {"netPay": 1000}}', now(), 'Lan')`);

    // Act
    await pg.exec(`update payroll_runs set reopened_at = now(), reopened_by = 'Lan', reopen_reason = 'Sai'`);

    // Assert
    await expect(pg.exec(`update payroll_runs set reopen_reason = 'Khác'`)).rejects.toThrow(/never changed/);
    await expect(pg.exec(`update payroll_runs set snapshot = '{}'`)).rejects.toThrow(/never changed/);
    await expect(pg.exec(`delete from payroll_runs`)).rejects.toThrow(/never changed/);
    const runs = await pg.query(`select snapshot, reopen_reason from payroll_runs`);
    expect(runs.rows).toEqual([{ snapshot: { totals: { netPay: 1000 } }, reopen_reason: 'Sai' }]);
  });

  it('should refuse a second approval with the same number for the month', async () => {
    // Arrange
    const pg = await closedMonth();
    const run = `insert into payroll_runs (period_id, approval_no, closing_id, snapshot, approved_at, approved_by)
      values ('${MONTH}', 1, '${CLOSING}', '{}', now(), 'Lan')`;

    // Act
    await pg.exec(run);

    // Assert
    await expect(pg.exec(run)).rejects.toThrow();
  });
});
