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
import { fakeGoogle, MemoryCvStore, MemoryImageStore, RecordingFetch } from './fakes.js';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
const TABLES = Object.values(schema)
  .filter((v) => is(v, PgTable))
  .map((t) => `"${getTableName(t)}"`)
  .join(', ');

export const HR_EMAIL = 'hr@congty.vn';
export const TEST_INDEXNOW_KEY = 'test-indexnow-key-0001';

/** 10:00 on 20/10/2026 in Vietnam. */
export const DEFAULT_NOW = new Date('2026-10-20T03:00:00.000Z');

export interface TestContext {
  db: Db;
  clock: { now: Date };
  cvStore: MemoryCvStore;
  imageStore: MemoryImageStore;
  /** Outgoing HTTP calls (IndexNow). */
  outbound: RecordingFetch;
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
  const imageStore = new MemoryImageStore();
  const outbound = new RecordingFetch();
  const deps: Deps = {
    db,
    config: {
      siteUrl: 'https://tuyendung.test',
      companyName: 'Công ty Test',
      isProduction: false,
      sessionSecret: 'test-secret-test-secret-test-secret!',
      secureCookies: false,
      indexNowKey: TEST_INDEXNOW_KEY,
    },
    cvStore,
    imageStore,
    verifyGoogleToken: fakeGoogle,
    verifyCaptcha: null,
    now: () => clock.now,
    fetch: outbound.fetch,
  };
  const app = createApp(deps);
  const request = async (path: string, init?: RequestInit) => app.request(path, init);

  return {
    db,
    clock,
    cvStore,
    imageStore,
    outbound,
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
      deps.cvStore = cvStore;
      imageStore.clear();
      deps.imageStore = imageStore;
      outbound.clear();
      deps.fetch = outbound.fetch;
      deps.config.indexNowKey = TEST_INDEXNOW_KEY;
      deps.config.isProduction = false;
      deps.verifyGoogleToken = fakeGoogle;
      deps.verifyCaptcha = null;
      await db.execute(sql.raw(`TRUNCATE ${TABLES} CASCADE`));
    },
  };
}
