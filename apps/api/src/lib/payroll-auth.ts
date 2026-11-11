import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../app.js';
import { noPayrollRight, payrollRightsOf, type PayrollRights } from '../services/payroll-rights.js';
import { hrOf } from './hr-auth.js';

/**
 * Lương is closed to anyone without Xem, sửa lương (spec-luong.md 2 (1)): every route behind this answers 403, also an
 * address that does not exist, and the answer carries no figure. Runs after requireHr.
 */
export const requirePayroll: MiddlewareHandler<Env> = async (c, next) => {
  const { db, config, now } = c.get('deps');
  const rights = await payrollRightsOf(db, hrOf(c), config.payrollAdmins, now());
  if (!rights.canPayroll) throw noPayrollRight();
  c.set('payroll', rights);
  await next();
};

/** The rights of a request that passed requirePayroll. */
export function payrollOf(c: Context<Env>): PayrollRights {
  const rights = c.get('payroll');
  if (!rights) throw noPayrollRight();
  return rights;
}
