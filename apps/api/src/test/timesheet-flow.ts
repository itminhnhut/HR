import {
  dayCode,
  isWeekend,
  periodDays,
  timesheetTotals,
  type AttendanceCode,
  type EmployeeDto,
  type TimesheetDto,
  type TimesheetLogDto,
  type TimesheetRegionDto,
  type TimesheetRowDto,
  type TimesheetTotals,
} from '@careers/shared';
import { expect } from 'vitest';
import { upsertHrUser } from '../services/hr-accounts.js';
import { createTestContext, type TestContext } from './harness.js';

/** HR going through several periods over the real API and a real Postgres. Only the clock is moved. */

const HR = { email: 'hr@lee-hr.com', name: 'Lan', password: 'Hop-Dong-Test-2026' };

export interface Flow {
  t: TestContext;
  hcm: TimesheetRegionDto;
  hn: TimesheetRegionDto;
  /** A moment of that day in Vietnam, signed in again because sessions do not last for months. */
  at(day: string): Promise<void>;
  call<T>(method: string, path: string, body?: unknown, expected?: number): Promise<T>;
  /** The status and the error code, when the answer is the point of the test. */
  attempt(method: string, path: string, body?: unknown): Promise<{ status: number; code?: string }>;
  addPerson(over?: Record<string, unknown>): Promise<EmployeeDto>;
  updatePerson(person: EmployeeDto, over: Record<string, unknown>): Promise<EmployeeDto>;
  period(year: number, month: number): Promise<TimesheetDto>;
  enter(dto: TimesheetDto, employeeId: string, cells: Record<string, AttendanceCode>): Promise<TimesheetDto>;
  close(year: number, month: number): Promise<TimesheetDto>;
  log(dto: TimesheetDto): Promise<TimesheetLogDto[]>;
  reset(): Promise<void>;
}

export async function createFlow(): Promise<Flow> {
  const t = await createTestContext();
  let cookie = '';
  const regions: { hcm?: TimesheetRegionDto; hn?: TimesheetRegionDto } = {};

  const request = (method: string, path: string, body?: unknown) => t.send(method, `/api/hr/timesheet${path}`, body, { cookie });
  const call = async <T>(method: string, path: string, body?: unknown, expected = 200): Promise<T> => {
    const res = await request(method, path, body);
    const text = await res.text();
    expect(res.status, `${method} ${path}: ${text}`).toBe(expected);
    return (text ? JSON.parse(text) : null) as T;
  };
  const signIn = async () => {
    const login = await t.send('POST', '/api/hr/auth/login', { email: HR.email, password: HR.password });
    cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
  };
  const region = (key: 'hcm' | 'hn') => {
    const found = regions[key];
    if (!found) throw new Error('The flow has not been reset yet');
    return found;
  };

  const flow: Flow = {
    t,
    get hcm() {
      return region('hcm');
    },
    get hn() {
      return region('hn');
    },
    async at(day) {
      t.clock.now = new Date(`${day}T03:00:00.000Z`);
      await signIn();
    },
    call,
    async attempt(method, path, body) {
      const res = await request(method, path, body);
      const text = await res.text();
      let code: string | undefined;
      try {
        code = (JSON.parse(text) as { code?: string }).code;
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
      }
      return { status: res.status, code };
    },
    addPerson(over = {}) {
      return call<EmployeeDto>('POST', '/employees', { code: 'TF100', fullName: 'Người Thử', regionId: region('hcm').id, employment: 'official', openingLeave: 0, ...over }, 201);
    },
    updatePerson(person, over) {
      const { id: _id, ...fields } = person;
      return call<EmployeeDto>('PATCH', `/employees/${person.id}`, { ...fields, ...over });
    },
    period(year, month) {
      return call<TimesheetDto>('GET', `/periods/${year}/${month}`);
    },
    enter(dto, employeeId, cells) {
      return call<TimesheetDto>('PATCH', `/${dto.periodId}/cells`, {
        cells: Object.entries(cells).map(([day, code]) => ({ employeeId, day, code })),
      });
    },
    async close(year, month) {
      const dto = await flow.period(year, month);
      return call<TimesheetDto>('POST', `/${dto.periodId}/close`);
    },
    log(dto) {
      return call<TimesheetLogDto[]>('GET', `/${dto.periodId}/log`);
    },
    async reset() {
      await t.reset();
      await upsertHrUser(t.db, HR);
      await flow.at('2026-11-05');
      const list = await call<TimesheetRegionDto[]>('GET', '/regions');
      regions.hcm = list.find((r) => r.name === 'HCM');
      regions.hn = list.find((r) => r.name === 'HN');
    },
  };
  return flow;
}

export function rowOf(dto: TimesheetDto, code: string): TimesheetRowDto {
  const row = dto.rows.find((r) => r.code === code);
  if (!row) throw new Error(`${code} is not in the period ${dto.from}–${dto.to}: ${dto.rows.map((r) => r.code).join(', ')}`);
  return row;
}

/** What the screen and the Excel file show for a person: the same rules on what the server sends. */
export function totalsOf(dto: TimesheetDto, code: string): TimesheetTotals {
  const row = rowOf(dto, code);
  const codes = periodDays({ from: dto.from, to: dto.to }).map((day) =>
    dayCode({
      day,
      entered: row.cells[day]?.entered ?? null,
      isHoliday: dto.holidays.some((h) => h.day === day),
      today: dto.today,
      joinedOn: row.joinedOn,
      leftOn: row.leftOn,
    }),
  );
  return timesheetTotals({
    codes,
    norm: row.norm,
    leaveOpening: row.leaveOpening,
    employment: row.employment,
    adjustment: row.adjustments.reduce((sum, a) => sum + a.amount, 0),
    leaveChange: row.leaveChanges.reduce((sum, c) => sum + c.amount, 0),
    rule: dto.rule,
    ...row.leaveSoFar,
  });
}

/** The Mon–Fri of a period, for filling it with one code. */
export const weekdaysOf = (dto: Pick<TimesheetDto, 'from' | 'to'>) => periodDays({ from: dto.from, to: dto.to }).filter((d) => !isWeekend(d));

export const allOn = (days: readonly string[], code: AttendanceCode): Record<string, AttendanceCode> =>
  Object.fromEntries(days.map((d) => [d, code]));
