import type { AbsenceBatchDto, AbsenceBatchSaveDto, AbsenceRowDto, EmployeeDto, TimesheetCellDto, TimesheetLogPageDto, TimesheetTotals } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, rowOf, totalsOf, type Flow } from '../test/timesheet-flow.js';

/**
 * "Nghỉ công ty": one company day off for many people. Each case reads the sheet cells and the period totals before and
 * after, and the log. The clock stands on 25/11/2026, so every day of the November period has passed and counts.
 */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
  await flow.at('2026-11-25');
});

type Body = Record<string, unknown>;
const DAY_OFF = { name: 'Công ty nghỉ thêm', reason: 'other-paid', code: 'CL', approvedBy: 'Giám đốc', note: '' };
const peopleOf = (...people: (EmployeeDto | undefined)[]) => ({ kind: 'people', employeeIds: people.map((p) => p?.id ?? '') });
const create = (body: Body, expected = 201) => flow.call<AbsenceBatchSaveDto>('POST', '/absence-batches', { ...DAY_OFF, ...body }, expected);
const edit = (batch: AbsenceBatchDto, body: Body, expected = 200) =>
  flow.call<AbsenceBatchSaveDto>('PATCH', `/absence-batches/${batch.id}`, { ...DAY_OFF, from: batch.from, to: batch.to, audience: batch.audience, version: batch.version, ...body }, expected);
