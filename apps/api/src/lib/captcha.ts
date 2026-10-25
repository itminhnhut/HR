import { HttpError } from './http-error.js';

/** Checks a Cloudflare Turnstile token. `null` verifier = CAPTCHA switched off (no keys configured). */
export type CaptchaVerifier = ((token: string, ip: string) => Promise<boolean>) | null;

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileVerifier(secret: string): NonNullable<CaptchaVerifier> {
  return async (token, ip) => {
    try {
      const res = await fetch(SITEVERIFY, {
        method: 'POST',
        body: new URLSearchParams({ secret, response: token, ...(ip !== 'unknown' ? { remoteip: ip } : {}) }),
      });
      const body = (await res.json()) as { success?: boolean };
      return body.success === true;
    } catch (error) {
      // Cloudflare unreachable: refuse rather than let bots through, and leave a trace for whoever looks.
      console.error('Turnstile verification failed', error);
      return false;
    }
  };
}

export const CAPTCHA_MESSAGE = 'Xác nhận bạn không phải robot rồi gửi lại.';

/** Throws 422 unless the token passes (or CAPTCHA is off). */
export async function requireCaptcha(verify: CaptchaVerifier, token: unknown, ip: string): Promise<void> {
  if (!verify) return;
  const ok = typeof token === 'string' && token.length > 0 && token.length < 4096 && (await verify(token, ip));
  if (!ok) throw new HttpError(422, CAPTCHA_MESSAGE, { captcha: CAPTCHA_MESSAGE });
}
