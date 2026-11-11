import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import { confirmPayslipUnchanged, payslipChangesOf } from '../services/payslip-changes.js';
import {
  markPayslipsSent,
  payslipsOf,
  sendPayslip,
  type MailContext,
  type MarkArgs,
} from '../services/payslip-mail.js';

/** Lương › Phiếu lương. Mounted inside /api/hr/payroll, so every route already needs the payroll right. */
export const hrPayrollPayslipRoutes = new Hono<Env>();

const mailOf = (c: Context<Env>): MailContext => {
  const { mailer, config } = c.get('deps');
  return { mailer, isProduction: config.isProduction };
};

async function args(c: Context<Env>): Promise<MarkArgs> {
  return {
    key: c.req.param('month') ?? '',
    raw: await readJson(c),
    hr: hrOf(c),
    now: c.get('deps').now(),
    mail: mailOf(c),
  };
}

/** Who gets a payslip of the month, their address and whether it was sent. */
hrPayrollPayslipRoutes.get('/months/:month/payslips', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await payslipsOf(db, c.req.param('month'), now(), mailOf(c)));
});

/** "Đánh dấu đã gửi" (or taking it back): 409 unless the month is approved or paid. */
hrPayrollPayslipRoutes.post('/months/:month/payslips/mark', async (c) =>
  c.json(await markPayslipsSent(c.get('deps').db, await args(c))),
);

/** "Gửi tự động" of one person with their payslip file: 409 when mail is not configured or the month is a draft. */
hrPayrollPayslipRoutes.post('/months/:month/payslips/send', async (c) =>
  c.json(await sendPayslip(c.get('deps').db, await args(c))),
);

/** "Thay đổi từ lần gửi": the payslip as sent against the payslip now, why, and the log since. Reads only. */
hrPayrollPayslipRoutes.get('/months/:month/payslips/:employeeId/changes', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await payslipChangesOf(db, c.req.param('month'), c.req.param('employeeId'), now()));
});

/** "Đánh dấu vẫn đúng (không cần gửi lại)": 409 when a figure differs from what was sent. */
hrPayrollPayslipRoutes.post('/months/:month/payslips/:employeeId/unchanged', async (c) => {
  const { db, now } = c.get('deps');
  const args = {
    key: c.req.param('month'),
    employeeId: c.req.param('employeeId'),
    hr: hrOf(c),
    now: now(),
    mail: mailOf(c),
  };
  return c.json(await confirmPayslipUnchanged(db, args));
});
