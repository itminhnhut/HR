import type { AbsenceKindDto, AbsenceRowDto, ApproverDto, TimesheetAbsenceDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, totalsOf, type Flow } from '../test/timesheet-flow.js';

/** Registering an absence on a person: it fills the days, across periods. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const register = (id: string, body: Record<string, unknown>, expected = 201) =>
  flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${id}/absences`, { approvedBy: 'Giám đốc', ...body }, expected);

describe('registering an absence', () => {
  it('TC-DK-01: should fill the weekdays across periods, leaving Saturdays and Sundays, for maternity leave', async () => {
    // Arrange: 19/10/2026 to 30/10/2026 crosses from October into November
    const person = await flow.addPerson({ code: 'A' });

    // Act
    await register(person.id, { reason: 'maternity', from: '2026-10-19', to: '2026-10-30' });
    await flow.at('2026-11-26');
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);

    // Assert
    const cellsA = rowOf(october, 'A').cells;
    expect(cellsA['2026-10-19']?.entered).toBe('TS');
    expect(cellsA['2026-10-19']?.note).toBe('Thai sản');
    expect(cellsA['2026-10-24']).toBeUndefined();
    expect(rowOf(november, 'A').cells['2026-10-30']?.entered).toBe('TS');
    expect(totalsOf(october, 'A').insured).toBe(5);
  });

  it('TC-DK-02: should list what was registered, with how many days the law gives', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const list = await register(person.id, { reason: 'wedding', from: '2026-11-02', to: '2026-11-04', note: 'Cưới' });

    // Assert
    expect(list).toEqual([expect.objectContaining({ reason: 'wedding', code: 'CL', from: '2026-11-02', to: '2026-11-04', days: 3, note: 'Cưới' })]);
  });

  it('TC-DK-03: should refuse days in a closed period, which only a reopening may change', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act
    const answer = await flow.attempt('POST', `/employees/${person.id}/absences`, { reason: 'sick', from: '2026-10-20', to: '2026-10-27' });

    // Assert
    expect(answer).toEqual({ status: 409, code: 'period_closed' });
  });

  it('TC-DK-04: should take the days back when removed, returning them to the automatic 1', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [absence] = await register(person.id, { reason: 'sick', from: '2026-11-02', to: '2026-11-03' });

    // Act
    const left = await flow.call<TimesheetAbsenceDto[]>('DELETE', `/employees/${person.id}/absences/${absence?.id}`);
    await flow.at('2026-11-26');

    // Assert
    expect(left).toEqual([]);
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-02']).toBeUndefined();
  });

  it('TC-DK-05: should keep what HR changed by hand on a day when the absence is removed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [absence] = await register(person.id, { reason: 'sick', from: '2026-11-02', to: '2026-11-03' });
    await flow.at('2026-11-26');
    await flow.enter(await flow.period(2026, 11), person.id, { '2026-11-03': 'M' });

    // Act
    await flow.call('DELETE', `/employees/${person.id}/absences/${absence?.id}`);

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03']?.entered).toBe('M');
  });

  it('TC-DK-06: should refuse a reason it does not know, or days the wrong way round', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act + Assert
    await register(person.id, { reason: 'khong-co', from: '2026-11-02', to: '2026-11-03' }, 422);
    await register(person.id, { reason: 'sick', from: '2026-11-05', to: '2026-11-03' }, 422);
  });

  it('TC-DK-07: should write it into the log of each period it touches', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const october = await flow.period(2026, 10);
    const november = await flow.period(2026, 11);

    // Act
    await register(person.id, { reason: 'maternity', from: '2026-10-19', to: '2026-10-30' });

    // Assert
    expect((await flow.log(october)).map((l) => l.action)).toContain('Đăng ký nghỉ');
    expect((await flow.log(november)).map((l) => l.action)).toContain('Đăng ký nghỉ');
  });
});

describe('the list of absences and the kinds HR adds', () => {
  it('TC-DK-08: should list everyone\'s absences of a year, naming the person and how it counts', async () => {
    // Arrange
    const a = await flow.addPerson({ code: 'A', fullName: 'Người A' });
    const b = await flow.addPerson({ code: 'B', fullName: 'Người B' });
    await register(a.id, { reason: 'wedding', from: '2026-11-02', to: '2026-11-04' });
    await register(b.id, { reason: 'sick', from: '2026-03-02', to: '2026-03-03' });
    await register(b.id, { reason: 'sick', from: '2027-03-01', to: '2027-03-02' });

    // Act
    const list = await flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

    // Assert
    expect(list.map((r) => [r.fullName, r.label, r.code, r.days])).toEqual([
      ['Người A', 'Bản thân kết hôn', 'CL', 3],
      ['Người B', 'Ốm có giấy BHXH', 'OM', 2],
    ]);
  });

  it('TC-DK-09: should refuse days that overlap what this person already registered, and say which', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await register(person.id, { reason: 'wedding', from: '2026-11-02', to: '2026-11-04' });

    // Act
    const answer = await flow.attempt('POST', `/employees/${person.id}/absences`, { reason: 'sick', from: '2026-11-04', to: '2026-11-05' });

    // Assert
    expect(answer).toEqual({ status: 409, code: 'absence_overlap' });
  });

  it('TC-DK-10: should take a kind HR named, counted the way HR chose: paid, not from the balance', async () => {
    // Arrange: "Nam, 3–5, nghỉ nhà có phép, tính lương bình thường"
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });
    const kinds = await flow.call<AbsenceKindDto[]>('POST', '/absence-kinds', { name: 'Việc nhà có phép', code: 'CL', days: null }, 201);
    const kind = kinds.find((k) => k.name === 'Việc nhà có phép');

    // Act
    const list = await register(person.id, { reason: kind?.key, from: '2026-11-03', to: '2026-11-05' });
    await flow.at('2026-11-26');
    const sheet = await flow.period(2026, 11);

    // Assert
    expect(list[0]).toMatchObject({ code: 'CL', days: 3, label: 'Việc nhà có phép' });
    expect(rowOf(sheet, 'A').cells['2026-11-04']?.note).toBe('Việc nhà có phép');
    expect(totalsOf(sheet, 'A')).toMatchObject({ personalPaid: 3, leave: 0 });
    expect(rowOf(sheet, 'A').cells['2026-11-04']?.entered).toBe('CL');
  });

  it('TC-DK-11: should list the kinds in the law first and HR\'s own after, and let HR remove only their own', async () => {
    // Arrange
    const added = await flow.call<AbsenceKindDto[]>('POST', '/absence-kinds', { name: 'Đám hỏi', code: 'KL', days: 1 }, 201);
    const own = added.find((k) => k.name === 'Đám hỏi');

    // Act
    const left = await flow.call<AbsenceKindDto[]>('DELETE', `/absence-kinds/${own?.key}`);

    // Assert
    expect(added.at(0)?.isOwn).toBe(false);
    expect(own?.isOwn).toBe(true);
    expect(left.some((k) => k.name === 'Đám hỏi')).toBe(false);
    await flow.call('DELETE', '/absence-kinds/wedding', undefined, 404);
  });

  it('TC-DK-12: should keep the absences already registered when a kind is removed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const kinds = await flow.call<AbsenceKindDto[]>('POST', '/absence-kinds', { name: 'Đám hỏi', code: 'KL', days: 1 }, 201);
    const key = kinds.find((k) => k.name === 'Đám hỏi')?.key;
    await register(person.id, { reason: key, from: '2026-11-03', to: '2026-11-03' });

    // Act
    await flow.call('DELETE', `/absence-kinds/${key}`);
    const list = await flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

    // Assert
    expect(list[0]).toMatchObject({ label: 'Đám hỏi', code: 'KL' });
  });

  it('TC-DK-13: should refuse two kinds with one name, or a way of counting it does not know', async () => {
    // Arrange
    await flow.call('POST', '/absence-kinds', { name: 'Đám hỏi', code: 'KL', days: 1 }, 201);

    // Act + Assert
    await flow.call('POST', '/absence-kinds', { name: 'Đám hỏi', code: 'CL', days: 1 }, 422);
    await flow.call('POST', '/absence-kinds', { name: 'Khác', code: 'NL', days: 1 }, 422);
  });

  it('TC-DK-14: should take half a day of leave, on one day only', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });

    // Act
    const list = await register(person.id, { reason: 'annual', from: '2026-11-03', to: '2026-11-03', isHalf: true });

    // Assert
    expect(list[0]).toMatchObject({ code: 'P/2', days: 0.5 });
    await register(person.id, { reason: 'annual', from: '2026-11-05', to: '2026-11-06', isHalf: true }, 422);
    await register(person.id, { reason: 'wedding', from: '2026-11-09', to: '2026-11-09', isHalf: true }, 422);
  });
});

describe('approving and changing an absence', () => {
  const pending = async (id: string) =>
    flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${id}/absences`, { reason: 'sick', from: '2026-11-03', to: '2026-11-04', note: 'Xin nghỉ', handover: 'Bình nhận việc' }, 201);
  const edit = (id: string, absenceId: string | undefined, body: Record<string, unknown>, expected = 200) =>
    flow.call<TimesheetAbsenceDto[]>('PATCH', `/employees/${id}/absences/${absenceId}`, body, expected);
  const fields = { reason: 'sick', from: '2026-11-03', to: '2026-11-04', note: 'Xin nghỉ', handover: 'Bình nhận việc' };

  it('TC-DK-15: should wait without touching the sheet until someone has approved, then fill it', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [absence] = await pending(person.id);
    await flow.at('2026-11-26');
    const before = rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03'];

    // Act
    const [approved] = await edit(person.id, absence?.id, { ...fields, approvedBy: 'Anh Hùng' });

    // Assert
    expect(absence).toMatchObject({ approvedBy: null, handover: 'Bình nhận việc', note: 'Xin nghỉ' });
    expect(before).toBeUndefined();
    expect(approved?.approvedBy).toBe('Anh Hùng');
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03']).toMatchObject({ entered: 'OM', note: 'Xin nghỉ' });
  });

  it('TC-DK-16: should move the days on the sheet when the dates change, and log before and after', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', fullName: 'Người A' });
    const [absence] = await register(person.id, fields);
    const november = await flow.period(2026, 11);

    // Act
    await edit(person.id, absence?.id, { ...fields, approvedBy: 'Giám đốc', from: '2026-11-04', to: '2026-11-05' });
    await flow.at('2026-11-26');
    const sheet = await flow.period(2026, 11);

    // Assert
    expect(rowOf(sheet, 'A').cells['2026-11-03']).toBeUndefined();
    expect(rowOf(sheet, 'A').cells['2026-11-05']?.entered).toBe('OM');
    const line = (await flow.log(november)).find((l) => l.action === 'Sửa đăng ký nghỉ');
    expect(line?.detail).toContain('03/11–04/11 → 04/11–05/11');
  });

  it('TC-DK-17: should take the days off the sheet when the approval is withdrawn', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [absence] = await register(person.id, fields);

    // Act
    await edit(person.id, absence?.id, { ...fields, approvedBy: '' });
    await flow.at('2026-11-26');

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03']).toBeUndefined();
  });

  it('TC-DK-18: should refuse moving onto another absence or into a closed period, but not overlap itself', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await register(person.id, { reason: 'wedding', from: '2026-11-09', to: '2026-11-10' });
    const list = await register(person.id, fields);
    const id = list.find((a) => a.from === '2026-11-03')?.id;
    await flow.at('2026-10-26');
    await flow.close(2026, 10);

    // Act + Assert
    await edit(person.id, id, { ...fields, to: '2026-11-05' });
    await edit(person.id, id, { ...fields, to: '2026-11-09' }, 409);
    await edit(person.id, id, { ...fields, from: '2026-10-20' }, 409);
  });

  it('TC-DK-19: should show who approved and who took over the work in the list', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    await register(person.id, { ...fields, approvedBy: 'Anh Hùng' });

    // Act
    const [row] = await flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

    // Assert
    expect(row).toMatchObject({ approvedBy: 'Anh Hùng', handover: 'Bình nhận việc', note: 'Xin nghỉ', createdBy: 'Lan' });
  });
});

describe('being late', () => {
  it('TC-DK-20: should mark M at once with the note, needing no approval, still one day worked', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const [row] = await flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${person.id}/absences`, { reason: 'late', from: '2026-11-03', to: '2026-11-03', note: 'Muộn 1 tiếng' }, 201);
    await flow.at('2026-11-26');
    const sheet = await flow.period(2026, 11);

    // Assert
    expect(row).toMatchObject({ code: 'M', approvedBy: null, days: 1 });
    expect(rowOf(sheet, 'A').cells['2026-11-03']).toMatchObject({ entered: 'M', note: 'Muộn 1 tiếng' });
    expect(totalsOf(sheet, 'A')).toMatchObject({ lateCount: 1 });
  });

  it('TC-DK-21: should go back to the automatic 1 when removed', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [row] = await flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${person.id}/absences`, { reason: 'late', from: '2026-11-03', to: '2026-11-03' }, 201);

    // Act
    await flow.call('DELETE', `/employees/${person.id}/absences/${row?.id}`);
    await flow.at('2026-11-26');

    // Assert
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03']).toBeUndefined();
  });
});

describe('what HR can change on a line', () => {
  it('TC-DK-22: should count it the way HR chose for this one, over the default of the reason', async () => {
    // Arrange: a wedding is paid by default; here HR makes the extra day unpaid
    const person = await flow.addPerson({ code: 'A' });

    // Act
    const [row] = await register(person.id, { reason: 'wedding', code: 'KL', from: '2026-11-03', to: '2026-11-03' });
    await flow.at('2026-11-26');

    // Assert
    expect(row).toMatchObject({ code: 'KL', label: 'Bản thân kết hôn' });
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-03']?.entered).toBe('KL');
  });

  it('TC-DK-23: should refuse a way of counting that is not on offer', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act + Assert
    await register(person.id, { reason: 'wedding', code: 'NL', from: '2026-11-03', to: '2026-11-03' }, 422);
  });

  it('TC-DK-24: should take half a day when HR changed the counting to leave', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A', openingLeave: 2 });

    // Act
    const [row] = await register(person.id, { reason: 'other-paid', code: 'P', isHalf: true, from: '2026-11-03', to: '2026-11-03' });

    // Assert
    expect(row).toMatchObject({ code: 'P/2', days: 0.5 });
  });

  it('TC-DK-25: should keep the counting HR chose when the line is edited later', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const [row] = await register(person.id, { reason: 'wedding', code: 'KL', from: '2026-11-03', to: '2026-11-03' });

    // Act
    const [edited] = await flow.call<TimesheetAbsenceDto[]>('PATCH', `/employees/${person.id}/absences/${row?.id}`, { reason: 'wedding', code: 'CL', approvedBy: 'Giám đốc', from: '2026-11-03', to: '2026-11-04' });
    await flow.at('2026-11-26');

    // Assert
    expect(edited).toMatchObject({ code: 'CL', days: 2 });
    expect(rowOf(await flow.period(2026, 11), 'A').cells['2026-11-04']?.entered).toBe('CL');
  });
});

describe('the list of approvers', () => {
  it('TC-DK-26: should let HR add a person, once, and remove them', async () => {
    // Act
    const added = await flow.call<ApproverDto[]>('POST', '/approvers', { name: 'Anh Hùng' }, 201);
    const again = await flow.call<ApproverDto[]>('POST', '/approvers', { name: ' anh hùng ' }, 201);
    const left = await flow.call<ApproverDto[]>('DELETE', `/approvers/${added[0]?.id}`);

    // Assert
    expect(added.map((a) => a.name)).toEqual(['Anh Hùng']);
    expect(again).toHaveLength(1);
    expect(left).toEqual([]);
  });

  it('TC-DK-27: should remember a name typed on a line for next time', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });

    // Act
    await register(person.id, { reason: 'sick', from: '2026-11-03', to: '2026-11-03', approvedBy: 'Chị Lan' });

    // Assert
    const list = await flow.call<ApproverDto[]>('GET', '/approvers');
    expect(list.map((a) => a.name)).toEqual(['Chị Lan']);
  });

  it('TC-DK-28: should refuse an empty name', async () => {
    // Act + Assert
    await flow.call('POST', '/approvers', { name: ' ' }, 422);
  });
});

describe('changing a kind HR added', () => {
  const add = async (name: string) => (await flow.call<AbsenceKindDto[]>('POST', '/absence-kinds', { name, code: 'CL', days: null }, 201)).find((k) => k.name === name);

  it('TC-DK-29: should change its name, counting and days, leaving what was already written', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'A' });
    const kind = await add('Đám hỏi');
    await register(person.id, { reason: kind?.key, from: '2026-11-03', to: '2026-11-03' });

    // Act
    const kinds = await flow.call<AbsenceKindDto[]>('PATCH', `/absence-kinds/${kind?.key}`, { name: 'Đám hỏi con', code: 'KL', days: 2 });
    const [row] = await flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

    // Assert
    expect(kinds.find((k) => k.key === kind?.key)).toMatchObject({ name: 'Đám hỏi con', code: 'KL', days: 2 });
    expect(row).toMatchObject({ label: 'Đám hỏi', code: 'CL' });
  });

  it('TC-DK-30: should refuse a kind in the law, or a name already taken', async () => {
    // Arrange
    await add('Đám hỏi');
    const other = await add('Khác');

    // Act + Assert
    await flow.call('PATCH', '/absence-kinds/wedding', { name: 'Cưới', code: 'CL', days: 5 }, 404);
    await flow.call('PATCH', `/absence-kinds/${other?.key}`, { name: 'đám hỏi', code: 'CL', days: null }, 422);
    await flow.call('PATCH', `/absence-kinds/${other?.key}`, { name: 'Khác', code: 'KL', days: null });
  });
});
