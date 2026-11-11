import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { payrollOf, requirePayroll } from '../lib/payroll-auth.js';
import { readJson } from '../lib/request.js';
import { listFirstMonthChecks, setFirstMonthCheck } from '../services/payroll-checks.js';
import { readPayrollLog } from '../services/payroll-log.js';
import { payrollMonthOf } from '../services/payroll-month.js';
import { approveMonth, markMonthPaid, reopenMonth, type MonthActionArgs } from '../services/payroll-month-actions.js';
import { accessOf, listPayrollRights, setPayrollRights } from '../services/payroll-rights.js';
import { saveTypedInputs } from '../services/payroll-typed-inputs.js';
import { hrPayrollConfigRoutes } from './hr-payroll-config.js';
import { hrPayrollProfileRoutes } from './hr-payroll-profiles.js';

/** Lương (spec-luong.md). Mounted at /api/hr/payroll behind requireHr; every route needs the payroll right. */
export const hrPayrollRoutes = new Hono<Env>();

hrPayrollRoutes.use('*', requirePayroll);

/** What the signed-in HR may do; the web shows the Lương menu only when this answers 200. */
hrPayrollRoutes.get('/access', (c) => c.json(accessOf(payrollOf(c))));

hrPayrollRoutes.get('/log', async (c) => c.json(await readPayrollLog(c.get('deps').db, c.req.query())));

hrPayrollRoutes.get('/rights', async (c) => c.json(await listPayrollRights(c.get('deps').db, hrOf(c))));
hrPayrollRoutes.put('/rights/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await setPayrollRights(db, c.req.param('id'), await readJson(c), hrOf(c), payrollOf(c), now()));
});

/** What HR has checked before the first payroll month (spec-luong.md 17.2). */
hrPayrollRoutes.get('/first-month-checks', async (c) => c.json(await listFirstMonthChecks(c.get('deps').db)));
hrPayrollRoutes.put('/first-month-checks', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await setFirstMonthCheck(db, await readJson(c), hrOf(c), now()));
});

/** Bảng lương of a month "YYYY-MM" (spec 11.2): computed on every read, never written by it (L-L22). */
hrPayrollRoutes.get('/months/:month', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await payrollMonthOf(db, c.req.param('month'), now()));
});

async function actionArgs(c: Context<Env>): Promise<MonthActionArgs> {
  return {
    key: c.req.param('month') ?? '',
    raw: await readJson(c),
    hr: hrOf(c),
    rights: payrollOf(c),
    now: c.get('deps').now(),
  };
}

/** Duyệt (R4, 11.4): approve right; 409 not a draft; 422 a red warning not acknowledged. */
hrPayrollRoutes.post('/months/:month/approve', async (c) =>
  c.json(await approveMonth(c.get('deps').db, await actionArgs(c))),
);
/** Mở lại (R7): approve right and a reason; 409 paid or not the latest approved month. */
hrPayrollRoutes.post('/months/:month/reopen', async (c) =>
  c.json(await reopenMonth(c.get('deps').db, await actionArgs(c))),
);
/** Đã chuyển khoản: the payroll right; 409 not approved. */
hrPayrollRoutes.post('/months/:month/paid', async (c) =>
  c.json(await markMonthPaid(c.get('deps').db, await actionArgs(c))),
);

/** Đầu vào tháng of one person (spec 2 (4)): partial, 409 once the month is approved or paid. */
hrPayrollRoutes.put('/months/:month/lines/:employeeId/inputs', async (c) => {
  const { db, now } = c.get('deps');
  const { month: key, employeeId } = c.req.param();
  return c.json(await saveTypedInputs(db, { key, employeeId, raw: await readJson(c), hr: hrOf(c), now: now() }));
});

hrPayrollRoutes.route('/', hrPayrollConfigRoutes);
hrPayrollRoutes.route('/', hrPayrollProfileRoutes);
