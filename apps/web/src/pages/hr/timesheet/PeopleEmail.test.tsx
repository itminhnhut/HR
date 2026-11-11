import type { DepartmentDto, EmployeeDto, EmployeeInput, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PeopleTab } from './PeopleTab';

/** Email nhận phiếu lương: a field of the person form and a column of the list. Made-up people. */
const region: TimesheetRegionDto = { id: '11111111-1111-4111-8111-111111111111', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] };
const person = (id: string, fullName: string, over: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id, code: id, fullName, department: 'Kế toán', title: '', regionId: region.id, employment: 'official', staffKindId: null, joinedOn: '2025-01-06', officialOn: null, leftOn: null, openingLeave: 0,
  email: null, block: 'BO', joinedOnConfirmed: false, officialOnConfirmed: false, leftOnConfirmed: false, ...over,
});
const PEOPLE = [person('A', 'Người Thử A'), person('B', 'Người Thử B', { email: 'b@example.com' })];

const dialog = () => within(screen.getByRole('dialog'));
const saved = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls[0]?.[1] as EmployeeInput;

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

describe('email nhận phiếu lương in Nhân viên', () => {
  it('should show the address in the list, and "Thiếu email" for someone without one', async () => {
    // Assert
    expect(await screen.findByText('b@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm email Người Thử A' }).textContent).toBe('Thiếu email');
  });

  it('should send the typed address when HR saves the form opened from "Thiếu email"', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue(person('A', 'Người Thử A', { email: 'a@example.com' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm email Người Thử A' }));

    // Act
    await userEvent.type(dialog().getByRole('textbox', { name: 'Email nhận phiếu lương' }), 'a@example.com');
    await userEvent.click(dialog().getByRole('button', { name: /Lưu nhân viên/ }));

    // Assert
    expect(saved(update).email).toBe('a@example.com');
  });

  it('should send no address when HR empties the field', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue(person('B', 'Người Thử B'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa Người Thử B' }));

    // Act
    await userEvent.clear(dialog().getByRole('textbox', { name: 'Email nhận phiếu lương' }));
    await userEvent.click(dialog().getByRole('button', { name: /Lưu nhân viên/ }));

    // Assert
    expect(saved(update).email).toBeNull();
  });
});
