import type {
  HrMe,
  PayrollAccessDto,
  PayrollLogPageDto,
  PayrollRightsListDto,
  TimesheetLogPageDto,
} from '@careers/shared';
import { eq, sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hrUsers, payrollLog } from '../db/schema.js';
import { writePayrollLog } from '../services/payroll-log.js';
import { PAYROLL_OPEN } from '../services/payroll-rights.js';
import { json, loginHr } from '../test/fixtures.js';
import { createTestContext, HR_EMAIL, type TestContext } from '../test/harness.js';

/** Quyền Lương (spec-luong.md 2 (1), 10.2; docs/test-cases-luong.md H). People are fake: NV A, NV B. */

const OTHER = 'nhansu2@congty.vn';
const THIRD = 'nhansu3@congty.vn';
const ANY_ID = '11111111-1111-4111-8111-111111111111';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
});

const as = (cookie: string) => ({
  call: (method: string, path: string, body?: unknown) => t.send(method, `/api/hr${path}`, body, { cookie }),
});

const grant = async (email: string, approve = true) =>
  t.db.update(hrUsers).set({ canPayroll: true, canApprovePayroll: approve }).where(eq(hrUsers.email, email));

const idOf = async (email: string) => {
  const [user] = await t.db.select().from(hrUsers).where(eq(hrUsers.email, email));
  if (!user) throw new Error(`No account ${email}`);
  return user.id;
};

const rightsOf = async (email: string) => {
  const [user] = await t.db.select().from(hrUsers).where(eq(hrUsers.email, email));
  return { canPayroll: user?.canPayroll, canApprovePayroll: user?.canApprovePayroll };
};

/** Every route the payroll API has, with its parameters filled in. */
const payrollRoutes = () =>
  createApp(t.deps)
    .routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api/hr/payroll'))
    .map((r) => ({ method: r.method, path: r.path.replace(/:[a-zA-Z]+/g, ANY_ID) }));

describe('L-H01 menu: who may see Lương', () => {
  it('L-H01: should answer 403 to an HR account without the payroll right, so the menu stays hidden', async () => {
    // Arrange
    const plain = as(await loginHr(t));

    // Act
    const res = await plain.call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(403);
  });

  it('L-H01: should tell an HR account with both rights what it may do', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await grant(HR_EMAIL);

    // Act
    const res = await as(cookie).call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(200);
    expect(await json<PayrollAccessDto>(res)).toEqual({ canPayroll: true, canApprovePayroll: true });
  });

  it('L-H01: should say canPayroll true on /hr/me to an HR account with a payroll right', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await grant(HR_EMAIL, false);

    // Act
    const res = await as(cookie).call('GET', '/me');

    // Assert
    expect(res.status).toBe(200);
    expect(await json<HrMe>(res)).toMatchObject({ canPayroll: true, canApprovePayroll: false });
  });

  it('L-H01: should say canPayroll false on /hr/me to an HR account without a payroll right', async () => {
    // Arrange
    const cookie = await loginHr(t);

    // Act
    const res = await as(cookie).call('GET', '/me');

    // Assert
    expect(res.status).toBe(200);
    expect(await json<HrMe>(res)).toMatchObject({ canPayroll: false, canApprovePayroll: false });
  });
});

describe('L-H02 every payroll route answers 403 without the right', () => {
  it('L-H02: should refuse every payroll route with 403 and a body that has no number in it', async () => {
    // Arrange
    const plain = as(await loginHr(t));
    const routes = payrollRoutes();

    // Act
    const answers = await Promise.all(
      routes.map(async (r) => {
        const res = await plain.call(r.method, r.path.replace('/api/hr', ''), r.method === 'GET' ? undefined : {});
        return { route: `${r.method} ${r.path}`, status: res.status, body: await res.text() };
      }),
    );

    // Assert
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const answer of answers) {
      expect(answer.status, answer.route).toBe(403);
      expect(answer.body, answer.route).not.toMatch(/\d/);
    }
  });

  it('L-H02: should answer 403, not 404, to a payroll address that does not exist, so nothing about it shows', async () => {
    // Arrange
    const plain = as(await loginHr(t));

    // Act
    const res = await plain.call('GET', '/payroll/khong-co/2026/10');

    // Assert
    expect(res.status).toBe(403);
  });

  it('L-H02: should still ask for a sign-in first', async () => {
    // Act
    const res = await t.send('GET', '/api/hr/payroll/access');

    // Assert
    expect(res.status).toBe(401);
  });
});

describe('L-H04 Xem, sửa without Duyệt', () => {
  it('L-H04: should not let someone without Duyệt give Duyệt to anyone, themselves included', async () => {
    // Arrange: HR has Xem, sửa only; another account keeps both so the rule of one is met
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL, false);
    await grant(OTHER);

    // Act
    const own = await as(cookie).call('PUT', `/payroll/rights/${await idOf(HR_EMAIL)}`, {
      canPayroll: true,
      canApprovePayroll: true,
    });
    const other = await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: true,
      canApprovePayroll: false,
    });

    // Assert
    expect(own.status).toBe(403);
    expect(other.status).toBe(403);
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: true, canApprovePayroll: false });
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: true, canApprovePayroll: true });
  });

  it('L-H04: should refuse Duyệt without Xem, sửa', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: false,
      canApprovePayroll: true,
    });

    // Assert
    expect(res.status).toBe(422);
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: false, canApprovePayroll: false });
  });
});

