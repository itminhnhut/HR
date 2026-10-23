import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createApp } from '../app.js';
import type { Db } from '../db/index.js';
import * as schema from '../db/schema.js';
import type { Deps } from '../deps.js';
import { fakeGoogle, MemoryCvStore, RecordingOtpSender } from './fakes.js';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
const TABLES = Object.values(schema)
  .filter((v) => is(v, PgTable))
  .map((t) => `"${getTableName(t)}"`)
  .join(', ');

export const HR_EMAIL = 'hr@congty.vn';

/** 10:00 on 20/10/2026 in Vietnam. */
export const DEFAULT_NOW = new Date('2026-10-20T03:00:00.000Z');

export interface TestContext {
  db: Db;
  clock: { now: Date };
  cvStore: MemoryCvStore;
  otp: RecordingOtpSender;
  deps: Deps;
  request(path: string, init?: RequestInit): Promise<Response>;
  /** JSON request with the CSRF header the FE always sends. */
  send(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  reset(): Promise<void>;
}

/** A real Postgres (PGlite) with the real migrations, one per test file. */
export async function createTestContext(): Promise<TestContext> {
  const pglite = drizzle({ client: new PGlite(), schema });
  await migrate(pglite, { migrationsFolder: MIGRATIONS });
  const db: Db = pglite;

  const clock = { now: DEFAULT_NOW };
  const cvStore = new MemoryCvStore();
  const otp = new RecordingOtpSender();
  const deps: Deps = {
    db,
    config: {
      siteUrl: 'https://tuyendung.test',
      companyName: 'Công ty Test',
      isProduction: false,
      sessionSecret: 'test-secret-test-secret-test-secret!',
      hrEmails: [HR_EMAIL],
      secureCookies: false,
    },
    cvStore,
    verifyGoogleToken: fakeGoogle,
    otpSender: otp,
    now: () => clock.now,
  };
  const app = createApp(deps);
  const request = async (path: string, init?: RequestInit) => app.request(path, init);

  return {
    db,
    clock,
    cvStore,
    otp,
    deps,
    request,
    send: (method, path, body, headers = {}) =>
      request(path, {
        method,
        headers: { 'x-requested-with': 'careers-web', 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    async reset() {
      clock.now = DEFAULT_NOW;
      cvStore.clear();
      otp.sent.length = 0;
      deps.otpSender = otp;
      await db.execute(sql.raw(`TRUNCATE ${TABLES} CASCADE`));
    },
  };
}
