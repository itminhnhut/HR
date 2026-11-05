import { describe, expect, it } from 'vitest';
import {
  ABSENCE_REASONS,
  dayCode,
  employeeInputSchema,
  timesheetAdjustmentSchema,
  timesheetCellsSchema,
  timesheetNormsSchema,
  timesheetReopenSchema,
  timesheetTotals,
  type AttendanceCode,
  type StaffType,
} from './timesheet.js';

/**
 * The rules in small situations nobody has yet met in HR's sheets. Where a formula is named, it is the one in
 * "Tháng 11.26" row 9. Case numbers: docs/test-cases-cham-cong.md.
 */

const ones = (n: number) => Array<AttendanceCode>(n).fill('1');
const repeat = (code: AttendanceCode, n: number) => Array<AttendanceCode>(n).fill(code);
const totalsOf = (
  codes: readonly (AttendanceCode | null)[],
  over: { norm?: number; leaveOpening?: number; employment?: StaffType; adjustment?: number } = {},
) => timesheetTotals({ codes, norm: 22, leaveOpening: 0, employment: 'official', ...over });

describe('half days (AL9, AN9, AO9, AV9)', () => {
  it('TC-ND-01: should count P/2 as half a day worked and half a day of leave', () => {
    // Act
    const totals = totalsOf([...ones(19), 'P/2'], { leaveOpening: 2 });

    // Assert: 19 + 0.5 worked, 0.5 paid from the 3 available, 2.5 left
    expect(totals).toMatchObject({ actual: 19.5, leave: 0.5, paid: 20, leaveClosing: 2.5 });
  });

  it('TC-ND-02: should count KL/2 as half a day worked and half a day unpaid, with nothing off the leave', () => {
    // Act
    const totals = totalsOf([...ones(19), 'KL/2'], { leaveOpening: 2 });

    // Assert
    expect(totals).toMatchObject({ actual: 19.5, unpaidLeave: 0.5, leave: 0, paid: 19.5, leaveClosing: 3 });
  });

  it('TC-ND-03: should leave the other half of P/2 unpaid when there is no leave, like person E of "Tháng 10.26"', () => {
    // Act
    const totals = totalsOf([...ones(9), 'P/2'], { leaveOpening: 0 });

    // Assert
    expect(totals).toMatchObject({ actual: 9.5, leave: 0.5, paid: 9.5, leaveClosing: 0, leaveOverdrawn: 0.5 });
  });

  it('TC-ND-04: should add up several half days of both kinds', () => {
    // Act
    const totals = totalsOf([...ones(16), 'P/2', 'P/2', 'KL/2', 'KL/2'], { leaveOpening: 4 });

    // Assert: 16 + 1 + 1 worked, 1 leave paid
    expect(totals).toMatchObject({ actual: 18, leave: 1, unpaidLeave: 1, paid: 19, leaveClosing: 4 });
  });
});

describe('a new day of leave needs 14 days in the period (AV9)', () => {
  const cases: [name: string, codes: AttendanceCode[], closing: number][] = [
    ['14 days worked earn it', ones(14), 1],
    ['13 days worked do not', ones(13), 0],
    ['M counts as a day', [...ones(13), 'M'], 1],
    ['a whole P counts, and takes the new day back', [...ones(13), 'P'], 0],
    ['a P/2 counts whole', [...ones(13), 'P/2'], 0.5],
    ['one KL/2 counts half: 13.5 is not enough', [...ones(13), 'KL/2'], 0],
    ['two KL/2 count one: 14 is enough', [...ones(13), 'KL/2', 'KL/2'], 1],
    ['KL does not count', [...ones(13), 'KL'], 0],
    ['KP does not count', [...ones(13), 'KP'], 0],
    ['NL does not count', [...ones(13), 'NL'], 0],
  ];

  it.each(cases)('TC-BT-03: %s', (_name, codes, closing) => {
    // Act
    const totals = totalsOf(codes);

    // Assert
    expect(totals.leaveClosing).toBe(closing);
  });

  it('TC-BT-04: should give only one new day however many days were worked', () => {
    expect(totalsOf(ones(26), { norm: 25, leaveOpening: 2 }).leaveClosing).toBe(3);
  });
});

