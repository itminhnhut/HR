import {
  acceptsApplications,
  candidateStage,
  effectiveStatus,
  phoneSchema,
  todayInVietnam,
  type LookupResponse,
} from '@careers/shared';
import { and, desc, eq, getTableColumns, gte } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { applications, jobs } from '../db/schema.js';
import { invalid } from '../lib/http-error.js';
import { enforceLimits } from '../lib/rate-limit.js';

export const LOOKUP_DAYS = 90;
const MINUTE = 60_000;
const BUSY = 'Bạn tra cứu nhiều lần quá. Thử lại sau ít phút.';

const lookupSchema = z.object({ phone: phoneSchema });

/**
 * Public lookup by phone only (product decision, BA Q1). To limit what a stranger who knows the number can learn:
 * only job title, date and the candidate-facing stage, only the last 90 days, and rate limits per IP and per number.
 */
export async function lookupByPhone(db: Db, raw: unknown, ip: string, now: Date): Promise<LookupResponse> {
  const parsed = lookupSchema.safeParse(raw);
  if (!parsed.success) {
    throw invalid('Số điện thoại chưa đúng.', { phone: 'Số điện thoại chưa đúng, ví dụ 0912 345 678.' });
  }
  const { phone } = parsed.data;
  await enforceLimits(
    db,
    [
      { key: `lookup:ip:${ip}`, max: 5, windowMs: 15 * MINUTE },
      { key: `lookup:phone:${phone}`, max: 10, windowMs: 24 * 60 * MINUTE },
    ],
    now,
    BUSY,
  );
  const since = new Date(now.getTime() - LOOKUP_DAYS * 24 * 60 * MINUTE);
  const rows = await db
    .select({ app: getTableColumns(applications), job: getTableColumns(jobs) })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.phone, phone), gte(applications.createdAt, since)))
    .orderBy(desc(applications.createdAt));
  return {
    applications: rows.map(({ app, job }) => {
      const status = effectiveStatus(job, now);
      return {
        jobTitle: job.title,
        jobSlug: job.slug,
        appliedOn: todayInVietnam(app.createdAt),
        stage: candidateStage(app.status, !acceptsApplications(status)),
      };
    }),
  };
}