const remove = (batch: AbsenceBatchDto, expected = 200) => flow.call<{ removed: number }>('DELETE', `/absence-batches/${batch.id}`, undefined, expected);
/** The status, the error code and the message, when the refusal is the point. */
async function refusal(method: string, path: string, body?: Body) {
  const res = await flow.raw(method, path, { body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json()) as { error?: string; code?: string; employeeId?: string };
  return { status: res.status, code: json.code, error: json.error ?? '', employeeId: json.employeeId };
}
const person = (code: string, over: Body = {}) => flow.addPerson({ code, fullName: `Người ${code}`, openingLeave: 5, ...over });
const inHn = (code: string, over: Body = {}) => person(code, { regionId: flow.hn.id, ...over });

/** What a person's cells hold on some days, and the totals HR reads, in one period. */
async function sheetOf(code: string, month = 11) {
  const dto = await flow.period(2026, month);
  return { cells: rowOf(dto, code).cells, totals: totalsOf(dto, code) };
}
const codesOn = (cells: Record<string, TimesheetCellDto>, days: readonly string[]) => days.map((d) => cells[d]?.entered ?? null);
const figures = (t: TimesheetTotals) => ({ paid: t.paid, actual: t.actual, leave: t.leave, unpaidLeave: t.unpaidLeave, leaveClosing: t.leaveClosing, personalPaid: t.personalPaid, holiday: t.holiday, maternity: t.maternity });
/** The totals before, moved by what the case expects. */
const moved = (before: TimesheetTotals, change: Partial<ReturnType<typeof figures>>) => {
  const base = figures(before);
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v + (change[k as keyof typeof base] ?? 0)]));
};
const logOf = async (action: string) => (await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nghi')).lines.filter((l) => l.action === action).map((l) => l.detail);
const yearList = () => flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');
const batchesOf = () => flow.call<AbsenceBatchDto[]>('GET', '/absence-batches?year=2026');

describe('weekends', () => {
  it('TC-NCT-01: should fill Mon–Fri over a weekend, never Sunday, and Saturday only where the region works every Saturday', async () => {
    // Arrange: HCM works 2 of 4 Saturdays of the November period, HN all 4
    const [a, b] = [await person('A'), await inHn('B')];
    const before = { a: (await sheetOf('A')).totals, b: (await sheetOf('B')).totals };

    // Act: Friday 06/11 to Monday 09/11
    const batch = await create({ from: '2026-11-06', to: '2026-11-09', audience: peopleOf(a, b) });

    // Assert
    const days = ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
    const after = { a: await sheetOf('A'), b: await sheetOf('B') };
    expect(codesOn(after.a.cells, days)).toEqual(['CL', null, null, 'CL']);
    expect(codesOn(after.b.cells, days)).toEqual(['CL', 'CL', null, 'CL']);
    expect(figures(after.a.totals)).toEqual(moved(before.a, { actual: -2, personalPaid: 2 }));
    expect(figures(after.b.totals)).toEqual(moved(before.b, { actual: -2, personalPaid: 3, paid: 1 }));
    expect(batch.employeeIds).toHaveLength(2);
    expect(await logOf('Tạo đợt nghỉ công ty')).toEqual(['Công ty nghỉ thêm: Nghỉ có lương khác (CL), 06/11–09/11, 2 người, Giám đốc duyệt']);
    expect((await logOf('Thêm vào đợt nghỉ công ty')).sort()).toEqual(['Công ty nghỉ thêm: A Người A, 2 ngày', 'Công ty nghỉ thêm: B Người B, 3 ngày']);
  });

  it('TC-NCT-02: should not fill a Saturday for HN in a period with 5 Saturdays, which HN does not all work', async () => {
    // Arrange: the October period (26/09–25/10) has 5 Saturdays; HN works 4
    const b = await inHn('B');
    const before = { oct: (await sheetOf('B', 10)).totals, nov: (await sheetOf('B')).totals };

    // Act: Saturday 24/10 to Monday 26/10
    await create({ from: '2026-10-24', to: '2026-10-26', audience: peopleOf(b) });

    // Assert
    const oct = await sheetOf('B', 10);
    const nov = await sheetOf('B');
    expect(codesOn(oct.cells, ['2026-10-24', '2026-10-25'])).toEqual([null, null]);
    expect(codesOn(nov.cells, ['2026-10-26'])).toEqual(['CL']);
    expect(figures(oct.totals)).toEqual(figures(before.oct));
    expect(figures(nov.totals)).toEqual(moved(before.nov, { actual: -1, personalPaid: 1 }));
  });

  it('TC-NCT-03: should skip, and name, people with no working day in the range, saving the rest', async () => {
    // Arrange
    const [a, b] = [await person('A'), await inHn('B')];
    const before = (await sheetOf('A')).totals;

    // Act: Saturday 07/11 and Sunday 08/11 for everyone at work
    const batch = await create({ from: '2026-11-07', to: '2026-11-08', audience: { kind: 'all' } });

    // Assert: HN works that Saturday, HCM does not
    expect(batch.employeeIds).toEqual([b.id]);
    expect(batch.skipped).toEqual([{ employeeId: a.id, fullName: 'Người A' }]);
    expect(codesOn((await sheetOf('B')).cells, ['2026-11-07', '2026-11-08'])).toEqual(['CL', null]);
    expect(codesOn((await sheetOf('A')).cells, ['2026-11-07', '2026-11-08'])).toEqual([null, null]);
    expect(figures((await sheetOf('A')).totals)).toEqual(figures(before));
    expect(await logOf('Tạo đợt nghỉ công ty')).toEqual(['Công ty nghỉ thêm: Nghỉ có lương khác (CL), 07/11–08/11, 1 người, Giám đốc duyệt']);
  });

  it('TC-NCT-04: should refuse, saying why, when nobody chosen has a working day in the range', async () => {
    // Arrange
    const a = await person('A');

    // Act
    const answer = await refusal('POST', '/absence-batches', { ...DAY_OFF, from: '2026-11-07', to: '2026-11-08', audience: { kind: 'region', regionIds: [flow.hcm.id] } });

    // Assert
    expect(answer.status).toBe(422);
    expect(answer.error).toBe('Không ai trong đợt có ngày làm việc từ 07/11 đến 08/11.');
    expect(codesOn((await sheetOf('A')).cells, ['2026-11-07'])).toEqual([null]);
    expect(await batchesOf()).toEqual([]);
    expect(a.id).toBeTruthy();
  });
});

describe('holidays', () => {
  it('TC-NCT-05: should leave a public holiday inside the range as NL', async () => {
    // Arrange: Tuesday 10/11 is a holiday
    await flow.call('POST', '/holidays', { day: '2026-11-10', name: 'Lễ thử' });
    const a = await person('A');
    const before = (await sheetOf('A')).totals;

    // Act
    const batch = await create({ from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a) });

    // Assert
    const after = await sheetOf('A');
    expect(codesOn(after.cells, ['2026-11-09', '2026-11-10', '2026-11-11'])).toEqual(['CL', null, 'CL']);
    expect(figures(after.totals)).toEqual(moved(before, { actual: -2, personalPaid: 2 }));
    expect(after.totals.holiday).toBe(1);
    expect((await yearList()).find((r) => r.employeeId === a.id)?.days).toBe(2);
    expect(batch.code).toBe('CL');
  });

  it('TC-NCT-06: should leave the Monday in lieu of a Sunday holiday as NL', async () => {
    // Arrange: Sunday 08/11 is a holiday, taken on Monday 09/11
    await flow.call('POST', '/holidays', { day: '2026-11-08', name: 'Lễ thử' });
    const a = await person('A');
    const before = (await sheetOf('A')).totals;

    // Act: Friday 06/11 to Tuesday 10/11
    await create({ from: '2026-11-06', to: '2026-11-10', audience: peopleOf(a) });

    // Assert
    const after = await sheetOf('A');
    expect(codesOn(after.cells, ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'])).toEqual(['CL', null, null, null, 'CL']);
    expect(figures(after.totals)).toEqual(moved(before, { actual: -2, personalPaid: 2 }));
    expect(after.totals.holiday).toBe(1);
  });

  it('TC-NCT-07: should run maternity leave (TS) through a holiday, as single absences do', async () => {
    // Arrange
    await flow.call('POST', '/holidays', { day: '2026-11-10', name: 'Lễ thử' });
    const a = await person('A');
    const before = (await sheetOf('A')).totals;

    // Act
    await create({ name: 'Thai sản thử', reason: 'maternity', code: 'TS', from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a) });

    // Assert
    const after = await sheetOf('A');
    expect(codesOn(after.cells, ['2026-11-09', '2026-11-10', '2026-11-11'])).toEqual(['TS', 'TS', 'TS']);
    expect(figures(after.totals)).toEqual(moved(before, { actual: -2, holiday: -1, maternity: 3, paid: -3 }));
  });
});

describe('what the sheet already holds', () => {
  it('TC-NCT-08: should save nobody, naming the person and the days, when one already has leave on them', async () => {
    // Arrange: B has annual leave on 10/11
    const [a, b, c] = [await person('A'), await person('B'), await person('C')];
    await flow.call('POST', `/employees/${b.id}/absences`, { reason: 'annual', from: '2026-11-10', to: '2026-11-10', approvedBy: 'Giám đốc' }, 201);
    const before = await sheetOf('A');

    // Act
    const answer = await refusal('POST', '/absence-batches', { ...DAY_OFF, from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a, b, c) });

    // Assert
    expect(answer).toMatchObject({ status: 409, code: 'absence_overlap', employeeId: b.id });
    expect(answer.error).toBe('B Người B: Trùng với Nghỉ phép năm 10/11–10/11.');
    const after = await sheetOf('A');
    expect(codesOn(after.cells, ['2026-11-09', '2026-11-11'])).toEqual([null, null]);
    expect(figures(after.totals)).toEqual(figures(before.totals));
    expect(await batchesOf()).toEqual([]);
    expect(await logOf('Tạo đợt nghỉ công ty')).toEqual([]);
  });

  it('TC-NCT-09: should refuse a day HR typed with the same code, naming the person and the day', async () => {
    // Arrange: CL typed by hand for A on 10/11
    const [a, b] = [await person('A'), await person('B')];
    await flow.enter(await flow.period(2026, 11), a.id, { '2026-11-10': 'CL' });

    // Act
    const answer = await refusal('POST', '/absence-batches', { ...DAY_OFF, from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a, b) });

    // Assert
    expect(answer).toMatchObject({ status: 409, code: 'sheet_typed', employeeId: a.id });
    expect(answer.error).toMatch(/^A Người A: 10\/11 đã chấm CL trên bảng công/);
    expect(codesOn((await sheetOf('B')).cells, ['2026-11-09'])).toEqual([null]);
    expect(codesOn((await sheetOf('A')).cells, ['2026-11-09', '2026-11-10'])).toEqual([null, 'CL']);
  });

  it('TC-NCT-10: should fill around a day HR typed with another code and leave it HR\'s, also on delete', async () => {
    // Arrange: KL typed by hand on 10/11
    const a = await person('A');
    await flow.enter(await flow.period(2026, 11), a.id, { '2026-11-10': 'KL' });
    const before = (await sheetOf('A')).totals;

    // Act
    const batch = await create({ from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a) });
    const filled = await sheetOf('A');
    await remove(batch);

    // Assert
    const days = ['2026-11-09', '2026-11-10', '2026-11-11'];
    expect(codesOn(filled.cells, days)).toEqual(['CL', 'KL', 'CL']);
    expect(figures(filled.totals)).toEqual(moved(before, { actual: -2, personalPaid: 2 }));
    const after = await sheetOf('A');
    expect(codesOn(after.cells, days)).toEqual([null, 'KL', null]);
    expect(figures(after.totals)).toEqual(figures(before));
  });

  it('TC-NCT-11: should fill only the days someone is employed: joined after the start, left before the end', async () => {
    // Arrange
    const joiner = await person('J', { joinedOn: '2026-11-10' });
    const leaver = await person('L', { leftOn: '2026-11-10' });
    const before = { j: (await sheetOf('J')).totals, l: (await sheetOf('L')).totals };

    // Act: everyone at work on 09–11/11
    const batch = await create({ from: '2026-11-09', to: '2026-11-11', audience: { kind: 'all' } });

    // Assert
    const days = ['2026-11-09', '2026-11-10', '2026-11-11'];
    const after = { j: await sheetOf('J'), l: await sheetOf('L') };
    expect(codesOn(after.j.cells, days)).toEqual([null, 'CL', 'CL']);
    expect(codesOn(after.l.cells, days)).toEqual(['CL', 'CL', null]);
    expect(figures(after.j.totals)).toEqual(moved(before.j, { actual: -2, personalPaid: 2 }));
    expect(figures(after.l.totals)).toEqual(moved(before.l, { actual: -2, personalPaid: 2 }));
    expect([...batch.employeeIds].sort()).toEqual([joiner.id, leaver.id].sort());
  });

  it('TC-NCT-12: should take annual leave from someone on probation as the sheet does: nothing to take, so unpaid', async () => {
    // Arrange
    const p = await person('P', { employment: 'probation', openingLeave: 0 });
    const before = (await sheetOf('P')).totals;

    // Act
    await create({ name: 'Nghỉ trừ phép', reason: 'annual', code: 'P', from: '2026-11-09', to: '2026-11-10', audience: peopleOf(p) });

    // Assert
    const after = await sheetOf('P');
    expect(codesOn(after.cells, ['2026-11-09', '2026-11-10'])).toEqual(['P', 'P']);
    expect(figures(after.totals)).toEqual(moved(before, { actual: -2, leave: 2, paid: -2 }));
    expect(after.totals.leaveOverdrawn).toBe(2);
  });
});

