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
    const results = await Promise.all(Array.from({ length: 20 }, () => login(HR_EMAIL, 'sai', '198.51.100.1')));
    const checked = results.filter((r) => r.status === 401).length;
    expect(checked).toBeLessThanOrEqual(5);
    expect(results.every((r) => r.status === 401 || r.status === 429)).toBe(true);
  });

  it('locks an unknown email exactly like a real one, so the answers do not reveal accounts', async () => {
    const statuses = async (email: string) => {
      const out: number[] = [];
      for (let i = 0; i < 6; i++) out.push((await login(email, 'sai', '198.51.100.3')).status);
      return out;
    };
    expect(await statuses('khong-co@congty.vn')).toEqual(await statuses(HR_EMAIL));
  });

  it('gives a full 5 tries again once a lock from a parallel burst has ended', async () => {
    await Promise.all(Array.from({ length: 8 }, () => login(HR_EMAIL, 'sai', '198.51.100.2')));
    later(16 * MINUTE);
    const next: number[] = [];
    for (let i = 0; i < 5; i++) next.push((await login(HR_EMAIL, 'sai', '198.51.100.2')).status);
    expect(next).toEqual([401, 401, 401, 401, 429]);
  });

  it('does not lock the real HR out on their own device when someone guesses from elsewhere', async () => {
    for (let i = 0; i < 5; i++) await login(HR_EMAIL, 'sai', '203.0.113.50');
    expect((await login(HR_EMAIL, PASSWORD, '203.0.113.50')).status).toBe(429);
    expect((await login(HR_EMAIL, PASSWORD, '198.51.100.77')).status).toBe(200);
  });

  it('still caps wrong guesses for one email spread over many devices', async () => {
    for (let i = 0; i < 30; i++) await login(HR_EMAIL, 'sai', `192.0.2.${i}`);
    expect((await login(HR_EMAIL, PASSWORD, '192.0.2.200')).status).toBe(429);
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

  it('should answer "wrong password" when a stored hash asks for the most memory scrypt allows', async () => {
    // 128 * N * r is exactly the memory cap, but scrypt needs a little more than that.
    await t.db
      .update(hrUsers)
      .set({ passwordHash: `scrypt$${2 ** 17}$16$1$c2FsdA==$aGFzaA==` })
      .where(eq(hrUsers.email, HR_EMAIL));

    const res = await login(HR_EMAIL, PASSWORD);

    expect(res.status).toBe(401);
  });

  it('should count a device by the address the nearest proxy saw, not by a first hop the client can fake', async () => {
    for (let i = 0; i < 30; i++) {
      await t.send(
        'POST',
        '/api/hr/auth/login',
        { email: `gia-${i}@congty.vn`, password: 'sai' },
        { 'x-forwarded-for': `1.2.3.${i}, 203.0.113.60` },
      );
    }

    const res = await login(HR_EMAIL, PASSWORD, '5.6.7.8, 203.0.113.60');

    expect(res.status).toBe(429);
  });

  it('should not use up an office address with successful sign-ins or tries on a locked account', async () => {
    const office = '203.0.113.70';
    await upsertHrUser(t.db, { email: 'ban@congty.vn', password: 'Thu-Hai-Dung-2026' });
    for (let i = 0; i < 30; i++) await login(HR_EMAIL, PASSWORD, office);
    for (let i = 0; i < 5; i++) await login('ban@congty.vn', 'sai', office);
    for (let i = 0; i < 30; i++) await login('ban@congty.vn', 'sai', office);

    const res = await login(HR_EMAIL, PASSWORD, office);

    expect(res.status).toBe(200);
  });

  it('should keep wrong guesses from another device counted when the real HR signs in', async () => {
    const attacker = '198.51.100.90';
    for (let i = 0; i < 4; i++) await login(HR_EMAIL, 'sai', attacker);
    expect((await login(HR_EMAIL, PASSWORD, '198.51.100.91')).status).toBe(200);

    const next = [(await login(HR_EMAIL, 'sai', attacker)).status, (await login(HR_EMAIL, 'sai', attacker)).status];

    expect(next).toEqual([429, 429]);
  });

  it('should keep an account locked for the full 15 minutes after the 5th wrong password', async () => {
    const ip = '198.51.100.93';
    await login(HR_EMAIL, 'sai', ip);
    later(14 * MINUTE);
    for (let i = 0; i < 4; i++) await login(HR_EMAIL, 'sai', ip);

    later(2 * MINUTE);
    const stillLocked = await login(HR_EMAIL, PASSWORD, ip);
    later(14 * MINUTE);
    const open = await login(HR_EMAIL, PASSWORD, ip);

    expect(stillLocked.status).toBe(429);
    expect(open.status).toBe(200);
  });

  it('should not let anyone block every HR when the client address is unknown', async () => {
    const noAddress = (email: string, password: string) => t.send('POST', '/api/hr/auth/login', { email, password });
    for (let i = 0; i < 30; i++) await noAddress(`la-${i}@congty.vn`, 'sai');

    const res = await noAddress(HR_EMAIL, PASSWORD);

    expect(res.status).toBe(200);
  });

  it('should give the real HR fresh tries on their own device after signing in', async () => {
    const own = '198.51.100.92';
    for (let i = 0; i < 4; i++) await login(HR_EMAIL, 'sai', own);
    expect((await login(HR_EMAIL, PASSWORD, own)).status).toBe(200);

    const next: number[] = [];
    for (let i = 0; i < 4; i++) next.push((await login(HR_EMAIL, 'sai', own)).status);

    expect(next).toEqual([401, 401, 401, 401]);
  });
});

describe('hr:user script helper', () => {
  it('should store an empty display name as no name, so the UI falls back to the email', async () => {
    await upsertHrUser(t.db, { email: HR_EMAIL, name: '  ', password: 'Doi-Lai-Ngay-2026' });

    expect((await findHrUser(t.db, HR_EMAIL))?.name).toBeNull();
  });

  it('keeps the display name when only the password is reset', async () => {
    await upsertHrUser(t.db, { email: HR_EMAIL, password: 'Doi-Lai-Ngay-2026' });
    expect((await findHrUser(t.db, HR_EMAIL))?.name).toBe('Phòng Nhân sự');
  });
});
