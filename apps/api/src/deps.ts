import type { PayrollKey } from './lib/payroll-crypto.js';
import type { Db } from './db/index.js';
import type { CvStore } from './lib/cv-store.js';
import type { PaperStore } from './lib/paper-store.js';
import type { CaptchaVerifier } from './lib/captcha.js';
import type { GoogleVerifier } from './lib/google.js';
import type { ImageStore } from './lib/image-store.js';
import type { RealtimeReader } from './lib/ga-realtime.js';
import type { FetchFn } from './lib/indexnow.js';
import type { Mailer } from './lib/mailer.js';

export interface AppConfig {
  /** Public FRONTEND origin, used in share pages and the sitemap. */
  siteUrl: string;
  companyName: string;
  isProduction: boolean;
  /** Signs session cookies. At least 32 characters. */
  sessionSecret: string;
  /** Secure cookies need HTTPS: on for Vercel, off for http://localhost. */
  secureCookies: boolean;
  /** IndexNow key (production only); null turns the pings and the /<key>.txt file off. */
  indexNowKey: string | null;
  /**
   * PAYROLL_ADMINS unset or empty: [PAYROLL_OPEN], every HR account has both payroll rights and the stored rights
   * decide nothing (changing them answers 409 payroll_open). Set: sign-in emails (lowercase) given both rights while
   * nobody has any payroll right, ignored once someone has it (spec-luong.md 10.2).
   */
  payrollAdmins: readonly string[];
  /**
   * Seals bank account numbers (spec-luong.md 10.2): PAYROLL_KEY when set, else a key made from the session secret
   * (version 0). Null only when that secret is the public local default and the database is real (payrollKeyOf):
   * saving, showing or exporting a whole number then answers 503.
   */
  payrollKey: PayrollKey | null;
}

/**
 * Everything the app reaches outside its own code. Production wires the real
 * services; tests pass a PGlite database and fakes for the external ones.
 */
export interface Deps {
  db: Db;
  config: AppConfig;
  cvStore: CvStore;
  /** Papers kept with an absence, private like CVs. */
  paperStore: PaperStore;
  /** Public images in news articles. */
  imageStore: ImageStore;
  verifyGoogleToken: GoogleVerifier;
  /** Cloudflare Turnstile on the public forms; null when no keys are configured. */
  verifyCaptcha: CaptchaVerifier;
  now: () => Date;
  /** Outgoing HTTP calls the app makes itself (IndexNow pings). */
  fetch: FetchFn;
  /** "Đang truy cập" on the HR overview. */
  readRealtime: RealtimeReader;
  /** Mail the server sends by itself (payslips); null or absent: not configured, HR sends from their own mailbox. */
  mailer?: Mailer | null;
}
