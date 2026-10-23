// The demo data the FE mock uses, so local BE and mock show the same jobs and people.
import { buildSeed } from '../../../web/src/api/mock-seed.js';
import type { Db } from './index.js';
import { applications, candidates, jobs, savedJobs, subscribers } from './schema.js';

/** Fills an EMPTY database with demo data. Refuses when jobs already exist. */
export async function seedDemoData(db: Db, now: Date): Promise<{ jobs: number; applications: number }> {
  if ((await db.select({ id: jobs.id }).from(jobs).limit(1)).length > 0) {
    throw new Error('Database already has jobs; seeding only runs on an empty database.');
  }
  const seed = buildSeed(now);
  const ids = new Map(seed.jobs.map((job) => [job.id, crypto.randomUUID()]));
  const jobId = (mockId: string) => {
    const id = ids.get(mockId);
    if (!id) throw new Error(`Seed refers to unknown job ${mockId}`);
    return id;
  };

  const rows = toRows(seed, jobId);
  await db.transaction(async (tx) => {
    await tx.insert(jobs).values(rows.jobs);
    await tx.insert(applications).values(rows.applications);
    await tx.insert(subscribers).values(rows.subscribers);
    await tx.insert(candidates).values(rows.candidates);
    if (rows.savedJobs.length > 0) await tx.insert(savedJobs).values(rows.savedJobs);
  });
  return { jobs: seed.jobs.length, applications: seed.applications.length };
}

type Seed = ReturnType<typeof buildSeed>;

/** Mock rows → table rows: real uuids, Date objects, and no fake CV files. */
function toRows(seed: Seed, jobId: (mockId: string) => string) {
  const owner = seed.candidates[0]?.phone;
  return {
    jobs: seed.jobs.map(({ id, perks: _perks, createdAt, ...job }) => ({
      ...job,
      id: jobId(id),
      createdAt: new Date(createdAt),
    })),
    applications: seed.applications.map(
      ({ id: _id, jobId: mockJobId, cvFileName: _cv, consentAt, thankedAt, createdAt, ...a }) => ({
        ...a,
        jobId: jobId(mockJobId),
        // Demo rows have no real file behind them, so they show as "no CV" instead of a broken download.
        cvFileName: null,
        consentAt: new Date(consentAt),
        thankedAt: thankedAt ? new Date(thankedAt) : null,
        createdAt: new Date(createdAt),
      }),
    ),
    subscribers: seed.subscribers.map(({ id: _id, fromJobId, consentAt, policyVersion, createdAt, ...sub }) => ({
      ...sub,
      fromJobId: fromJobId ? jobId(fromJobId) : null,
      consentAt: new Date(consentAt),
      policyVersion: policyVersion ?? '2026-10',
      createdAt: new Date(createdAt),
    })),
    candidates: seed.candidates.map(({ alertDepartments: _a, cvFileName: _cv, ...c }) => ({ ...c, cvFileName: null })),
    savedJobs: owner
      ? seed.jobs.filter((job) => seed.saved.includes(job.slug)).map((job) => ({ phone: owner, jobId: jobId(job.id) }))
      : [],
  };
}
