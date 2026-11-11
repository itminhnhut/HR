import type {
  AttendanceCode,
  StaffType,
  TimesheetClosingChangeDto,
  TimesheetClosingDto,
  TimesheetClosingRowDto,
  TimesheetHolidayDto,
  TimesheetRegionDto,
  TimesheetTotals,
} from '@careers/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, timesheetClosingRows, timesheetClosings, timesheetPeriods } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';

/**
 * Lần chốt kỳ công (spec-luong.md 10.1, 4.19). Each close is written once, with the code of every day, and never
 * changed: closing again after a reopen adds the next number, so payroll keeps pointing at the close it paid from.
 */

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Period = typeof timesheetPeriods.$inferSelect;
type Closing = typeof timesheetClosings.$inferSelect;
type ClosingRow = typeof timesheetClosingRows.$inferSelect;

/** One person as the close counted them: the snapshot of Chấm công and the code of every day. */
export interface ClosedPerson {
  employeeId: string;
  code: string;
  fullName: string;
  department: string;
  title: string;
  regionId: string;
  employment: StaffType;
  staffLabel?: string | null;
  joinedOn: string | null;
  leftOn: string | null;
  norm: number;
  totals: TimesheetTotals;
  codes: Record<string, AttendanceCode | null>;
}

export interface NewClosing {
  period: Period;
  closedAt: Date;
  closedBy: string;
  holidays: TimesheetHolidayDto[];
  regions: TimesheetRegionDto[];
  norms: Record<string, number>;
  people: readonly ClosedPerson[];
}

/**
 * Writes the next close of a period, inside the transaction that closes it. What the person is now (official date,
 * kind) is read with the close, so a later edit of the person does not reach it.
 */
export async function recordClosing(tx: Tx, input: NewClosing): Promise<Closing> {
  const { period, people } = input;
  const [last] = await tx
    .select({ no: sql<number>`coalesce(max(${timesheetClosings.closeNo}), 0)`.mapWith(Number) })
    .from(timesheetClosings)
    .where(eq(timesheetClosings.periodId, period.id));
  const ids = people.map((p) => p.employeeId);
  const live = ids.length === 0 ? [] : await tx.select().from(employees).where(inArray(employees.id, ids));
  const [closing] = await tx
    .insert(timesheetClosings)
    .values({
      periodId: period.id,
      closeNo: (last?.no ?? 0) + 1,
      year: period.year,
      month: period.month,
      fromOn: period.fromOn,
      toOn: period.toOn,
      closedAt: input.closedAt,
      closedBy: input.closedBy,
      source: 'web',
      holidays: input.holidays,
      regions: input.regions,
      norms: input.norms,
    })
    .returning();
  if (!closing) throw new Error('Closing missing after insert');
  if (people.length > 0) {
    await tx.insert(timesheetClosingRows).values(
      people.map((p) =>
        closingRowOf(
          closing.id,
          p,
          live.find((e) => e.id === p.employeeId),
        ),
      ),
    );
  }
  return closing;
}

function closingRowOf(closingId: string, p: ClosedPerson, person: typeof employees.$inferSelect | undefined) {
  return {
    closingId,
    employeeId: p.employeeId,
    code: p.code,
    fullName: p.fullName,
    department: p.department,
    title: p.title,
    block: person?.block ?? null,
    regionId: p.regionId,
    staffKindId: person?.staffKindId ?? null,
    staffLabel: p.staffLabel ?? null,
    employment: p.employment,
    joinedOn: p.joinedOn,
    officialOn: person?.officialOn ?? null,
    leftOn: p.leftOn,
    norm: p.norm,
    totals: p.totals,
    codes: p.codes,
    cannotRebuild: false,
  };
}

const rowDtoOf = (r: ClosingRow): TimesheetClosingRowDto => ({
  employeeId: r.employeeId,
  code: r.code,
  fullName: r.fullName,
  department: r.department,
  title: r.title,
  block: r.block,
  regionId: r.regionId,
  staffKindId: r.staffKindId,
  staffLabel: r.staffLabel,
  employment: r.employment,
  joinedOn: r.joinedOn,
  officialOn: r.officialOn,
  leftOn: r.leftOn,
  norm: r.norm,
  totals: r.totals,
  codes: r.codes,
  cannotRebuild: r.cannotRebuild,
});

const closingDtoOf = (
  c: Closing,
  rows: TimesheetClosingRowDto[],
  changes: TimesheetClosingChangeDto[] | null,
): TimesheetClosingDto => ({
  id: c.id,
  periodId: c.periodId,
  closeNo: c.closeNo,
  year: c.year,
  month: c.month,
  from: c.fromOn,
  to: c.toOn,
  closedAt: c.closedAt.toISOString(),
  closedBy: c.closedBy,
  source: c.source,
  holidays: c.holidays,
  norms: c.norms,
  rows,
  changesFromPrevious: changes,
});

async function rowsOf(db: Db, closingIds: readonly string[]): Promise<Map<string, TimesheetClosingRowDto[]>> {
  const out = new Map<string, TimesheetClosingRowDto[]>();
  if (closingIds.length === 0) return out;
  const rows = await db
    .select()
    .from(timesheetClosingRows)
    .where(inArray(timesheetClosingRows.closingId, [...closingIds]))
    .orderBy(asc(timesheetClosingRows.code));
  for (const r of rows) out.set(r.closingId, [...(out.get(r.closingId) ?? []), rowDtoOf(r)]);
  return out;
}

