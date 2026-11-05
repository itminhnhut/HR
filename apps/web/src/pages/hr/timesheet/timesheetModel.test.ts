import { standardPeriod, type TimesheetDto, type TimesheetRowDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { changedCells, dayColumns, findProblems, gridRows, notesOf, withCells } from './timesheetModel';

const REGION = '00000000-0000-4000-8000-000000000001';
const person = (over: Partial<TimesheetRowDto> = {}): TimesheetRowDto => ({
  employeeId: '00000000-0000-4000-8000-000000000011', code: 'NV01', fullName: 'Người A', department: 'HR', title: '', regionId: REGION,
  employment: 'official', joinedOn: null, leftOn: null, leaveOpening: 2, norm: 25, cells: {}, adjustments: [], ...over,
});
const sheet = (rows: TimesheetRowDto[], over: Partial<TimesheetDto> = {}): TimesheetDto => ({
  periodId: 'p', year: 2026, month: 11, ...standardPeriod(2026, 11), status: 'open', closedAt: null, closedBy: null, canReopen: false,
  norms: { [REGION]: 25 }, rule: { threshold: 14, perPeriod: 1 }, today: '2026-11-05',
  regions: [{ id: REGION, name: 'HCM', saturdays: 2, tone: 'blue', hidden: false, employees: 1 }], holidays: [], rows, ...over,
});
const column = (dto: TimesheetDto, iso: string) => dayColumns(dto).find((d) => d.iso === iso)?.key ?? '';

describe('the grid rows', () => {
  it('should show Mon–Fri as 1 up to today, and leave Saturdays and later days empty', () => {
    // Arrange
    const dto = sheet([person()]);

    // Act
    const [row] = gridRows(dto, dayColumns(dto));

    // Assert
    expect(row?.[column(dto, '2026-11-05')]).toBe('1');
    expect(row?.[column(dto, '2026-11-06')]).toBe('');
    expect(row?.[column(dto, '2026-10-31')]).toBe('');
    expect(row).toMatchObject({ thucTe: 9, huong: 9, chuan: 25 });
  });

  it('should number people and take an adjustment off the pay', () => {
    // Arrange
    const dto = sheet([person({ adjustments: [{ id: 'a', amount: -0.5, reason: 'x', isRecurring: true, createdBy: 'Lan' }] })]);

    // Act
    const [row] = gridRows(dto, dayColumns(dto));

    // Assert
    expect(row).toMatchObject({ stt: 1, huong: 8.5, huongTinhRa: 9, adjust: -0.5 });
  });

  it('should key notes by person and column', () => {
    // Arrange
    const dto = sheet([person({ cells: { '2026-11-03': { entered: 'M', note: 'Kẹt xe' } } })]);
    const days = dayColumns(dto);

    // Act + Assert
    expect(notesOf(dto, days)).toEqual({ [`${dto.rows[0]?.employeeId}:${column(dto, '2026-11-03')}`]: 'Kẹt xe' });
  });
});

describe('what an edit saves', () => {
  const dto = sheet([person()]);
  const days = dayColumns(dto);
  const [before] = gridRows(dto, days);
  const id = dto.rows[0]?.employeeId ?? '';
  const edit = (iso: string, value: string) => changedCells(dto, days, [before!], [{ ...before!, [column(dto, iso)]: value }]);

  it('should save an exception', () => {
    expect(edit('2026-11-04', 'P')).toEqual([{ employeeId: id, day: '2026-11-04', code: 'P' }]);
  });

  it('should save a Saturday as an entry, because nothing fills it by itself', () => {
    expect(edit('2026-10-31', '1')).toEqual([{ employeeId: id, day: '2026-10-31', code: '1' }]);
  });

  it('should save a future 1 as an entry, and leave the rest of the row out', () => {
    expect(edit('2026-11-06', '1')).toEqual([{ employeeId: id, day: '2026-11-06', code: '1' }]);
  });

  it('should go back to automatic when the cell is cleared', () => {
    // Arrange
    const withLeave = withCells(dto, [{ employeeId: id, day: '2026-11-04', code: 'P' }]);
    const [row] = gridRows(withLeave, days);

    // Act
    const saved = changedCells(withLeave, days, [row!], [{ ...row!, [column(dto, '2026-11-04')]: '' }]);

    // Assert
    expect(saved).toEqual([{ employeeId: id, day: '2026-11-04', code: null }]);
  });

  it('should treat pressing 1 on a passed Monday as automatic', () => {
    // Arrange
    const withLeave = withCells(dto, [{ employeeId: id, day: '2026-11-04', code: 'P' }]);
    const [row] = gridRows(withLeave, days);

    // Act
    const saved = changedCells(withLeave, days, [row!], [{ ...row!, [column(dto, '2026-11-04')]: '1' }]);

    // Assert
    expect(saved[0]?.code).toBeNull();
  });

  it('should keep a holiday automatic, also in the future', () => {
    // Arrange
    const withHoliday = sheet([person()], { holidays: [{ day: '2026-11-24', name: 'Lễ' }] });
    const holidayDays = dayColumns(withHoliday);
    const [row] = gridRows(withHoliday, holidayDays);

    // Assert
    expect(row?.[column(withHoliday, '2026-11-24')]).toBe('NL');
  });
});

describe('applying an edit ahead of the server', () => {
  it('should keep a note when only the code changes and drop an empty cell', () => {
    // Arrange
    const dto = sheet([person({ cells: { '2026-11-04': { entered: 'P', note: 'Việc nhà' } } })]);
    const id = dto.rows[0]?.employeeId ?? '';

    // Act
    const coded = withCells(dto, [{ employeeId: id, day: '2026-11-04', code: 'KL' }]);
    const cleared = withCells(coded, [{ employeeId: id, day: '2026-11-04', code: null, note: null }]);

    // Assert
    expect(coded.rows[0]?.cells['2026-11-04']).toEqual({ entered: 'KL', note: 'Việc nhà' });
    expect(cleared.rows[0]?.cells['2026-11-04']).toBeUndefined();
  });
});

describe('what to look at before closing', () => {
  const problems = (dto: TimesheetDto) => {
    const days = dayColumns(dto);
    return findProblems(dto, days, gridRows(dto, days));
  };

  it('should not nag about Saturdays while enough are left', () => {
    expect(problems(sheet([person()])).filter((p) => p.kind === 'saturday')).toEqual([]);
  });

  it('should warn once the remaining Saturdays cannot make the norm', () => {
    expect(problems(sheet([person()], { today: '2026-11-22' })).map((p) => p.kind)).toContain('saturday');
  });

  it('should warn about leave beyond the balance', () => {
    // Arrange
    const dto = sheet([person({ leaveOpening: 0, employment: 'probation', cells: { '2026-11-04': { entered: 'P/2', note: null } } })]);

    // Assert
    expect(problems(dto)[0]?.text).toContain('vượt 0,5 ngày');
  });

  it('should ask to pay out the leave of someone who left', () => {
    // Arrange
    const dto = sheet([person({ leftOn: '2026-11-03', leaveOpening: 2 })]);

    // Assert
    expect(problems(dto).find((p) => p.kind === 'left')?.text).toContain('còn 2 ngày phép');
  });

  it('should list adjustments to look at, apart from what must be fixed', () => {
    // Arrange
    const dto = sheet([person({ adjustments: [{ id: 'a', amount: -0.5, reason: 'Sáng thứ 6', isRecurring: true, createdBy: 'Lan' }] })]);

    // Assert
    expect(problems(dto)).toEqual([expect.objectContaining({ group: 'Cần xem', text: 'Người A: điều chỉnh -0,5 công (Sáng thứ 6)' })]);
  });
});
