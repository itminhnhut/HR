import { sql } from 'drizzle-orm';
import type {
  PayrollCashItemDto,
  PayrollRetroInputDto,
  PayrollMonthSnapshot,
  PayrollOtherIncomeDto,
  PayrollRecurringKind,
} from '@careers/shared';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { employees, payrollPeriods, timesheetClosings } from './schema.js';

/** Lương, steps 13–14 (spec-luong.md 10.2). Re-exported by schema.ts, which drizzle-kit reads. */

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Cấu hình lương (spec 6.1): one row per value, the engine's `SettingRow` column for column. `employee_id` null is
 * everyone. A law parameter applies from a date (`YYYY-MM-DD`), the rest from a payroll month (`YYYY-MM`). "Sửa lỗi"
 * keeps the old row and points it at its replacement; a stop row ("Ngừng", "Bỏ ghi đè") has no value.
 */
export const payrollSettings = pgTable(
  'payroll_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'restrict' }),
    appliesFrom: text('applies_from').notNull(),
    value: jsonb('value').$type<unknown>(),
    stop: boolean('stop').notNull().default(false),
    source: text('source').notNull().default(''),
    /**
     * The row that replaced this one. No foreign key: the replacement is written right after the old row is marked,
     * and deleting a replacement hands its date back to the row it replaced.
     */
    supersededBy: uuid('superseded_by'),
    createdBy: text('created_by').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('payroll_settings_live_idx')
      .on(t.key, sql`coalesce(${t.employeeId}, '00000000-0000-0000-0000-000000000000'::uuid)`, t.appliesFrom)
      .where(sql`${t.supersededBy} is null`),
    index('payroll_settings_employee_idx').on(t.employeeId),
    check('payroll_settings_value_or_stop', sql`${t.stop} or ${t.value} is not null`),
    check('payroll_settings_from', sql`${t.appliesFrom} ~ '^[0-9]{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?$'`),
  ],
);

/** Money in whole dong (spec 10.2): bigint, read as a JS number (safe far beyond any salary). */
const dong = (name: string) => bigint(name, { mode: 'number' });
const person = () =>
  uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'restrict' });
const createdBy = () => text('created_by').notNull();
const createdAt = () => tz('created_at').notNull().defaultNow();

/**
 * Hồ sơ lương (spec 10.2, R1): one row per person and effective date. A month reads every level in force during its
 * period (segments, 5.6); `contract_type_id` and the component ids are the engine's (`loai-hd.danh-sach`,
 * `khoan.danh-sach`), kept as text so a later catalogue change never rewrites a level.
 */
export const payrollProfiles = pgTable(
  'payroll_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: person(),
    effectiveOn: date('effective_on').notNull(),
    contractTypeId: text('contract_type_id').notNull(),
    /** Null: the contract type's default (câu 33). */
    probationDays: integer('probation_days'),
    /** "Việc quản lý doanh nghiệp": 180 days of probation allowed (BLLĐ Đ.25). */
    managesBusiness: boolean('manages_business').notNull().default(false),
    unionMember: boolean('union_member').notNull().default(false),
    /** KPI 100%. */
    kpiAmount: dong('kpi_amount').notNull().default(0),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('payroll_profiles_person_day_idx').on(t.employeeId, t.effectiveOn),
    check('payroll_profiles_amounts', sql`${t.kpiAmount} >= 0 and coalesce(${t.probationDays}, 0) >= 0`),
  ],
);

/** The amount of each pay component in a level. */
export const payrollProfileAmounts = pgTable(
  'payroll_profile_amounts',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => payrollProfiles.id, { onDelete: 'cascade' }),
    componentId: text('component_id').notNull(),
    amount: dong('amount').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.componentId] }),
    check('payroll_profile_amounts_amount', sql`${t.amount} >= 0`),
  ],
);

/** Người phụ thuộc (spec 10.2): read on the pay date of a month (R2, câu 29). */
export const payrollDependants = pgTable(
  'payroll_dependants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: person(),
    fromMonth: text('from_month').notNull(),
    toMonth: text('to_month'),
    count: integer('count').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [
    index('payroll_dependants_employee_idx').on(t.employeeId),
    check('payroll_dependants_count', sql`${t.count} > 0 and (${t.toMonth} is null or ${t.toMonth} >= ${t.fromMonth})`),
  ],
);

/** Cam kết thuế (câu 10): one per person and tax year, from the day it is signed. */
export const payrollTaxCommitments = pgTable(
  'payroll_tax_commitments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: person(),
    year: integer('year').notNull(),
    signedOn: date('signed_on').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('payroll_tax_commitments_person_year_idx').on(t.employeeId, t.year)],
);

/**
 * Khoản (32) định kỳ (câu 4): by months, apart from the levels, since it has its own start and end. Prefills the
 * support / refund / advance cells of each month; `insurance-paid` adds the month's employee insurance to (32).
 */
export const payrollRecurringItems = pgTable(
  'payroll_recurring_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: person(),
    kind: text('kind').$type<PayrollRecurringKind>().notNull().default('support'),
    amount: dong('amount').notNull(),
    /** "Tính thuế" of the insurance the company pays back; the typed kinds are taxed by their kind. */
    taxable: boolean('taxable').notNull().default(false),
    fromMonth: text('from_month').notNull(),
    toMonth: text('to_month'),
    note: text('note').notNull().default(''),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [
    index('payroll_recurring_items_employee_idx').on(t.employeeId),
    check('payroll_recurring_items_kind', sql`${t.kind} in ('support', 'refund', 'advance', 'insurance-paid')`),
    // "Công ty trả thay BH" has no typed amount: the month's employee insurance.
    check(
      'payroll_recurring_items_amount',
      sql`case when ${t.kind} = 'insurance-paid' then ${t.amount} = 0 else ${t.amount} > 0 end`,
    ),
  ],
);

