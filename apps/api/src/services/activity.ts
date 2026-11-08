import type { ActivityDto, ActivityKind, HrMe } from '@careers/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applicationActivity } from '../db/schema.js';
import { activityWords } from './activity-words.js';
import { logRecruitment } from './recruitment-log.js';

export const actorOf = (hr: Pick<HrMe, 'name' | 'email'>) => hr.name || hr.email;

interface ActivityInput {
  applicationId: string;
  kind: ActivityKind;
  actor: string;
  from?: string | null;
  to?: string | null;
  detail?: string | null;
  at?: Date;
}

/**
 * One line of "Nhật ký hồ sơ": who changed what, from what to what. Deleted with the application. The same change goes
 * into "Nhật ký tuyển dụng" in words, here and only here, so the two logs never disagree.
 */
export async function logActivity(db: Db, entry: ActivityInput): Promise<void> {
  const at = entry.at ?? new Date();
  await logRecruitment(db, {
    applicationId: entry.applicationId,
    actor: entry.actor,
    at,
    ...(await activityWords(db, entry)),
  });
  // A note's words stay in its timeline and in "Nhật ký tuyển dụng"; "Nhật ký hồ sơ" only says it changed.
  const isNote = entry.kind === 'note';
  await db.insert(applicationActivity).values({
    applicationId: entry.applicationId,
    kind: entry.kind,
    actor: entry.actor,
    fromValue: isNote ? null : (entry.from ?? null),
    toValue: isNote ? null : (entry.to ?? null),
    detail: entry.detail ?? null,
    createdAt: at,
  });
}

export async function activityOf(db: Db, applicationId: string): Promise<ActivityDto[]> {
  const rows = await db
    .select()
    .from(applicationActivity)
    .where(eq(applicationActivity.applicationId, applicationId))
    .orderBy(desc(applicationActivity.createdAt));
  return rows.map((row) => ({
    kind: row.kind,
    actor: row.actor,
    at: row.createdAt.toISOString(),
    from: row.fromValue,
    to: row.toValue,
    detail: row.detail,
  }));
}
