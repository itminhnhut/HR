import type { HrMe } from '@careers/shared';
import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../app.js';
import { HttpError } from './http-error.js';
import { readSession } from './session.js';

/** Re-checks the allow-list on every request, so removing an email revokes access at once. */
export async function currentHr(c: Context<Env>): Promise<HrMe | null> {
  const session = await readSession(c, 'hr');
  if (!session || !c.get('deps').config.hrEmails.includes(session.subject)) return null;
  const name = session.claims.name;
  return { email: session.subject, name: typeof name === 'string' ? name : null };
}

export const requireHr: MiddlewareHandler<Env> = async (c, next) => {
  if (!(await currentHr(c))) throw new HttpError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
  await next();
};