describe('L-H05 giving and taking the right', () => {
  it('L-H05: should let someone with the payroll right give it to another account, and log who gave what to whom', async () => {
    // Arrange
    t.clock.now = new Date('2026-11-09T02:30:00.000Z');
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: true,
      canApprovePayroll: false,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: true, canApprovePayroll: false });
    const log = await json<PayrollLogPageDto>(await as(cookie).call('GET', '/payroll/log?nhom=quyen'));
    expect(log.lines).toEqual([
      expect.objectContaining({
        area: 'quyen',
        action: 'Cấp quyền',
        detail: `${OTHER}: Xem, sửa lương`,
        at: '2026-11-09T02:30:00.000Z',
      }),
    ]);
  });

  it('L-H05: should list every account with its rights only to someone who has the right', async () => {
    // Arrange
    const cookie = await loginHr(t);
    const otherCookie = await loginHr(t, OTHER);
    await grant(HR_EMAIL);

    // Act
    const listed = await as(cookie).call('GET', '/payroll/rights');
    const refused = await as(otherCookie).call('GET', '/payroll/rights');

    // Assert
    expect(listed.status).toBe(200);
    const list = await json<PayrollRightsListDto>(listed);
    expect(list.open).toBe(false);
    expect(list.accounts.map((r) => [r.email, r.canPayroll, r.canApprovePayroll, r.isMe])).toEqual([
      [HR_EMAIL, true, true, true],
      [OTHER, false, false, false],
    ]);
    expect(refused.status).toBe(403);
  });

  it('L-H05: should log nothing when the rights saved are the ones already held', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL);
    await grant(OTHER, false);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: true,
      canApprovePayroll: false,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await t.db.select().from(payrollLog)).toEqual([]);
  });
});

describe('L-H06 the last one with both rights', () => {
  it('L-H06: should refuse to take the rights of the only account that has both', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await grant(HR_EMAIL);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(HR_EMAIL)}`, {
      canPayroll: true,
      canApprovePayroll: false,
    });

    // Assert
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Phải còn ít nhất một người có quyền Lương và Duyệt.' });
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: true, canApprovePayroll: true });
  });

  it('L-H06: should refuse to delete the only account that has both rights', async () => {
    // Arrange
    await loginHr(t);
    const otherCookie = await loginHr(t, OTHER);
    await grant(HR_EMAIL);

    // Act
    const res = await as(otherCookie).call('DELETE', `/users/${await idOf(HR_EMAIL)}`);

    // Assert
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'Phải còn ít nhất một người có quyền Lương và Duyệt.' });
  });

  it('L-H06: should let one of two holders give up both rights', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL);
    await grant(OTHER);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(HR_EMAIL)}`, {
      canPayroll: false,
      canApprovePayroll: false,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: false, canApprovePayroll: false });
  });
});

describe('L-H07 PAYROLL_ADMINS', () => {
  it('L-H07: should give both rights to the listed accounts while nobody has any, and log it', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    t.deps.config.payrollAdmins = [HR_EMAIL, OTHER];

    // Act
    const res = await as(cookie).call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(200);
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: true, canApprovePayroll: true });
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: true, canApprovePayroll: true });
    const lines = await t.db.select().from(payrollLog);
    expect(lines.map((l) => [l.area, l.actor, l.action])).toEqual([
      ['quyen', 'Hệ thống', 'Cấp quyền từ PAYROLL_ADMINS'],
    ]);
  });

  it('L-H07: should ignore the list once someone has the right, so a right taken on the web stays taken', async () => {
    // Arrange: both were given by the list; HR then takes OTHER's rights on the web
    const cookie = await loginHr(t);
    const otherCookie = await loginHr(t, OTHER);
    t.deps.config.payrollAdmins = [HR_EMAIL, OTHER];
    await as(cookie).call('GET', '/payroll/access');
    await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: false,
      canApprovePayroll: false,
    });

    // Act
    const res = await as(otherCookie).call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(403);
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: false, canApprovePayroll: false });
  });

  it('L-H07: should not give the right to an account added to the list after someone already has it', async () => {
    // Arrange
    await loginHr(t);
    const thirdCookie = await loginHr(t, THIRD);
    await grant(HR_EMAIL);
    t.deps.config.payrollAdmins = [THIRD];

    // Act
    const res = await as(thirdCookie).call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(403);
    expect(await rightsOf(THIRD)).toEqual({ canPayroll: false, canApprovePayroll: false });
  });

  it('L-H07: should never give anything to an account that is not on the list', async () => {
    // Arrange
    const cookie = await loginHr(t);
    t.deps.config.payrollAdmins = [OTHER];

    // Act
    const res = await as(cookie).call('GET', '/payroll/access');

    // Assert
    expect(res.status).toBe(403);
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: false, canApprovePayroll: false });
  });
});

