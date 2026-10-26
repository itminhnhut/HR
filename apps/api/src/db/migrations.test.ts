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
