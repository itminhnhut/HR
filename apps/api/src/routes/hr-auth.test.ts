import { randomBytes, scrypt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers } from '../db/schema.js';
import { generatePassword, hashPassword, needsRehash, passwordProblem, verifyPassword } from '../lib/password.js';
import { upsertHrUser } from '../services/hr-accounts.js';
import { insertJob, jobInput } from '../test/fixtures.js';
import { cookiesFrom } from '../test/fixtures.js';
import { createTestContext, HR_EMAIL, type TestContext } from '../test/harness.js';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  await upsertHrUser(t.db, { email: HR_EMAIL, name: 'Phòng Nhân sự', password: PASSWORD });
});

const PASSWORD = 'Dung-Roi-Test-2026';
const MINUTE = 60_000;
const login = (email: string, password: string) => t.send('POST', '/api/hr/auth/login', { email, password });
const later = (ms: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + ms);
};

describe('HR sign-in with own password', () => {
  it('signs in with the right password, records the time and keeps the session', async () => {
    const res = await login('  HR@congty.vn ', PASSWORD);
    expect(res.status).toBe(200);
    const [user] = await t.db.select().from(hrUsers);
    expect(await res.json()).toEqual({ id: user.id, email: HR_EMAIL, name: 'Phòng Nhân sự' });
    expect(user.lastLoginAt).toEqual(t.clock.now);
    const setCookie = res.headers.getSetCookie()[0];
    expect(setCookie).toMatch(/^hr_session=.*HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    const me = await t.request('/api/hr/me', { headers: { cookie: cookiesFrom(res) } });
    expect(await me.json()).toEqual({ id: user.id, email: HR_EMAIL, name: 'Phòng Nhân sự' });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await login(HR_EMAIL, 'sai-mat-khau');
    const unknown = await login('khong-co@congty.vn', PASSWORD);
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(wrong.headers.getSetCookie()).toEqual([]);
  });

  it('asks for both fields', async () => {
    expect((await login('', PASSWORD)).status).toBe(422);
    expect((await t.send('POST', '/api/hr/auth/login', { email: HR_EMAIL })).status).toBe(422);
  });

  it('locks the account for 15 minutes after 5 wrong passwords, even for the right one', async () => {
    for (let i = 0; i < 4; i++) expect((await login(HR_EMAIL, 'sai')).status).toBe(401);
    const fifth = await login(HR_EMAIL, 'sai');
    expect(fifth.status).toBe(429);
    expect(((await fifth.json()) as { error: string }).error).toMatch(
      /^Đăng nhập sai nhiều lần\. Thử lại sau 15 phút \(lúc \d{2}:\d{2}\), hoặc nhờ HR khác đặt lại mật khẩu\.$/,
    );

    later(10 * MINUTE);
    const stillLocked = await login(HR_EMAIL, PASSWORD);
    expect(stillLocked.status).toBe(429);
    expect(await stillLocked.json()).toMatchObject({ error: expect.stringMatching(/5 phút/) });

    later(5 * MINUTE + 1000);
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(200);
  });

  it('resets the failure count after a successful sign-in', async () => {
    for (let i = 0; i < 4; i++) await login(HR_EMAIL, 'sai');
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login(HR_EMAIL, 'sai')).status).toBe(401);
  });

  it('counts parallel wrong guesses against the same limit', async () => {
    await Promise.all(Array.from({ length: 8 }, () => login(HR_EMAIL, 'sai')));
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(429);
  });

  it('signs a person out at once when their account is deleted', async () => {
    const cookie = cookiesFrom(await login(HR_EMAIL, PASSWORD));
    await t.db.delete(hrUsers).where(eq(hrUsers.email, HR_EMAIL));
    expect((await t.request('/api/hr/jobs', { headers: { cookie } })).status).toBe(401);
  });

  it('signs old sessions out when the password changes', async () => {
    const cookie = cookiesFrom(await login(HR_EMAIL, PASSWORD));
    await upsertHrUser(t.db, { email: HR_EMAIL, name: 'Phòng Nhân sự', password: 'Moi-Doi-Test-2026' });
    expect((await t.request('/api/hr/me', { headers: { cookie } })).status).toBe(401);
    expect((await login(HR_EMAIL, 'Moi-Doi-Test-2026')).status).toBe(200);
  });

  it('rejects a forged or expired session cookie', async () => {
    const forged = await new SignJWT({ kind: 'hr' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(HR_EMAIL)
      .sign(new TextEncoder().encode('another-secret-another-secret-12345'));
    expect((await t.request('/api/hr/jobs', { headers: { cookie: `hr_session=${forged}` } })).status).toBe(401);

    const cookie = cookiesFrom(await login(HR_EMAIL, PASSWORD));
    later(8 * 24 * 60 * MINUTE);
    expect((await t.request('/api/hr/jobs', { headers: { cookie } })).status).toBe(401);
  });

  it('does not accept a candidate cookie as an HR session', async () => {
    const cookie = cookiesFrom(await login(HR_EMAIL, PASSWORD)).replace('hr_session', 'candidate_session');
    expect((await t.request('/api/hr/me', { headers: { cookie } })).status).toBe(401);
  });

  it('blocks every HR endpoint without a session', async () => {
    const job = await insertJob(t);
    const calls = [
      t.request('/api/hr/jobs'),
      t.request(`/api/hr/jobs/${job.id}`),
      t.send('POST', '/api/hr/jobs', jobInput()),
      t.send('PUT', `/api/hr/jobs/${job.id}`, jobInput()),
      t.send('DELETE', `/api/hr/jobs/${job.id}`),
      t.send('POST', `/api/hr/jobs/${job.id}/close`),
      t.send('POST', `/api/hr/jobs/${job.id}/deadline`, { deadline: '2026-11-30' }),
      t.request('/api/hr/jobs/template'),
      t.send('PUT', '/api/hr/jobs/template', {}),
      t.request('/api/hr/dashboard'),
      t.request('/api/hr/applications'),
      t.send('DELETE', '/api/hr/applications/due'),
      t.request('/api/hr/subscribers'),
      t.request('/api/hr/users'),
      t.send('POST', '/api/hr/users', { email: 'moi@congty.vn' }),
      t.send('POST', '/api/hr/me/password', { current: PASSWORD, next: 'Moi-Doi-Test-2026' }),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  it('no longer offers Google sign-in for HR', async () => {
    expect((await t.send('POST', '/api/hr/auth/google', { idToken: 'google:hr@congty.vn' })).status).toBe(401);
  });

  it('answers /hr/me with 401 when signed out and clears the cookie on logout', async () => {
    expect((await t.request('/api/hr/me')).status).toBe(401);
    const res = await t.send('POST', '/api/hr/logout');
    expect(res.headers.getSetCookie()[0]).toMatch(/hr_session=;.*Max-Age=0/);
  });
});

describe('passwords', () => {
  it('are stored as salted scrypt hashes at the OWASP cost, never in clear', async () => {
    const [user] = await t.db.select().from(hrUsers);
    expect(user.passwordHash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it('verify only the exact password', async () => {
    const stored = await hashPassword('Mật-khẩu-123');
    expect(await verifyPassword('Mật-khẩu-123', stored)).toBe(true);
    expect(await verifyPassword('mật-khẩu-123', stored)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });

  it('refuse weak passwords for accounts', async () => {
    const weak = {
      'Ngan-1a': /12 ký tự/,
      chuthuongvaso123: /3 trong 4/,
      'Admin-Lee-Hr-2026': /tên email/,
      'Matkhau-Cua-Toi-2026': /phổ biến/,
      'Aaaaa-Bbbbb-2026': /lặp/,
    };
    for (const [password, reason] of Object.entries(weak)) {
      expect(passwordProblem(password, 'admin@lee-hr.com') ?? 'accepted', password).toMatch(reason);
      await expect(upsertHrUser(t.db, { email: 'admin@lee-hr.com', name: null, password })).rejects.toThrow(reason);
    }
  });

  it('generate strong, readable passwords that pass the rules', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const password = generatePassword();
      expect(password).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
      expect(passwordProblem(password, 'hr@lee-hr.com')).toBeNull();
      seen.add(password);
    }
    expect(seen.size).toBe(200);
  });

  it('upgrade an old, cheaper hash at the next sign-in', async () => {
    const old = await scryptHash(PASSWORD, 16384);
    await t.db.update(hrUsers).set({ passwordHash: old });
    expect(needsRehash(old)).toBe(true);

    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(200);

    const [user] = await t.db.select().from(hrUsers);
    expect(user.passwordHash).toMatch(/^scrypt\$131072\$/);
    expect(needsRehash(user.passwordHash)).toBe(false);
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(200);
  });
});

/** A hash in the old format (cost N), as accounts created before the upgrade have. */
function scryptHash(password: string, N: number): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, 32, { N, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(['scrypt', N, 8, 1, salt.toString('base64'), key.toString('base64')].join('$')),
    ),
  );
}