describe('periods', () => {
  it('TC-NCT-13: should fill both periods of a range across the 25/26 boundary, with the totals and log of each', async () => {
    // Arrange: a day typed in October already, so October counts toward the balance before as after (firstMonthInUse)
    const a = await person('A');
    await flow.enter(await flow.period(2026, 10), a.id, { '2026-10-01': '1' });
    const before = { oct: (await sheetOf('A', 10)).totals, nov: (await sheetOf('A')).totals };

    // Act: Friday 23/10 to Wednesday 28/10
    await create({ from: '2026-10-23', to: '2026-10-28', audience: peopleOf(a) });

    // Assert
    const oct = await sheetOf('A', 10);
    const nov = await sheetOf('A');
    expect(codesOn(oct.cells, ['2026-10-23', '2026-10-24', '2026-10-25'])).toEqual(['CL', null, null]);
    expect(codesOn(nov.cells, ['2026-10-26', '2026-10-27', '2026-10-28'])).toEqual(['CL', 'CL', 'CL']);
    expect(figures(oct.totals)).toEqual(moved(before.oct, { actual: -1, personalPaid: 1 }));
    expect(figures(nov.totals)).toEqual(moved(before.nov, { actual: -3, personalPaid: 3 }));
    expect((await flow.log(await flow.period(2026, 10))).map((l) => l.action)).toContain('Tạo đợt nghỉ công ty');
    expect((await flow.log(await flow.period(2026, 11))).map((l) => l.action)).toContain('Tạo đợt nghỉ công ty');
  });

  it('TC-NCT-14: should refuse creating, changing or deleting anything in a closed period, naming it', async () => {
    // Arrange: a batch on 20–21/10, then October closed
    await flow.at('2026-10-26');
    const a = await person('A');
    const october = await create({ from: '2026-10-20', to: '2026-10-21', audience: peopleOf(a) });
    await flow.close(2026, 10);
    await flow.at('2026-11-25');
    const november = await create({ from: '2026-11-09', to: '2026-11-09', audience: peopleOf(a) });
    const before = { oct: await sheetOf('A', 10), nov: await sheetOf('A') };

    // Act
    const created = await refusal('POST', '/absence-batches', { ...DAY_OFF, from: '2026-10-23', to: '2026-10-27', audience: peopleOf(a) });
    const changed = await refusal('PATCH', `/absence-batches/${october.id}`, { ...DAY_OFF, from: '2026-10-20', to: '2026-10-22', audience: october.audience, version: october.version });
    const movedIn = await refusal('PATCH', `/absence-batches/${november.id}`, { ...DAY_OFF, from: '2026-10-22', to: '2026-11-09', audience: november.audience, version: november.version });
    const deleted = await refusal('DELETE', `/absence-batches/${october.id}`);

    // Assert
    for (const answer of [created, changed, movedIn, deleted]) {
      expect(answer).toMatchObject({ status: 409, code: 'period_closed', error: 'Kỳ tháng 10/2026 đã chốt. Mở lại kỳ để sửa.' });
    }
    expect((await sheetOf('A', 10)).cells).toEqual(before.oct.cells);
    expect((await sheetOf('A')).cells).toEqual(before.nov.cells);
    expect((await batchesOf()).map((b) => [b.from, b.to])).toEqual([['2026-11-09', '2026-11-09'], ['2026-10-20', '2026-10-21']]);
  });
});

