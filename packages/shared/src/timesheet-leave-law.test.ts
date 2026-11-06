import { describe, expect, it } from 'vitest';
import { timesheetTotals, type AttendanceCode, type LeaveRule, type StaffType } from './timesheet.js';

/**
 * Annual leave as NĐ 145/2020 Điều 65 and 66 count it ("Theo luật"), against the workbook's own way ("Như Excel cũ").
 * Cases: docs/test-cases-cham-cong.md, group TC-PL.
 */

const LAW: LeaveRule = { threshold: 14, perPeriod: 1, mode: 'law' };
const EXCEL: LeaveRule = { threshold: 14, perPeriod: 1, mode: 'excel' };
const ones = (n: number) => Array<AttendanceCode>(n).fill('1');

const totalsOf = (
  codes: readonly (AttendanceCode | null)[],
  over: { employment?: StaffType; leaveOpening?: number; rule?: LeaveRule; leavePending?: number; unpaidCountedBefore?: number; sickCountedBefore?: number } = {},
) => timesheetTotals({ codes, norm: 22, leaveOpening: 0, employment: 'official', rule: LAW, ...over });

describe('probation (Điều 65 khoản 2)', () => {
  it('TC-PL-01: should keep the leave someone already has while on probation', () => {
    // Act
    const totals = totalsOf(ones(22), { employment: 'probation', leaveOpening: 3 });

    // Assert
    expect(totals.leaveClosing).toBe(3);
  });

  it('TC-PL-02: should hold a probation month\'s leave until the person becomes official, without paying it yet', () => {
    // Act
    const totals = totalsOf([...ones(20), 'P'], { employment: 'probation' });

    // Assert: 21 days counted, 1 day earned but not usable, the P is unpaid
    expect(totals).toMatchObject({ leavePendingClosing: 1, leaveClosing: 0, leaveOverdrawn: 1, paid: 20 });
  });

  it('TC-PL-03: should add the held leave in the first official period', () => {
    // Act
    const totals = totalsOf(ones(22), { leavePending: 2 });

    // Assert: 2 held + 1 earned this period
    expect(totals).toMatchObject({ leaveCredited: 2, leavePendingClosing: 0, leaveClosing: 3 });
  });

  it('TC-PL-04: should let the held leave pay a day taken in that first official period', () => {
    // Act
    const totals = totalsOf([...ones(21), 'P'], { leavePending: 1 });

    // Assert
    expect(totals).toMatchObject({ leaveOverdrawn: 0, paid: 22, leaveClosing: 1 });
  });

  it('TC-PL-05: should give no held leave for a probation month under the threshold', () => {
    expect(totalsOf(ones(13), { employment: 'probation' }).leavePendingClosing).toBe(0);
  });

  it('TC-PL-06: should keep the workbook\'s way when HR chooses it: nothing earned, nothing kept', () => {
    // Act
    const totals = totalsOf(ones(22), { employment: 'probation', leaveOpening: 3, rule: EXCEL });

    // Assert
    expect(totals).toMatchObject({ leaveClosing: 0, leavePendingClosing: 0 });
  });
});

describe('what counts toward the threshold (Điều 65, 66)', () => {
  it('TC-PL-07: should count a public holiday as time worked', () => {
    // Act + Assert: 13 days worked and 1 holiday reach 14
    expect(totalsOf([...ones(13), 'NL']).leaveClosing).toBe(1);
  });

  it('TC-PL-08: should count approved unpaid leave, and not leave taken without permission', () => {
    // Act + Assert
    expect(totalsOf([...ones(13), 'KL']).leaveClosing).toBe(1);
    expect(totalsOf([...ones(13), 'KP']).leaveClosing).toBe(0);
  });

  it('TC-PL-09: should stop counting approved unpaid leave once a month of it has counted this year', () => {
    // Act + Assert: a month is the period's norm, 22 days
    expect(totalsOf([...ones(13), 'KL'], { unpaidCountedBefore: 22 }).leaveClosing).toBe(0);
    expect(totalsOf([...ones(13), 'KL'], { unpaidCountedBefore: 21 })).toMatchObject({ leaveClosing: 1, unpaidCounted: 1 });
  });

  it('TC-PL-10: should count sick leave up to two months a year, and maternity leave in full', () => {
    // Act + Assert
    expect(totalsOf([...ones(13), 'OM'], { sickCountedBefore: 44 }).leaveClosing).toBe(0);
    expect(totalsOf([...ones(13), 'OM'], { sickCountedBefore: 43 })).toMatchObject({ leaveClosing: 1, sickCounted: 1 });
    expect(totalsOf([...ones(13), 'TS'], { sickCountedBefore: 44 }).leaveClosing).toBe(1);
  });

  it('TC-PL-11: should count the unpaid half of KL/2 as approved unpaid leave', () => {
    // Act: 13 days and 2 half days, each half worked and half unpaid
    const totals = totalsOf([...ones(13), 'KL/2', 'KL/2']);

    // Assert: 13 + 1 worked + 1 unpaid counted
    expect(totals).toMatchObject({ unpaidCounted: 1, leaveClosing: 1 });
  });

  it('TC-PL-12: should keep the workbook\'s count when HR chooses it: holidays and unpaid leave do not count', () => {
    // Act + Assert
    expect(totalsOf([...ones(13), 'NL'], { rule: EXCEL }).leaveClosing).toBe(0);
    expect(totalsOf([...ones(13), 'KL'], { rule: EXCEL }).leaveClosing).toBe(0);
  });
});

describe('maternity and sick leave apart', () => {
  it('TC-PL-13: should report maternity and sick days apart, and still their sum', () => {
    // Act
    const totals = totalsOf([...ones(18), 'TS', 'TS', 'OM']);

    // Assert
    expect(totals).toMatchObject({ maternity: 2, sick: 1, insured: 3 });
  });
});