describe('leave beyond the balance', () => {
  it('TC-HP-01: should pay what the person has, and not take the balance below zero', () => {
    // Act: 1 opening + 1 new, 3 taken
    const totals = totalsOf([...ones(17), ...repeat('P', 3)], { leaveOpening: 1 });

    // Assert
    expect(totals).toMatchObject({ actual: 17, leave: 3, paid: 19, leaveClosing: 0, leaveOverdrawn: 1 });
  });

  it('TC-HP-03: should pay nothing for leave during probation', () => {
    // Act
    const totals = totalsOf([...ones(20), 'P'], { employment: 'probation' });

    // Assert
    expect(totals).toMatchObject({ actual: 20, leave: 1, paid: 20, leaveClosing: 0, leaveOverdrawn: 1 });
  });

  it('TC-HP-04: should carry no leave out of probation, as "Thử Việc" gives 0 in AV9', () => {
    expect(totalsOf(ones(22), { employment: 'probation', leaveOpening: 3 }).leaveClosing).toBe(0);
  });

  it('TC-HP-05: should treat KP as unpaid, off nothing and worth nothing', () => {
    // Act
    const totals = totalsOf([...ones(19), 'KP'], { leaveOpening: 2 });

    // Assert
    expect(totals).toMatchObject({ actual: 19, absent: 1, leave: 0, paid: 19, leaveClosing: 3 });
  });
});

describe('overtime (AS9, AT9)', () => {
  it('TC-OT-01: should stop at the norm and put the rest in overtime', () => {
    // Act
    const totals = totalsOf(ones(24));

    // Assert
    expect(totals).toMatchObject({ actual: 24, paid: 22, overtime: 2 });
  });

  it('TC-OT-02: should have no overtime at exactly the norm', () => {
    expect(totalsOf(ones(22))).toMatchObject({ paid: 22, overtime: 0 });
  });

  it('TC-OT-03: should count paid leave and holidays towards overtime', () => {
    // Act: 21 + 1 leave + 1 holiday = 23 against 22
    const totals = totalsOf([...ones(21), 'P', 'NL'], { leaveOpening: 1 });

    // Assert
    expect(totals).toMatchObject({ actual: 21, holiday: 1, paid: 22, overtime: 1 });
  });

  it('TC-OT-04: should not count unpaid leave beyond the balance towards overtime', () => {
    // Act: 21 worked, 2 of leave of which 1 is paid (0 opening + 1 new) = 22
    const totals = totalsOf([...ones(21), 'P', 'P']);

    // Assert
    expect(totals).toMatchObject({ paid: 22, overtime: 0 });
  });

  it('TC-OT-05: should keep half days of overtime', () => {
    expect(totalsOf([...ones(22), 'KL/2'])).toMatchObject({ actual: 22.5, paid: 22, overtime: 0.5 });
  });
});

describe('adjustments (comment on "Công hưởng lương", rows G of both sheets)', () => {
  it('TC-DC-01: should take half a day off the pay and leave everything else, like person G', () => {
    // Act
    const totals = totalsOf([...ones(21), 'KL/2'], { adjustment: -0.5 });

    // Assert
    expect(totals).toMatchObject({ actual: 21.5, paid: 21, paidBeforeAdjustment: 21.5, unpaidLeave: 0.5, overtime: 0 });
  });

  it('TC-DC-02: should stop at zero when an adjustment would make the pay negative', () => {
    // Act
    const totals = totalsOf(ones(3), { adjustment: -5 });

    // Assert
    expect(totals).toMatchObject({ actual: 3, paid: 0, paidBeforeAdjustment: 3 });
  });

  it('TC-DC-03: should pay zero for someone with no days and a negative adjustment', () => {
    expect(totalsOf([], { adjustment: -0.5 }).paid).toBe(0);
  });

  it('TC-DC-04: should go past the norm with a positive adjustment, without turning into overtime', () => {
    expect(totalsOf(ones(22), { adjustment: 1 })).toMatchObject({ paid: 23, overtime: 0, paidBeforeAdjustment: 22 });
  });

  it('TC-DC-05: should not change the leave balance, or the 14 days that earn leave', () => {
    // Act: 13 worked and +5 adjusted is still 13 worked
    const totals = totalsOf(ones(13), { adjustment: 5, leaveOpening: 2 });

    // Assert
    expect(totals).toMatchObject({ paid: 18, leaveClosing: 2 });
  });

  it('TC-DC-06: should take the adjustment off a capped pay, and keep the overtime', () => {
    expect(totalsOf(ones(24), { adjustment: -0.5 })).toMatchObject({ paid: 21.5, overtime: 2 });
  });
});

