import type { DepartmentDto, EmployeeDto, EmployeeInput, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { confirmsToSave } from './DateConfirm';
import { PeopleTab } from './PeopleTab';

/** "Đã kiểm tra, ngày này đúng" under Ngày vào, Ngày chính thức, Ngày nghỉ việc (F25): payroll's red warning ends here. Made-up people. */
const region: TimesheetRegionDto = { id: '11111111-1111-4111-8111-111111111111', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] };
const person = (id: string, fullName: string, over: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id, code: id, fullName, department: 'Kế toán', title: '', regionId: region.id, employment: 'official', staffKindId: null, joinedOn: '2025-01-06', officialOn: null, leftOn: null, openingLeave: 0,
  email: null, block: 'BO', joinedOnConfirmed: false, officialOnConfirmed: false, leftOnConfirmed: false, ...over,
});
const PEOPLE = [person('A', 'Người Thử A'), person('B', 'Người Thử B', { officialOn: '2025-03-06', joinedOnConfirmed: true, officialOnConfirmed: true })];

const dialog = () => within(screen.getByRole('dialog'));
const saved = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls[0]?.[1] as EmployeeInput;
const openForm = async (name: string) => {
  await screen.findByText(name);
  await userEvent.click(screen.getByRole('button', { name: `Sửa khối ${name}` }));
};

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue(PEOPLE);
  vi.spyOn(api, 'hrRegions').mockResolvedValue([region]);
  vi.spyOn(api, 'hrDepartments').mockResolvedValue([] as DepartmentDto[]);
  vi.spyOn(api, 'hrStaffKinds').mockResolvedValue([] as StaffKindDto[]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TooltipProvider><PeopleTab /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('confirming the dates payroll reads', () => {
  it('should offer the tick only under a date that is filled in', async () => {
    // Act
    await openForm('Người Thử A');

    // Assert: A has a start date only.
    expect(dialog().getByRole('checkbox', { name: 'Đã kiểm tra, ngày này đúng: Ngày vào' })).toBeTruthy();
    expect(dialog().queryByRole('checkbox', { name: 'Đã kiểm tra, ngày này đúng: Ngày chính thức' })).toBeNull();
    expect(dialog().queryByRole('checkbox', { name: 'Đã kiểm tra, ngày này đúng: Ngày nghỉ việc' })).toBeNull();
  });

  it('should send the confirmation when HR ticks it and saves', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue({ ...person('A', 'Người Thử A'), joinedOnConfirmed: true });
    await openForm('Người Thử A');

    // Act
    await userEvent.click(dialog().getByRole('checkbox', { name: 'Đã kiểm tra, ngày này đúng: Ngày vào' }));
    await userEvent.click(dialog().getByRole('button', { name: /Lưu nhân viên/ }));

    // Assert
    expect(saved(update)).toMatchObject({ joinedOn: '2025-01-06', joinedOnConfirmed: true, officialOnConfirmed: false, leftOnConfirmed: false });
  });

  it('should show a date already confirmed as ticked, with "Đã xác nhận"', async () => {
    // Act
    await openForm('Người Thử B');

    // Assert
    expect(dialog().getByRole<HTMLInputElement>('checkbox', { name: 'Đã kiểm tra, ngày này đúng: Ngày chính thức' }).checked).toBe(true);
    expect(dialog().getAllByText('Đã xác nhận')).toHaveLength(2);
  });
});

describe('what is sent for the three confirmations', () => {
  it('should never confirm a date that is empty', () => {
    // Act
    const flags = confirmsToSave({ joinedOn: '2025-01-06', officialOn: '', leftOn: '', joinedOnConfirmed: true, officialOnConfirmed: true, leftOnConfirmed: false });

    // Assert
    expect(flags).toEqual({ joinedOnConfirmed: true, officialOnConfirmed: false, leftOnConfirmed: false });
  });
});
