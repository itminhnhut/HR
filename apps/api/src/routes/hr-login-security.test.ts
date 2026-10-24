import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers } from '../db/schema.js';
import { findHrUser, upsertHrUser } from '../services/hr-accounts.js';
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
let ipCounter = 0;
/** Each test gets its own address unless it passes one, so the per-device limit does not leak between tests. */
const login = (email: string, password: string, ip = `10.0.0.${++ipCounter % 250}`) =>
  t.send('POST', '/api/hr/auth/login', { email, password }, { 'x-forwarded-for': ip });
const later = (ms: number) => {
  t.clock.now = new Date(t.clock.now.getTime() + ms);
};

describe('HR sign-in limits', () => {
  it('checks at most 5 passwords per account even when guesses arrive in parallel', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => login(HR_EMAIL, 'sai')));
    const checked = results.filter((r) => r.status === 401).length;
    expect(checked).toBeLessThanOrEqual(5);
    expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
  });

  it('locks an unknown email exactly like a real one, so the answers do not reveal accounts', async () => {
    const statuses = async (email: string) => {
      const out: number[] = [];
      for (let i = 0; i < 6; i++) out.push((await login(email, 'sai')).status);
      return out;
    };
    expect(await statuses('khong-co@congty.vn')).toEqual(await statuses(HR_EMAIL));
  });

  it('gives a full 5 tries again once a lock from a parallel burst has ended', async () => {
    await Promise.all(Array.from({ length: 8 }, () => login(HR_EMAIL, 'sai')));
    later(16 * MINUTE);
    const next: number[] = [];
    for (let i = 0; i < 5; i++) next.push((await login(HR_EMAIL, 'sai')).status);
    expect(next).toEqual([401, 401, 401, 401, 429]);
  });

  it('limits sign-in attempts per device, whatever email is tried', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < 30; i++) await login(`nguoi-${i}@congty.vn`, 'sai', ip);
    const blocked = await login(HR_EMAIL, PASSWORD, ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: expect.stringMatching(/máy này/) });
    expect((await login(HR_EMAIL, PASSWORD, '203.0.113.10')).status).toBe(200);
  });

  it('answers "wrong password" instead of failing when a stored hash is malformed', async () => {
    await t.db
      .update(hrUsers)
      .set({ passwordHash: 'scrypt$abc$8$1$c2FsdA==$aGFzaA==' })
      .where(eq(hrUsers.email, HR_EMAIL));
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(401);
    await t.db
      .update(hrUsers)
      .set({ passwordHash: `scrypt$${2 ** 24}$8$1$c2FsdA==$aGFzaA==` })
      .where(eq(hrUsers.email, HR_EMAIL));
    expect((await login(HR_EMAIL, PASSWORD)).status).toBe(401);
  });
});

describe('hr:user script helper', () => {
  it('keeps the display name when only the password is reset', async () => {
    await upsertHrUser(t.db, { email: HR_EMAIL, password: 'Doi-Lai-Ngay-2026' });
    expect((await findHrUser(t.db, HR_EMAIL))?.name).toBe('Phòng Nhân sự');
  });
});