describe('Saturdays by turns: nothing fills them, the norm counts only some', () => {
  const october = { norm: 22 };

  it('TC-T7-01: should fall short of the norm with fewer Saturdays than the region counts', () => {
    // Act: 20 Mon–Fri and 1 of the 2 Saturdays HCM counts
    const totals = totalsOf(ones(21), october);

    // Assert
    expect(totals).toMatchObject({ actual: 21, paid: 21, overtime: 0 });
  });

  it('TC-T7-02: should pay like person I of "Tháng 10.26" with no Saturday at all', () => {
    expect(totalsOf([...ones(19), 'KL/2'], october)).toMatchObject({ actual: 19.5, paid: 19.5, overtime: 0 });
  });

  it('TC-T7-03: should turn a third Saturday in HCM into overtime', () => {
    expect(totalsOf(ones(23), october)).toMatchObject({ paid: 22, overtime: 1 });
  });

  it('TC-T7-04: should turn all 5 Saturdays of "Tháng 10.26" in HN into 1 overtime against its 24', () => {
    expect(totalsOf(ones(25), { norm: 24 })).toMatchObject({ paid: 24, overtime: 1 });
  });

  it('TC-T7-05: should not fill a Saturday or a Sunday by itself even once it has passed', () => {
    // Arrange
    const base = { entered: null, isHoliday: false, today: '2026-11-05', joinedOn: null, leftOn: null };

    // Assert
    expect(dayCode({ ...base, day: '2026-10-31' })).toBeNull();
    expect(dayCode({ ...base, day: '2026-11-01' })).toBeNull();
  });

  it('TC-T7-06: should count what HR enters on a Sunday', () => {
    // Arrange
    const code = dayCode({ day: '2026-11-01', entered: '1', isHoliday: false, today: '2026-11-05', joinedOn: null, leftOn: null });

    // Act + Assert
    expect(totalsOf([...ones(22), code], october)).toMatchObject({ paid: 22, overtime: 1 });
  });
});

