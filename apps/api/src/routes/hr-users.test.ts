import type { HrMe, HrUserDto, TempPasswordResponse } from '@careers/shared';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hrUsers } from '../db/schema.js';
import { cookiesFrom, HR_PASSWORD, json, loginHr } from '../test/fixtures.js';
import { createTestContext, HR_EMAIL, type TestContext } from '../test/harness.js';

const OTHER_EMAIL = 'nhansu2@congty.vn';
const NEW_PASSWORD = 'Bau-Troi-Xanh-2026';

let t: TestContext;
let cookie: string;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  cookie = await loginHr(t);
});

const hr = (method: string, path: string, body?: unknown, as = cookie) =>
  t.send(method, `/api/hr${path}`, body, { cookie: as });
const login = (email: string, password: string) => t.send('POST', '/api/hr/auth/login', { email, password });
const userId = async (email: string) => (await t.db.select().from(hrUsers).where(eq(hrUsers.email, email)))[0].id;

describe('GET /api/hr/users', () => {
  it('lists every account oldest first, marking the caller and showing the last sign-in', async () => {
    t.clock.now = new Date('2026-10-21T03:00:00.000Z');
    await loginHr(t, OTHER_EMAIL);

    const users = await json<HrUserDto[]>(await hr('GET', '/users'));

    expect(users.map((u) => [u.email, u.isMe])).toEqual([
      [HR_EMAIL, true],
      [OTHER_EMAIL, false],
    ]);
    expect(users[1].lastLoginAt).toBe('2026-10-21T03:00:00.000Z');
  });
});

describe('POST /api/hr/users', () => {
  it('creates an account with a generated password that signs in right away', async () => {
    const res = await hr('POST', '/users', { email: 'Moi@CongTy.vn', name: 'Chị Lan' });

    expect(res.status).toBe(200);
    const body = await json<TempPasswordResponse>(res);
    expect(body.user).toMatchObject({ email: 'moi@congty.vn', name: 'Chị Lan', lastLoginAt: null, isMe: false });
    expect(body.password).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
    expect((await login('moi@congty.vn', body.password)).status).toBe(200);
  });

  it('refuses an email that already has an account', async () => {
    const res = await hr('POST', '/users', { email: 'HR@congty.vn' });

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { email: 'Email này đã có tài khoản.' } });
    expect(await t.db.select().from(hrUsers)).toHaveLength(1);
  });

  it('refuses an invalid email', async () => {
    const res = await hr('POST', '/users', { email: 'khong-phai-email' });

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { email: 'Email chưa đúng.' } });
  });
});

describe('POST /api/hr/users/:id/reset-password', () => {
  it('gives the other person a new password and ends their open session', async () => {
    const otherCookie = await loginHr(t, OTHER_EMAIL);
    expect((await hr('GET', '/me', undefined, otherCookie)).status).toBe(200);

    const res = await hr('POST', `/users/${await userId(OTHER_EMAIL)}/reset-password`);

    expect(res.status).toBe(200);
    const { password, user } = await json<TempPasswordResponse>(res);
    expect(user.email).toBe(OTHER_EMAIL);
    expect((await hr('GET', '/me', undefined, otherCookie)).status).toBe(401);
    expect((await login(OTHER_EMAIL, HR_PASSWORD)).status).toBe(401);
    expect((await login(OTHER_EMAIL, password)).status).toBe(200);
  });

  it('unlocks an account that was locked by wrong passwords', async () => {
    await loginHr(t, OTHER_EMAIL);
    for (let i = 0; i < 5; i++) await login(OTHER_EMAIL, 'sai');
    expect((await login(OTHER_EMAIL, HR_PASSWORD)).status).toBe(429);

    const { password } = await json<TempPasswordResponse>(
      await hr('POST', `/users/${await userId(OTHER_EMAIL)}/reset-password`),
    );

    expect((await login(OTHER_EMAIL, password)).status).toBe(200);
  });

  it('refuses to reset your own password and keeps it', async () => {
    const res = await hr('POST', `/users/${await userId(HR_EMAIL)}/reset-password`);

    expect(res.status).toBe(422);
    expect((await hr('GET', '/me')).status).toBe(200);
  });

  it('answers 404 for unknown or malformed ids', async () => {
    expect((await hr('POST', '/users/00000000-0000-0000-0000-000000000000/reset-password')).status).toBe(404);
    expect((await hr('POST', '/users/abc/reset-password')).status).toBe(404);
  });
});

describe('DELETE /api/hr/users/:id', () => {
  it('removes another account and signs that person out at once', async () => {
    const otherCookie = await loginHr(t, OTHER_EMAIL);

    const res = await hr('DELETE', `/users/${await userId(OTHER_EMAIL)}`);

    expect(await res.json()).toEqual({ ok: true });
    expect((await t.db.select().from(hrUsers)).map((u) => u.email)).toEqual([HR_EMAIL]);
    expect((await hr('GET', '/me', undefined, otherCookie)).status).toBe(401);
  });

  it('refuses to delete the account you are signed in with', async () => {
    await loginHr(t, OTHER_EMAIL);

    const res = await hr('DELETE', `/users/${await userId(HR_EMAIL)}`);

    expect(res.status).toBe(422);
    expect(await t.db.select().from(hrUsers)).toHaveLength(2);
  });

  it('keeps the last remaining account', async () => {
    const res = await hr('DELETE', `/users/${await userId(HR_EMAIL)}`);

    expect(res.status).toBe(422);
    expect(await t.db.select().from(hrUsers)).toHaveLength(1);
  });

  it('answers 404 for an unknown id', async () => {
    expect((await hr('DELETE', '/users/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });
});

describe('POST /api/hr/me/password', () => {
  it('changes your password and keeps this browser signed in, ending other sessions', async () => {
    const otherBrowser = cookiesFrom(await login(HR_EMAIL, HR_PASSWORD));

    const res = await hr('POST', '/me/password', { current: HR_PASSWORD, next: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(await json<HrMe>(res)).toMatchObject({ email: HR_EMAIL });
    const renewed = cookiesFrom(res);
    expect((await hr('GET', '/me', undefined, renewed)).status).toBe(200);
    expect((await hr('GET', '/me', undefined, otherBrowser)).status).toBe(401);
    expect((await login(HR_EMAIL, HR_PASSWORD)).status).toBe(401);
    expect((await login(HR_EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses a wrong current password', async () => {
    const res = await hr('POST', '/me/password', { current: 'sai-mat-khau', next: NEW_PASSWORD });

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { current: 'Mật khẩu hiện tại chưa đúng.' } });
    expect((await hr('GET', '/me')).status).toBe(200);
  });

  it('refuses a weak new password', async () => {
    const res = await hr('POST', '/me/password', { current: HR_PASSWORD, next: 'ngan' });

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { next: expect.stringMatching(/12 ký tự/) } });
    expect((await login(HR_EMAIL, HR_PASSWORD)).status).toBe(200);
  });

  it('asks for both passwords', async () => {
    expect((await hr('POST', '/me/password', { current: HR_PASSWORD })).status).toBe(422);
  });
});
