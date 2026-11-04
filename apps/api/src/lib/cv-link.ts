import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long the link in a letter opens: a candidate reads it around the interview, not months later. */
const VALID_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(\d+)\.([\w-]+)$/;

export interface CvLinkToken {
  id: string;
  /** Seconds since 1970. */
  expires: number;
  signature: string;
}

/** Signs the stored file too, so a link stops working as soon as the CV is replaced. */
const signatureOf = (secret: string, id: string, expires: number, pathname: string) =>
  createHmac('sha256', secret).update(`cv-link:v1:${id}:${expires}:${pathname}`).digest('base64url');

/** The end of the 30th day, so every letter copied today carries the same address. */
function expiryFrom(now: Date): number {
  const dayEnd = (Math.floor(now.getTime() / DAY_MS) + VALID_DAYS + 1) * DAY_MS;
  return Math.floor(dayEnd / 1000);
}

export function createCvLink(secret: string, siteUrl: string, id: string, pathname: string, now: Date) {
  const expires = expiryFrom(now);
  return {
    url: `${siteUrl}/api/cv/${id}.${expires}.${signatureOf(secret, id, expires, pathname)}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function readCvLinkToken(token: string): CvLinkToken | null {
  const match = TOKEN.exec(token);
  const [, id, expires, signature] = match ?? [];
  return id && expires && signature ? { id, expires: Number(expires), signature } : null;
}

export function isCvLinkValid(secret: string, token: CvLinkToken, pathname: string, now: Date): boolean {
  if (token.expires * 1000 <= now.getTime()) return false;
  const expected = Buffer.from(signatureOf(secret, token.id, token.expires, pathname));
  const given = Buffer.from(token.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
