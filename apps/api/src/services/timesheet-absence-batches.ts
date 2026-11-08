import { absenceBatchInputSchema, fieldErrors, type AbsenceBatchDto, type AbsenceBatchSaveDto, type BatchAudience, type HrMe } from '@careers/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetAbsenceBatches, timesheetAbsenceFiles, timesheetAbsences } from '../db/schema.js';
import { HttpError, invalid, notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import {
  daysWords,
  eraseCells,
  fieldsOf,
  listAbsenceKinds,
  rangeWords,
  rememberApprover,
  requireNoClosedPeriod,
  resolveFor,
  whoOf,
  writeCells,
  type Resolved,
  type Tx,
} from './timesheet-absences.js';
import { actorOf, dayWords, logChange } from './timesheet-people.js';

/**
 * "Nghỉ công ty": one company day off, one absence per person it comes to, each through the single-absence rules. Every
 * save runs in one transaction, so one refusal saves nobody; the version makes two saves of one batch apply only once.
 */

type Batch = typeof timesheetAbsenceBatches.$inferSelect;
type Person = typeof employees.$inferSelect;
type Absence = typeof timesheetAbsences.$inferSelect;
type Input = NonNullable<ReturnType<typeof absenceBatchInputSchema.safeParse>['data']>;
interface Applied { person: Person; resolved: Resolved }

const toDto = (b: Batch): AbsenceBatchDto => ({
  id: b.id,
  name: b.name,
  reason: b.reason,
  label: b.label,
  code: b.code,
  from: b.fromOn,
  to: b.toOn,
  approvedBy: b.approvedBy,
  note: b.note,
  audience: b.audience,
  employeeIds: b.employeeIds,
  version: b.version,
  createdBy: b.createdBy,
  createdAt: b.createdAt.toISOString(),
});

export async function listAbsenceBatches(db: Db, year: number): Promise<AbsenceBatchDto[]> {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw invalid('Năm không hợp lệ.');
  const rows = await db.select().from(timesheetAbsenceBatches)
    .where(and(lte(timesheetAbsenceBatches.fromOn, `${year}-12-31`), gte(timesheetAbsenceBatches.toOn, `${year}-01-01`)))
    .orderBy(desc(timesheetAbsenceBatches.fromOn), desc(timesheetAbsenceBatches.createdAt));
  return rows.map(toDto);
}

function parse(raw: unknown): Input {
  const parsed = absenceBatchInputSchema.safeParse(raw);
  if (!parsed.success) throw invalid('Kiểm tra lại đợt nghỉ.', fieldErrors(parsed.error));
  return parsed.data;
}

async function labelOf(tx: Tx, reason: string): Promise<string> {
  const kind = (await listAbsenceKinds(tx)).find((k) => k.key === reason);
  if (!kind) throw invalid('Chọn lý do nghỉ.', { reason: 'Chọn lý do nghỉ.' });
  return kind.name;
}

/** Who the batch comes to, locked until the save ends: at work on some day of it, or the people picked. */
async function peopleFor(tx: Tx, audience: BatchAudience, from: string, to: string): Promise<Person[]> {
  if (audience.kind === 'people') {
    const found = await tx.select().from(employees).where(inArray(employees.id, audience.employeeIds)).orderBy(asc(employees.code)).for('update');
    const missing = audience.employeeIds.find((id) => !found.some((p) => p.id === id));
    if (missing) throw new HttpError(404, 'Không tìm thấy một người đã chọn. Tải lại trang.', {}, undefined, { employeeId: missing });
    return found;
  }
  const atWork = and(or(isNull(employees.joinedOn), lte(employees.joinedOn, to)), or(isNull(employees.leftOn), gte(employees.leftOn, from)));
  const which = audience.kind === 'region' ? inArray(employees.regionId, audience.regionIds) : audience.kind === 'department' ? inArray(employees.department, audience.departments) : undefined;
  return tx.select().from(employees).where(and(atWork, which)).orderBy(asc(employees.code)).for('update');
}

/** Each person's absence says the batch's name on the sheet, unless the batch has a note of its own. */
const absenceInput = (input: Input) => ({ reason: input.reason, code: input.code, from: input.from, to: input.to, approvedBy: input.approvedBy ?? '', note: input.note || input.name, handover: '' });

/** A refusal for one person of the batch: whose it is, so HR can take that person out and save again. */
function forPerson(error: unknown, person: Person): unknown {
  if (!(error instanceof HttpError)) return error;
  return new HttpError(error.status, `${whoOf(person)}: ${error.message}`, {}, error.code, { employeeId: person.id, fullName: person.fullName });
}

/** One person's absence, new or changed, by the single-absence rules. Null when none of their working days fall in it. */
async function applyTo(tx: Tx, person: Person, input: Input, batchId: string, current: Absence | undefined, hr: HrMe, now: Date): Promise<Resolved | null> {
  try {
    const resolved = await resolveFor(tx, person, absenceInput(input), current);
    if (resolved.fill.length === 0) return null;
    await writeCells(tx, person.id, resolved, actorOf(hr), now);
    if (current) await tx.update(timesheetAbsences).set(fieldsOf(resolved)).where(eq(timesheetAbsences.id, current.id));
    else await tx.insert(timesheetAbsences).values({ employeeId: person.id, ...fieldsOf(resolved), batchId, createdBy: actorOf(hr) });
    return resolved;
  } catch (error) {
    throw forPerson(error, person);
  }
}

async function applyToAll(tx: Tx, people: readonly Person[], input: Input, batchId: string, current: ReadonlyMap<string, Absence>, hr: HrMe, now: Date) {
  const kept: Applied[] = [];
  const skipped: Person[] = [];
  for (const person of people) {
    const resolved = await applyTo(tx, person, input, batchId, current.get(person.id), hr, now);
    if (resolved) kept.push({ person, resolved });
    else skipped.push(person);
  }
  return { kept, skipped };
}

/** An absence cancelled with its batch: its papers go too, from the store once the save has gone through. */
async function dropAbsence(tx: Tx, absence: Absence, person: Person | undefined, hr: HrMe, now: Date): Promise<string[]> {
  const files = await tx.select({ pathname: timesheetAbsenceFiles.pathname }).from(timesheetAbsenceFiles).where(eq(timesheetAbsenceFiles.absenceId, absence.id));
  await tx.delete(timesheetAbsences).where(eq(timesheetAbsences.id, absence.id));
  if (files.length > 0) {
    await logChange(tx, hr, 'Xoá giấy tờ', `${person ? whoOf(person) : ''}: ${absence.label}, ${rangeWords(absence.fromOn, absence.toOn)}, ${files.length} file, cùng dòng nghỉ đã huỷ`, now, { from: absence.fromOn, to: absence.toOn });
  }
  return files.map((f) => f.pathname);
}

const stateWords = (approvedBy: string | null) => (approvedBy ? `${approvedBy} duyệt` : 'chờ duyệt');
const summary = (b: Pick<Batch, 'name' | 'label' | 'code' | 'fromOn' | 'toOn'>, count: number) => `${b.name}: ${b.label} (${b.code}), ${rangeWords(b.fromOn, b.toOn)}, ${count} người`;
const spanOf = (...batches: Pick<Batch, 'fromOn' | 'toOn'>[]) => ({
  from: batches.map((b) => b.fromOn).reduce((a, b) => (a < b ? a : b)),
  to: batches.map((b) => b.toOn).reduce((a, b) => (a > b ? a : b)),
});

async function logPeople(tx: Tx, hr: HrMe, name: string, added: readonly Applied[], removed: readonly Person[], now: Date, span: { from: string; to: string }) {
  for (const { person, resolved } of added) await logChange(tx, hr, 'Thêm vào đợt nghỉ công ty', `${name}: ${whoOf(person)}, ${daysWords(resolved.days)} ngày`, now, span);
  for (const person of removed) await logChange(tx, hr, 'Bỏ khỏi đợt nghỉ công ty', `${name}: ${whoOf(person)}`, now, span);
}

const noOneWorks = (input: Input) => invalid(`Không ai trong đợt có ngày làm việc từ ${dayWords(input.from)} đến ${dayWords(input.to)}.`);
const skippedOf = (people: readonly Person[]) => people.map((p) => ({ employeeId: p.id, fullName: p.fullName }));

export async function createAbsenceBatch(db: Db, raw: unknown, hr: HrMe, now: Date): Promise<AbsenceBatchSaveDto> {
  const input = parse(raw);
  return db.transaction(async (tx) => {
    await requireNoClosedPeriod(tx, input.from, input.to);
    const label = await labelOf(tx, input.reason);
    const people = await peopleFor(tx, input.audience, input.from, input.to);
    const fields = { name: input.name, reason: input.reason, label, code: input.code, fromOn: input.from, toOn: input.to, approvedBy: input.approvedBy || null, note: input.note ?? '', audience: input.audience };
    const [batch] = await tx.insert(timesheetAbsenceBatches).values({ ...fields, createdBy: actorOf(hr) }).returning();
    if (!batch) throw new Error('Batch missing after insert');
    const { kept, skipped } = await applyToAll(tx, people, input, batch.id, new Map(), hr, now);
    if (kept.length === 0) throw noOneWorks(input);
    const [saved] = await tx.update(timesheetAbsenceBatches).set({ employeeIds: kept.map((k) => k.person.id) }).where(eq(timesheetAbsenceBatches.id, batch.id)).returning();
    if (!saved) throw new Error('Batch missing after update');
    await rememberApprover(tx, hr, saved.approvedBy, now);
    await logChange(tx, hr, 'Tạo đợt nghỉ công ty', `${summary(saved, kept.length)}, ${stateWords(saved.approvedBy)}`, now, spanOf(saved));
    await logPeople(tx, hr, saved.name, kept, [], now, spanOf(saved));
    return { ...toDto(saved), skipped: skippedOf(skipped) };
  });
}

/** Takes the batch for this save: only from the version HR edited, which a save made since has replaced. */
async function claim(tx: Tx, id: string, version: number | undefined): Promise<Batch> {
  const found = isUuid(id) ? await tx.query.timesheetAbsenceBatches.findFirst({ where: eq(timesheetAbsenceBatches.id, id) }) : undefined;
  if (!found) throw notFound('Không tìm thấy đợt nghỉ.');
  const [claimed] = version === undefined
    ? []
    : await tx.update(timesheetAbsenceBatches).set({ version: sql`${timesheetAbsenceBatches.version} + 1` })
      .where(and(eq(timesheetAbsenceBatches.id, id), eq(timesheetAbsenceBatches.version, version))).returning();
  if (!claimed) throw new HttpError(409, 'Đợt nghỉ này vừa được sửa ở nơi khác. Tải lại rồi sửa tiếp.', {}, 'batch_changed');
  return claimed;
}

function batchChanges(before: Batch, after: Batch, added: readonly Applied[], removed: readonly Person[]): string {
  const pairs: [string, string, string][] = [
    ['Tên', before.name, after.name],
    ['Lý do', before.label, after.label],
    ['Cách tính', before.code, after.code],
    ['Ngày', rangeWords(before.fromOn, before.toOn), rangeWords(after.fromOn, after.toOn)],
    ['Người duyệt', before.approvedBy ?? 'chưa', after.approvedBy ?? 'chưa'],
    ['Ghi chú', before.note || 'không', after.note || 'không'],
  ];
  const parts = pairs.filter(([, a, b]) => a !== b).map(([what, a, b]) => `${what} ${a} → ${b}`);
  if (added.length > 0) parts.push(`thêm ${added.map((a) => whoOf(a.person)).join(', ')}`);
  if (removed.length > 0) parts.push(`bỏ ${removed.map(whoOf).join(', ')}`);
  return parts.join('; ') || 'Không đổi';
}

async function membersOf(tx: Tx, batchId: string) {
  return tx.select({ absence: timesheetAbsences, person: employees }).from(timesheetAbsences)
    .innerJoin(employees, eq(employees.id, timesheetAbsences.employeeId)).where(eq(timesheetAbsences.batchId, batchId));
}

/** Everyone in it again, by the new dates and rules: people added, people left out, the rest changed in place. */
export async function updateAbsenceBatch(db: Db, id: string, raw: unknown, hr: HrMe, now: Date): Promise<{ batch: AbsenceBatchSaveDto; papers: string[] }> {
  const input = parse(raw);
  return db.transaction(async (tx) => {
    const before = await claim(tx, id, input.version);
    await requireNoClosedPeriod(tx, before.fromOn, before.toOn);
    await requireNoClosedPeriod(tx, input.from, input.to);
    const label = await labelOf(tx, input.reason);
    const people = await peopleFor(tx, input.audience, input.from, input.to);
    const members = await membersOf(tx, id);
    for (const m of members) await eraseCells(tx, m.absence);
    const current = new Map(members.map((m) => [m.person.id, m.absence]));
    const { kept, skipped } = await applyToAll(tx, people, input, id, current, hr, now);
    if (kept.length === 0) throw noOneWorks(input);
    const gone = members.filter((m) => !kept.some((k) => k.person.id === m.person.id));
    const papers: string[] = [];
    for (const m of gone) papers.push(...(await dropAbsence(tx, m.absence, m.person, hr, now)));
    const fields = { name: input.name, reason: input.reason, label, code: input.code, fromOn: input.from, toOn: input.to, approvedBy: input.approvedBy || null, note: input.note ?? '', audience: input.audience, employeeIds: kept.map((k) => k.person.id), updatedAt: now };
    const [saved] = await tx.update(timesheetAbsenceBatches).set(fields).where(eq(timesheetAbsenceBatches.id, id)).returning();
    if (!saved) throw notFound('Không tìm thấy đợt nghỉ.');
    const added = kept.filter((k) => !current.has(k.person.id));
    const removed = gone.map((m) => m.person);
    await rememberApprover(tx, hr, saved.approvedBy, now);
    await logChange(tx, hr, 'Sửa đợt nghỉ công ty', `${saved.name}: ${kept.length} người; ${batchChanges(before, saved, added, removed)}`, now, spanOf(before, saved));
    await logPeople(tx, hr, saved.name, added, removed, now, spanOf(before, saved));
    return { batch: { ...toDto(saved), skipped: skippedOf(skipped) }, papers };
  });
}

/** Cancels every absence of the batch, giving their days back as single cancels do, and the batch with them. */
export async function removeAbsenceBatch(db: Db, id: string, hr: HrMe, now: Date): Promise<{ removed: number; papers: string[] }> {
  if (!isUuid(id)) throw notFound('Không tìm thấy đợt nghỉ.');
  return db.transaction(async (tx) => {
    const [batch] = await tx.select().from(timesheetAbsenceBatches).where(eq(timesheetAbsenceBatches.id, id)).for('update');
    if (!batch) throw notFound('Không tìm thấy đợt nghỉ.');
    await requireNoClosedPeriod(tx, batch.fromOn, batch.toOn);
    const members = await membersOf(tx, id);
    const papers: string[] = [];
    for (const m of members) {
      await eraseCells(tx, m.absence);
      papers.push(...(await dropAbsence(tx, m.absence, m.person, hr, now)));
    }
    await tx.delete(timesheetAbsenceBatches).where(eq(timesheetAbsenceBatches.id, id));
    await logChange(tx, hr, 'Xoá đợt nghỉ công ty', summary(batch, members.length), now, spanOf(batch));
    await logPeople(tx, hr, batch.name, [], members.map((m) => m.person), now, spanOf(batch));
    return { removed: members.length, papers };
  });
}
