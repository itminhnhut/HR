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
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([person('A', 'Người A'), person('B', 'Người B'), { ...person('C', 'Người C'), leftOn: '2020-01-31' }]);
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

describe('searching and filtering the staff table', () => {
  it('should keep only the people whose name matches, typed without tones', async () => {
    // Arrange
    await screen.findByText('Người A');

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhân viên' }), 'nguoi b');

    // Assert
    expect(screen.queryByText('Người A')).toBeNull();
    expect(screen.getByText('Người B')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Xoá lọc \(1\)/ })).toBeTruthy();
  });

  it('should say nothing matches, and bring everyone back on Xoá lọc', async () => {
    // Arrange
    await screen.findByText('Người A');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhân viên' }), 'không ai');

    // Act + Assert
    expect(screen.getByText('Không có nhân viên phù hợp.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Xoá lọc/ }));
    expect(screen.getByText('Người A')).toBeTruthy();
    expect(screen.getByText('Người B')).toBeTruthy();
  });

  it('should hide those who left when HR picks Đang làm', async () => {
    // Arrange
    await screen.findByText('Người A');

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái' }), 'working');

    // Assert
    expect(screen.queryByText('Người C')).toBeNull();
    expect(screen.getByText('Người A')).toBeTruthy();
  });
});
