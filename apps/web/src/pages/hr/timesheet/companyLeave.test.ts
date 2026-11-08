import type { AbsenceBatchDto, EmployeeDto, TimesheetRegionDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { audiencePeople, audienceWords, batchInput, filterBatches, formOfBatch, NO_BATCH_FILTERS, type BatchForm } from './companyLeave';

const REGIONS = [{ id: 'r1', name: 'HCM' }, { id: 'r2', name: 'HN' }] as TimesheetRegionDto[];
const personOf = (id: string, regionId: string, department: string, over: Partial<EmployeeDto> = {}) =>
  ({ id, code: id.toUpperCase(), fullName: `Người ${id.toUpperCase()}`, department, title: '', regionId, employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0, ...over }) as EmployeeDto;
const PEOPLE = [personOf('a', 'r1', 'Sales'), personOf('b', 'r2', 'Sales'), personOf('c', 'r1', 'Kế toán'), personOf('d', 'r1', 'Sales', { leftOn: '2026-10-31' })];
const batchOf = (over: Partial<AbsenceBatchDto>): AbsenceBatchDto => ({
  id: 'b1', name: 'Công ty nghỉ thêm', reason: 'other-paid', label: 'Nghỉ có lương khác', code: 'CL', from: '2026-11-09', to: '2026-11-10', approvedBy: 'HR', note: '',
  audience: { kind: 'all' }, employeeIds: ['a', 'b', 'c'], version: 1, createdBy: 'Lan', createdAt: '2026-11-01T00:00:00.000Z', ...over,
});

describe('who a company day off comes to', () => {
  it('should take everyone at work on some day of it, by region, by department, or as picked', () => {
    // Act
    const all = audiencePeople({ kind: 'all' }, PEOPLE, '2026-11-09', '2026-11-10');
    const hcm = audiencePeople({ kind: 'region', regionIds: ['r1'] }, PEOPLE, '2026-11-09', '2026-11-10');
    const sales = audiencePeople({ kind: 'department', departments: ['Sales'] }, PEOPLE, '2026-11-09', '2026-11-10');
    const picked = audiencePeople({ kind: 'people', employeeIds: ['c', 'd'] }, PEOPLE, '2026-11-09', '2026-11-10');

    // Assert: D left on 31/10
    expect([all, hcm, sales, picked].map((list) => list.map((p) => p.id))).toEqual([['a', 'b', 'c'], ['a', 'c'], ['a', 'b'], ['c', 'd']]);
  });

  it('should say how HR chose them, in plain words', () => {
    // Act
    const words = [
      audienceWords({ kind: 'all' }, REGIONS),
      audienceWords({ kind: 'region', regionIds: ['r1', 'r2'] }, REGIONS),
      audienceWords({ kind: 'department', departments: ['Sales'] }, REGIONS),
      audienceWords({ kind: 'people', employeeIds: ['a', 'b'] }, REGIONS),
    ];

    // Assert
    expect(words).toEqual(['Tất cả đang làm', 'Khu vực HCM, HN', 'Bộ phận Sales', 'Chọn 2 người']);
  });
});

describe('the form of a company day off', () => {
  it('should send the people picked only when HR picks people, with the version when editing', () => {
    // Arrange
    const form: BatchForm = { ...formOfBatch(batchOf({ audience: { kind: 'region', regionIds: ['r1'] } })), kind: 'people', employeeIds: ['a'] };

    // Act
    const input = batchInput(form);

    // Assert
    expect(input).toEqual({ name: 'Công ty nghỉ thêm', reason: 'other-paid', code: 'CL', from: '2026-11-09', to: '2026-11-10', approvedBy: 'HR', note: '', audience: { kind: 'people', employeeIds: ['a'] }, version: 1 });
  });
});

describe('the list of company days off', () => {
  const batches = [
    batchOf({ id: 'b1', from: '2026-11-09', to: '2026-11-10', employeeIds: ['a'] }),
    batchOf({ id: 'b2', name: 'Tết thêm', reason: 'unpaid', from: '2026-02-20', to: '2026-02-21', employeeIds: ['b'] }),
    batchOf({ id: 'b3', name: 'Team building', from: '2026-11-20', to: '2026-11-20', employeeIds: ['c'] }),
  ];

  it('should keep the batches touching the period, of a reason, region or department, or matching the words', () => {
    // Act
    const period = filterBatches(batches, 2026, { ...NO_BATCH_FILTERS, period: 11 }, PEOPLE);
    const reason = filterBatches(batches, 2026, { ...NO_BATCH_FILTERS, reason: 'unpaid' }, PEOPLE);
    const region = filterBatches(batches, 2026, { ...NO_BATCH_FILTERS, regionId: 'r2' }, PEOPLE);
    const department = filterBatches(batches, 2026, { ...NO_BATCH_FILTERS, department: 'Kế toán' }, PEOPLE);
    const words = filterBatches(batches, 2026, { ...NO_BATCH_FILTERS, query: 'team' }, PEOPLE);

    // Assert
    expect([period, reason, region, department, words].map((list) => list.map((b) => b.id))).toEqual([['b1', 'b3'], ['b2'], ['b2'], ['b3'], ['b3']]);
  });
});
