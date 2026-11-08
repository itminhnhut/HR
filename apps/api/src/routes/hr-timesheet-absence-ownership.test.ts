import type { AbsenceRowDto, TimesheetAbsenceDto, TimesheetLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, type Flow } from '../test/timesheet-flow.js';

/** What an absence owns on the sheet: only the days it wrote, or the typed line it was told to take over. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const register = (id: string, body: Record<string, unknown>, expected = 201) =>
  flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${id}/absences`, { approvedBy: 'Giám đốc', ...body }, expected);
const edit = (id: string, absenceId: string | undefined, body: Record<string, unknown>, expected = 200) =>
  flow.call<TimesheetAbsenceDto[]>('PATCH', `/employees/${id}/absences/${absenceId}`, { approvedBy: 'Giám đốc', ...body }, expected);
const typeOn = async (id: string, cells: Record<string, 'P' | 'KL' | 'M'>) => flow.enter(await flow.period(2026, 11), id, cells);
const cellsOf = async (code: string) => rowOf(await flow.period(2026, 11), code).cells;
const logOf = async (action: string) => (await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nghi')).lines.filter((l) => l.action === action).map((l) => l.detail);
const yearList = () => flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

describe('a day HR typed with the same code inside an absence (B2)', () => {
  it('TC-DK-60: should refuse an absence over a day HR typed with its code, leaving HR\'s day alone', async () => {
    // Arrange: P typed by hand on 4/11
    const person = await flow.addPerson({ code: 'A' });
    await typeOn(person.id, { '2026-11-04': 'P' });

    // Act: P registered over 3–5/11
    const answer = await flow.attempt('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-03', to: '2026-11-05', approvedBy: 'Giám đốc' });

    // Assert
    expect(answer).toEqual({ status: 409, code: 'sheet_typed' });
    expect((await cellsOf('A'))['2026-11-04']?.entered).toBe('P');
    expect((await yearList()).filter((r) => r.source !== 'sheet')).toEqual([]);
  });

  it('TC-DK-61: should refuse moving an absence onto a day HR typed with its code', async () => {
    // Arrange: P registered on 3/11, P typed by hand on 5/11
    const person = await flow.addPerson({ code: 'A' });
    const [absence] = await register(person.id, { reason: 'annual', from: '2026-11-03', to: '2026-11-03' });
    await typeOn(person.id, { '2026-11-05': 'P' });

    // Act
    const answer = await flow.attempt('PATCH', `/employees/${person.id}/absences/${absence?.id}`, { reason: 'annual', from: '2026-11-03', to: '2026-11-05', approvedBy: 'Giám đốc' });

    // Assert
    expect(answer).toEqual({ status: 409, code: 'sheet_typed' });
    expect((await cellsOf('A'))['2026-11-05']?.entered).toBe('P');
  });

  it('TC-DK-62: should take a day typed with its code over only through the typed line it replaces, counting it', async () => {
    // Arrange: P typed by hand on 4/11
    const person = await flow.addPerson({ code: 'A' });
    await typeOn(person.id, { '2026-11-04': 'P' });

    // Act: "Sửa" on that line, stretched to 3–5/11
    const [absence] = await register(person.id, { reason: 'annual', from: '2026-11-03', to: '2026-11-05', replacesSheet: { code: 'P', from: '2026-11-04', to: '2026-11-04' } });

    // Assert
    expect(absence?.days).toBe(3);
    const cells = await cellsOf('A');
    expect(['2026-11-03', '2026-11-04', '2026-11-05'].map((d) => cells[d]?.entered)).toEqual(['P', 'P', 'P']);
    expect((await yearList()).filter((r) => r.source === 'sheet')).toEqual([]);
  });

  it('TC-DK-63: should still list, and keep on cancel, a day HR typed with another code inside an absence', async () => {
    // Arrange: KL typed by hand on 4/11, P registered over 3–5/11 fills around it
    const person = await flow.addPerson({ code: 'A' });
    await typeOn(person.id, { '2026-11-04': 'KL' });
    const [absence] = await register(person.id, { reason: 'annual', from: '2026-11-03', to: '2026-11-05' });

    // Act
    const listed = (await yearList()).filter((r) => r.source === 'sheet').map((r) => [r.code, r.from, r.to]);
    await flow.call('DELETE', `/employees/${person.id}/absences/${absence?.id}`);

    // Assert
    expect(absence?.days).toBe(2);
    expect(listed).toEqual([['KL', '2026-11-04', '2026-11-04']]);
    expect((await cellsOf('A'))['2026-11-04']?.entered).toBe('KL');
  });
});

describe('taking over a line typed on the sheet (B1, B6, B7)', () => {
  it('TC-DK-64: should refuse to take a typed line over without an approver, leaving its days as typed', async () => {
    // Arrange: P typed on 5/11 and 6/11, already approved by HR
    const person = await flow.addPerson({ code: 'A' });
    await typeOn(person.id, { '2026-11-05': 'P', '2026-11-06': 'P' });

    // Act: "Sửa" with the approver cleared
    const answer = await flow.attempt('POST', `/employees/${person.id}/absences`, { reason: 'wedding', from: '2026-11-05', to: '2026-11-06', approvedBy: '', replacesSheet: { code: 'P', from: '2026-11-05', to: '2026-11-06' } });

    // Assert
    expect(answer.status).toBe(422);
    const cells = await cellsOf('A');
    expect([cells['2026-11-05']?.entered, cells['2026-11-06']?.entered]).toEqual(['P', 'P']);
    expect((await yearList()).filter((r) => r.source !== 'sheet')).toEqual([]);
  });

  it('TC-DK-65: should log the typed days a takeover removes outside the new dates', async () => {
    // Arrange: P typed on 5/11, 6/11 and 9/11
    const person = await flow.addPerson({ code: 'A', fullName: 'Người A' });
    await typeOn(person.id, { '2026-11-05': 'P', '2026-11-06': 'P', '2026-11-09': 'P' });

    // Act: registered as a wedding on 5–6/11 only
    await register(person.id, { reason: 'wedding', from: '2026-11-05', to: '2026-11-06', replacesSheet: { code: 'P', from: '2026-11-05', to: '2026-11-09' } });

    // Assert
    expect((await cellsOf('A'))['2026-11-09']).toBeUndefined();
    expect(await logOf('Xoá nghỉ gõ trên bảng công')).toEqual([expect.stringMatching(/^A Người A: .*09\/11.*1 ô/)]);
  });

  it('TC-DK-66: should refuse a takeover whose dates are not a line typed on the sheet, deleting nothing', async () => {
    // Arrange: two separate P lines, 5/11 and 20/11
    const person = await flow.addPerson({ code: 'A' });
    await typeOn(person.id, { '2026-11-05': 'P', '2026-11-20': 'P' });

    // Act: a takeover claiming the whole month
    const answer = await flow.attempt('POST', `/employees/${person.id}/absences`, { reason: 'annual', from: '2026-11-05', to: '2026-11-05', approvedBy: 'Giám đốc', replacesSheet: { code: 'P', from: '2026-11-01', to: '2026-11-30' } });

    // Assert
    expect(answer).toEqual({ status: 409, code: 'sheet_changed' });
    expect((await cellsOf('A'))['2026-11-20']?.entered).toBe('P');
  });
});

describe('the log of an absence (B4, B5, B9)', () => {
  it('TC-DK-67: should log a change of counting, of half a day and of the number of days', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    const [unpaid] = await register(person.id, { reason: 'wedding', code: 'KL', from: '2026-11-03', to: '2026-11-03' });
    const [leave] = (await register(person.id, { reason: 'annual', from: '2026-11-10', to: '2026-11-10' })).filter((a) => a.from === '2026-11-10');

    // Act
    await edit(person.id, unpaid?.id, { reason: 'wedding', code: 'CL', from: '2026-11-03', to: '2026-11-03' });
    await edit(person.id, leave?.id, { reason: 'annual', from: '2026-11-10', to: '2026-11-10', isHalf: true });

    // Assert
    const lines = await logOf('Sửa đăng ký nghỉ');
    expect(lines).toContainEqual(expect.stringContaining('Cách tính KL → CL'));
    expect(lines).toContainEqual(expect.stringMatching(/Cách tính P → P\/2.*Số ngày 1 → 0,5/));
  });

  it('TC-DK-68: should name the person when an absence is cancelled', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', fullName: 'Người A' });
    const [absence] = await register(person.id, { reason: 'sick', from: '2026-11-03', to: '2026-11-03' });

    // Act
    await flow.call('DELETE', `/employees/${person.id}/absences/${absence?.id}`);

    // Assert
    expect(await logOf('Huỷ đăng ký nghỉ')).toEqual([expect.stringMatching(/^A Người A: /)]);
  });

  it('TC-DK-69: should keep no approver for being late, even when one is sent, and log it as recorded', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const [late] = await register(person.id, { reason: 'late', from: '2026-11-03', to: '2026-11-03', approvedBy: 'HR' });

    // Assert
    expect(late?.approvedBy).toBeNull();
    expect(await logOf('Đăng ký nghỉ')).toEqual([expect.stringMatching(/đã ghi$/)]);
  });
});
