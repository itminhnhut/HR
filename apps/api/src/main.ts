import { createApp } from './app.js';
import { createNeonDb, type Db } from './db/index.js';
import { vercelBlobCvStore, type CvStore } from './lib/cv-store.js';
import { turnstileVerifier, type CaptchaVerifier } from './lib/captcha.js';
import { googleVerifier, type GoogleVerifier } from './lib/google.js';
import { vercelBlobImageStore, type ImageStore } from './lib/image-store.js';
import { companyName, envValue } from './lib/env-value.js';
import { isValidIndexNowKey } from './lib/indexnow.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const onVercel = process.env.VERCEL === '1';

/** Public FRONTEND origin without a trailing slash. */
export const siteUrl = () => (envValue(process.env.SITE_URL) || 'http://localhost:3344').replace(/\/$/, '');

/** Fixed so local sessions survive `tsx watch` restarts. Never used on Vercel. */
const LOCAL_DEV_SECRET = 'local-dev-only-session-secret-0000';

function sessionSecret(): string {
  const secret = onVercel ? requireEnv('SESSION_SECRET') : (process.env.SESSION_SECRET ?? LOCAL_DEV_SECRET);
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return secret;
}

function googleSignIn(): GoogleVerifier {
  const clientId = onVercel ? requireEnv('GOOGLE_CLIENT_ID') : process.env.GOOGLE_CLIENT_ID;
  if (clientId) return googleVerifier(clientId);
  // Local only, no OAuth client yet: the FE sends "dev:<email>" when VITE_DEV_GOOGLE_EMAIL is set.
  console.warn('GOOGLE_CLIENT_ID is not set: local sign-in accepts "dev:<email>" tokens.');
  return async (idToken) => {
    const email = idToken.startsWith('dev:') ? idToken.slice(4).trim().toLowerCase() : '';
    return email.includes('@') ? { email, name: 'Tài khoản dev' } : null;
  };
}

/** CAPTCHA on the public forms once TURNSTILE_SECRET_KEY is set (with VITE_TURNSTILE_SITE_KEY on the FE). */
function captcha(): CaptchaVerifier {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (secret) return turnstileVerifier(secret);
  console.warn('TURNSTILE_SECRET_KEY is not set: the public forms run without CAPTCHA.');
  return null;
}

/**
 * News images need a PUBLIC Blob store; a store's access is fixed when it is created, so the private CV
 * store cannot hold them. NEWS_BLOB_READ_WRITE_TOKEN is that public store's token. The fallback to
 * BLOB_READ_WRITE_TOKEN only works when the project's main store is itself public.
 */
function newsImageStore(): ImageStore {
  const token = process.env.NEWS_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (onVercel && !process.env.NEWS_BLOB_READ_WRITE_TOKEN) {
    console.warn('NEWS_BLOB_READ_WRITE_TOKEN is not set: news image uploads need a public Blob store.');
  }
  return vercelBlobImageStore(token);
}

/** IndexNow pings only from production, so preview deployments never announce their test content. */
function indexNowKey(isProduction: boolean): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !isProduction) return null;
  if (isValidIndexNowKey(key)) return key;
  console.warn('INDEXNOW_KEY must be 8-128 characters a-z, A-Z, 0-9 or "-": IndexNow is off.');
  return null;
}

/** Local stand-ins for services without credentials yet (see local-dev.ts). Ignored on Vercel. */
export interface LocalOverrides {
  db?: Db;
  cvStore?: CvStore;
  imageStore?: ImageStore;
}

/** The app wired to real services from environment variables (Vercel and `npm run dev:api`). */
export function createProductionApp(local: LocalOverrides = {}) {
  const useLocal: LocalOverrides = onVercel ? {} : local;
  const isProduction = process.env.VERCEL_ENV === 'production';
  return createApp({
    db: useLocal.db ?? createNeonDb(requireEnv('DATABASE_URL')),
    config: {
      siteUrl: siteUrl(),
      companyName: companyName(process.env),
      isProduction,
      sessionSecret: sessionSecret(),
      secureCookies: onVercel,
      indexNowKey: indexNowKey(isProduction),
    },
    cvStore: useLocal.cvStore ?? vercelBlobCvStore,
    imageStore: useLocal.imageStore ?? newsImageStore(),
    verifyGoogleToken: googleSignIn(),
    verifyCaptcha: captcha(),
    now: () => new Date(),
    fetch: (url, init) => fetch(url, init),
  });
}
