import type { HrMe } from '@careers/shared';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../app.js';
import { findHrUser, toHrMe } from '../services/hr-accounts.js';
import { HttpError } from './http-error.js';
import { passwordFingerprint } from './password.js';
import { readSession } from './session.js';

/**
 * Re-checks the account on every request: deleting it, or changing its password,
 * signs the person out at once.
 */
export async function currentHr(c: Context<Env>): Promise<HrMe | null> {
  const session = await readSession(c, 'hr');
  if (!session) return null;
  const user = await findHrUser(c.get('deps').db, session.subject);
  if (!user || session.claims.pw !== passwordFingerprint(user.passwordHash)) return null;
  return toHrMe(user);
}

export const requireHr: MiddlewareHandler<Env> = async (c, next) => {
  const me = await currentHr(c);
  if (!me) throw new HttpError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
  c.set('hr', me);
  await next();
};

/** The HR account of a request that passed requireHr. */
export function hrOf(c: Context<Env>): HrMe {
  const me = c.get('hr');
  if (!me) throw new HttpError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
  return me;
}
