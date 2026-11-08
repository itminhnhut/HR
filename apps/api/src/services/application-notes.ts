import { fieldErrors, noteInputSchema, type ApplicationNoteDto, type HrMe } from '@careers/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { applicationNotes } from '../db/schema.js';
import { invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { actorOf, logActivity } from './activity.js';

/** "Ghi chú nội bộ" as a timeline (spec-nhat-ky-ho-so.md). Every change is logged with the old words. */

type NoteRow = typeof applicationNotes.$inferSelect;

const toDto = (row: NoteRow): ApplicationNoteDto => ({
  id: row.id,
  body: row.body,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Newest first. */
export async function notesOf(db: Db, applicationId: string): Promise<ApplicationNoteDto[]> {
  const rows = await db
    .select()
    .from(applicationNotes)
    .where(eq(applicationNotes.applicationId, applicationId))
    .orderBy(desc(applicationNotes.createdAt), desc(applicationNotes.id));
  return rows.map(toDto);
}

/** The newest note of each application asked for, for the list and the dashboard. */
export async function newestNotes(db: Db, applicationIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (applicationIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([applicationNotes.applicationId], {
      applicationId: applicationNotes.applicationId,
      body: applicationNotes.body,
    })
    .from(applicationNotes)
    .where(inArray(applicationNotes.applicationId, [...applicationIds]))
    .orderBy(applicationNotes.applicationId, desc(applicationNotes.createdAt), desc(applicationNotes.id));
  return new Map(rows.map((r) => [r.applicationId, r.body]));
}

/** A new entry, already checked. Also what an old "PATCH { note }" and a note given with "Thêm hồ sơ" become. */
export async function insertNote(db: Db, applicationId: string, body: string, actor: string, at: Date): Promise<void> {
  await db.insert(applicationNotes).values({ applicationId, body, createdBy: actor, createdAt: at, updatedAt: at });
  await logActivity(db, { applicationId, kind: 'note', actor, to: body, detail: 'add', at });
}

function parseBody(raw: unknown): string {
  const parsed = noteInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại ghi chú.', fieldErrors(parsed.error));
  return parsed.data.body;
}

async function findNote(db: Db, applicationId: string, noteId: string): Promise<NoteRow> {
  const [row] =
    isUuid(applicationId) && isUuid(noteId)
      ? await db
          .select()
          .from(applicationNotes)
          .where(and(eq(applicationNotes.id, noteId), eq(applicationNotes.applicationId, applicationId)))
      : [];
  if (!row) throw notFound('Không tìm thấy ghi chú.');
  return row;
}

export async function addNote(db: Db, applicationId: string, raw: unknown, hr: HrMe, now: Date): Promise<void> {
  await insertNote(db, applicationId, parseBody(raw), actorOf(hr), now);
}

/** Anyone in HR may edit any note (spec §8.2); the log keeps what it said. */
export async function editNote(db: Db, applicationId: string, noteId: string, raw: unknown, hr: HrMe, now: Date) {
  const note = await findNote(db, applicationId, noteId);
  const body = parseBody(raw);
  if (body === note.body) return;
  await db.update(applicationNotes).set({ body, updatedAt: now }).where(eq(applicationNotes.id, note.id));
  await logActivity(db, {
    applicationId,
    kind: 'note',
    actor: actorOf(hr),
    from: note.body,
    to: body,
    detail: 'edit',
    at: now,
  });
}

export async function deleteNote(db: Db, applicationId: string, noteId: string, hr: HrMe, now: Date): Promise<void> {
  const note = await findNote(db, applicationId, noteId);
  await db.delete(applicationNotes).where(eq(applicationNotes.id, note.id));
  await logActivity(db, {
    applicationId,
    kind: 'note',
    actor: actorOf(hr),
    from: note.body,
    detail: 'delete',
    at: now,
  });
}
