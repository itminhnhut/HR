import type { HrMe } from '@careers/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../app.js';
import { currentHr, requireHr } from '../lib/hr-auth.js';
import { HttpError } from '../lib/http-error.js';
import { readJson } from '../lib/request.js';
import { clearSession, setSession } from '../lib/session.js';
import { hrApplicationRoutes } from './hr-applications.js';
import { hrJobRoutes } from './hr-jobs.js';

const idTokenSchema = z.object({ idToken: z.string().min(1) });

export const hrRoutes = new Hono<Env>();

hrRoutes.post('/auth/google', async (c) => {
  const parsed = idTokenSchema.safeParse(await readJson(c));
  if (!parsed.success) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google.');
  const { verifyGoogleToken, config } = c.get('deps');
  const identity = await verifyGoogleToken(parsed.data.idToken);
  if (!identity) throw new HttpError(401, 'Không xác minh được tài khoản Google, thử lại.');
  if (!config.hrEmails.includes(identity.email)) {
    throw new HttpError(403, `Tài khoản ${identity.email} chưa được cấp quyền vào trang tuyển dụng.`);
  }
  await setSession(c, 'hr', identity.email, { name: identity.name });
  return c.json<HrMe>({ email: identity.email, name: identity.name });
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
