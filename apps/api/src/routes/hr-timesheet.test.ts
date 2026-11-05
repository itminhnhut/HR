import type { EmployeeDto, TimesheetDto, TimesheetLogDto, TimesheetRegionDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { upsertHrUser } from '../services/hr-accounts.js';
import { createTestContext, type TestContext } from '../test/harness.js';

let t: TestContext;
let cookie: string;
let hcm: TimesheetRegionDto;
let hn: TimesheetRegionDto;

const NOW = new Date('2026-11-05T03:00:00.000Z');

const call = async <T>(method: string, path: string, body?: unknown, expected = 200): Promise<T> => {
  const res = await t.send(method, `/api/hr/timesheet${path}`, body, { cookie });
  const text = await res.text();
  expect(res.status, text).toBe(expected);
  return (text ? JSON.parse(text) : null) as T;
};

const addPerson = (over: Record<string, unknown> = {}) =>
  call<EmployeeDto>('POST', '/employees', { code: 'TF100', fullName: 'Người Thử', regionId: hcm.id, employment: 'official', openingLeave: 2, ...over }, 201);
const november = () => call<TimesheetDto>('GET', '/periods/2026/11');
const october = () => call<TimesheetDto>('GET', '/periods/2026/10');

const logIn = async () => {
  const login = await t.send('POST', '/api/hr/auth/login', { email: 'hr@lee-hr.com', password: 'Hop-Dong-Test-2026' });
  cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
};

beforeAll(async () => {
  t = await createTestContext();
});

beforeEach(async () => {
  await t.reset();
  t.clock.now = NOW;
  await upsertHrUser(t.db, { email: 'hr@lee-hr.com', name: 'Lan', password: 'Hop-Dong-Test-2026' });
  await logIn();
  const regions = await call<TimesheetRegionDto[]>('GET', '/regions');
  hcm = regions.find((r) => r.name === 'HCM') as TimesheetRegionDto;
  hn = regions.find((r) => r.name === 'HN') as TimesheetRegionDto;
});

describe('the timesheet', () => {
  it('should need a signed-in HR', async () => {
    // Act
    const res = await t.send('GET', '/api/hr/timesheet/periods/2026/11');

    // Assert
    expect(res.status).toBe(401);
  });

  it('should open a month as its 26–25 period with the suggested norms', async () => {
    // Act
    const dto = await november();

    // Assert
    expect(dto).toMatchObject({ from: '2026-10-26', to: '2026-11-25', status: 'open', today: '2026-11-05', rule: { threshold: 14, perPeriod: 1 } });
    expect(dto.norms[hcm.id]).toBe(25);
    expect(dto.norms[hn.id]).toBe(27);
  });

  it('should list only who works during the period', async () => {
    // Arrange
    await addPerson({ code: 'A', leftOn: '2026-10-20' });
    await addPerson({ code: 'B', joinedOn: '2026-12-01' });
    await addPerson({ code: 'C', joinedOn: '2026-11-03' });

    // Act
    const dto = await november();

    // Assert
    expect(dto.rows.map((r) => r.code)).toEqual(['C']);
  });

  it('should keep what HR entered and go back to automatic when it is cleared', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId } = await november();

    // Act
    const entered = await call<TimesheetDto>('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'P', note: 'Việc nhà' }] });
    const cleared = await call<TimesheetDto>('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: null, note: null }] });

    // Assert
    expect(entered.rows[0]?.cells['2026-11-04']).toEqual({ entered: 'P', note: 'Việc nhà' });
    expect(cleared.rows[0]?.cells['2026-11-04']).toBeUndefined();
  });

  it('should keep a note when only the code changes, and the code when only the note changes', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId } = await november();
    await call('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'M', note: 'Kẹt xe' }] });

    // Act
    const a = await call<TimesheetDto>('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'P' }] });
    const b = await call<TimesheetDto>('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', note: 'Khác' }] });

    // Assert
    expect(a.rows[0]?.cells['2026-11-04']).toEqual({ entered: 'P', note: 'Kẹt xe' });
    expect(b.rows[0]?.cells['2026-11-04']).toEqual({ entered: 'P', note: 'Khác' });
  });

  it('should refuse a code that does not exist, a day outside the period and a day outside the working dates', async () => {
    // Arrange
    const person = await addPerson({ joinedOn: '2026-11-03' });
    const { periodId } = await november();
    const cell = (over: object) => ({ cells: [{ employeeId: person.id, day: '2026-11-04', code: 'P', ...over }] });

    // Act + Assert
    await call('PATCH', `/${periodId}/cells`, cell({ code: 'P2' }), 422);
    await call('PATCH', `/${periodId}/cells`, cell({ day: '2026-12-01' }), 422);
    await call('PATCH', `/${periodId}/cells`, cell({ day: '2026-11-02' }), 422);
  });

  it('should write down who changed what', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId } = await november();

    // Act
    await call('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'KL' }] });
    await call('PATCH', `/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-11-04', code: 'KL' }] });
    const log = await call<TimesheetLogDto[]>('GET', `/${periodId}/log`);

    // Assert: saving the same thing again is not a change
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor: 'Lan', action: 'Chấm công' });
    expect(log[0]?.detail).toContain('tự động → KL');
    expect(log[0]?.detail).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('should save a norm for this period only', async () => {
    // Arrange
    const { periodId } = await november();

    // Act
    const saved = await call<TimesheetDto>('PATCH', `/${periodId}/norms`, { norms: { [hcm.id]: 24 } });
    const other = await october();

    // Assert
    expect(saved.norms[hcm.id]).toBe(24);
    expect(saved.norms[hn.id]).toBe(27);
    expect(other.norms[hcm.id]).toBe(22);
  });
});

describe('closing a period', () => {
  it('should lock it, and carry the leave balance into the next period', async () => {
    // Arrange: 22 working days by itself in October, so +1 on top of 2
    await addPerson();
    t.clock.now = new Date('2026-10-26T03:00:00.000Z');
    const { periodId } = await october();

    // Act
    const closed = await call<TimesheetDto>('POST', `/${periodId}/close`);
    const next = await november();

    // Assert
    expect(closed).toMatchObject({ status: 'closed', closedBy: 'Lan', canReopen: true });
    expect(next.rows[0]?.leaveOpening).toBe(3);
  });

  it('should refuse to close a period before its last day, because later days have no attendance yet', async () => {
    // Arrange
    await addPerson();
    await call('POST', `/${(await october()).periodId}/close`);
    const { periodId } = await november();

    // Act
    const res = await t.send('POST', `/api/hr/timesheet/${periodId}/close`, undefined, { cookie });

    // Assert
    expect(res.status).toBe(409);
    expect((await res.json()) as { code: string }).toMatchObject({ code: 'period_running' });
    expect(await november()).toMatchObject({ status: 'open' });
  });

  it('should refuse entries while closed', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId } = await october();
    await call('POST', `/${periodId}/close`);

    // Act
    const res = await t.send('PATCH', `/api/hr/timesheet/${periodId}/cells`, { cells: [{ employeeId: person.id, day: '2026-10-05', code: 'P' }] }, { cookie });

    // Assert
    expect(res.status).toBe(409);
  });

  it('should keep what a closed period said about someone who changes later', async () => {
    // Arrange
    const person = await addPerson({ department: 'Kế toán' });
    const { periodId } = await october();
    await call('POST', `/${periodId}/close`);

    // Act
    await call('PATCH', `/employees/${person.id}`, { code: 'TF100', fullName: 'Tên Mới', department: 'HR', regionId: hn.id, employment: 'official', openingLeave: 9 });
    const after = await october();

    // Assert
    expect(after.rows[0]).toMatchObject({ fullName: 'Người Thử', department: 'Kế toán', regionId: hcm.id, norm: 22 });
  });

  it('should refuse closing before an earlier open period', async () => {
    // Arrange
    await october();
    const { periodId } = await november();

    // Act
    const res = await t.send('POST', `/api/hr/timesheet/${periodId}/close`, undefined, { cookie });

    // Assert
    expect(res.status).toBe(409);
    expect((await res.json()) as { code: string }).toMatchObject({ code: 'earlier_open' });
  });

  it('should reopen only the latest closed period, and only with a reason', async () => {
    // Arrange
    await addPerson();
    const first = await october();
    await call('POST', `/${first.periodId}/close`);
    t.clock.now = new Date('2026-11-26T03:00:00.000Z');
    await logIn();
    const second = await november();
    await call('POST', `/${second.periodId}/close`);

    // Act + Assert
    await call('POST', `/${second.periodId}/reopen`, { reason: ' ' }, 422);
    expect(await october()).toMatchObject({ canReopen: false });
    await call('POST', `/${first.periodId}/reopen`, { reason: 'Sửa' }, 409);
    const reopened = await call<TimesheetDto>('POST', `/${second.periodId}/reopen`, { reason: 'Sửa sai' });
    expect(reopened.status).toBe('open');
    const log = await call<TimesheetLogDto[]>('GET', `/${second.periodId}/log`);
    expect(log.find((l) => l.action === 'Mở lại kỳ')).toMatchObject({ actor: 'Lan', detail: 'Sửa sai' });
  });
});

describe('an adjustment', () => {
  it('should need a reason', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId } = await november();

    // Act + Assert
    await call('POST', `/${periodId}/adjustments`, { employeeId: person.id, amount: -0.5, reason: '', isRecurring: true }, 422);
    await call('POST', `/${periodId}/adjustments`, { employeeId: person.id, amount: 0, reason: 'x', isRecurring: true }, 422);
    await call('POST', `/${periodId}/adjustments`, { employeeId: person.id, amount: 0.3, reason: 'x', isRecurring: true }, 422);
  });

  it('should come back every period when recurring, stop when removed, and leave earlier periods alone', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId: oct } = await october();
    await call('POST', `/${oct}/adjustments`, { employeeId: person.id, amount: -0.5, reason: 'Sáng thứ 6', isRecurring: true });

    // Act
    const nov = await november();
    const removed = await call<TimesheetDto>('DELETE', `/${nov.periodId}/adjustments/${nov.rows[0]?.adjustments[0]?.id}`);
    const backInOctober = await october();

    // Assert
    expect(nov.rows[0]?.adjustments[0]).toMatchObject({ amount: -0.5, isRecurring: true, createdBy: 'Lan' });
    expect(removed.rows[0]?.adjustments).toEqual([]);
    expect(backInOctober.rows[0]?.adjustments).toHaveLength(1);
  });

  it('should stay in its own period when it is once only', async () => {
    // Arrange
    const person = await addPerson();
    const { periodId: oct } = await october();

    // Act
    await call('POST', `/${oct}/adjustments`, { employeeId: person.id, amount: 1, reason: 'Làm bù', isRecurring: false });

    // Assert
    expect((await october()).rows[0]?.adjustments).toHaveLength(1);
    expect((await november()).rows[0]?.adjustments).toEqual([]);
  });
});

describe('a free range of days', () => {
  it('should read without becoming a period, up to 31 days', async () => {
    // Arrange
    await addPerson();

    // Act
    const dto = await call<TimesheetDto>('GET', '/range?from=2026-11-02&to=2026-11-15');

    // Assert
    expect(dto).toMatchObject({ periodId: null, from: '2026-11-02', to: '2026-11-15' });
    expect(dto.rows).toHaveLength(1);
    await call('GET', '/range?from=2026-10-01&to=2026-11-15', undefined, 422);
    await call('GET', '/range?from=2026-11-15&to=2026-11-02', undefined, 422);
  });
});

describe('people and settings', () => {
  it('should not allow the same code twice, and a leave date before the start', async () => {
    // Arrange
    await addPerson();

    // Act + Assert
    await addPersonExpect({ code: 'TF100' }, 422);
    await addPersonExpect({ code: 'TF101', joinedOn: '2026-11-05', leftOn: '2026-11-01' }, 422);
    await addPersonExpect({ code: 'TF102', regionId: '00000000-0000-4000-8000-000000000000' }, 422);
  });

  it('should keep a region someone belongs to', async () => {
    // Arrange
    await addPerson();

    // Act + Assert
    await call('DELETE', `/regions/${hcm.id}`, undefined, 409);
    const left = await call<TimesheetRegionDto[]>('DELETE', `/regions/${hn.id}`);
    expect(left.map((r) => r.name)).toEqual(['HCM']);
  });

  it('should add a region and refuse the same name', async () => {
    // Act
    const regions = await call<TimesheetRegionDto[]>('POST', '/regions', { name: 'Đà Nẵng', saturdays: 2, tone: 'cyan' }, 201);

    // Assert
    expect(regions).toHaveLength(3);
    await call('POST', '/regions', { name: 'Đà Nẵng', saturdays: 2, tone: 'cyan' }, 422);
  });

  it('should show a holiday only in the period it falls in', async () => {
    // Act
    await call('POST', '/holidays', { day: '2026-11-24', name: 'Lễ thử' });

    // Assert
    expect((await november()).holidays).toEqual([{ day: '2026-11-24', name: 'Lễ thử' }]);
    expect((await october()).holidays).toEqual([]);
    expect(await call('DELETE', '/holidays/2026-11-24')).toEqual([]);
  });
});

function addPersonExpect(over: Record<string, unknown>, status: number) {
  return call('POST', '/employees', { code: 'X', fullName: 'Người', regionId: hcm.id, employment: 'official', ...over }, status);
}
