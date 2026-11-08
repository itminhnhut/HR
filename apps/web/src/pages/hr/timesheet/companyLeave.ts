import { matchesQuery, SHEET_APPROVER, standardPeriod, type AbsenceBatchDto, type AbsenceBatchInput, type BatchAudience, type BatchAudienceKind, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import type { Counting } from './AbsenceKinds';

/** "Nghỉ công ty": the form, who it comes to, and the list's filters. The server decides the days of each person. */

export interface BatchForm {
  name: string;
  reason: string;
  code: Counting;
  from: string;
  to: string;
  approvedBy: string;
  note: string;
  kind: BatchAudienceKind;
  regionIds: string[];
  departments: string[];
  employeeIds: string[];
  /** The version being edited; none for a new batch. */
  version?: number;
}

export const AUDIENCE_KINDS: { kind: BatchAudienceKind; label: string }[] = [
  { kind: 'all', label: 'Tất cả đang làm' },
  { kind: 'region', label: 'Theo khu vực' },
  { kind: 'department', label: 'Theo bộ phận' },
  { kind: 'people', label: 'Chọn người' },
];

/** A paid day off, approved by HR, for everyone at work: what a company day off usually is. */
export const emptyBatchForm = (today: string): BatchForm => ({
  name: '', reason: 'other-paid', code: 'CL', from: today, to: today, approvedBy: SHEET_APPROVER, note: '', kind: 'all', regionIds: [], departments: [], employeeIds: [],
});

export function formOfBatch(b: AbsenceBatchDto): BatchForm {
  const a = b.audience;
  return {
    name: b.name, reason: b.reason, code: b.code as Counting, from: b.from, to: b.to, approvedBy: b.approvedBy ?? '', note: b.note, kind: a.kind,
    regionIds: a.kind === 'region' ? a.regionIds : [],
    departments: a.kind === 'department' ? a.departments : [],
    employeeIds: a.kind === 'people' ? a.employeeIds : b.employeeIds,
    version: b.version,
  };
}

export function audienceOf(f: BatchForm): BatchAudience {
  if (f.kind === 'region') return { kind: 'region', regionIds: f.regionIds };
  if (f.kind === 'department') return { kind: 'department', departments: f.departments };
  if (f.kind === 'people') return { kind: 'people', employeeIds: f.employeeIds };
  return { kind: 'all' };
}

export const batchInput = (f: BatchForm): AbsenceBatchInput => ({
  name: f.name, reason: f.reason, code: f.code as AbsenceBatchInput['code'], from: f.from, to: f.to || f.from, approvedBy: f.approvedBy, note: f.note, audience: audienceOf(f),
  ...(f.version ? { version: f.version } : {}),
});

/** At work on some day of the dates. */
const atWork = (p: EmployeeDto, from: string, to: string) => (!p.joinedOn || p.joinedOn <= to) && (!p.leftOn || p.leftOn >= from);

/** Who it would come to, as the server chooses them. People with no working day in the dates are left out on saving. */
export function audiencePeople(audience: BatchAudience, people: readonly EmployeeDto[], from: string, to: string): EmployeeDto[] {
  if (audience.kind === 'people') return people.filter((p) => audience.employeeIds.includes(p.id));
  const working = people.filter((p) => atWork(p, from, to || from));
  if (audience.kind === 'region') return working.filter((p) => audience.regionIds.includes(p.regionId));
  if (audience.kind === 'department') return working.filter((p) => audience.departments.includes(p.department));
  return working;
}

export function audienceWords(audience: BatchAudience, regions: readonly Pick<TimesheetRegionDto, 'id' | 'name'>[]): string {
  if (audience.kind === 'region') return `Khu vực ${audience.regionIds.map((id) => regions.find((r) => r.id === id)?.name ?? '?').join(', ')}`;
  if (audience.kind === 'department') return `Bộ phận ${audience.departments.join(', ')}`;
  if (audience.kind === 'people') return `Chọn ${audience.employeeIds.length} người`;
  return 'Tất cả đang làm';
}

export interface BatchFilters {
  /** A period of the year: 11 is 26/10–25/11. None: the whole year. */
  period: number | null;
  reason: string;
  regionId: string;
  department: string;
  query: string;
}

export const NO_BATCH_FILTERS: BatchFilters = { period: null, reason: '', regionId: '', department: '', query: '' };

export function filterBatches(batches: readonly AbsenceBatchDto[], year: number, f: BatchFilters, people: readonly EmployeeDto[]): AbsenceBatchDto[] {
  const range = f.period ? standardPeriod(year, f.period) : null;
  const has = (b: AbsenceBatchDto, test: (p: EmployeeDto) => boolean) => b.employeeIds.some((id) => people.some((p) => p.id === id && test(p)));
  return batches.filter(
    (b) =>
      (!range || (b.from <= range.to && b.to >= range.from)) &&
      (!f.reason || b.reason === f.reason) &&
      (!f.regionId || has(b, (p) => p.regionId === f.regionId)) &&
      (!f.department || has(b, (p) => p.department === f.department)) &&
      matchesQuery(`${b.name} ${b.label} ${b.note} ${b.approvedBy ?? ''}`, f.query),
  );
}
