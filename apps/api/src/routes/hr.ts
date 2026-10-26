import type { HrMe } from '@careers/shared';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { currentHr, hrOf, requireHr } from '../lib/hr-auth.js';
import { HttpError } from '../lib/http-error.js';
import { clientIp } from '../lib/rate-limit.js';
import { readJson } from '../lib/request.js';
import { passwordFingerprint } from '../lib/password.js';
import { clearSession, setSession } from '../lib/session.js';
import { dashboard } from '../services/dashboard.js';
import { signIn, toHrMe } from '../services/hr-accounts.js';
import {
  changeOwnPassword,
  createHrUser,
  deleteHrUser,
  listHrUsers,
  resetHrPassword,
  updateMyProfile,
} from '../services/hr-users.js';
import { listMessageTemplates, resetMessageTemplate, saveMessageTemplate } from '../services/message-templates.js';
import { hrApplicationRoutes } from './hr-applications.js';
import { hrJobRoutes } from './hr-jobs.js';
import { hrNewsRoutes } from './hr-news.js';

export const hrRoutes = new Hono<Env>();

/** HR accounts have their own password (scripts/hr-user.ts creates them). */
hrRoutes.post('/auth/login', async (c) => {
  const { db, now } = c.get('deps');
  const user = await signIn(db, await readJson(c), now(), clientIp(c));
  await setSession(c, 'hr', user.email, { pw: passwordFingerprint(user.passwordHash) });
  return c.json<HrMe>(toHrMe(user));
});

hrRoutes.get('/me', async (c) => {
  const me = await currentHr(c);
  if (!me) throw new HttpError(401, 'Chưa đăng nhập.');
  return c.json(me);
});

hrRoutes.post('/logout', (c) => {
  clearSession(c, 'hr');
  return c.json({ ok: true });
});

/** Everything below needs a signed-in HR account. */
const signedIn = new Hono<Env>();
signedIn.use(requireHr);
signedIn.route('/jobs', hrJobRoutes);
signedIn.route('/news', hrNewsRoutes);
signedIn.get('/dashboard', async (c) => {
  const { db, now } = c.get('deps');
  return c.json(await dashboard(db, now()));
});

/** "Tài khoản HR": every HR account has full rights, so any of them manages the others. */
signedIn.get('/users', async (c) => c.json(await listHrUsers(c.get('deps').db, hrOf(c))));
signedIn.post('/users', async (c) => c.json(await createHrUser(c.get('deps').db, await readJson(c), hrOf(c))));
signedIn.post('/users/:id/reset-password', async (c) =>
  c.json(await resetHrPassword(c.get('deps').db, c.req.param('id'), hrOf(c))),
);
signedIn.delete('/users/:id', async (c) => c.json(await deleteHrUser(c.get('deps').db, c.req.param('id'), hrOf(c))));
signedIn.patch('/me', async (c) => c.json(await updateMyProfile(c.get('deps').db, await readJson(c), hrOf(c))));

/** "Mẫu thư": message templates shared by every HR. */
signedIn.get('/message-templates', async (c) => c.json(await listMessageTemplates(c.get('deps').db)));
signedIn.put('/message-templates/:key', async (c) =>
  c.json(await saveMessageTemplate(c.get('deps').db, c.req.param('key'), await readJson(c))),
);
signedIn.delete('/message-templates/:key', async (c) =>
  c.json(await resetMessageTemplate(c.get('deps').db, c.req.param('key'))),
);

signedIn.post('/me/password', async (c) => {
  const user = await changeOwnPassword(c.get('deps').db, await readJson(c), hrOf(c));
  // The old cookie carries the old password fingerprint; keep this browser signed in.
  await setSession(c, 'hr', user.email, { pw: passwordFingerprint(user.passwordHash) });
  return c.json<HrMe>(toHrMe(user));
});
signedIn.route('/', hrApplicationRoutes);
hrRoutes.route('/', signedIn);
