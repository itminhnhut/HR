import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
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
