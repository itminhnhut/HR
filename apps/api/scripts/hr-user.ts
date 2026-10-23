/**
 * Create an HR account, or reset its password:
 *   npm run hr:user -w @careers/api -- --email hr@lee-hr.com --name "Phòng Nhân sự" [--password ...]
 * Without --password a strong one is generated and printed once. Uses DATABASE_URL, or the local dev DB.
 * Delete an account: npm run hr:user -w @careers/api -- --email hr@lee-hr.com --delete
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { createNeonDb, type Db } from '../src/db/index.js';
import { hrUsers } from '../src/db/schema.js';
import { generatePassword } from '../src/lib/password.js';
import { localDevOverrides } from '../src/local-dev.js';
import { normalizeEmail, upsertHrUser } from '../src/services/hr-accounts.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    delete: { type: 'boolean', default: false },
  },
});
if (!values.email) throw new Error('--email is required');

const url = process.env.DATABASE_URL;
const db: Db | undefined = url ? createNeonDb(url) : (await localDevOverrides()).db;
if (!db) throw new Error('No database: set DATABASE_URL or run without it for the local dev DB.');

if (values.delete) {
  const removed = await db
    .delete(hrUsers)
    .where(eq(hrUsers.email, normalizeEmail(values.email)))
    .returning();
  console.info(removed.length ? `Deleted ${values.email}.` : `No account ${values.email}.`);
} else {
  const password = values.password ?? generatePassword();
  const user = await upsertHrUser(db, { email: values.email, name: values.name ?? null, password });
  console.info(`HR account ready: ${user.email}${values.password ? '' : `\nPassword (shown once): ${password}`}`);
}
process.exit(0);
