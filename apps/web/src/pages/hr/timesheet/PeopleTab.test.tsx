import type { DepartmentDto, EmployeeDto, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PeopleTab } from './PeopleTab';

const region: TimesheetRegionDto = { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] };
const person = (id: string, fullName: string): EmployeeDto => ({ id, code: id, fullName, department: 'Sales', title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 }) as EmployeeDto;

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const isPicked = (name: string) => rowOf(name).hasAttribute('data-picked');

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([person('A', 'Người A'), person('B', 'Người B')]);
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

describe('picking a person in the staff table', () => {
  it('should mark nobody until HR clicks', async () => {
    // Act
    await screen.findByText('Người A');

    // Assert
    expect(isPicked('Người A')).toBe(false);
    expect(isPicked('Người B')).toBe(false);
  });

  it('should mark the whole row clicked, and move when another is clicked', async () => {
    // Arrange
    await screen.findByText('Người A');

    // Act + Assert
    await userEvent.click(screen.getByText('Người A'));
    expect(isPicked('Người A')).toBe(true);

    await userEvent.click(screen.getByText('Người B'));
    expect(isPicked('Người A')).toBe(false);
    expect(isPicked('Người B')).toBe(true);
  });
});