describe('L-H08 the right taken while the page is open', () => {
  it('L-H08: should answer 403 to the very next call once the right is taken', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);
    await grant(HR_EMAIL, false);
    await grant(OTHER);
    expect((await as(cookie).call('GET', '/payroll/log')).status).toBe(200);

    // Act
    await t.db.update(hrUsers).set({ canPayroll: false }).where(eq(hrUsers.email, HR_EMAIL));
    const res = await as(cookie).call('GET', '/payroll/log');

    // Assert
    expect(res.status).toBe(403);
  });
});

describe('L-H09 the payroll log is its own', () => {
  it('L-H09: should keep payroll lines out of the timesheet log, even when searched by the person code', async () => {
    // Arrange
    const cookie = await loginHr(t);
    await grant(HR_EMAIL);
    await writePayrollLog(t.db, {
      area: 'ho-so',
      actor: 'Lan',
      action: 'Sửa hồ sơ',
      detail: 'NV01 NV A: Tiền cơm 1.100.000 → 1.150.000',
      month: '2026-12',
      at: t.clock.now,
    });

    // Act
    const timesheet = await json<TimesheetLogPageDto>(await as(cookie).call('GET', '/timesheet/log?tim=NV01'));
    const payroll = await json<PayrollLogPageDto>(await as(cookie).call('GET', '/payroll/log?tim=NV01'));

    // Assert
    expect(timesheet.lines).toEqual([]);
    expect(payroll.lines.map((l) => [l.area, l.detail, l.month])).toEqual([
      ['ho-so', 'NV01 NV A: Tiền cơm 1.100.000 → 1.150.000', '2026-12'],
    ]);
  });
});

describe('L-I10 the payroll log is only added to', () => {
  it('L-I10: should refuse to change or remove a line, even straight in the database', async () => {
    // Arrange
    await writePayrollLog(t.db, {
      area: 'quyen',
      actor: 'Lan',
      action: 'Cấp quyền',
      detail: 'x',
      month: null,
      at: t.clock.now,
    });

    // Act + Assert
    await expect(t.db.execute(sql`update payroll_log set detail = 'y'`)).rejects.toThrow();
    await expect(t.db.execute(sql`delete from payroll_log`)).rejects.toThrow();
    expect(await t.db.select().from(payrollLog)).toHaveLength(1);
  });

  it('L-I10: should offer no route that writes to the log', () => {
    // Act
    const writers = payrollRoutes().filter((r) => r.path.includes('/log') && r.method !== 'GET');

    // Assert
    expect(writers).toEqual([]);
  });
});

describe('Lương open to every HR account while PAYROLL_ADMINS names nobody', () => {
  it('should give an HR account without any stored right both payroll rights', async () => {
    // Arrange
    t.deps.config.payrollAdmins = [PAYROLL_OPEN];
    const hr = as(await loginHr(t));

    // Act
    const me = await json<HrMe>(await hr.call('GET', '/me'));
    const access = await hr.call('GET', '/payroll/access');

    // Assert
    expect(me.canPayroll).toBe(true);
    expect(me.canApprovePayroll).toBe(true);
    expect(access.status).toBe(200);
  });

  it('should refuse to change rights while Lương is open to everyone, storing and logging nothing', async () => {
    // Arrange
    t.deps.config.payrollAdmins = [PAYROLL_OPEN];
    const cookie = await loginHr(t);
    await loginHr(t, OTHER);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(OTHER)}`, {
      canPayroll: true,
      canApprovePayroll: true,
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await json<{ code: string; error: string }>(res)).toMatchObject({
      code: 'payroll_open',
      error: 'Lương đang mở cho mọi tài khoản HR, chưa cần phân quyền',
    });
    expect(await rightsOf(OTHER)).toEqual({ canPayroll: false, canApprovePayroll: false });
    expect(await t.db.select().from(payrollLog)).toEqual([]);
  });

  it('should not let an HR account raise its own stored rights while Lương is open', async () => {
    // Arrange
    t.deps.config.payrollAdmins = [PAYROLL_OPEN];
    const cookie = await loginHr(t);

    // Act
    const res = await as(cookie).call('PUT', `/payroll/rights/${await idOf(HR_EMAIL)}`, {
      canPayroll: true,
      canApprovePayroll: true,
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await rightsOf(HR_EMAIL)).toEqual({ canPayroll: false, canApprovePayroll: false });
    expect(await t.db.select().from(payrollLog)).toEqual([]);
  });

  it('should tell the rights list that Lương is open to every HR account', async () => {
    // Arrange
    t.deps.config.payrollAdmins = [PAYROLL_OPEN];
    const cookie = await loginHr(t);

    // Act
    const res = await as(cookie).call('GET', '/payroll/rights');

    // Assert
    expect(res.status).toBe(200);
    expect((await json<PayrollRightsListDto>(res)).open).toBe(true);
  });

  it('should still ask for a sign-in first', async () => {
    t.deps.config.payrollAdmins = [PAYROLL_OPEN];

    const res = await t.send('GET', '/api/hr/payroll/access');

    expect(res.status).toBe(401);
  });
});
