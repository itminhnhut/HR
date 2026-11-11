import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { employees, payrollPeriods } from './schema.js';

/** Gửi phiếu lương qua email. Re-exported by schema.ts, which drizzle-kit reads. */

const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * The last time a person's payslip of a month was mailed, per approval: sent again replaces the row. A row of an
 * earlier approval than the one in force is what the list shows as "Số đã đổi, cần gửi lại". No amount is kept here.
 */
export const payrollPayslipSends = pgTable(
  'payroll_payslip_sends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => payrollPeriods.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    approvalNo: integer('approval_no').notNull(),
    status: text('status').$type<'sent' | 'failed'>().notNull(),
    /** `manual`: HR sent it from their own mailbox and said so. `auto`: the server mailed it. */
    channel: text('channel').$type<'manual' | 'auto'>().notNull(),
    /** The employee's address the payslip was meant for; empty when HR marked it sent for someone without one. */
    email: text('email').notNull(),
    /** Where it really went: the same address, or the test mailbox on a dev machine. */
    sentTo: text('sent_to').notNull(),
    /** Why it failed, in words HR reads; null when sent. */
    error: text('error'),
    at: tz('at').notNull(),
    actor: text('actor').notNull(),
  },
  (t) => [
    uniqueIndex('payroll_payslip_sends_person_idx').on(t.periodId, t.employeeId, t.approvalNo),
    check('payroll_payslip_sends_status', sql`${t.status} in ('sent', 'failed')`),
    check('payroll_payslip_sends_channel', sql`${t.channel} in ('manual', 'auto')`),
  ],
);
