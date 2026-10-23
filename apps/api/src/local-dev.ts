import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { seedDemoData } from './db/seed.js';
import type { CvStore } from './lib/cv-store.js';
import type { LocalOverrides } from './main.js';

/**
 * Local development without any account: Postgres runs in-process (PGlite, saved under apps/api/.data)
 * and CVs are files on disk. Only `npm run dev:api` uses this; Vercel always needs Neon and Blob.
 */
const DATA_DIR = fileURLToPath(new URL('../.data', import.meta.url));
const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));

async function localDb(): Promise<Db> {
  await mkdir(DATA_DIR, { recursive: true });
  const db = drizzle({ client: new PGlite(join(DATA_DIR, 'db')), schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const empty = (await db.select({ id: schema.jobs.id }).from(schema.jobs).limit(1)).length === 0;
  if (empty) {
    const seeded = await seedDemoData(db, new Date());
    console.info(`Local database seeded with ${seeded.jobs} demo jobs.`);
  }
  return db;
}

function localCvStore(): CvStore {
  const root = join(DATA_DIR, 'files');
  const full = (pathname: string) => join(root, pathname);
  return {
    async put(folder, file) {
      const pathname = `cv/${folder}/${crypto.randomUUID()}.pdf`;
      await mkdir(dirname(full(pathname)), { recursive: true });
      await writeFile(full(pathname), new Uint8Array(await file.arrayBuffer()));
      return pathname;
    },
    async get(pathname) {
      try {
        return new Blob([await readFile(full(pathname))]).stream();
      } catch (error) {
        console.warn('Local CV file missing', pathname, error instanceof Error ? error.message : error);
        return null;
      }
    },
    async delete(pathnames) {
      await Promise.all(pathnames.map((p) => rm(full(p), { force: true })));
    },
  };
}

/** Uses the local stand-ins only for what is not configured in apps/api/.env. */
export async function localDevOverrides(): Promise<LocalOverrides> {
  return {
    ...(process.env.DATABASE_URL ? {} : { db: await localDb() }),
    ...(process.env.BLOB_READ_WRITE_TOKEN ? {} : { cvStore: localCvStore() }),
  };
}
