import {
  EMPTY_MONTH_INPUTS,
  EMPTY_YEAR_PART,
  employmentOn,
  type PayrollDates,
  type PayrollMonthInputsDto,
  type PayrollProfileVersionDto,
  type PayrollYearPartDto,
  type TimesheetClosingRowDto,
} from '@careers/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import {
  employees,
  payrollBankAccounts,
  payrollDependants,
  payrollMonthInputs,
  payrollOpening,
  payrollRecurringItems,
  payrollTaxCommitments,
} from '../db/schema.js';
import { accountOn } from './payroll-bank.js';
import { probationDaysOf, regionalMinimum } from './payroll-catalogue.js';
import { leaveBaseOf } from './payroll-leave-payout.js';
import type { PersonFacts } from './payroll-month-lines.js';
import { commitmentDtoOf, dependantDtoOf, openingDtoOf, recurringDtoOf } from './payroll-profile-facts.js';
import { monthFactsOf } from './payroll-profile-read.js';
import { levelOn, versionsOf, type Reader } from './payroll-profile-store.js';
import { dateWords } from './payroll-words.js';
import type { Row } from './payroll-versions.js';

/**
 * Hồ sơ lương of everyone in a close, read in one go for a payroll month (spec-luong.md R2): each person's levels,
 * dependants, commitment, recurring items and opening balance on their own reference dates, the zone of the region,
 * whether a bank account is on file, the dates HR has not confirmed and what HR typed for the month.
 */

type Employee = typeof employees.$inferSelect;

