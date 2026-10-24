import { createApp } from './app.js';
import { createNeonDb, type Db } from './db/index.js';
import { vercelBlobCvStore, type CvStore } from './lib/cv-store.js';
import { googleVerifier, type GoogleVerifier } from './lib/google.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const onVercel = process.env.VERCEL === '1';

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

/** Local stand-ins for services without credentials yet (see local-dev.ts). Ignored on Vercel. */
export interface LocalOverrides {
  db?: Db;
  cvStore?: CvStore;
}

/** The app wired to real services from environment variables (Vercel and `npm run dev:api`). */
export function createProductionApp(local: LocalOverrides = {}) {
  const useLocal = onVercel ? {} : local;
  return createApp({
    db: useLocal.db ?? createNeonDb(requireEnv('DATABASE_URL')),
    config: {
      siteUrl: (process.env.SITE_URL ?? 'http://localhost:3344').replace(/\/$/, ''),
      companyName: process.env.COMPANY_NAME ?? 'TOP FLOW',
      isProduction: process.env.VERCEL_ENV === 'production',
      sessionSecret: sessionSecret(),
      secureCookies: onVercel,
    },
    cvStore: useLocal.cvStore ?? vercelBlobCvStore,
    verifyGoogleToken: googleSignIn(),
    now: () => new Date(),
  });
}