describe('holidays', () => {
  const on = (day: string, over: { entered?: AttendanceCode; joinedOn?: string; leftOn?: string; today?: string } = {}) =>
    dayCode({ day, entered: over.entered ?? null, isHoliday: true, today: over.today ?? '2026-11-05', joinedOn: over.joinedOn ?? null, leftOn: over.leftOn ?? null });

  it('TC-LE-01: should make a Mon–Fri holiday NL by itself, and bring a full period to the norm', () => {
    // Arrange: 24/11/2026 falls in the period with 23 Mon–Fri and a norm of 25
    const codes = [...ones(22), on('2026-11-24'), ...ones(2)];

    // Act
    const totals = totalsOf(codes, { norm: 25 });

    // Assert
    expect(on('2026-11-24')).toBe('NL');
    expect(totals).toMatchObject({ actual: 24, holiday: 1, paid: 25, overtime: 0 });
  });

  it('TC-LE-02: should count a holiday in full for someone on probation', () => {
    expect(totalsOf([...ones(21), 'NL'], { employment: 'probation' })).toMatchObject({ holiday: 1, paid: 22 });
  });

  it('TC-LE-03: should count nothing for a holiday outside the working dates', () => {
    expect(on('2026-11-24', { leftOn: '2026-11-20' })).toBeNull();
    expect(on('2026-11-24', { joinedOn: '2026-11-25' })).toBeNull();
  });

  it('TC-LE-04: should keep what HR entered on a holiday, such as someone who came in', () => {
    expect(on('2026-11-24', { entered: '1' })).toBe('1');
  });

  /**
   * Neither sheet has a holiday yet, so these two only pin what the code does today. Whether a holiday on a day off
   * should give a day at all, or a day in lieu, is a question for the owner: see the report.
   */
  it('TC-LE-05: currently gives NL for a holiday on a Saturday, which pushes a full period one over the norm', () => {
    // Arrange: 1/5/2027 is a Saturday. 20 Mon–Fri and 2 Saturdays make the norm of 22
    const codes = [...ones(22), on('2027-05-01', { today: '2027-05-26' })];

    // Act + Assert
    expect(codes.at(-1)).toBe('NL');
    expect(totalsOf(codes)).toMatchObject({ actual: 22, holiday: 1, paid: 22, overtime: 1 });
  });

  it('TC-LE-06: currently gives NL for a holiday on a Sunday, which also pushes a full period one over the norm', () => {
    // Arrange: 30/4/2028 is a Sunday
    const codes = [...ones(22), on('2028-04-30', { today: '2028-05-26' })];

    // Act + Assert
    expect(codes.at(-1)).toBe('NL');
    expect(totalsOf(codes)).toMatchObject({ holiday: 1, paid: 22, overtime: 1 });
  });
});

describe('working dates', () => {
  const base = { entered: null, isHoliday: false, today: '2026-11-30' };

  it('TC-VG-01: should count from the day someone starts, not the day before', () => {
    expect(dayCode({ ...base, day: '2026-11-02', joinedOn: '2026-11-03', leftOn: null })).toBeNull();
    expect(dayCode({ ...base, day: '2026-11-03', joinedOn: '2026-11-03', leftOn: null })).toBe('1');
  });

  it('TC-NV-01: should count up to the last day, not the day after', () => {
    expect(dayCode({ ...base, day: '2026-11-03', joinedOn: null, leftOn: '2026-11-03' })).toBe('1');
    expect(dayCode({ ...base, day: '2026-11-04', joinedOn: null, leftOn: '2026-11-03' })).toBeNull();
  });

  it('TC-VG-02: should keep the full norm for someone who starts mid-period, like person J', () => {
    expect(totalsOf([...ones(12), ...repeat('M', 2), 'KL'], { employment: 'probation' })).toMatchObject({ actual: 14, norm: 22, paid: 14 });
  });

  it('TC-VG-03: should give new leave to an official who starts mid-period and reaches 14', () => {
    expect(totalsOf(ones(14))).toMatchObject({ paid: 14, leaveClosing: 1 });
  });

  it('TC-NV-02: should give no new leave to someone who leaves before reaching 14, like person E', () => {
    expect(totalsOf(ones(10), { leaveOpening: 2 })).toMatchObject({ paid: 10, leaveClosing: 2 });
  });
});