/** What HR typed for a person and month (`payroll_month_inputs`), or nothing typed. */
export function typedInputsOf(row: typeof payrollMonthInputs.$inferSelect | undefined): PayrollMonthInputsDto {
  if (!row) return { ...EMPTY_MONTH_INPUTS };
  return {
    kpiPercent: row.kpiPercent,
    overtimeHours: row.overtimeHours,
    restDays: row.restDays,
    holidayDays: row.holidayDays,
    otherIncome: row.otherIncome,
    cash: row.cash,
    leavePayout: row.leavePayout,
    retro: row.retro,
    note: row.note,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function load(db: Reader, ids: string[], dates: PayrollDates) {
  const [levels, dependants, commitments, recurring, openings, banks, people, typed] = await Promise.all([
    versionsOf(db, ids),
    db.select().from(payrollDependants).where(inArray(payrollDependants.employeeId, ids)),
    db.select().from(payrollTaxCommitments).where(inArray(payrollTaxCommitments.employeeId, ids)),
    db.select().from(payrollRecurringItems).where(inArray(payrollRecurringItems.employeeId, ids)),
    db.select().from(payrollOpening).where(inArray(payrollOpening.employeeId, ids)),
    db
      .select({
        employeeId: payrollBankAccounts.employeeId,
        bank: payrollBankAccounts.bank,
        last4: payrollBankAccounts.last4,
        changedOn: payrollBankAccounts.changedOn,
      })
      .from(payrollBankAccounts)
      .where(inArray(payrollBankAccounts.employeeId, ids)),
    db.select().from(employees).where(inArray(employees.id, ids)),
    db
      .select()
      .from(payrollMonthInputs)
      .where(
        and(
          eq(payrollMonthInputs.year, dates.year),
          eq(payrollMonthInputs.month, dates.month),
          inArray(payrollMonthInputs.employeeId, ids),
        ),
      ),
  ]);
  return { levels, dependants, commitments, recurring, openings, banks, people, typed };
}

/** The dates of the close row that split the period, decide insurance or the 10% (spec 11.3), not yet confirmed. */
function unconfirmedDatesOf(row: TimesheetClosingRowDto, person: Employee | undefined, dates: PayrollDates): string[] {
  const from = dates.period.from;
  const to = `${dates.insuranceMonth}-31`;
  const matters = (day: string | null): day is string => day !== null && day >= from && day <= to;
  const checks: [string, string | null, boolean][] = [
    ['Ngày vào', row.joinedOn, person?.joinedOnConfirmed ?? false],
    ['Ngày chính thức', row.officialOn, person?.officialOnConfirmed ?? false],
    ['Ngày nghỉ', row.leftOn, person?.leftOnConfirmed ?? false],
  ];
  return checks.flatMap(([label, day, confirmed]) =>
    matters(day) && !confirmed ? [`${label} ${dateWords(day)}`] : [],
  );
}

/**
 * Câu 33: while the person is on probation in the period, the probation days of the level they are on then (its own
 * or its contract type's) and whether the job manages the business (BLLĐ Đ.25).
 */
function probationOf(
  row: TimesheetClosingRowDto,
  versions: readonly PayrollProfileVersionDto[],
  rows: readonly Row[],
  dates: PayrollDates,
): PersonFacts['probation'] {
  const { from, to } = dates.period;
  const start = row.joinedOn && row.joinedOn > from ? row.joinedOn : from;
  if (start > to || employmentOn(row, start) !== 'probation') return null;
  const level = levelOn(versions, start) ?? versions.find((v) => v.effectiveOn > start && v.effectiveOn <= to);
  if (!level) return null;
  const days = level.probationDays ?? probationDaysOf(rows, level.contractTypeId, row.employeeId, dates.monthKey);
  return { days, managesBusiness: level.managesBusiness };
}

export interface PeopleFactsExtra {
  /** Σ of the earlier pay months of the tax year, by person. */
  yearMonths?: ReadonlyMap<string, PayrollYearPartDto>;
  /** Công chuẩn of each person in the period before, for the leave payout; empty when the web has no close of it. */
  previousNorms?: ReadonlyMap<string, number>;
  /** (42) of each person in the approval of the month before; empty when it is not approved. */
  previousNets?: ReadonlyMap<string, number>;
}

export async function peopleFactsOf(
  db: Reader,
  closingRows: readonly TimesheetClosingRowDto[],
  rows: readonly Row[],
  dates: PayrollDates,
  { yearMonths = new Map(), previousNorms = new Map(), previousNets = new Map() }: PeopleFactsExtra = {},
): Promise<Map<string, PersonFacts>> {
  const ids = closingRows.map((r) => r.employeeId);
  if (ids.length === 0) return new Map();
  const all = await load(db, ids, dates);
  const mine = <T extends { employeeId: string }>(xs: readonly T[], id: string) =>
    xs.filter((x) => x.employeeId === id);
  return new Map(
    closingRows.map((row) => {
      const id = row.employeeId;
      const employee = all.people.find((p) => p.id === id);
      const versions = mine(all.levels, id).map((l) => l.version);
      const profile = {
        versions,
        dependants: mine(all.dependants, id).map(dependantDtoOf),
        commitments: mine(all.commitments, id).map(commitmentDtoOf),
        recurring: mine(all.recurring, id).map(recurringDtoOf),
        openings: mine(all.openings, id).map(openingDtoOf),
      };
      const facts = monthFactsOf(profile, rows, dates.monthKey, dates.payDate);
      // The sheet and the payslip use the account in force on the pay date; one from a later day is not there yet.
      const bank = accountOn(mine(all.banks, id), dates.payDate) ?? null;
      const person: PersonFacts = {
        facts: facts.versions.length > 0 ? facts : null,
        zone: regionalMinimum(rows, { id, regionId: row.regionId }, dates.insuranceDate)?.zone ?? 'I',
        hasBankAccount: bank !== null,
        email: employee?.email ?? null,
        bank,
        unconfirmedDates: unconfirmedDatesOf(row, employee, dates),
        inputs: typedInputsOf(all.typed.find((t) => t.employeeId === id)),
        currentBlock: employee?.block ?? null,
        yearMonths: yearMonths.get(id) ?? EMPTY_YEAR_PART,
        leaveBase: leaveBaseOf(row, versions, dates.period, previousNorms.get(id)),
        previousNet: previousNets.get(id) ?? null,
        probation: probationOf(row, versions, rows, dates),
      };
      return [id, person];
    }),
  );
}
