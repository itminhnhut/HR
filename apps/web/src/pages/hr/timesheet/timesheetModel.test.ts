import { standardPeriod, type AttendanceCode, type TimesheetDto, type TimesheetRowDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { changedCells, dayColumns, findProblems, gridRows, notesOf, rowTotals, withCells } from './timesheetModel';

const REGION = '00000000-0000-4000-8000-000000000001';
const person = (over: Partial<TimesheetRowDto> = {}): TimesheetRowDto => ({
  employeeId: '00000000-0000-4000-8000-000000000011', code: 'NV01', fullName: 'Người A', department: 'HR', title: '', regionId: REGION,
  employment: 'official', joinedOn: null, leftOn: null, leaveChanges: [], frozenTotals: null, leaveOpening: 2, norm: 25, cells: {}, adjustments: [], ...over,
});
const sheet = (rows: TimesheetRowDto[], over: Partial<TimesheetDto> = {}): TimesheetDto => ({
  periodId: 'p', year: 2026, month: 11, ...standardPeriod(2026, 11), status: 'open', closedAt: null, closedBy: null, canReopen: false,
  norms: { [REGION]: 25 }, rule: { threshold: 14, perPeriod: 1 }, today: '2026-11-05',
  regions: [{ id: REGION, name: 'HCM', saturdays: 2, saturdayChanges: [], tone: 'blue', hidden: false, employees: 1 }], holidays: [], rows, ...over,
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
  // Those tests look at people, so the holiday list stands complete.
  const problemsOnly: typeof findProblems = (...args) => findProblems(...args).filter((p) => p.kind !== 'missingHoliday');

  const problems = (dto: TimesheetDto) => {
    const days = dayColumns(dto);
    return problemsOnly(dto, days, gridRows(dto, days));
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

describe('working on a day of rest', () => {
  const holidaySheet = (cells: Record<string, { entered: AttendanceCode; note: null }>) => {
    const base = sheet([person({ cells })]);
    return { ...base, holidays: [{ day: '2026-11-24', name: 'Lễ' }] };
  };

  it('should count a holiday worked and a Sunday worked apart, and say so in the review', () => {
    // Arrange: 24/11 is the holiday, 08/11 a Sunday
    const dto = holidaySheet({ '2026-11-24': { entered: '1', note: null }, '2026-11-08': { entered: '1', note: null } });
    const days = dayColumns(dto);

    // Act
    const rows = gridRows(dto, days);
    const kinds = findProblems(dto, days, rows).map((p) => p.kind);

    // Assert
    expect(rows[0]).toMatchObject({ lamLe: 1, lamCN: 1 });
    expect(kinds).toEqual(expect.arrayContaining(['holidayWork', 'sundayWork']));
  });

  it('should leave a holiday nobody worked out of it', () => {
    // Arrange
    const dto = holidaySheet({});
    const days = dayColumns(dto);

    // Act
    const rows = gridRows(dto, days);

    // Assert
    expect(rows[0]).toMatchObject({ lamLe: 0, lamCN: 0, le: 1 });
  });

  it('should read a closed period from the totals it closed with', () => {
    // Arrange
    const frozen = { ...rowTotals(sheet([person()]), person(), dayColumns(sheet([person()]))), paid: 99 };
    const dto = sheet([person({ frozenTotals: frozen })]);

    // Act + Assert
    expect(rowTotals(dto, person({ frozenTotals: frozen }), dayColumns(dto)).paid).toBe(99);
  });
});

describe('a fixed holiday nobody entered', () => {
  it('should be raised before closing, once, not per person', () => {
    // Arrange: November's period holds 24/11
    const dto = sheet([person(), person({ employeeId: 'other', code: 'B' })]);
    const days = dayColumns(dto);

    // Act
    const missing = findProblems(dto, days, gridRows(dto, days)).filter((p) => p.kind === 'missingHoliday');

    // Assert
    expect(missing.map((p) => p.text)).toEqual(['Chưa nhập ngày lễ 24/11: Ngày Văn hoá Việt Nam']);
  });

  it('should stay quiet once it is entered, under any name', () => {
    // Arrange
    const dto = { ...sheet([person()]), holidays: [{ day: '2026-11-24', name: 'Lễ công ty' }] };
    const days = dayColumns(dto);

    // Act + Assert
    expect(findProblems(dto, days, gridRows(dto, days)).some((p) => p.kind === 'missingHoliday')).toBe(false);
  });
});

describe('leave beyond the balance while the period is still running', () => {
  // 05/11: half a day of leave, nothing in the balance, and enough days left to earn this period's new day.
  const running = (over: Partial<TimesheetRowDto> = {}) => {
    const dto = sheet([person({ leaveOpening: 0, cells: { '2026-10-30': { entered: 'P/2', note: null } }, ...over })]);
    return { ...dto, today: '2026-11-05' };
  };

  it('should not raise it yet, because the day earned by the end of the period may cover it', () => {
    // Arrange
    const dto = running();
    const days = dayColumns(dto);

    // Act
    const rows = gridRows(dto, days);

    // Assert
    expect(rows[0]?.phepVuot).toBe(0);
    expect(findProblems(dto, days, rows).some((p) => p.kind === 'leave')).toBe(false);
  });

  it('should raise it when the leave is more than the day that can still be earned', () => {
    // Arrange
    const cells = Object.fromEntries(['2026-10-26', '2026-10-27'].map((d) => [d, { entered: 'P' as const, note: null }]));
    const dto = running({ cells });
    const days = dayColumns(dto);

    // Act + Assert: 2 days taken, at most 1 can be earned
    expect(findProblems(dto, days, gridRows(dto, days)).some((p) => p.kind === 'leave')).toBe(true);
  });

  it('should raise it when too few days are left to reach the threshold', () => {
    // Arrange: leaves on 10/11, far short of 14
    const dto = running({ leftOn: '2026-11-10' });
    const days = dayColumns(dto);

    // Act + Assert
    expect(findProblems(dto, days, gridRows(dto, days)).some((p) => p.kind === 'leave')).toBe(true);
  });

  it('should raise it once the period is over and the day was not earned', () => {
    // Arrange: 20 days of unpaid leave leave too few to earn the day
    const away = Object.fromEntries(dayColumns(sheet([person()])).filter((d) => !d.isWeekend && d.iso !== '2026-10-30').map((d) => [d.iso, { entered: 'KL' as const, note: null }]));
    const dto = { ...sheet([person({ leaveOpening: 0, cells: { ...away, '2026-10-30': { entered: 'P/2', note: null } } })]), today: '2026-11-25' };
    const days = dayColumns(dto);

    // Act + Assert
    expect(findProblems(dto, days, gridRows(dto, days)).some((p) => p.kind === 'leave')).toBe(true);
  });

  it('should never hold it back for someone on probation, who earns no new day', () => {
    // Arrange
    const dto = running({ employment: 'probation' });
    const days = dayColumns(dto);

    // Act + Assert
    expect(findProblems(dto, days, gridRows(dto, days)).some((p) => p.kind === 'leave')).toBe(true);
  });
});