/** Every close of a period, oldest first, each with what changed since the one before it. */
export async function listClosings(db: Db, periodId: string): Promise<TimesheetClosingDto[]> {
  if (!isUuid(periodId)) throw notFound('Không tìm thấy kỳ công.');
  const closings = await db
    .select()
    .from(timesheetClosings)
    .where(eq(timesheetClosings.periodId, periodId))
    .orderBy(asc(timesheetClosings.closeNo));
  const rows = await rowsOf(
    db,
    closings.map((c) => c.id),
  );
  return closings.map((c, i) => {
    const previous = closings[i - 1];
    const changes = previous ? closingChanges(rows.get(previous.id) ?? [], rows.get(c.id) ?? [], c.regions) : null;
    return closingDtoOf(c, rows.get(c.id) ?? [], changes);
  });
}

/** One close with its people, or undefined. */
export async function readClosing(
  db: Pick<Db, 'select'>,
  closingId: string,
): Promise<{ closing: Closing; rows: TimesheetClosingRowDto[] } | undefined> {
  const [closing] = await db.select().from(timesheetClosings).where(eq(timesheetClosings.id, closingId));
  if (!closing) return undefined;
  const rows = await db
    .select()
    .from(timesheetClosingRows)
    .where(eq(timesheetClosingRows.closingId, closingId))
    .orderBy(asc(timesheetClosingRows.code));
  return { closing, rows: rows.map(rowDtoOf) };
}

/** What payroll reads from a close (spec-luong.md 5.1), in the order HR reads it. */
const COMPARED_TOTALS: readonly [key: string, label: string][] = [
  ['paid', 'Công hưởng lương'],
  ['norm', 'Công chuẩn'],
  ['overtime', 'OT'],
  ['sundayWorked', 'Làm Chủ nhật'],
  ['holidayWorked', 'Làm lễ'],
  ['maternity', 'Thai sản'],
  ['sick', 'Ốm'],
  ['unpaidLeave', 'Nghỉ không lương'],
  ['leaveOverdrawn', 'Phép vượt'],
  ['leaveClosing', 'Phép cuối kỳ'],
];

type Change = TimesheetClosingChangeDto['changes'][number];

const numberWords = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));
const fullDate = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const totalOf = (totals: TimesheetTotals | null, key: string): number | undefined => {
  const value = totals ? Object.entries(totals).find(([k]) => k === key)?.[1] : undefined;
  return typeof value === 'number' ? value : undefined;
};

function totalChanges(before: TimesheetClosingRowDto, after: TimesheetClosingRowDto): Change[] {
  return COMPARED_TOTALS.flatMap(([key, label]) => {
    const [a, b] = [numberWords(totalOf(before.totals, key)), numberWords(totalOf(after.totals, key))];
    return a === b ? [] : [{ label, before: a, after: b }];
  });
}

/** Who the person was: what payroll groups and splits by. */
export function personChanges(
  before: TimesheetClosingRowDto,
  after: TimesheetClosingRowDto,
  regions: readonly TimesheetRegionDto[],
): Change[] {
  const regionName = (id: string) => regions.find((r) => r.id === id)?.name ?? id;
  const fields: [label: string, a: string, b: string][] = [
    ['Khu vực', regionName(before.regionId), regionName(after.regionId)],
    ['Khối', before.block ?? '', after.block ?? ''],
    ['Loại', before.staffLabel ?? before.employment, after.staffLabel ?? after.employment],
    ['Ngày vào', fullDate(before.joinedOn), fullDate(after.joinedOn)],
    ['Ngày chính thức', fullDate(before.officialOn), fullDate(after.officialOn)],
    ['Ngày nghỉ việc', fullDate(before.leftOn), fullDate(after.leftOn)],
  ];
  return fields.filter(([, a, b]) => a !== b).map(([label, a, b]) => ({ label, before: a, after: b }));
}

function dayChanges(before: TimesheetClosingRowDto, after: TimesheetClosingRowDto): Change[] {
  const [a, b] = [before.codes, after.codes];
  if (!a || !b) return [];
  const days = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return days.flatMap((day) => {
    const [x, y] = [a[day] ?? null, b[day] ?? null];
    return x === y ? [] : [{ label: `Ngày ${fullDate(day)}`, before: x ?? '–', after: y ?? '–' }];
  });
}

const PRESENCE = 'Có trong lần chốt';

/** Each person whose figures, details or days differ between two closes of a period. */
export function closingChanges(
  before: readonly TimesheetClosingRowDto[],
  after: readonly TimesheetClosingRowDto[],
  regions: readonly TimesheetRegionDto[],
): TimesheetClosingChangeDto[] {
  const changed = after.flatMap((row) => {
    const old = before.find((b) => b.employeeId === row.employeeId);
    const changes = old
      ? [...totalChanges(old, row), ...personChanges(old, row, regions), ...dayChanges(old, row)]
      : [{ label: PRESENCE, before: 'Không', after: 'Có' }];
    return changes.length > 0 ? [{ employeeId: row.employeeId, code: row.code, fullName: row.fullName, changes }] : [];
  });
  const gone = before
    .filter((b) => !after.some((a) => a.employeeId === b.employeeId))
    .map((b) => ({
      employeeId: b.employeeId,
      code: b.code,
      fullName: b.fullName,
      changes: [{ label: PRESENCE, before: 'Có', after: 'Không' }],
    }));
  return [...changed, ...gone];
}
