import { matchesQuery, staffKindOf, type EmployeeDto, type StaffKindDto, type StaffType } from '@careers/shared';

/** Đang làm, Đã nghỉ, or everyone. */
export type WorkStatus = 'all' | 'working' | 'left';

export interface PeopleFilters {
  /** Name, employee code or title, tones ignored. */
  query: string;
  regionId: string;
  department: string;
  staffKindId: string;
  status: WorkStatus;
}

/** The tab opens on the people still working (HR's choice); "Xoá lọc" comes back to it. */
export const START_FILTERS: PeopleFilters = { query: '', regionId: '', department: '', staffKindId: '', status: 'working' };

/** Gone once the last day has come: the row shows "Đã nghỉ" from that day. */
export const hasLeftBy = (p: Pick<EmployeeDto, 'leftOn'>, today: string) => !!p.leftOn && p.leftOn <= today;

/** Official from the official day on, else as hired: what the Loại NV badge shows. */
export const employmentNow = (p: Pick<EmployeeDto, 'officialOn' | 'employment'>, today: string): StaffType =>
  p.officialOn && p.officialOn <= today ? 'official' : p.employment;

const matchesStatus = (p: EmployeeDto, today: string, status: WorkStatus) => status === 'all' || (status === 'left') === hasLeftBy(p, today);

export function filterPeople(people: readonly EmployeeDto[], kinds: readonly StaffKindDto[], today: string, f: PeopleFilters): EmployeeDto[] {
  return people.filter(
    (p) =>
      (!f.regionId || p.regionId === f.regionId) &&
      (!f.department || p.department === f.department) &&
      (!f.staffKindId || staffKindOf(kinds, p.staffKindId, employmentNow(p, today))?.id === f.staffKindId) &&
      matchesStatus(p, today, f.status) &&
      matchesQuery(`${p.fullName} ${p.code} ${p.title}`, f.query),
  );
}

/** How many filters are on beyond the start, for "Xoá lọc (2)". */
export const filtersOn = (f: PeopleFilters) =>
  [!!f.query.trim(), !!f.regionId, !!f.department, !!f.staffKindId, f.status !== START_FILTERS.status].filter(Boolean).length;
