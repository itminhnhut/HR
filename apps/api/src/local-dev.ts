import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { sampleCvPdf } from './db/sample-cv.js';
import { seedDemoData } from './db/seed.js';
import { findHrUser, upsertHrUser } from './services/hr-accounts.js';
import type { CvStore } from './lib/cv-store.js';
import { localImageStore } from './lib/image-store.js';
import { rewriteLocalImageUrls } from './lib/local-image-urls.js';
import { generatePassword } from './lib/password.js';
import type { LocalOverrides } from './main.js';

/**
 * Local development without any account: Postgres runs in-process (PGlite, saved under apps/api/.data)
 * and CVs are files on disk. Only `npm run dev:api` uses this; Vercel always needs Neon and Blob.
 */
const DATA_DIR = fileURLToPath(new URL('../.data', import.meta.url));
const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));
/** Local only. The password is random per machine and kept in .data/hr-login.txt (git-ignored). */
const LOCAL_HR = { email: 'hr@congty.vn', name: 'Phòng Nhân sự' };
const LOCAL_HR_FILE = join(DATA_DIR, 'hr-login.txt');

async function localDb(cvStore: CvStore | undefined): Promise<Db> {
  await mkdir(DATA_DIR, { recursive: true });
  const db = drizzle({ client: new PGlite(join(DATA_DIR, 'db')), schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const empty = (await db.select({ id: schema.jobs.id }).from(schema.jobs).limit(1)).length === 0;
  if (empty) {
    const seeded = await seedDemoData(db, new Date());
    if (cvStore) await attachSampleCvs(db, cvStore);
    console.info(`Local database seeded with ${seeded.jobs} demo jobs.`);
  }
  await ensureLocalHr(db);
  const moved = await rewriteLocalImageUrls(db);
  if (moved > 0) console.info(`Local news images: ${moved} posts now use site paths (/api/news-images/…).`);
  return db;
}

/** Demo applications without a CV get a small real PDF, so "Xem CV" can be tried locally. */
async function attachSampleCvs(db: Db, cvStore: CvStore): Promise<void> {
  const rows = await db
    .select()
    .from(schema.applications)
    .where(and(isNull(schema.applications.cvPathname), isNull(schema.applications.cvLink)));
  for (const app of rows) {
    const fileName = `CV_${app.fullName.split(' ').pop() ?? 'mau'}.pdf`;
    const pathname = await cvStore.put(app.jobId, new File([sampleCvPdf(app.fullName)], fileName));
    await db
      .update(schema.applications)
      .set({ cvPathname: pathname, cvFileName: fileName })
      .where(eq(schema.applications.id, app.id));
  }
}

/** Creates the local HR account with a fresh random password the first time (or after the file is deleted). */
async function ensureLocalHr(db: Db): Promise<void> {
  const saved = await readFile(LOCAL_HR_FILE, 'utf8').catch(() => null);
  if (saved && (await findHrUser(db, LOCAL_HR.email))) {
    console.info(`Local HR login is in ${LOCAL_HR_FILE}`);
    return;
  }
  const password = generatePassword();
  await upsertHrUser(db, { ...LOCAL_HR, password });
  await writeFile(LOCAL_HR_FILE, `Email: ${LOCAL_HR.email}\nMật khẩu: ${password}\n`, { mode: 0o600 });
  console.info(`Local HR account ${LOCAL_HR.email}, password saved to ${LOCAL_HR_FILE}`);
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
  const cvStore = process.env.BLOB_READ_WRITE_TOKEN ? undefined : localCvStore();
  // News images need a PUBLIC store; without its token they are files served by GET /api/news-images/:name.
  const imageStore = process.env.NEWS_BLOB_READ_WRITE_TOKEN
    ? undefined
    : localImageStore(join(DATA_DIR, 'news-images'));
  return {
    ...(process.env.DATABASE_URL ? {} : { db: await localDb(cvStore) }),
    ...(cvStore ? { cvStore } : {}),
    ...(imageStore ? { imageStore } : {}),
  };
}
