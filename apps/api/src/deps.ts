import type { Db } from './db/index.js';
import type { CvStore } from './lib/cv-store.js';
import type { CaptchaVerifier } from './lib/captcha.js';
import type { GoogleVerifier } from './lib/google.js';

export interface AppConfig {
  /** Public FRONTEND origin, used in share pages and the sitemap. */
  siteUrl: string;
  companyName: string;
  isProduction: boolean;
  /** Signs session cookies. At least 32 characters. */
  sessionSecret: string;
  /** Secure cookies need HTTPS: on for Vercel, off for http://localhost. */
  secureCookies: boolean;
}

/**
 * Everything the app reaches outside its own code. Production wires the real
 * services; tests pass a PGlite database and fakes for the external ones.
 */
export interface Deps {
  db: Db;
  config: AppConfig;
  cvStore: CvStore;
  verifyGoogleToken: GoogleVerifier;
  /** Cloudflare Turnstile on the public forms; null when no keys are configured. */
  verifyCaptcha: CaptchaVerifier;
  now: () => Date;
}
