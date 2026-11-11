import { Hono } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import { settingsOfMonth } from '../services/payroll-settings-view.js';
import { addSetting, correctSetting, deleteSetting, editSetting, listSettings } from '../services/payroll-settings.js';

/** Cấu hình lương (spec-luong.md 6, 11.6), mounted under /api/hr/payroll behind requirePayroll. */
export const hrPayrollConfigRoutes = new Hono<Env>();

hrPayrollConfigRoutes.get('/settings', async (c) => c.json(await listSettings(c.get('deps').db, c.req.query())));
hrPayrollConfigRoutes.get('/settings/month', async (c) =>
  c.json(await settingsOfMonth(c.get('deps').db, c.req.query())),
);

hrPayrollConfigRoutes.post('/settings', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await addSetting(db, await readJson(c), hrOf(c), now()), 201);
});

hrPayrollConfigRoutes.put('/settings/:id', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await editSetting(db, c.req.param('id'), await readJson(c), hrOf(c), now()));
});

hrPayrollConfigRoutes.delete('/settings/:id', async (c) => {
  const { db, now } = c.get('deps');
  await deleteSetting(db, c.req.param('id'), hrOf(c), now());
  return c.json({ ok: true });
});

/** "Sửa lỗi" (R5). */
hrPayrollConfigRoutes.post('/settings/:id/correct', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await correctSetting(db, c.req.param('id'), await readJson(c), hrOf(c), now()), 201);
});
