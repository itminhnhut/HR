import type { DepartmentDto, EmployeeDto, StaffKindDto, TimesheetDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, type Flow } from '../test/timesheet-flow.js';

/** What HR sets up once: departments and kinds of staff. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const departments = () => flow.call<DepartmentDto[]>('GET', '/departments');
const kinds = () => flow.call<StaffKindDto[]>('GET', '/staff-kinds');

describe('departments', () => {
  it('TC-CH-01: should let HR add one, once, whatever the capitals', async () => {
    // Act
    const added = await flow.call<DepartmentDto[]>('POST', '/departments', { name: 'Kế toán' }, 201);

    // Assert
    expect(added.map((d) => [d.name, d.employees])).toEqual([['Kế toán', 0]]);
    await flow.call('POST', '/departments', { name: 'kế toán' }, 422);
    await flow.call('POST', '/departments', { name: ' ' }, 422);
  });

  it('TC-CH-02: should remember a department typed on a person, and count who is in it', async () => {
    // Act
    await flow.addPerson({ code: 'A', department: 'Sales' });
    await flow.addPerson({ code: 'B', department: 'Sales' });

    // Assert
    expect((await departments()).map((d) => [d.name, d.employees])).toEqual([['Sales', 2]]);
  });

  it('TC-CH-03: should carry a new name to everyone in it, leaving a closed period as it closed', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', department: 'Sales' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);
    const [sales] = await departments();

    // Act
    await flow.call('PATCH', `/departments/${sales?.id}`, { name: 'Kinh doanh' });

    // Assert
    const people = await flow.call<EmployeeDto[]>('GET', '/employees');
    expect(people[0]?.department).toBe('Kinh doanh');
    expect(rowOf(await flow.period(2026, 10), 'A').department).toBe('Sales');
    expect(rowOf(await flow.period(2026, 11), 'A').department).toBe('Kinh doanh');
  });

  it('TC-CH-04: should refuse a name already taken', async () => {
    // Arrange
    await flow.call('POST', '/departments', { name: 'Sales' }, 201);
    const list = await flow.call<DepartmentDto[]>('POST', '/departments', { name: 'HR' }, 201);
    const hr = list.find((d) => d.name === 'HR');

    // Act + Assert
    await flow.call('PATCH', `/departments/${hr?.id}`, { name: 'sales' }, 422);
  });

  it('TC-CH-05: should remove one only when nobody is in it', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', department: 'Sales' });
    await flow.call('POST', '/departments', { name: 'Trống' }, 201);
    const list = await departments();
    const empty = list.find((d) => d.name === 'Trống');
    const used = list.find((d) => d.name === 'Sales');

    // Act + Assert
    expect(await flow.call<DepartmentDto[]>('DELETE', `/departments/${empty?.id}`)).toHaveLength(1);
    await flow.call('DELETE', `/departments/${used?.id}`, undefined, 409);
    await flow.call('DELETE', '/departments/khong-phai-id', undefined, 404);
  });

  it('TC-CH-06: should log what changed', async () => {
    // Arrange
    const november = await flow.period(2026, 11);

    // Act
    await flow.call('POST', '/departments', { name: 'Sales' }, 201);

    // Assert
    expect((await flow.log(november)).map((l) => l.action)).toContain('Thêm bộ phận');
  });
});

describe('kinds of staff', () => {
  const custom = async (name: string, rule: 'official' | 'probation') => {
    const list = await flow.call<StaffKindDto[]>('POST', '/staff-kinds', { name, rule }, 201);
    const kind = list.find((k) => k.name === name);
    if (!kind) throw new Error('kind not added');
    return kind;
  };

  it('TC-CH-07: should start with the two of the sheet, which can be renamed but not removed', async () => {
    // Act
    const list = await kinds();

    // Assert
    expect(list.map((k) => [k.name, k.rule, k.isDefault])).toEqual([['Chính thức', 'official', true], ['Thử việc', 'probation', true]]);
    const renamed = await flow.call<StaffKindDto[]>('PATCH', `/staff-kinds/${list[1]?.id}`, { name: 'Học việc', rule: 'probation' });
    expect(renamed.map((k) => k.name)).toContain('Học việc');
    await flow.call('DELETE', `/staff-kinds/${list[0]?.id}`, undefined, 409);
  });

  it('TC-CH-08: should not let a kind of the sheet change the way it counts', async () => {
    // Arrange
    const [official] = await kinds();

    // Act + Assert
    await flow.call('PATCH', `/staff-kinds/${official?.id}`, { name: 'Chính thức', rule: 'probation' }, 422);
  });

  it('TC-CH-09: should count someone by the rule of the kind HR gave them, and show its name', async () => {
    // Arrange: part-timers earn leave like official staff
    const partTime = await custom('Bán thời gian', 'official');
    const intern = await custom('Thực tập', 'probation');

    // Act
    await flow.addPerson({ code: 'A', staffKindId: partTime.id, openingLeave: 2 });
    await flow.addPerson({ code: 'B', staffKindId: intern.id, openingLeave: 2 });
    const sheet = await flow.period(2026, 11);

    // Assert
    expect(rowOf(sheet, 'A')).toMatchObject({ employment: 'official', staffLabel: 'Bán thời gian' });
    expect(rowOf(sheet, 'B')).toMatchObject({ employment: 'probation', staffLabel: 'Thực tập' });
  });

  it('TC-CH-10: should show the official name once someone has passed their official date', async () => {
    // Arrange
    const intern = await custom('Thực tập', 'probation');
    await flow.addPerson({ code: 'A', staffKindId: intern.id, officialOn: '2026-11-10' });

    // Act
    await flow.at('2026-10-26');
    const before = await flow.period(2026, 10);
    const after = await flow.period(2026, 11);

    // Assert
    expect(rowOf(before, 'A').staffLabel).toBe('Thực tập');
    expect(rowOf(after, 'A')).toMatchObject({ employment: 'official', staffLabel: 'Chính thức' });
  });

  it('TC-CH-11: should keep the name a closed period closed with', async () => {
    // Arrange
    const intern = await custom('Thực tập', 'probation');
    await flow.addPerson({ code: 'A', staffKindId: intern.id });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    await flow.call('PATCH', `/staff-kinds/${intern.id}`, { name: 'Sinh viên', rule: 'probation' });

    // Assert
    expect(rowOf(await flow.period(2026, 10), 'A').staffLabel).toBe('Thực tập');
    expect(rowOf(await flow.period(2026, 11), 'A').staffLabel).toBe('Sinh viên');
  });

  it('TC-CH-12: should remove a kind only when nobody has it, and count who does', async () => {
    // Arrange
    const used = await custom('Thực tập', 'probation');
    const empty = await custom('Khác', 'official');
    await flow.addPerson({ code: 'A', staffKindId: used.id });

    // Act + Assert
    expect((await kinds()).find((k) => k.id === used.id)?.employees).toBe(1);
    await flow.call('DELETE', `/staff-kinds/${used.id}`, undefined, 409);
    expect((await flow.call<StaffKindDto[]>('DELETE', `/staff-kinds/${empty.id}`)).some((k) => k.id === empty.id)).toBe(false);
  });

  it('TC-CH-15: should count everyone under the kind they show as, chosen or not', async () => {
    // Arrange
    await flow.addPerson({ code: 'A', employment: 'official' });
    await flow.addPerson({ code: 'B', employment: 'probation' });
    await flow.addPerson({ code: 'C', employment: 'probation', officialOn: '2020-01-01' });
    const intern = await custom('Thực tập', 'probation');
    await flow.addPerson({ code: 'D', staffKindId: intern.id });

    // Act
    const counts = (await kinds()).map((k) => [k.name, k.employees]);

    // Assert
    expect(counts).toContainEqual(['Chính thức', 2]);
    expect(counts).toContainEqual(['Thử việc', 1]);
    expect(counts).toContainEqual(['Thực tập', 1]);
  });

  it('TC-CH-13: should refuse a kind it does not know on a person, and two kinds of one name', async () => {
    // Act + Assert
    const answer = await flow.attempt('POST', '/employees', { code: 'Z', fullName: 'Z', department: '', title: '', regionId: flow.hcm.id, employment: 'official', staffKindId: '00000000-0000-4000-8000-000000000000', joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 });
    expect(answer.status).toBe(422);
    await flow.call('POST', '/staff-kinds', { name: 'chính thức', rule: 'official' }, 422);
  });

  it('TC-CH-14: should keep showing the default names for someone without a chosen kind', async () => {
    // Act
    await flow.addPerson({ code: 'A', employment: 'probation' });
    const sheet: TimesheetDto = await flow.period(2026, 11);

    // Assert
    expect(rowOf(sheet, 'A').staffLabel).toBe('Thử việc');
  });
});