describe('what HR may type', () => {
  const REGION = '00000000-0000-4000-8000-000000000001';
  const EMPLOYEE = '00000000-0000-4000-8000-000000000002';
  const adjustment = (over: object) => timesheetAdjustmentSchema.safeParse({ employeeId: EMPLOYEE, amount: -0.5, reason: 'Lý do', isRecurring: false, ...over });
  const employee = (over: object) => employeeInputSchema.safeParse({ code: 'X', fullName: 'Người', regionId: REGION, employment: 'official', ...over });

  it('TC-DC-07: should take adjustments in half days, with a reason, and never zero', () => {
    expect(adjustment({}).success).toBe(true);
    expect(adjustment({ amount: 1.5 }).success).toBe(true);
    expect(adjustment({ amount: 0.25 }).success).toBe(false);
    expect(adjustment({ amount: 0 }).success).toBe(false);
    expect(adjustment({ reason: '   ' }).success).toBe(false);
  });

  it('TC-CC-01: should take only the codes of the legend', () => {
    // Arrange
    const cell = (code: string) => timesheetCellsSchema.safeParse({ cells: [{ employeeId: EMPLOYEE, day: '2026-11-04', code }] });

    // Assert
    for (const code of ['1', 'M', 'P', 'P/2', 'KL', 'KL/2', 'NL', 'KP']) expect(cell(code).success).toBe(true);
    for (const code of ['0', 'p', 'P/4', 'OT', '']) expect(cell(code).success).toBe(false);
  });

  it('TC-CC-02: should keep a norm between 0 and 31', () => {
    // Arrange
    const norm = (n: number) => timesheetNormsSchema.safeParse({ norms: { [REGION]: n } }).success;

    // Assert
    expect(norm(0)).toBe(true);
    expect(norm(31)).toBe(true);
    expect(norm(-1)).toBe(false);
    expect(norm(32)).toBe(false);
  });

  it('TC-CC-03: should take opening leave in half days, and not below zero', () => {
    expect(employee({ openingLeave: 7.5 }).success).toBe(true);
    expect(employee({ openingLeave: -0.5 }).success).toBe(false);
    expect(employee({ openingLeave: 0.25 }).success).toBe(false);
  });

  it('TC-MK-01: should need a reason to reopen', () => {
    expect(timesheetReopenSchema.safeParse({ reason: 'Sai ô' }).success).toBe(true);
    expect(timesheetReopenSchema.safeParse({ reason: '  ' }).success).toBe(false);
  });
});

describe('family and insured leave', () => {
  const totalsWith = (codes: (AttendanceCode | null)[], over: Partial<{ norm: number; leaveOpening: number }> = {}) =>
    timesheetTotals({ codes, norm: over.norm ?? 22, leaveOpening: over.leaveOpening ?? 0, employment: 'official' });
  const days = (code: AttendanceCode, n: number) => Array.from({ length: n }, () => code);

  it('TC-RG-01: should pay a wedding or a funeral without touching the balance, Điều 115 khoản 1', () => {
    // Act
    const totals = totalsWith([...days('1', 19), ...days('CL', 3)], { leaveOpening: 2 });

    // Assert
    expect(totals).toMatchObject({ actual: 19, personalPaid: 3, leave: 0, paid: 22, overtime: 0, leaveClosing: 3 });
  });

  it('TC-RG-02: should not pay maternity leave, which insurance pays, but still earn the leave day, NĐ 145 Điều 65', () => {
    // Act
    const totals = totalsWith(days('TS', 20));

    // Assert
    expect(totals).toMatchObject({ actual: 0, insured: 20, paid: 0, overtime: 0, leaveClosing: 1 });
  });

  it('TC-RG-03: should not pay sick leave on insurance either', () => {
    // Act
    const totals = totalsWith([...days('1', 18), ...days('OM', 2)]);

    // Assert
    expect(totals).toMatchObject({ actual: 18, insured: 2, paid: 18, leaveClosing: 1 });
  });

  it('TC-RG-04: should count family leave towards the leave day, Điều 65 khoản 3', () => {
    // Act
    const totals = totalsWith([...days('1', 11), ...days('CL', 3)]);

    // Assert
    expect(totals.leaveClosing).toBe(1);
  });
});

describe('the reasons HR can choose', () => {
  it('should say what the law gives for each family event', () => {
    // Act
    const of = (key: string) => ABSENCE_REASONS.find((r) => r.key === key);

    // Assert
    expect(of('wedding')).toMatchObject({ code: 'CL', days: 3 });
    expect(of('child-wedding')).toMatchObject({ code: 'CL', days: 1 });
    expect(of('funeral-close')).toMatchObject({ code: 'CL', days: 3 });
    expect(of('funeral-family')).toMatchObject({ code: 'KL', days: 1 });
    expect(of('family-wedding')).toMatchObject({ code: 'KL', days: 1 });
    expect(of('maternity')).toMatchObject({ code: 'TS' });
    expect(of('sick')).toMatchObject({ code: 'OM' });
  });
});