/**
 * Ngân hàng (spec 10.2): the account number only as AES-256-GCM cipher text under PAYROLL_KEY, with the key version
 * it was sealed with and its last four digits apart. One row per day it changed.
 */
export const payrollBankAccounts = pgTable(
  'payroll_bank_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: person(),
    bank: text('bank').notNull(),
    accountCipher: text('account_cipher').notNull(),
    keyVersion: integer('key_version').notNull(),
    last4: text('last4').notNull(),
    /** No longer read or written (migration 0051 copied it to `employees.email`); kept so no data is lost. */
    payslipEmail: text('payslip_email'),
    changedOn: date('changed_on').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('payroll_bank_accounts_person_day_idx').on(t.employeeId, t.changedOn),
    check('payroll_bank_accounts_last4', sql`${t.last4} ~ '^[0-9]{4}$'`),
  ],
);

/** Số dư đầu năm thuế (câu 34): every pay of the tax year before the first one on the web, by pay date. */
export const payrollOpening = pgTable(
  'payroll_opening',
  {
    employeeId: person(),
    taxYear: integer('tax_year').notNull(),
    taxableIncome: dong('taxable_income').notNull().default(0),
    taxWithheld: dong('tax_withheld').notNull().default(0),
    overtimeHours: numeric('overtime_hours', { precision: 7, scale: 1, mode: 'number' }).notNull().default(0),
    clothingPaid: dong('clothing_paid').notNull().default(0),
    monthsPaid: integer('months_paid').notNull().default(0),
    updatedBy: text('updated_by').notNull(),
    updatedAt: tz('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.employeeId, t.taxYear] }),
    check(
      'payroll_opening_amounts',
      sql`${t.taxableIncome} >= 0 and ${t.taxWithheld} >= 0 and ${t.overtimeHours} >= 0 and ${t.clothingPaid} >= 0 and ${t.monthsPaid} >= 0`,
    ),
  ],
);

/**
 * Đầu vào tháng (spec 2 (4), 10.2 `payroll_inputs`): what HR types for one person in one payroll month, kept by
 * (year, month) so it lives before the payroll month has a row and survives the timesheet period being reopened
 * (R7). Null on (19), (22), (23): as the engine computes it. The (24) and (32) lines of the month are jsonb lists.
 */
export const payrollMonthInputs = pgTable(
  'payroll_month_inputs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    employeeId: person(),
    kpiPercent: numeric('kpi_percent', { precision: 8, scale: 6, mode: 'number' }),
    overtimeHours: numeric('overtime_hours', { precision: 5, scale: 1, mode: 'number' }).notNull().default(0),
    restDays: numeric('rest_days', { precision: 4, scale: 1, mode: 'number' }),
    holidayDays: numeric('holiday_days', { precision: 4, scale: 1, mode: 'number' }),
    otherIncome: jsonb('other_income').$type<PayrollOtherIncomeDto[]>().notNull().default([]),
    cash: jsonb('cash').$type<PayrollCashItemDto[]>().notNull().default([]),
    /** Tiền phép chưa nghỉ typed over the computed amount (spec 5.5); null: as the web computes it. */
    leavePayout: dong('leave_payout'),
    /** Truy lĩnh / truy thu typed over or left out for the month (spec R6, 11.4), by the month they come from. */
    retro: jsonb('retro').$type<PayrollRetroInputDto[]>().notNull().default([]),
    note: text('note').notNull().default(''),
    updatedBy: text('updated_by').notNull(),
    updatedAt: tz('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('payroll_month_inputs_period_person_idx').on(t.year, t.month, t.employeeId),
    index('payroll_month_inputs_employee_idx').on(t.employeeId),
    check('payroll_month_inputs_month', sql`${t.month} between 1 and 12`),
    check('payroll_month_inputs_leave_payout', sql`${t.leavePayout} is null or ${t.leavePayout} >= 0`),
    check(
      'payroll_month_inputs_numbers',
      sql`(${t.kpiPercent} is null or ${t.kpiPercent} between 0 and 2) and ${t.overtimeHours} >= 0 and (${t.restDays} is null or ${t.restDays} >= 0) and (${t.holidayDays} is null or ${t.holidayDays} >= 0)`,
    ),
  ],
);

/**
 * Bản duyệt lần N (spec 10.2 `payroll_runs`, R4, R7): the month as it was approved, rows and totals already rounded,
 * kept as one jsonb snapshot. Never changed but for being superseded: Mở lại marks the approval in force with who
 * reopened it, when and why, and the next Duyệt adds approval N+1.
 */
export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => payrollPeriods.id, { onDelete: 'restrict' }),
    approvalNo: integer('approval_no').notNull(),
    closingId: uuid('closing_id')
      .notNull()
      .references(() => timesheetClosings.id, { onDelete: 'restrict' }),
    snapshot: jsonb('snapshot').$type<PayrollMonthSnapshot>().notNull(),
    approvedAt: tz('approved_at').notNull(),
    approvedBy: text('approved_by').notNull(),
    reopenedAt: tz('reopened_at'),
    reopenedBy: text('reopened_by'),
    reopenReason: text('reopen_reason'),
  },
  (t) => [
    uniqueIndex('payroll_runs_period_no_idx').on(t.periodId, t.approvalNo),
    check('payroll_runs_no', sql`${t.approvalNo} > 0`),
    check(
      'payroll_runs_reopened',
      sql`(${t.reopenedAt} is null) = (${t.reopenedBy} is null) and (${t.reopenedAt} is null) = (${t.reopenReason} is null)`,
    ),
  ],
);
