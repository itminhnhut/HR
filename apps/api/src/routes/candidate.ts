import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../app.js';
import type { Candidate } from '../db/schema.js';
import { HttpError } from '../lib/http-error.js';
import { readJson, readMultipart } from '../lib/request.js';
import { clearSession, readSession, setSession } from '../lib/session.js';
import { deleteCandidateData, overview, savedSlugs, setSaved, updateCandidate } from '../services/candidate-account.js';
import {
  candidateByEmail,
  findOrCreateCandidate,
  linkGoogleEmail,
  requestOtp,
  toCandidateMe,
  verifyOtp,
} from '../services/candidate-auth.js';

const idTokenSchema = z.object({ idToken: z.string().min(1) });
const savedSchema = z.object({ saved: z.boolean() });

/** The signed-in candidate, or null. A deleted account ends the session. */
async function currentCandidate(c: Context<Env>): Promise<Candidate | null> {
  const session = await readSession(c, 'candidate');
  if (!session) return null;
  const { db } = c.get('deps');
  const candidate = await db.query.candidates.findFirst({ where: (t, { eq }) => eq(t.phone, session.subject) });
  if (!candidate) clearSession(c, 'candidate');
  return candidate ?? null;
}

async function requireCandidate(c: Context<Env>): Promise<Candidate> {
  const candidate = await currentCandidate(c);
  if (!candidate) throw new HttpError(401, 'Đăng nhập lại để tiếp tục.');
  return candidate;
}

export const candidateRoutes = new Hono<Env>();

candidateRoutes.post('/otp', async (c) => {
  return c.json(await requestOtp(c.get('deps'), await readJson(c)));
});

candidateRoutes.post('/otp/verify', async (c) => {
  const deps = c.get('deps');
  const phone = await verifyOtp(deps, await readJson(c));
  const candidate = await findOrCreateCandidate(deps.db, phone);
  // BR-22: first Google sign-in finishes here, once the phone is proven.
  const pending = await readSession(c, 'pendingGoogle');
  if (pending) {
    await linkGoogleEmail(deps.db, phone, pending.subject);
    clearSession(c, 'pendingGoogle');
  }
  await setSession(c, 'candidate', phone);
  const fresh = pending ? await findOrCreateCandidate(deps.db, phone) : candidate;
  return c.json(await toCandidateMe(deps.db, fresh));
});

candidateRoutes.post('/google', async (c) => {
  const parsed = idTokenSchema.safeParse(await readJson(c));
  if (!parsed.success) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google.');
  const { db, verifyGoogleToken } = c.get('deps');
  const identity = await verifyGoogleToken(parsed.data.idToken);
  if (!identity) throw new HttpError(401, 'Không xác minh được tài khoản Google, thử lại.');
  const linked = await candidateByEmail(db, identity.email);
  if (linked) {
    await setSession(c, 'candidate', linked.phone);
    return c.json({ email: identity.email, needsPhone: false });
  }
  await setSession(c, 'pendingGoogle', identity.email);
  return c.json({ email: identity.email, needsPhone: true });
});

candidateRoutes.get('/me', async (c) => {
  const candidate = await requireCandidate(c);
  const { db, now } = c.get('deps');
  return c.json(await overview(db, candidate, now()));
});

candidateRoutes.patch('/me', async (c) => {
  const candidate = await requireCandidate(c);
  return c.json(await updateCandidate(c.get('deps'), candidate, await readMultipart(c, 'cv')));
});

candidateRoutes.delete('/me', async (c) => {
  const candidate = await requireCandidate(c);
  const result = await deleteCandidateData(c.get('deps'), candidate.phone);
  clearSession(c, 'candidate');
  clearSession(c, 'pendingGoogle');
  return c.json(result);
});

/** Signed-out visitors simply have nothing saved. */
candidateRoutes.get('/saved', async (c) => {
  const candidate = await currentCandidate(c);
  return c.json(candidate ? await savedSlugs(c.get('deps').db, candidate.phone) : []);
});

candidateRoutes.put('/saved/:slug', async (c) => {
  const candidate = await requireCandidate(c);
  const parsed = savedSchema.safeParse(await readJson(c));
  if (!parsed.success) throw new HttpError(400, 'Dữ liệu không hợp lệ.');
  return c.json(await setSaved(c.get('deps').db, candidate.phone, c.req.param('slug'), parsed.data.saved));
});

candidateRoutes.post('/logout', (c) => {
  clearSession(c, 'candidate');
  clearSession(c, 'pendingGoogle');
  return c.json({ ok: true });
});
