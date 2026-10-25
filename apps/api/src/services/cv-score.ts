import {
  CV_MATCH_VERSION,
  NO_REQUIREMENT,
  scoreCv,
  toLines,
  todayInVietnam,
  type CvScoreDto,
  type MatchItem,
} from '@careers/shared';
import { eq, isNotNull } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import type { Db } from '../db/index.js';
import { applications, cvScores, jobs, type Application, type Job } from '../db/schema.js';
import { pdfText } from '../lib/pdf-text.js';

/** The job's requirement lines, plus its "Kinh nghiệm" and "Học vấn" choices when they ask for something. */
export function requirementLines(job: Pick<Job, 'requirements' | 'experience' | 'education'>): string[] {
  const asks = (v: string | null) => !!v?.trim() && v.trim() !== NO_REQUIREMENT;
  return [
    ...(asks(job.experience) ? [`Kinh nghiệm: ${job.experience}`] : []),
    ...(asks(job.education) ? [`Học vấn: ${job.education}`] : []),
    ...toLines(job.requirements),
  ];
}

type ScoreRow = typeof cvScores.$inferSelect;

const toDto = (row: ScoreRow): CvScoreDto => ({
  percent: row.percent,
  items: row.items,
  note: row.note,
  scoredAt: row.scoredAt.toISOString(),
});

async function readCv(deps: Deps, app: Application): Promise<{ text: string; note: string | null }> {
  if (!app.cvPathname) {
    return {
      text: '',
      note: app.cvLink ? 'CV là link, không đọc được tự động: HR mở link để xem.' : 'Hồ sơ không có CV.',
    };
  }
  const stream = await deps.cvStore.get(app.cvPathname);
  if (!stream) return { text: '', note: 'Không đọc được file CV.' };
  const text = await pdfText(new Uint8Array(await new Response(stream).arrayBuffer()));
  return { text, note: text ? null : 'CV là ảnh scan hoặc không có chữ, HR xem trực tiếp.' };
}

export async function storedScore(db: Db, applicationId: string): Promise<CvScoreDto | null> {
  const row = await db.query.cvScores.findFirst({ where: eq(cvScores.applicationId, applicationId) });
  return row ? toDto(row) : null;
}

/**
 * Scores the application's CV against its job (spec-cv-match.md), reusing the stored result while the CV,
 * the requirements and the rules are unchanged. Nothing leaves our server.
 */
export async function scoreApplication(deps: Deps, app: Application, job: Job): Promise<CvScoreDto> {
  const requirements = requirementLines(job);
  const requirementsKey = requirements.join('\n');
  const existing = await deps.db.query.cvScores.findFirst({ where: eq(cvScores.applicationId, app.id) });
  if (
    existing &&
    existing.version === CV_MATCH_VERSION &&
    existing.cvPathname === app.cvPathname &&
    existing.requirementsKey === requirementsKey
  ) {
    return toDto(existing);
  }
  const { text, note } = await readCv(deps, app);
  const result = scoreCv({ cvText: text, requirements, today: todayInVietnam(deps.now()) });
  const items: MatchItem[] = result.items;
  const row = {
    applicationId: app.id,
    percent: text ? result.percent : null,
    items,
    note,
    version: CV_MATCH_VERSION,
    cvPathname: app.cvPathname,
    requirementsKey,
    scoredAt: deps.now(),
  };
  await deps.db.insert(cvScores).values(row).onConflictDoUpdate({ target: cvScores.applicationId, set: row });
  return toDto(row);
}

/** How many CVs one call scores, so a request stays well inside the function time limit. */
export const SCORE_BATCH = 10;

/**
 * Scores CV files that have no up-to-date result (new CV, changed requirements or rules), up to SCORE_BATCH
 * per call, so the applicant list can show a percent for every CV without HR opening each one.
 */
export async function scorePending(deps: Deps): Promise<{ scored: number; remaining: number }> {
  const rows = await deps.db
    .select({ app: applications, job: jobs, score: cvScores })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .leftJoin(cvScores, eq(cvScores.applicationId, applications.id))
    .where(isNotNull(applications.cvPathname));
  const stale = rows.filter(
    ({ app, job, score }) =>
      !score ||
      score.version !== CV_MATCH_VERSION ||
      score.cvPathname !== app.cvPathname ||
      score.requirementsKey !== requirementLines(job).join('\n'),
  );
  const batch = stale.slice(0, SCORE_BATCH);
  for (const { app, job } of batch) await scoreApplication(deps, app, job);
  return { scored: batch.length, remaining: stale.length - batch.length };
}
