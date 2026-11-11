import {
  PAYROLL_DEFAULT_CONTRACT,
  PAYROLL_MONTH,
  periodMonthOf,
  type PayrollProfileDto,
  type PayrollProfileListDto,
  type PayrollProfileMonthDto,
  type PayrollProfilePrefillDto,
  type PayrollProfileVersionDto,
} from '@careers/shared';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  employees,
  payrollDependants,
  payrollOpening,
  payrollRecurringItems,
  payrollTaxCommitments,
} from '../db/schema.js';
import { invalid } from '../lib/http-error.js';
import { bankAccountsOf } from './payroll-bank.js';
import { componentDefaults, firstMonth, probationDaysOf } from './payroll-catalogue.js';
import { periodOfMonth } from './payroll-months.js';
import { commitmentDtoOf, dependantDtoOf, openingDtoOf, recurringDtoOf } from './payroll-profile-facts.js';
import { addDays, levelOn, levelsOf, personDtoOf, personOf, versionsOf } from './payroll-profile-store.js';
import { loadRows } from './payroll-settings.js';
import { payDateOf, payDayFor, type Row } from './payroll-versions.js';

/** Hồ sơ lương as the page and a payroll month read it (spec-luong.md 11.5, R2). */

const pad = (n: number) => String(n).padStart(2, '0');
const monthOfDay = (day: string) => {
  const { year, month } = periodMonthOf(day);
  return `${year}-${pad(month)}`;
};

/** Everyone in Chấm công still there at the first payroll month or later, with a profile or not (L-B01). */
export async function listProfiles(db: Db): Promise<PayrollProfileListDto> {
  const [people, rows] = await Promise.all([db.select().from(employees).orderBy(asc(employees.code)), loadRows(db)]);
  const start = periodOfMonth(firstMonth(rows)).from;
  const current = people.filter((p) => !p.leftOn || p.leftOn >= start);
  const levels = await versionsOf(
    db,
    current.map((p) => p.id),
  );
  const withProfile = new Set(levels.map((l) => l.employeeId));
  const overridden = new Set(rows.filter((r) => r.employeeId && !r.supersededBy && !r.stop).map((r) => r.employeeId));
  const list = current.map((p) => ({
    ...personDtoOf(p),
    hasProfile: withProfile.has(p.id),
    hasOverrides: overridden.has(p.id),
  }));
  return { people: list, missing: current.filter((p) => !withProfile.has(p.id)).map(personDtoOf) };
}

export async function profileOf(db: Db, employeeId: string): Promise<PayrollProfileDto> {
  const person = await personOf(db, employeeId);
  const [versions, dependants, commitments, recurring, bankAccounts, openings, overrides] = await Promise.all([
    levelsOf(db, person.id),
    db
      .select()
      .from(payrollDependants)
      .where(eq(payrollDependants.employeeId, person.id))
      .orderBy(asc(payrollDependants.fromMonth)),
    db
      .select()
      .from(payrollTaxCommitments)
      .where(eq(payrollTaxCommitments.employeeId, person.id))
      .orderBy(asc(payrollTaxCommitments.year)),
    db
      .select()
      .from(payrollRecurringItems)
      .where(eq(payrollRecurringItems.employeeId, person.id))
      .orderBy(asc(payrollRecurringItems.fromMonth)),
    bankAccountsOf(db, person.id),
    db
      .select()
      .from(payrollOpening)
      .where(eq(payrollOpening.employeeId, person.id))
      .orderBy(asc(payrollOpening.taxYear)),
    loadRows(db).then((rows) => rows.filter((r) => r.employeeId === person.id)),
  ]);
  return {
    person: personDtoOf(person),
    leavingFrom: person.leftOn ? addDays(person.leftOn, 1) : null,
    versions,
    dependants: dependants.map(dependantDtoOf),
    commitments: commitments.map(commitmentDtoOf),
    recurring: recurring.map(recurringDtoOf),
    bankAccounts,
    openings: openings.map(openingDtoOf),
    overrides,
  };
}

/** "Tạo hồ sơ": default amounts in force on the day joined, the contract type of the staff kind (17.2). */
export async function prefillOf(db: Db, employeeId: string, today: string): Promise<PayrollProfilePrefillDto> {
  const person = await personOf(db, employeeId);
  const rows = await loadRows(db);
  const month = monthOfDay(person.joinedOn ?? today);
  const contractTypeId = PAYROLL_DEFAULT_CONTRACT[person.employment];
  const days = probationDaysOf(rows, contractTypeId, person.id, month);
  const isProbation = person.employment === 'probation';
  return {
    effectiveOn: person.joinedOn,
    contractTypeId,
    probationDays: null,
    amounts: componentDefaults(rows, person.id, month),
    suggestedOfficialOn: isProbation && person.joinedOn ? addDays(person.joinedOn, days) : null,
  };
}

/** The levels in force during a period: the one on its first day and each that starts inside it. */
function levelsInPeriod(levels: readonly PayrollProfileVersionDto[], from: string, to: string) {
  const first = levelOn(levels, from);
  return [...(first ? [first] : []), ...levels.filter((l) => l.effectiveOn > from && l.effectiveOn <= to)];
}

const inMonths = (month: string, from: string, to: string | null) => from <= month && (!to || month <= to);

/** What payroll month `month` reads from a profile, each fact on its own reference date (R2). Pure. */
export function monthFactsOf(
  profile: Pick<PayrollProfileDto, 'versions' | 'dependants' | 'commitments' | 'recurring' | 'openings'>,
  rows: readonly Row[],
  month: string,
  payDate = payDateOf(month, payDayFor(rows, month)),
): PayrollProfileMonthDto {
  const payMonth = payDate.slice(0, 7);
  const taxYear = Number(payDate.slice(0, 4));
  const { from, to } = periodOfMonth(month);
  const levels = levelsInPeriod(profile.versions, from, to);
  const signed = profile.commitments.filter((c) => c.year <= taxYear && c.signedOn <= payDate);
  const commitment = signed.find((c) => c.year === taxYear);
  return {
    month,
    payDate,
    versions: levels.map((l) => ({ from: l.effectiveOn, contractTypeId: l.contractTypeId, amounts: l.amounts })),
    kpiLevels: levels.map((l) => ({ from: l.effectiveOn, amount: l.kpiAmount })),
    unionMember: levelOn(profile.versions, `${month}-01`)?.unionMember ?? false,
    dependants: profile.dependants
      .filter((d) => inMonths(payMonth, d.fromMonth, d.toMonth))
      .reduce((sum, d) => sum + d.count, 0),
    hasCommitment: !!commitment,
    commitmentSignedOn: commitment?.signedOn ?? null,
    lastCommitmentYear: signed.reduce<number | null>(
      (last, c) => (last === null || c.year > last ? c.year : last),
      null,
    ),
    recurring: profile.recurring.filter((r) => inMonths(month, r.fromMonth, r.toMonth)),
    opening: profile.openings.find((o) => o.taxYear === taxYear) ?? null,
  };
}

export async function profileMonthOf(db: Db, employeeId: string, month: string): Promise<PayrollProfileMonthDto> {
  if (!PAYROLL_MONTH.test(month)) throw invalid('Chọn tháng lương.');
  const [profile, rows] = await Promise.all([profileOf(db, employeeId), loadRows(db, 'quy-tac.ngay-chi-tra')]);
  return monthFactsOf(profile, rows, month);
}
