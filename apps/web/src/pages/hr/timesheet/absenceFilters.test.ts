import type { AbsenceRowDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { filterAbsences, NO_FILTERS } from './absenceFilters';

/** The leave list's filters (TC-NG-10..15). */
const line = (id: string, over: Partial<AbsenceRowDto>): AbsenceRowDto => ({
  id, source: 'absence', reason: 'annual', code: 'P', from: '2026-11-10', to: '2026-11-10', days: 1, note: '', label: 'Nghỉ phép năm',
  approvedBy: 'HR', handover: '', createdBy: 'Lan', files: [], needsPaper: false, employeeId: 'e1', employeeCode: 'A', fullName: 'Người A', ...over,
});
const rows = [
  line('a', {}),
  line('b', { employeeId: 'e2', fullName: 'Người B', code: 'KL/2', label: 'Nghỉ không lương 0,5 ngày', from: '2026-10-20', to: '2026-10-20' }),
  line('c', { employeeId: 'e2', fullName: 'Người B', code: 'M', label: 'Đi muộn', approvedBy: null, from: '2026-10-27', to: '2026-10-27' }),
  line('d', { code: 'P', approvedBy: null, from: '2026-11-24', to: '2026-11-27' }),
  line('e', { source: 'sheet', code: 'OM', label: 'Ốm', from: '2026-12-01', to: '2026-12-01' }),
];
const ids = (filters: Partial<typeof NO_FILTERS>) => filterAbsences(rows, 2026, { ...NO_FILTERS, ...filters }).map((r) => r.id);

describe('filtering the leave list', () => {
  it('TC-NG-10: should keep every line with no filter', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('TC-NG-11: should keep the lines of a period, 26th to 25th, including one running into it', () => {
    // T11 is 26/10–25/11; d runs 24/11–27/11
    expect(ids({ period: 11 })).toEqual(['a', 'c', 'd']);
  });

  it('TC-NG-12: should keep who is away on a day, a line over several days included', () => {
    expect(ids({ day: '2026-11-26' })).toEqual(['d']);
  });

  it('TC-NG-13: should keep the lines of one person', () => {
    expect(ids({ employeeId: 'e2' })).toEqual(['b', 'c']);
  });

  it('TC-NG-14: should keep a kind of leave, its half day included', () => {
    expect(ids({ kind: 'KL' })).toEqual(['b']);
    expect(ids({ kind: 'P' })).toEqual(['a', 'd']);
  });

  it('TC-NG-15: should keep what waits for approval, or what is approved; lateness and the sheet need none', () => {
    expect(ids({ approval: 'waiting' })).toEqual(['d']);
    expect(ids({ approval: 'approved' })).toEqual(['a', 'b', 'c', 'e']);
  });

  it('TC-NG-16: should combine filters with the text search', () => {
    expect(ids({ period: 11, employeeId: 'e1', query: 'phép' })).toEqual(['a', 'd']);
  });
});