describe('changing a batch', () => {
  it('TC-NCT-15: should give back the old days and fill the new ones when it shrinks, grows and moves', async () => {
    // Arrange
    const a = await person('A');
    const before = (await sheetOf('A')).totals;
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17'];
    const first = await create({ from: '2026-11-09', to: '2026-11-11', audience: peopleOf(a) });

    // Act
    const shrunk = await edit(first, { from: '2026-11-10', to: '2026-11-10' });
    const afterShrink = await sheetOf('A');
    const grown = await edit(shrunk, { from: '2026-11-09', to: '2026-11-13' });
    const afterGrow = await sheetOf('A');
    await edit(grown, { from: '2026-11-16', to: '2026-11-17' });
    const afterMove = await sheetOf('A');

    // Assert
    expect(codesOn(afterShrink.cells, days)).toEqual([null, 'CL', null, null, null, null, null]);
    expect(figures(afterShrink.totals)).toEqual(moved(before, { actual: -1, personalPaid: 1 }));
    expect(codesOn(afterGrow.cells, days)).toEqual(['CL', 'CL', 'CL', 'CL', 'CL', null, null]);
    expect(figures(afterGrow.totals)).toEqual(moved(before, { actual: -5, personalPaid: 5 }));
    expect(codesOn(afterMove.cells, days)).toEqual([null, null, null, null, null, 'CL', 'CL']);
    expect(figures(afterMove.totals)).toEqual(moved(before, { actual: -2, personalPaid: 2 }));
    expect(await logOf('Sửa đợt nghỉ công ty')).toContain('Công ty nghỉ thêm: 1 người; Ngày 09/11–13/11 → 16/11–17/11');
  });

  it('TC-NCT-16: should add and remove people, logging each one', async () => {
    // Arrange
    const [a, b, c] = [await person('A'), await person('B'), await person('C')];
    const before = (await sheetOf('A')).totals;
    const batch = await create({ from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a, b) });

    // Act
    const changed = await edit(batch, { audience: peopleOf(b, c) });

    // Assert
    const days = ['2026-11-09', '2026-11-10'];
    expect(codesOn((await sheetOf('A')).cells, days)).toEqual([null, null]);
    expect(figures((await sheetOf('A')).totals)).toEqual(figures(before));
    expect(codesOn((await sheetOf('B')).cells, days)).toEqual(['CL', 'CL']);
    expect(codesOn((await sheetOf('C')).cells, days)).toEqual(['CL', 'CL']);
    expect([...changed.employeeIds].sort()).toEqual([b.id, c.id].sort());
    expect(changed.version).toBe(batch.version + 1);
    expect(await logOf('Bỏ khỏi đợt nghỉ công ty')).toEqual(['Công ty nghỉ thêm: A Người A']);
    expect(await logOf('Thêm vào đợt nghỉ công ty')).toContain('Công ty nghỉ thêm: C Người C, 2 ngày');
    expect(await logOf('Sửa đợt nghỉ công ty')).toEqual(['Công ty nghỉ thêm: 2 người; thêm C Người C; bỏ A Người A']);
    expect((await yearList()).filter((r) => r.batch?.id === batch.id).map((r) => r.employeeCode).sort()).toEqual(['B', 'C']);
  });

  it('TC-NCT-17: should move the leave balance and unpaid days when the counting changes: CL, then P, then KL', async () => {
    // Arrange: 5 days of leave
    const a = await person('A');
    const before = (await sheetOf('A')).totals;
    const batch = await create({ from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) });

    // Act
    const annual = await edit(batch, { reason: 'annual', code: 'P' });
    const asAnnual = await sheetOf('A');
    await edit(annual, { reason: 'unpaid', code: 'KL' });
    const asUnpaid = await sheetOf('A');

    // Assert
    expect(codesOn(asAnnual.cells, ['2026-11-09', '2026-11-10'])).toEqual(['P', 'P']);
    expect(figures(asAnnual.totals)).toEqual(moved(before, { actual: -2, leave: 2, leaveClosing: -2 }));
    expect(codesOn(asUnpaid.cells, ['2026-11-09', '2026-11-10'])).toEqual(['KL', 'KL']);
    expect(figures(asUnpaid.totals)).toEqual(moved(before, { actual: -2, unpaidLeave: 2, paid: -2 }));
    expect(await logOf('Sửa đợt nghỉ công ty')).toContain('Công ty nghỉ thêm: 1 người; Lý do Nghỉ phép năm → Nghỉ không lương; Cách tính P → KL');
  });

  it('TC-NCT-18: should take the written days off when the approver is cleared, and put them back when approved again', async () => {
    // Arrange
    const a = await person('A');
    const before = (await sheetOf('A')).totals;
    const batch = await create({ from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) });

    // Act
    const waiting = await edit(batch, { approvedBy: '' });
    const whileWaiting = await sheetOf('A');
    const approved = await edit(waiting, { approvedBy: 'Anh Hùng' });

    // Assert
    expect(codesOn(whileWaiting.cells, ['2026-11-09', '2026-11-10'])).toEqual([null, null]);
    expect(figures(whileWaiting.totals)).toEqual(figures(before));
    expect(waiting.approvedBy).toBeNull();
    expect(codesOn((await sheetOf('A')).cells, ['2026-11-09', '2026-11-10'])).toEqual(['CL', 'CL']);
    expect(approved.approvedBy).toBe('Anh Hùng');
    expect(await logOf('Sửa đợt nghỉ công ty')).toContain('Công ty nghỉ thêm: 1 người; Người duyệt Giám đốc → chưa');
  });

  it('TC-NCT-19: should leave the days of a batch to the batch: a single edit or cancel of one of them is refused', async () => {
    // Arrange
    const a = await person('A');
    const batch = await create({ name: 'Tết thêm', from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) });
    const line = (await yearList()).find((r) => r.batch?.id === batch.id);

    // Act
    const changed = await refusal('PATCH', `/employees/${a.id}/absences/${line?.id}`, { reason: 'other-paid', from: '2026-11-09', to: '2026-11-09', approvedBy: 'HR' });
    const cancelled = await refusal('DELETE', `/employees/${a.id}/absences/${line?.id}`);

    // Assert
    expect(line?.batch).toEqual({ id: batch.id, name: 'Tết thêm' });
    expect(changed).toMatchObject({ status: 409, code: 'in_batch', error: 'Dòng này thuộc đợt nghỉ công ty "Tết thêm". Sửa ở tab Nghỉ công ty.' });
    expect(cancelled).toMatchObject({ status: 409, code: 'in_batch' });
    expect(codesOn((await sheetOf('A')).cells, ['2026-11-09', '2026-11-10'])).toEqual(['CL', 'CL']);
  });
});

