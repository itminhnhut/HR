import { ABSENCE_FILE_PROBLEM_MESSAGE, ABSENCE_FILES_MAX, absenceFileProblem, type AbsenceFileDto, type HrMe } from '@careers/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetAbsenceFiles, timesheetAbsences } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { deletePapersQuietly, type PaperStore } from '../lib/paper-store.js';
import { isUuid } from '../lib/request.js';
import { rangeWords } from './timesheet-absences.js';
import { actorOf, logChange } from './timesheet-people.js';

/** Papers kept with an absence (spec-giay-to-nghi.md): added and removed one by one, read only through the API. */

type FileRow = typeof timesheetAbsenceFiles.$inferSelect;

const fileDto = (f: FileRow): AbsenceFileDto => ({ id: f.id, name: f.name, contentType: f.contentType, size: f.size, createdBy: f.createdBy, createdAt: f.createdAt.toISOString() });

/** Each absence's papers, oldest first. */
export async function filesByAbsence(db: Db, absenceIds: readonly string[]): Promise<Map<string, AbsenceFileDto[]>> {
  const byAbsence = new Map<string, AbsenceFileDto[]>();
  if (absenceIds.length === 0) return byAbsence;
  const rows = await db.select().from(timesheetAbsenceFiles).where(inArray(timesheetAbsenceFiles.absenceId, [...absenceIds])).orderBy(asc(timesheetAbsenceFiles.createdAt));
  for (const r of rows) byAbsence.set(r.absenceId, [...(byAbsence.get(r.absenceId) ?? []), fileDto(r)]);
  return byAbsence;
}

const listOf = async (db: Db, absenceId: string) => (await filesByAbsence(db, [absenceId])).get(absenceId) ?? [];

async function absenceOf(db: Db, absenceId: string) {
  const [found] = isUuid(absenceId)
    ? await db.select({ absence: timesheetAbsences, fullName: employees.fullName }).from(timesheetAbsences).innerJoin(employees, eq(employees.id, timesheetAbsences.employeeId)).where(eq(timesheetAbsences.id, absenceId))
    : [];
  if (!found) throw notFound('Không tìm thấy dòng nghỉ.');
  return found;
}

async function fileOf(db: Db, fileId: string) {
  const file = isUuid(fileId) ? await db.query.timesheetAbsenceFiles.findFirst({ where: eq(timesheetAbsenceFiles.id, fileId) }) : undefined;
  if (!file) throw notFound('Không tìm thấy file.');
  return file;
}

/** "Người A, Ốm có giấy BHXH 12/10–13/10: giay-om.jpg", as the log reads it. */
const lineOf = (found: Awaited<ReturnType<typeof absenceOf>>, what: string) =>
  `${found.fullName}, ${found.absence.label} ${rangeWords(found.absence.fromOn, found.absence.toOn)}: ${what}`;
const spanOf = (found: Awaited<ReturnType<typeof absenceOf>>) => ({ from: found.absence.fromOn, to: found.absence.toOn });

/** Control characters and folder parts out; a name is only shown, never used as a path. */
const cleanName = (raw: string, ext: string) => raw.replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 200) || `giay-to.${ext}`;

/** Also on a closed period's absence: papers often come later, and they change no number. */
export async function addAbsenceFile(db: Db, store: PaperStore, absenceId: string, file: File | null, hr: HrMe, now: Date): Promise<AbsenceFileDto[]> {
  const found = await absenceOf(db, absenceId);
  if (!file) throw invalid('Chọn file để gửi.');
  if ((await listOf(db, absenceId)).length >= ABSENCE_FILES_MAX) throw new HttpError(409, `Mỗi dòng nghỉ giữ tối đa ${ABSENCE_FILES_MAX} file. Xoá bớt rồi gửi lại.`, {}, 'too_many_files');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = absenceFileProblem(bytes);
  if (checked.problem) throw new HttpError(400, ABSENCE_FILE_PROBLEM_MESSAGE[checked.problem], {}, checked.problem);
  const pathname = `absence/${absenceId}/${crypto.randomUUID()}.${checked.ext}`;
  const name = cleanName(file.name, checked.ext);
  await store.put(pathname, bytes, checked.contentType);
  try {
    await db.insert(timesheetAbsenceFiles).values({ absenceId, pathname, name, contentType: checked.contentType, size: bytes.length, createdBy: actorOf(hr) });
  } catch (error) {
    await deletePapersQuietly(store, [pathname]);
    throw error;
  }
  await logChange(db, hr, 'Thêm giấy tờ', lineOf(found, name), now, spanOf(found));
  return listOf(db, absenceId);
}

/** The file as it was sent, shown in the browser and kept out of caches and search engines. */
export async function readAbsenceFile(db: Db, store: PaperStore, fileId: string): Promise<Response> {
  const file = await fileOf(db, fileId);
  const stream = await store.get(file.pathname);
  if (!stream) throw notFound('Không đọc được file.');
  return new Response(stream, {
    headers: {
      'content-type': file.contentType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export async function removeAbsenceFile(db: Db, store: PaperStore, fileId: string, hr: HrMe, now: Date): Promise<AbsenceFileDto[]> {
  const file = await fileOf(db, fileId);
  const found = await absenceOf(db, file.absenceId);
  await db.delete(timesheetAbsenceFiles).where(eq(timesheetAbsenceFiles.id, fileId));
  await deletePapersQuietly(store, [file.pathname]);
  await logChange(db, hr, 'Xoá giấy tờ', lineOf(found, file.name), now, spanOf(found));
  return listOf(db, file.absenceId);
}

/**
 * Before an absence is cancelled: what to clear from the store once it is gone (its rows go with it).
 * Returns the cleanup, to run only when the cancel went through.
 */
export async function papersToClear(db: Db, store: PaperStore, absenceId: string, hr: HrMe, now: Date): Promise<() => Promise<void>> {
  const files = isUuid(absenceId) ? await db.select().from(timesheetAbsenceFiles).where(eq(timesheetAbsenceFiles.absenceId, absenceId)) : [];
  if (files.length === 0) return async () => undefined;
  const found = await absenceOf(db, absenceId);
  return async () => {
    await deletePapersQuietly(store, files.map((f) => f.pathname));
    await logChange(db, hr, 'Xoá giấy tờ', lineOf(found, `${files.length} file, cùng dòng nghỉ đã huỷ`), now, spanOf(found));
  };
}
