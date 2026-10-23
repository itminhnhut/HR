import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export type OtpChannel = 'zalo' | 'sms';

/** Delivers a login code. A real provider (Zalo ZNS, SMS) plugs in here later (BR-17). */
export interface OtpSender {
  send(phone: string, code: string, channel: OtpChannel): Promise<void>;
  /** Only the local dev sender: the API may echo the code so developers can sign in. */
  readonly revealsCode: boolean;
}

/** Local development only: prints the code instead of sending it. */
export const consoleOtpSender: OtpSender = {
  revealsCode: true,
  async send(phone, code, channel) {
    console.info(`[dev OTP] ${phone} via ${channel}: ${code}`);
  },
};

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export const newOtpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Keyed hash, so a leaked table row does not hand out the code. */
export const hashOtp = (secret: string, phone: string, code: string) =>
  createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');

export function otpMatches(secret: string, phone: string, code: string, storedHash: string): boolean {
  const actual = Buffer.from(hashOtp(secret, phone, code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