describe('deleting a batch', () => {
  it('TC-NCT-20: should give every day back, keep HR\'s own codes and notes, restore the totals exactly, and 404 the second time', async () => {
    // Arrange: KL typed by hand on 11/11, then the batch on 09–12/11, then HR notes 10/11
    const [a, b] = [await person('A'), await inHn('B')];
    await flow.enter(await flow.period(2026, 11), a.id, { '2026-11-11': 'KL' });
    const before = { a: (await sheetOf('A')).totals, b: (await sheetOf('B')).totals };
    const batch = await create({ from: '2026-11-09', to: '2026-11-12', audience: peopleOf(a, b) });
    const dto = await flow.period(2026, 11);
    await flow.call('PATCH', `/${dto.periodId}/cells`, { cells: [{ employeeId: a.id, day: '2026-11-10', note: 'HR ghi: về quê' }] });

    // Act
    const result = await remove(batch);
    const again = await refusal('DELETE', `/absence-batches/${batch.id}`);

    // Assert
    const after = { a: await sheetOf('A'), b: await sheetOf('B') };
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
    expect(result).toEqual({ removed: 2 });
    expect(codesOn(after.a.cells, days)).toEqual([null, null, 'KL', null]);
    expect(after.a.cells['2026-11-10']?.note).toBe('HR ghi: về quê');
    expect(codesOn(after.b.cells, days)).toEqual([null, null, null, null]);
    expect(figures(after.a.totals)).toEqual(figures(before.a));
    expect(figures(after.b.totals)).toEqual(figures(before.b));
    expect(again.status).toBe(404);
    expect(await batchesOf()).toEqual([]);
    expect((await yearList()).filter((r) => r.source !== 'sheet')).toEqual([]);
    expect(await logOf('Xoá đợt nghỉ công ty')).toEqual(['Công ty nghỉ thêm: Nghỉ có lương khác (CL), 09/11–12/11, 2 người']);
    expect((await logOf('Bỏ khỏi đợt nghỉ công ty')).sort()).toEqual(['Công ty nghỉ thêm: A Người A', 'Công ty nghỉ thêm: B Người B']);
  });
});

