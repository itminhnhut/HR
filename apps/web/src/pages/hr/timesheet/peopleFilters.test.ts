import type { EmployeeDto, StaffKindDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { filterPeople, filtersOn, START_FILTERS, type PeopleFilters } from './peopleFilters';

/** The staff list's filters. */
const TODAY = '2026-11-08';
const kinds: StaffKindDto[] = [
  { id: 'k-off', name: 'Chính thức', rule: 'official', isDefault: true, employees: 0 },
  { id: 'k-pro', name: 'Thử việc', rule: 'probation', isDefault: true, employees: 0 },
  { id: 'k-intern', name: 'Thực tập', rule: 'probation', isDefault: false, employees: 0 },
];
const person = (id: string, over: Partial<EmployeeDto>): EmployeeDto => ({
  id, code: id.toUpperCase(), fullName: `Người ${id}`, department: 'Kinh doanh', title: '', regionId: 'hcm', employment: 'official',
  staffKindId: null, joinedOn: '2025-01-01', officialOn: null, leftOn: null, openingLeave: 0, ...over,
});
const people = [
  person('a', { fullName: 'Nguyễn Thị Hương', code: 'NV01', title: 'Kế toán trưởng', department: 'Kế toán' }),
  person('b', { fullName: 'Trần Văn Đức', code: 'NV02', regionId: 'hn', employment: 'probation' }),
  person('c', { fullName: 'Lê Minh', code: 'NV03', employment: 'probation', officialOn: '2026-11-01' }),
  person('d', { fullName: 'Phạm An', code: 'NV04', employment: 'probation', staffKindId: 'k-intern', leftOn: '2026-11-08' }),
  person('e', { fullName: 'Võ Bình', code: 'NV05', regionId: 'hn', department: 'Kế toán', leftOn: '2026-12-31' }),
];
const ids = (filters: Partial<PeopleFilters>) => filterPeople(people, kinds, TODAY, { ...START_FILTERS, ...filters }).map((p) => p.id);

describe('filtering the staff list', () => {
  it('should open on the people still working, HR\'s default', () => {
    expect(START_FILTERS.status).toBe('working');
  });

  it('should keep everyone, those who left included, with the status on Tất cả', () => {
    // Arrange: the start filters

    // Act
    const shown = ids({ status: 'all' });

    // Assert
    expect(shown).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('should find a name typed without tones', () => {
    // Arrange
    const query = 'tran van duc';

    // Act
    const shown = ids({ query });

    // Assert
    expect(shown).toEqual(['b']);
  });

  it('should find a person by employee code or by title', () => {
    // Arrange + Act
    const byCode = ids({ query: 'nv04', status: 'all' });
    const byTitle = ids({ query: 'ke toan truong', status: 'all' });

    // Assert
    expect(byCode).toEqual(['d']);
    expect(byTitle).toEqual(['a']);
  });

  it('should not search the department', () => {
    // Arrange: e works in Kế toán but has no such title

    // Act
    const shown = ids({ query: 'ke toan' });

    // Assert
    expect(shown).toEqual(['a']);
  });

  it('should keep the people of one region', () => {
    // Arrange + Act
    const shown = ids({ regionId: 'hn' });

    // Assert
    expect(shown).toEqual(['b', 'e']);
  });

  it('should keep the people of one department', () => {
    // Arrange + Act
    const shown = ids({ department: 'Kế toán' });

    // Assert
    expect(shown).toEqual(['a', 'e']);
  });

  it('should count someone official once their official day has come, as the badge shows', () => {
    // Arrange: c was hired on probation and became official on 01/11

    // Act
    const official = ids({ staffKindId: 'k-off' });
    const probation = ids({ staffKindId: 'k-pro' });

    // Assert
    expect(official).toEqual(['a', 'c', 'e']);
    expect(probation).toEqual(['b']);
  });

  it('should keep a kind HR named, apart from the usual kind of the same rule', () => {
    // Arrange + Act
    const shown = ids({ staffKindId: 'k-intern', status: 'all' });

    // Assert
    expect(shown).toEqual(['d']);
  });

  it('should keep those still working, a last day still to come included', () => {
    // Arrange: d's last day is today, e's is next month

    // Act
    const shown = ids({ status: 'working' });

    // Assert
    expect(shown).toEqual(['a', 'b', 'c', 'e']);
  });

  it('should keep those who have left, their last day today included', () => {
    // Arrange + Act
    const shown = ids({ status: 'left' });

    // Assert
    expect(shown).toEqual(['d']);
  });

  it('should combine the filters with the text search', () => {
    // Arrange + Act
    const shown = ids({ regionId: 'hn', status: 'working', query: 'binh' });

    // Assert
    expect(shown).toEqual(['e']);
  });
});

describe('counting the filters on', () => {
  it('should count nothing at the start', () => {
    // Arrange + Act
    const count = filtersOn(START_FILTERS);

    // Assert
    expect(count).toBe(0);
  });

  it('should count each filter set, the search and the status included', () => {
    // Arrange
    const filters: PeopleFilters = { query: 'an', regionId: 'hn', department: 'Kế toán', staffKindId: 'k-off', status: 'left' };

    // Act
    const count = filtersOn(filters);

    // Assert
    expect(count).toBe(5);
  });

  it('should not count a search of spaces only', () => {
    // Arrange + Act
    const count = filtersOn({ ...START_FILTERS, query: '   ' });

    // Assert
    expect(count).toBe(0);
  });
});
