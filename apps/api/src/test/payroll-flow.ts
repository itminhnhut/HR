import {
  standardPeriod,
  type EmployeeDto,
  type PayrollSettingDto,
  type PayrollSettingsMonthDto,
} from '@careers/shared';
import { hrUsers, payrollPeriods, timesheetClosings, timesheetPeriods } from '../db/schema.js';
import type { Flow } from './timesheet-flow.js';

/** Lương over the real API: the HR of `Flow` with the payroll right. People and amounts are fake. */

export const givePayrollRight = (flow: Flow) =>
  flow.t.db.update(hrUsers).set({ canPayroll: true, canApprovePayroll: true });

/**
 * A payroll month approved on a close of its timesheet period, written straight to the tables without an approval
 * snapshot: only the status matters to the rules tested here (POST /months/:month/approve makes the real one).
 */
export async function approvedMonth(flow: Flow, year: number, month: number, status: 'approved' | 'paid' = 'approved') {
  const range = standardPeriod(year, month);
  const closedAt = new Date(`${range.to}T10:00:00Z`);
  const dates = { year, month, fromOn: range.from, toOn: range.to };
  const [period] = await flow.t.db
    .insert(timesheetPeriods)
    .values({ ...dates, status: 'closed', closedBy: 'Lan', closedAt })
    .returning();
  if (!period) throw new Error('No period');
  const [closing] = await flow.t.db
    .insert(timesheetClosings)
    .values({
      ...dates,
      periodId: period.id,
      closeNo: 1,
      closedAt,
      closedBy: 'Lan',
      holidays: [],
      regions: [],
      norms: {},
    })
    .returning();
  if (!closing) throw new Error('No closing');
  await flow.t.db.insert(payrollPeriods).values({ year, month, status, closingId: closing.id });
}

export const addSetting = (flow: Flow, body: Record<string, unknown>, expected = 201) =>
  flow.payroll<{ setting: PayrollSettingDto; warnings: string[]; approvedMonthsTouched: string[] }>(
    'POST',
    '/settings',
    body,
    expected,
  );

export async function viewOf(flow: Flow, month: string, person?: EmployeeDto) {
  const query = person ? `?thang=${month}&nguoi=${person.id}` : `?thang=${month}`;
  return flow.payroll<PayrollSettingsMonthDto>('GET', `/settings/month${query}`);
}

/** The line of one key in the month view. */
export async function lineOf(flow: Flow, month: string, key: string, person?: EmployeeDto) {
  const view = await viewOf(flow, month, person);
  const line = view.lines.find((l) => l.key === key);
  if (!line) throw new Error(`${key} is not in the view of ${month}`);
  return line;
}

/** The value the month reads from a stored row, or "default" when the engine's own default applies. */
export const valueIn = async (flow: Flow, month: string, key: string, person?: EmployeeDto) =>
  (await lineOf(flow, month, key, person)).inForce?.value ?? 'default';
