import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { config, isAllowedHrEmail } from './config.js';

const COOKIE = 'hr_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface HrSession {
  email: string;
  name: string | null;
}

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

/** Verify a Google Identity Services ID token and return the verified account. */
export async function verifyGoogleCredential(credential: string): Promise<HrSession | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    if (!email || payload.email_verified !== true) return null;
    return { email, name: typeof payload.name === 'string' ? payload.name : null };
  } catch {
    return null;
  }
}

export async function startSession(c: Context, session: HrSession): Promise<void> {
  const token = await new SignJWT({ name: session.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.email)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(sessionKey());
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function endSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Re-checks the allow-list on every request, so removing an email revokes access at once. */
export async function readSession(c: Context): Promise<HrSession | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] });
    if (!isAllowedHrEmail(payload.sub)) return null;
    return { email: payload.sub!, name: typeof payload.name === 'string' ? payload.name : null };
  } catch {
    return null;
  }
}

export type HrEnv = { Variables: { hr: HrSession } };

export const requireHr: MiddlewareHandler<HrEnv> = async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: 'Cần đăng nhập.' }, 401);
  c.set('hr', session);
  await next();
};

/**
 * CSRF guard for cookie-authenticated writes: browsers cannot attach a custom
 * header to a cross-site form post, and cross-origin fetch with one needs a
 * CORS preflight that this API never grants.
 */
export const requireFetchHeader: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'GET' && c.req.header('x-requested-with') !== 'fetch') {
    return c.json({ error: 'Yêu cầu không hợp lệ.' }, 403);
  }
  await next();
};
