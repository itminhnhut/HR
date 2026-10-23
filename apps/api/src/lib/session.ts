import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { jwtVerify, SignJWT } from 'jose';
import type { Env } from '../app.js';

export const COOKIES = {
  hr: { name: 'hr_session', maxAge: 7 * 24 * 60 * 60 },
  candidate: { name: 'candidate_session', maxAge: 30 * 24 * 60 * 60 },
  /** Google email waiting for the one-time phone check (BR-22). */
  pendingGoogle: { name: 'candidate_google', maxAge: 10 * 60 },
} as const;

type CookieKind = keyof typeof COOKIES;

const key = (secret: string) => new TextEncoder().encode(secret);

/** Signed (HS256), httpOnly session cookie. `subject` is the email or phone. */
export async function setSession(
  c: Context<Env>,
  kind: CookieKind,
  subject: string,
  claims: Record<string, string | null> = {},
): Promise<void> {
  const { config, now } = c.get('deps');
  const { name, maxAge } = COOKIES[kind];
  const issuedAt = Math.floor(now().getTime() / 1000);
  const token = await new SignJWT({ ...claims, kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + maxAge)
    .sign(key(config.sessionSecret));
  setCookie(c, name, token, { httpOnly: true, secure: config.secureCookies, sameSite: 'Lax', path: '/', maxAge });
}

export interface SessionClaims {
  subject: string;
  claims: Record<string, unknown>;
}

export async function readSession(c: Context<Env>, kind: CookieKind): Promise<SessionClaims | null> {
  const token = getCookie(c, COOKIES[kind].name);
  if (!token) return null;
  const { config, now } = c.get('deps');
  try {
    const { payload } = await jwtVerify(token, key(config.sessionSecret), {
      algorithms: ['HS256'],
      currentDate: now(),
    });
    // A cookie signed for another purpose must not open this door.
    if (payload.kind !== kind || typeof payload.sub !== 'string') return null;
    return { subject: payload.sub, claims: payload };
  } catch {
    // Expired, tampered or signed with an old secret: treat as signed out.
    return null;
  }
}

export function clearSession(c: Context<Env>, kind: CookieKind): void {
  deleteCookie(c, COOKIES[kind].name, { path: '/' });
}
