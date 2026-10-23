import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface GoogleIdentity {
  email: string;
  name: string | null;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity | null>;

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Verifies a Google Identity Services ID token for our client id. Only verified emails count. */
export function googleVerifier(clientId: string): GoogleVerifier {
  return async (idToken) => {
    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
      if (!email || payload.email_verified !== true) return null;
      return { email, name: typeof payload.name === 'string' ? payload.name : null };
    } catch (error) {
      console.warn('Google ID token rejected', error instanceof Error ? error.message : error);
      return null;
    }
  };
}
