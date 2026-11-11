import { todayInVietnam } from '@careers/shared';
import { Hono, type Context } from 'hono';
import type { Env } from '../app.js';
import { hrOf } from '../lib/hr-auth.js';
import { readJson } from '../lib/request.js';
import { addBankAccount, deleteBankAccount, revealBankAccount } from '../services/payroll-bank.js';
import { firstMonthChecklist } from '../services/payroll-checklist.js';
import { applyDefault, peopleOnDefault } from '../services/payroll-component-defaults.js';
import { saveCommitment, saveDependant, saveOpening, saveRecurring } from '../services/payroll-profile-facts.js';
import { listProfiles, prefillOf, profileMonthOf, profileOf } from '../services/payroll-profile-read.js';
import { addLevel, deleteLevel, deleteProfile, editLevel } from '../services/payroll-profiles.js';

/** Hồ sơ lương (spec-luong.md 10.2, 11.5, 17.2), mounted under /api/hr/payroll behind requirePayroll. */
export const hrPayrollProfileRoutes = new Hono<Env>();

const ok = { ok: true } as const;
const ctx = (c: Context<Env>) => {
  const { db, now, config } = c.get('deps');
  return { db, now: now(), hr: hrOf(c), key: config.payrollKey, person: c.req.param('employeeId') ?? '' };
};

hrPayrollProfileRoutes.get('/profiles', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await listProfiles(db, todayInVietnam(now())));
});
hrPayrollProfileRoutes.get('/profiles/:employeeId', async (c) => {
  const { db, person } = ctx(c);
  return c.json(await profileOf(db, person));
});
hrPayrollProfileRoutes.delete('/profiles/:employeeId', async (c) => {
  const { db, person, hr, now } = ctx(c);
  await deleteProfile(db, person, hr, now);
  return c.json(ok);
});
hrPayrollProfileRoutes.get('/profiles/:employeeId/prefill', async (c) => {
  const { db, person, now } = ctx(c);
  return c.json(await prefillOf(db, person, todayInVietnam(now)));
});
hrPayrollProfileRoutes.get('/profiles/:employeeId/month/:month', async (c) => {
  const { db, person } = ctx(c);
  return c.json(await profileMonthOf(db, person, c.req.param('month')));
});

hrPayrollProfileRoutes.post('/profiles/:employeeId/versions', async (c) => {
  const { db, person, hr, now } = ctx(c);
  return c.json(await addLevel(db, person, await readJson(c), hr, now), 201);
});
hrPayrollProfileRoutes.put('/profiles/:employeeId/versions/:id', async (c) => {
  const { db, person, hr, now } = ctx(c);
  return c.json(await editLevel(db, person, c.req.param('id'), await readJson(c), hr, now));
});
hrPayrollProfileRoutes.delete('/profiles/:employeeId/versions/:id', async (c) => {
  const { db, person, hr, now } = ctx(c);
  await deleteLevel(db, person, c.req.param('id'), hr, now);
  return c.json(ok);
});

/** Người phụ thuộc, cam kết thuế, khoản (32) định kỳ: the same add / change / delete each. */
const FACTS = { dependants: saveDependant, commitments: saveCommitment, recurring: saveRecurring } as const;
for (const [path, save] of Object.entries(FACTS)) {
  hrPayrollProfileRoutes.post(`/profiles/:employeeId/${path}`, async (c) => {
    const { db, person, hr, now } = ctx(c);
    return c.json(await save(db, person, null, await readJson(c), hr, now), 201);
  });
  hrPayrollProfileRoutes.put(`/profiles/:employeeId/${path}/:id`, async (c) => {
    const { db, person, hr, now } = ctx(c);
    return c.json(await save(db, person, c.req.param('id') ?? '', await readJson(c), hr, now));
  });
  hrPayrollProfileRoutes.delete(`/profiles/:employeeId/${path}/:id`, async (c) => {
    const { db, person, hr, now } = ctx(c);
    await save(db, person, c.req.param('id') ?? '', null, hr, now);
    return c.json(ok);
  });
}

hrPayrollProfileRoutes.put('/profiles/:employeeId/opening/:year', async (c) => {
  const { db, person, hr, now } = ctx(c);
  return c.json(await saveOpening(db, person, c.req.param('year'), await readJson(c), hr, now));
});
hrPayrollProfileRoutes.delete('/profiles/:employeeId/opening/:year', async (c) => {
  const { db, person, hr, now } = ctx(c);
  await saveOpening(db, person, c.req.param('year'), null, hr, now);
  return c.json(ok);
});

hrPayrollProfileRoutes.post('/profiles/:employeeId/bank', async (c) => {
  const { db, person, hr, now, key } = ctx(c);
  return c.json(await addBankAccount(db, person, await readJson(c), hr, now, key), 201);
});
hrPayrollProfileRoutes.delete('/profiles/:employeeId/bank/:id', async (c) => {
  const { db, person, hr, now } = ctx(c);
  await deleteBankAccount(db, person, c.req.param('id'), hr, now);
  return c.json(ok);
});
/** "Hiện đủ": logged. */
hrPayrollProfileRoutes.post('/profiles/:employeeId/bank/:id/reveal', async (c) => {
  const { db, person, hr, now, key } = ctx(c);
  return c.json(await revealBankAccount(db, person, c.req.param('id'), hr, now, key));
});

/** L-A23: who is on a component's old default, and moving them to the new one. */
hrPayrollProfileRoutes.get('/components/:id/default-users', async (c) =>
  c.json(await peopleOnDefault(c.get('deps').db, c.req.param('id'), c.req.query())),
);
hrPayrollProfileRoutes.post('/components/:id/apply-default', async (c) => {
  const { db, hr, now } = ctx(c);
  return c.json(await applyDefault(db, c.req.param('id'), await readJson(c), hr, now));
});

hrPayrollProfileRoutes.get('/first-month-checklist', async (c) => c.json(await firstMonthChecklist(c.get('deps').db)));
