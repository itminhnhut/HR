import type { MeResponse } from '@careers/shared';
import { Hono } from 'hono';
import { isAllowedHrEmail } from '../lib/config.js';
import { endSession, readSession, startSession, verifyGoogleCredential } from '../lib/session.js';

export const authRoutes = new Hono();

authRoutes.post('/google', async (c) => {
  const body = await c.req.json<{ credential?: string }>().catch(() => ({ credential: undefined }));
  if (!body.credential) return c.json({ error: 'Thiếu thông tin đăng nhập.' }, 400);

  const account = await verifyGoogleCredential(body.credential);
  if (!account) return c.json({ error: 'Không xác thực được tài khoản Google.' }, 401);
  if (!isAllowedHrEmail(account.email)) {
    return c.json({ error: `Tài khoản ${account.email} chưa được cấp quyền HR.` }, 403);
  }

  await startSession(c, account);
  const me: MeResponse = { email: account.email, name: account.name };
  return c.json(me);
});

authRoutes.get('/me', async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: 'Chưa đăng nhập.' }, 401);
  const me: MeResponse = session;
  c.header('Cache-Control', 'private, no-store');
  return c.json(me);
});

authRoutes.post('/logout', (c) => {
  endSession(c);
  return c.json({ ok: true });
});
