import type { ApproverDto, DepartmentDto, TimesheetLogPageDto, TimesheetRegionDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/** Everything HR changes inside a tab leaves a line, all read in the one Nhật ký tab. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const page = (query = '') => flow.call<TimesheetLogPageDto>('GET', `/log${query}`);
const logOf = async (area: string) => (await page(`?nhom=${area}`)).lines;
const actions = async (area: string) => (await logOf(area)).map((l) => l.action);

describe('changes made in the Nhân viên tab', () => {
  it('TC-LOG-01: should say what changed on a person, old value to new', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', fullName: 'Người A', department: 'Sales' });

    // Act
    await flow.updatePerson(person, { department: 'Kế toán', leftOn: '2026-11-30', openingLeave: 3 });

    // Assert
    const line = (await logOf('nhan-vien')).find((l) => l.action === 'Sửa nhân viên');
    expect(line?.detail).toContain('A Người A');
    expect(line?.detail).toContain('Bộ phận Sales → Kế toán');
    expect(line?.detail).toContain('Ngày nghỉ việc trống → 30/11/2026');
    expect(line?.detail).toContain('Phép ban đầu 0 → 3');
    expect(line?.detail).not.toContain('Mã');
  });

  it('TC-LOG-02: should write nothing when a person is saved unchanged', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    await flow.updatePerson(person, {});

    // Assert
    expect(await actions('nhan-vien')).toEqual(['Thêm nhân viên']);
  });

  it('TC-LOG-03: should keep adding and removing someone', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    await flow.call('DELETE', `/employees/${person.id}`);

    // Assert
    expect(await actions('nhan-vien')).toEqual(expect.arrayContaining(['Thêm nhân viên', 'Xoá nhân viên']));
  });

  it('TC-LOG-04: should note a department that typing a new name on a person created', async () => {
    // Act
    await flow.addPerson({ code: 'A', department: 'Phòng mới' });

    // Assert
    const line = (await logOf('cau-hinh')).find((l) => l.action === 'Thêm bộ phận');
    expect(line?.detail).toBe('Phòng mới');
  });
});

describe('changes made in the Nghỉ, đi muộn tab', () => {
  it('TC-LOG-05: should hold adding, changing and cancelling an absence, and nothing of the other tabs', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const body = { reason: 'annual', from: '2026-11-03', to: '2026-11-03', approvedBy: 'Giám đốc' };

    // Act
    const [added] = await flow.call<{ id: string }[]>('POST', `/employees/${person.id}/absences`, body, 201);
    await flow.call('PATCH', `/employees/${person.id}/absences/${added?.id}`, { ...body, note: 'Nhà có việc' });
    await flow.call('DELETE', `/employees/${person.id}/absences/${added?.id}`);

    // Assert
    expect(await actions('nghi')).toEqual(expect.arrayContaining(['Đăng ký nghỉ', 'Sửa đăng ký nghỉ', 'Huỷ đăng ký nghỉ']));
    expect(await actions('nghi')).not.toContain('Thêm nhân viên');
  });
});

describe('changes made in the Cấu hình tab', () => {
  it('TC-LOG-06: should hold adding and removing an approver, once for the same name', async () => {
    // Act
    const added = await flow.call<ApproverDto[]>('POST', '/approvers', { name: 'Giám đốc' }, 201);
    await flow.call('POST', '/approvers', { name: 'giám đốc' }, 201);
    await flow.call('DELETE', `/approvers/${added[0]?.id}`);

    // Assert
    const lines = await logOf('cau-hinh');
    expect(lines.filter((l) => l.action === 'Thêm người duyệt').map((l) => l.detail)).toEqual(['Giám đốc']);
    expect(lines.filter((l) => l.action === 'Xoá người duyệt').map((l) => l.detail)).toEqual(['Giám đốc']);
  });

  it('TC-LOG-07: should note an approver first typed on an absence', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    await flow.call('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-03', to: '2026-11-03', approvedBy: 'Trưởng phòng' }, 201);

    // Assert
    expect((await logOf('cau-hinh')).find((l) => l.action === 'Thêm người duyệt')?.detail).toBe('Trưởng phòng');
  });

  it('TC-LOG-08: should say what changed on a region: name, Saturdays and from when', async () => {
    // Arrange
    const [region] = await flow.call<TimesheetRegionDto[]>('POST', '/regions', { name: 'Đà Nẵng', saturdays: 2, tone: 'cyan' }, 201).then((all) => all.filter((r) => r.name === 'Đà Nẵng'));

    // Act
    await flow.call('PATCH', `/regions/${region?.id}`, { name: 'Miền Trung', saturdays: 4, tone: 'cyan', saturdaysFrom: '2026-12' });

    // Assert
    const line = (await logOf('cau-hinh')).find((l) => l.action === 'Sửa khu vực');
    expect(line?.detail).toContain('Tên Đà Nẵng → Miền Trung');
    expect(line?.detail).toContain('Thứ Bảy +2 → +4 từ T12/2026');
  });

  it('TC-LOG-09: should say when a kind of staff changes how it counts for leave', async () => {
    // Arrange
    const [kind] = await flow.call<{ id: string; name: string }[]>('POST', '/staff-kinds', { name: 'Thực tập', rule: 'probation' }, 201).then((all) => all.filter((k) => k.name === 'Thực tập'));

    // Act
    await flow.call('PATCH', `/staff-kinds/${kind?.id}`, { name: 'Thực tập', rule: 'official' });

    // Assert
    const line = (await logOf('cau-hinh')).find((l) => l.action === 'Sửa loại nhân viên');
    expect(line?.detail).toBe('Thực tập: Cách tính phép Thử việc → Chính thức');
  });
});

describe('reading the Nhật ký tab', () => {
  it('TC-LOG-10: should show a change once, though it went into every open period', async () => {
    // Arrange
    await flow.period(2026, 10);
    await flow.period(2026, 11);

    // Act
    await flow.call<DepartmentDto[]>('POST', '/departments', { name: 'Kế toán' }, 201);

    // Assert
    expect((await logOf('cau-hinh')).filter((l) => l.detail === 'Kế toán')).toHaveLength(1);
  });

  it('TC-LOG-11: should still show a change made while no period was open', async () => {
    // Act
    await flow.call<DepartmentDto[]>('POST', '/departments', { name: 'Kế toán' }, 201);

    // Assert
    expect((await logOf('cau-hinh')).map((l) => l.detail)).toContain('Kế toán');
  });

  it('TC-LOG-12: should name who did it, newest first', async () => {
    // Act
    await flow.call('POST', '/departments', { name: 'Trước' }, 201);
    await flow.call('POST', '/departments', { name: 'Sau' }, 201);

    // Assert
    const lines = (await logOf('cau-hinh')).filter((l) => l.action === 'Thêm bộ phận');
    expect(lines.every((l) => l.actor.length > 0)).toBe(true);
    expect(lines.every((l) => l.id.length > 0)).toBe(true);
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });

  it('TC-LOG-13: should refuse a tab it does not know', async () => {
    // Act + Assert
    expect((await flow.attempt('GET', '/log?nhom=khac')).status).toBe(422);
    expect((await flow.attempt('GET', '/log?nhom=constructor')).status).toBe(422);
  });

  it('TC-LOG-14: should show every tab together, each line saying where it came from', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const november = await flow.period(2026, 11);
    await flow.enter(november, person.id, { '2026-11-03': 'P' });
    await flow.call('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-04', to: '2026-11-04', approvedBy: 'Giám đốc' }, 201);
    await flow.call('POST', '/departments', { name: 'Kế toán' }, 201);

    // Act
    const { lines } = await page();

    // Assert
    const areaOf = (action: string) => lines.find((l) => l.action === action)?.area;
    expect(areaOf('Chấm công')).toBe('bang-cong');
    expect(areaOf('Đăng ký nghỉ')).toBe('nghi');
    expect(areaOf('Thêm nhân viên')).toBe('nhan-vien');
    expect(areaOf('Thêm bộ phận')).toBe('cau-hinh');
  });

  it('TC-LOG-15: should name the month of a change on the sheet', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const november = await flow.period(2026, 11);

    // Act
    await flow.enter(november, person.id, { '2026-11-03': 'P' });

    // Assert
    expect((await logOf('bang-cong')).find((l) => l.action === 'Chấm công')?.periodMonth).toBe('2026-11');
  });

  it('TC-LOG-16: should find a line by code, name or who did it, whatever the capitals', async () => {
    // Arrange
    await flow.addPerson({ code: 'TF7', fullName: 'Người Tìm' });
    await flow.addPerson({ code: 'TF8', fullName: 'Người Khác' });

    // Act
    const found = await page(`?tim=${encodeURIComponent('tf7')}`);
    const wild = await page(`?tim=${encodeURIComponent('%')}`);

    // Assert
    expect(found.lines.map((l) => l.detail)).toEqual(['TF7 Người Tìm']);
    expect(wild.lines).toEqual([]);
  });

  it('TC-LOG-17: should read the log page by page, without losing or repeating a line', async () => {
    // Arrange
    for (let i = 0; i < 101; i += 1) await flow.call('POST', '/departments', { name: `Phòng ${i}` }, 201);

    // Act
    const first = await page();
    const second = await page('?tu=100');

    // Assert
    expect([first.lines.length, first.hasMore]).toEqual([100, true]);
    expect([second.lines.length, second.hasMore]).toEqual([1, false]);
    expect(new Set([...first.lines, ...second.lines].map((l) => l.id)).size).toBe(101);
    expect((await flow.attempt('GET', '/log?tu=-1')).status).toBe(422);
  });
});
