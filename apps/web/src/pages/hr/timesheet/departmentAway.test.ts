import type { AbsenceRowDto, EmployeeDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { awayNotices, awayWords, crowdedDepartments } from './departmentAway';

const personOf = (id: string, fullName: string, department: string) => ({ id, code: id.toUpperCase(), fullName, department, title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 }) as EmployeeDto;
const PEOPLE = [personOf('a', 'An', 'Sales Engineering'), personOf('b', 'Bình', 'Sales Engineering'), personOf('c', 'Chi', 'Sales Engineering'), personOf('d', 'Dũng', 'Kế toán')];
const rowOf = (employeeId: string, from: string, to = from, over: Partial<AbsenceRowDto> = {}): AbsenceRowDto => ({
  id: `${employeeId}-${from}`, source: 'absence', reason: 'annual', code: 'P', from, to, days: 1, note: '', label: 'Nghỉ phép năm', approvedBy: null, handover: '', createdBy: 'Lan',
  files: [], needsPaper: false, employeeId, employeeCode: employeeId.toUpperCase(), fullName: PEOPLE.find((p) => p.id === employeeId)?.fullName ?? '', ...over,
});

describe('people of one department already away on the chosen days', () => {
  it('should name the people of the chosen person\'s department away on a day, approved or waiting', () => {
    // Arrange: An and Bình away on Thursday 12/11, Dũng of another department too
    const rows = [rowOf('a', '2026-11-12', '2026-11-12', { approvedBy: 'HR' }), rowOf('b', '2026-11-11', '2026-11-13'), rowOf('d', '2026-11-12')];

    // Act: Chi asks for 12/11
    const notices = awayNotices({ rows, people: PEOPLE, chosenIds: ['c'], from: '2026-11-12', to: '2026-11-12' });

    // Assert
    expect(notices.map(awayWords)).toEqual(['Ngày 12/11: Sales Engineering đã có 2 người nghỉ: An, Bình']);
  });

  it('should join days in a row with the same people into one line, and leave out being late', () => {
    // Arrange: Bình away Friday 13/11 to Monday 16/11, An only late on 13/11
    const rows = [rowOf('b', '2026-11-13', '2026-11-16'), rowOf('a', '2026-11-13', '2026-11-13', { code: 'M' })];

    // Act
    const notices = awayNotices({ rows, people: PEOPLE, chosenIds: ['c'], from: '2026-11-12', to: '2026-11-16' });

    // Assert
    expect(notices.map(awayWords)).toEqual(['Ngày 13/11–16/11: Sales Engineering đã có 1 người nghỉ: Bình']);
  });

  it('should not count the chosen person, nor the line being edited', () => {
    // Arrange
    const rows = [rowOf('c', '2026-11-12'), rowOf('b', '2026-11-12')];

    // Act
    const notices = awayNotices({ rows, people: PEOPLE, chosenIds: ['c'], from: '2026-11-12', to: '2026-11-12', ignoreId: 'b-2026-11-12' });

    // Assert
    expect(notices).toEqual([]);
  });
});

describe('days the list marks as crowded', () => {
  it('should mark a department with two or more people away on a day of the line', () => {
    // Arrange
    const rows = [rowOf('a', '2026-11-12'), rowOf('b', '2026-11-10', '2026-11-12'), rowOf('d', '2026-11-12')];

    // Act
    const crowded = crowdedDepartments(rows, PEOPLE, '2026-11-12', '2026-11-12');

    // Assert
    expect(crowded).toEqual([{ department: 'Sales Engineering', count: 2, day: '2026-11-12' }]);
  });

  it('should mark nothing when each department has one person away', () => {
    // Arrange
    const rows = [rowOf('a', '2026-11-12'), rowOf('d', '2026-11-12')];

    // Act
    const crowded = crowdedDepartments(rows, PEOPLE, '2026-11-12', '2026-11-12');

    // Assert
    expect(crowded).toEqual([]);
  });
});