describe('two saves at once', () => {
  it('TC-NCT-21: should apply only one of two changes made from the same version, and never fill twice', async () => {
    // Arrange
    const [a, b] = [await person('A'), await person('B')];
    const batch = await create({ from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) });
    const body = (to: string) => ({ ...DAY_OFF, from: '2026-11-09', to, audience: peopleOf(a, b), version: batch.version });

    // Act
    const answers = await Promise.all([refusal('PATCH', `/absence-batches/${batch.id}`, body('2026-11-11')), refusal('PATCH', `/absence-batches/${batch.id}`, body('2026-11-12'))]);

    // Assert
    expect(answers.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(answers.find((x) => x.status === 409)?.code).toBe('batch_changed');
    const lines = (await yearList()).filter((r) => r.batch?.id === batch.id);
    expect(lines.map((r) => r.employeeCode).sort()).toEqual(['A', 'B']);
    expect(new Set(lines.map((r) => r.to)).size).toBe(1);
    const [saved] = await batchesOf();
    expect(saved?.version).toBe(2);
  });

  it('TC-NCT-22: should create only one of two identical batches sent at once', async () => {
    // Arrange
    const a = await person('A');
    const body = { ...DAY_OFF, from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) };

    // Act
    const answers = await Promise.all([refusal('POST', '/absence-batches', body), refusal('POST', '/absence-batches', body)]);

    // Assert
    expect(answers.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await batchesOf()).toHaveLength(1);
    expect((await yearList()).filter((r) => r.source !== 'sheet')).toHaveLength(1);
  });

  it('TC-NCT-23: should refuse a change from a version already replaced, and a batch that does not exist', async () => {
    // Arrange
    const a = await person('A');
    const batch = await create({ from: '2026-11-09', to: '2026-11-10', audience: peopleOf(a) });
    await edit(batch, { note: 'Đổi lần 1' });

    // Act
    const stale = await refusal('PATCH', `/absence-batches/${batch.id}`, { ...DAY_OFF, from: '2026-11-09', to: '2026-11-10', audience: batch.audience, version: batch.version });
    const missing = await refusal('PATCH', '/absence-batches/00000000-0000-4000-8000-000000000000', { ...DAY_OFF, from: '2026-11-09', to: '2026-11-10', audience: batch.audience, version: 1 });

    // Assert
    expect(stale).toMatchObject({ status: 409, code: 'batch_changed' });
    expect(missing.status).toBe(404);
  });
});
