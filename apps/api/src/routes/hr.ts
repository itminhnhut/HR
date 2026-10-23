import type { HrMe } from '@careers/shared';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { currentHr, requireHr } from '../lib/hr-auth.js';
import { HttpError } from '../lib/http-error.js';
import { readJson } from '../lib/request.js';
import { passwordFingerprint } from '../lib/password.js';
import { clearSession, setSession } from '../lib/session.js';
import { signIn, toHrMe } from '../services/hr-accounts.js';
import { hrApplicationRoutes } from './hr-applications.js';
import { hrJobRoutes } from './hr-jobs.js';

export const hrRoutes = new Hono<Env>();

/** HR accounts have their own password (scripts/hr-user.ts creates them). */
hrRoutes.post('/auth/login', async (c) => {
  const { db, now } = c.get('deps');
  const user = await signIn(db, await readJson(c), now());
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
signedIn.route('/', hrApplicationRoutes);
hrRoutes.route('/', signedIn);
