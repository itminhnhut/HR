import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, describe, expect, it } from 'vitest';
import * as schema from './schema.js';

/**
 * Migration 0051: the payslip email kept with a bank account moves to the person (`employees.email`), only where the
 * person has none. Made-up people and addresses.
 */
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'migration-0051-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A copy of the migrations folder that stops right before the migration named `name`. */
function migrationsBefore(name: string): string {
  const dir = join(tmp, 'before');
  cpSync(MIGRATIONS, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] };
  const index = journal.entries.findIndex((e) => e.tag.replace(/^\d+_/, '') === name);
  if (index < 0) throw new Error(`No migration named ${name}`);
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, index) }));
  return dir;
}

const person = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const account = (employee: number, email: string | null, changedOn: string) =>
  `('${person(employee)}', 'Ngân hàng Thử', 'x', 1, '0000', ${email === null ? 'null' : `'${email}'`}, '${changedOn}', 'Lan')`;

describe('migration 0051: payslip email moves to the person', { timeout: 60_000 }, () => {
  it('should copy the latest account email to a person without one, and never overwrite or invent one', async () => {
    // Arrange
    const pg = new PGlite();
    const db = drizzle({ client: pg, schema });
    await migrate(db, { migrationsFolder: migrationsBefore('payslip_email_to_employee') });
    await pg.exec(`
      insert into employees (id, code, full_name, region_id, email)
        select '${person(1)}', 'NV01', 'NV A', id, null from timesheet_regions limit 1;
      insert into employees (id, code, full_name, region_id, email)
        select '${person(2)}', 'NV02', 'NV B', id, 'rieng@example.com' from timesheet_regions limit 1;
      insert into employees (id, code, full_name, region_id, email)
        select '${person(3)}', 'NV03', 'NV C', id, null from timesheet_regions limit 1;
      insert into employees (id, code, full_name, region_id, email)
        select '${person(4)}', 'NV04', 'NV D', id, null from timesheet_regions limit 1;
      insert into payroll_bank_accounts
        (employee_id, bank, account_cipher, key_version, last4, payslip_email, changed_on, created_by) values
        ${account(1, 'cu@example.com', '2026-01-01')},
        ${account(1, ' Moi@Example.com ', '2026-06-01')},
        ${account(2, 'tai-khoan@example.com', '2026-01-01')},
        ${account(3, 'khong phai email', '2026-01-01')},
        ${account(4, null, '2026-01-01')};
    `);

    // Act
    await migrate(db, { migrationsFolder: MIGRATIONS });

    // Assert
    const people = await pg.query<{ code: string; email: string | null }>(
      `select code, email from employees order by code`,
    );
    expect(people.rows).toEqual([
      { code: 'NV01', email: 'moi@example.com' },
      { code: 'NV02', email: 'rieng@example.com' },
      { code: 'NV03', email: null },
      { code: 'NV04', email: null },
    ]);
    const kept = await pg.query<{ n: number }>(
      `select count(*)::int as n from payroll_bank_accounts where payslip_email is not null`,
    );
    expect(kept.rows[0]?.n).toBe(4);
  });
});
