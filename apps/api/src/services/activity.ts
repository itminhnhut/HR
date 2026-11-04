import type { ActivityDto, ActivityKind, HrMe } from '@careers/shared';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applicationActivity } from '../db/schema.js';

/** Note saves itself while HR types: edits this close together are one edit. */
const NOTE_EDIT_WINDOW_MS = 10 * 60_000;

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

/** One line of "Nhật ký hồ sơ": who changed what, from what to what. Deleted with the application. */
export async function logActivity(db: Db, entry: ActivityInput): Promise<void> {
  await db.insert(applicationActivity).values({
    applicationId: entry.applicationId,
    kind: entry.kind,
    actor: entry.actor,
    fromValue: entry.from ?? null,
    toValue: entry.to ?? null,
    detail: entry.detail ?? null,
    ...(entry.at ? { createdAt: entry.at } : {}),
  });
}

export async function logNoteEdit(db: Db, applicationId: string, actor: string, at: Date): Promise<void> {
  const [last] = await db
    .select()
    .from(applicationActivity)
    .where(eq(applicationActivity.applicationId, applicationId))
    .orderBy(desc(applicationActivity.createdAt))
    .limit(1);
  const isSameEdit =
    last?.kind === 'note' && last.actor === actor && at.getTime() - last.createdAt.getTime() < NOTE_EDIT_WINDOW_MS;
  if (isSameEdit && last) {
    await db.update(applicationActivity).set({ createdAt: at }).where(eq(applicationActivity.id, last.id));
    return;
  }
  await logActivity(db, { applicationId, kind: 'note', actor, at });
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
