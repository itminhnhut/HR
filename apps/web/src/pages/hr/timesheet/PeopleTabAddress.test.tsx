import type { DepartmentDto, EmployeeDto, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PeopleTab } from './PeopleTab';
import { NO_BLOCK, START_FILTERS, startFiltersOf } from './peopleFilters';

/** Links from Lương land here: `?nv=<id>` opens that person's form, `?khoi=none` shows the people without a block. */

const region: TimesheetRegionDto = { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] };
const person = (id: string, fullName: string, block: string | null): EmployeeDto => ({ id, code: id, fullName, department: 'Sales', title: '', regionId: 'r1', employment: 'official', staffKindId: null, joinedOn: '2020-01-01', officialOn: null, leftOn: null, openingLeave: 0, block }) as EmployeeDto;

function Address() {
  const { search } = useLocation();
  return <output aria-label="địa chỉ">{search}</output>;
}

function open(start: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}><TooltipProvider><PeopleTab /></TooltipProvider><Address /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue([person('A', 'Người A', 'BO'), person('B', 'Người B', null), { ...person('C', 'Người C', null), leftOn: '2020-01-31' }]);
  vi.spyOn(api, 'hrRegions').mockResolvedValue([region]);
  vi.spyOn(api, 'hrDepartments').mockResolvedValue([] as DepartmentDto[]);
  vi.spyOn(api, 'hrStaffKinds').mockResolvedValue([] as StaffKindDto[]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('startFiltersOf', () => {
  it('should start on the usual filters when the address asks for nothing', () => {
    expect(startFiltersOf(new URLSearchParams(''))).toEqual(START_FILTERS);
  });

  it('should preset "Thiếu khối" for ?khoi=none and a block for ?khoi=KD', () => {
    expect(startFiltersOf(new URLSearchParams('khoi=none')).block).toBe(NO_BLOCK);
    expect(startFiltersOf(new URLSearchParams('khoi=KD')).block).toBe('KD');
  });

  it('should ignore a block the list does not know', () => {
    expect(startFiltersOf(new URLSearchParams('khoi=xyz'))).toEqual(START_FILTERS);
  });
});

describe('the staff list opened from a link', () => {
  it('should open the edit form of the person in ?nv=', async () => {
    // Act
    open('/hr/cham-cong/nhan-vien?nv=B');

    // Assert
    expect(await screen.findByRole('dialog', { name: 'Sửa Người B' })).toBeTruthy();
  });

  it('should open the form of a person who left, though the list hides them', async () => {
    // Act
    open('/hr/cham-cong/nhan-vien?nv=C');

    // Assert
    expect(await screen.findByRole('dialog', { name: 'Sửa Người C' })).toBeTruthy();
  });

  it('should drop ?nv= on Huỷ so the form does not come back', async () => {
    // Arrange
    open('/hr/cham-cong/nhan-vien?nv=B&khoi=none');
    await screen.findByRole('dialog', { name: 'Sửa Người B' });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByLabelText('địa chỉ').textContent).toBe('?khoi=none');
  });

  it('should open no form for a person the list does not have', async () => {
    // Act
    open('/hr/cham-cong/nhan-vien?nv=khong-co');

    // Assert
    await screen.findByText('Người A');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should show only the people without a block for ?khoi=none', async () => {
    // Act
    open('/hr/cham-cong/nhan-vien?khoi=none');

    // Assert
    await screen.findByText('Người B');
    expect(screen.queryByText('Người A')).toBeNull();
  });
});
