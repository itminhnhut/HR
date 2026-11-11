import type { PayrollPersonDto, PayrollProfileVersionDto } from '@careers/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { employees, payrollProfileAmounts, payrollProfiles } from '../db/schema.js';
import { notFound } from '../lib/http-error.js';
import { isUuid } from '../lib/request.js';
import { periodOfMonth } from './payroll-months.js';

/** Reading a person and their pay levels; shared by the profile routes (spec-luong.md 10.2). */

export type Reader = Pick<Db, 'select'>;
export type Employee = typeof employees.$inferSelect;

export async function personOf(db: Reader, employeeId: string): Promise<Employee> {
  const [person] = isUuid(employeeId) ? await db.select().from(employees).where(eq(employees.id, employeeId)) : [];
  if (!person) throw notFound('Không tìm thấy nhân viên.');
  return person;
}

export const personDtoOf = (p: Employee): PayrollPersonDto => ({
  employeeId: p.id,
  code: p.code,
  fullName: p.fullName,
  employment: p.employment,
  block: p.block,
  joinedOn: p.joinedOn,
  leftOn: p.leftOn,
});

/** Every level of the given people, oldest first, with their amounts. */
export async function versionsOf(db: Reader, employeeIds: readonly string[]) {
  if (employeeIds.length === 0) return [];
  const levels = await db
    .select()
    .from(payrollProfiles)
    .where(inArray(payrollProfiles.employeeId, [...employeeIds]))
    .orderBy(asc(payrollProfiles.effectiveOn));
  const amounts = levels.length
    ? await db
        .select()
        .from(payrollProfileAmounts)
        .where(
          inArray(
            payrollProfileAmounts.profileId,
            levels.map((l) => l.id),
          ),
        )
    : [];
  return levels.map((l) => ({
    employeeId: l.employeeId,
    version: {
      id: l.id,
      effectiveOn: l.effectiveOn,
      contractTypeId: l.contractTypeId,
      probationDays: l.probationDays,
      managesBusiness: l.managesBusiness,
      unionMember: l.unionMember,
      kpiAmount: l.kpiAmount,
      amounts: Object.fromEntries(amounts.filter((a) => a.profileId === l.id).map((a) => [a.componentId, a.amount])),
      createdBy: l.createdBy,
      createdAt: l.createdAt.toISOString(),
    } satisfies PayrollProfileVersionDto,
  }));
}

export async function levelsOf(db: Reader, employeeId: string): Promise<PayrollProfileVersionDto[]> {
  return (await versionsOf(db, [employeeId])).map((v) => v.version);
}

/** The level in force on a day, from levels sorted oldest first. */
export const levelOn = <T extends { effectiveOn: string }>(levels: readonly T[], day: string): T | undefined =>
  levels.filter((l) => l.effectiveOn <= day).at(-1);

/** The approved months a level is in force on at least one day of (R5). */
export function monthsUsingLevel(
  levels: readonly PayrollProfileVersionDto[],
  level: Pick<PayrollProfileVersionDto, 'id' | 'effectiveOn'>,
  approved: readonly string[],
): string[] {
  const next = levels.filter((l) => l.id !== level.id && l.effectiveOn > level.effectiveOn)[0];
  return approved.filter((month) => {
    const { from, to } = periodOfMonth(month);
    return level.effectiveOn <= to && (!next || next.effectiveOn > from);
  });
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
