import type { SignedOutResponse } from '@careers/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../app.js';
import { HttpError } from '../lib/http-error.js';
import { readJson, readMultipart } from '../lib/request.js';
import { clearSession, setSession } from '../lib/session.js';
import { deleteCandidateData, overview, updateCandidate } from '../services/candidate-account.js';
import { currentCandidate, requireCandidate, signInWithGoogle, toCandidateMe } from '../services/candidate-auth.js';

const idTokenSchema = z.object({ idToken: z.string().min(1) });

/** Candidates sign in with Google only; there is no phone or password sign-in. */
export const candidateRoutes = new Hono<Env>();

candidateRoutes.post('/google', async (c) => {
  const parsed = idTokenSchema.safeParse(await readJson(c));
  if (!parsed.success) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google.');
  const { db, verifyGoogleToken } = c.get('deps');
  const identity = await verifyGoogleToken(parsed.data.idToken);
  if (!identity) throw new HttpError(401, 'Không xác minh được tài khoản Google, thử lại.');
  const candidate = await signInWithGoogle(db, identity);
  await setSession(c, 'candidate', candidate.id);
  return c.json(await toCandidateMe(db, candidate));
});

/** Public pages ask on every load: a visitor who is not signed in is a normal answer, not an error. */
candidateRoutes.get('/me', async (c) => {
  c.header('cache-control', 'private, no-store');
  const candidate = await currentCandidate(c);
  if (!candidate) return c.json({ signedIn: false } satisfies SignedOutResponse);
  const { db, now } = c.get('deps');
  return c.json(await overview(db, candidate, now()));
});

candidateRoutes.patch('/me', async (c) => {
  const candidate = await requireCandidate(c);
  return c.json(await updateCandidate(c.get('deps'), candidate, await readMultipart(c, 'cv')));
});

candidateRoutes.delete('/me', async (c) => {
  const candidate = await requireCandidate(c);
  const result = await deleteCandidateData(c.get('deps'), candidate);
  clearSession(c, 'candidate');
  return c.json(result);
});

candidateRoutes.post('/logout', (c) => {
  clearSession(c, 'candidate');
  return c.json({ ok: true });
});
