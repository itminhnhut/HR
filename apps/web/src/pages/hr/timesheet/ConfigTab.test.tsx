import { todayInVietnam } from '@careers/shared';
import type { DepartmentDto, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { ConfigTab } from './ConfigTab';

const sales: DepartmentDto = { id: 'd1', name: 'Sales', employees: 2 };
const empty: DepartmentDto = { id: 'd2', name: 'Kho', employees: 0 };
const official: StaffKindDto = { id: 'k1', name: 'Chính thức', rule: 'official', isDefault: true, employees: 3 };
const region: TimesheetRegionDto = { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 3, hidden: false, saturdayChanges: [{ from: '2099-01', saturdays: 4 }] };

function open(section: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/hr/cham-cong/cau-hinh?muc=${section}`]}><ConfigTab /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, 'hrDepartments').mockResolvedValue([empty, sales]);
  vi.spyOn(api, 'hrStaffKinds').mockResolvedValue([official]);
  vi.spyOn(api, 'hrRegions').mockResolvedValue([region]);
  vi.spyOn(api, 'hrAbsenceKinds').mockResolvedValue([]);
  vi.spyOn(api, 'hrApprovers').mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Cấu hình tab', () => {
  it('should read a newly added department back from the server, so the filters see it too', async () => {
    // Arrange
    open('bo-phan');
    const list = api.hrDepartments as ReturnType<typeof vi.fn>;
    const add = vi.spyOn(api, 'hrAddDepartment').mockResolvedValue([empty, sales]);
    await screen.findByText('Sales');
    const readsBefore = list.mock.calls.length;

    // Act
    await userEvent.type(screen.getByLabelText('Tên bộ phận'), 'Kế toán');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm bộ phận' }));

    // Assert
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(readsBefore));
    expect(add.mock.calls[0]?.[0]).toEqual({ name: 'Kế toán' });
  });

  it('should only let HR remove a department with nobody in it', async () => {
    // Act
    open('bo-phan');
    await screen.findByText('Sales');

    // Assert
    expect((screen.getByRole('button', { name: 'Xoá Sales' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Xoá Kho' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('should show a region with its people and the Saturdays planned ahead', async () => {
    // Act
    open('khu-vuc');
    const name = await screen.findByText('HCM');
    const row = within(name.closest('li') as HTMLElement);

    // Assert
    expect(row.getByText('3 nhân viên')).toBeTruthy();
    expect(row.getByText(/\+2 thứ Bảy · từ T1\/2099: \+4/)).toBeTruthy();
  });

  it('should ask which month the Saturdays change from only when editing a region', async () => {
    // Arrange
    open('khu-vuc');
    await screen.findByText('HCM');
    expect(screen.queryByLabelText('Số thứ Bảy áp dụng từ')).toBeNull();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa HCM' }));

    // Assert
    expect(screen.getByLabelText('Số thứ Bảy áp dụng từ')).toBeTruthy();
    expect((screen.getByPlaceholderText('vd: Đà Nẵng') as HTMLInputElement).value).toBe('HCM');
  });
});

describe('the holiday section count (TC-CH-01)', () => {
  it('should count this year\'s holidays as the list shows them, a long break once', async () => {
    // Arrange: Tết over three days and one single day this year, one day last year
    const year = Number(todayInVietnam().slice(0, 4));
    vi.spyOn(api, 'hrHolidays').mockResolvedValue([
      { day: `${year}-02-16`, name: 'Tết' },
      { day: `${year}-02-17`, name: 'Tết' },
      { day: `${year}-02-18`, name: 'Tết' },
      { day: `${year}-09-02`, name: 'Quốc khánh' },
      { day: `${year - 1}-09-02`, name: 'Quốc khánh' },
    ]);

    // Act
    open('bo-phan');

    // Assert
    const link = await screen.findByRole('button', { name: /Ngày lễ, Tết/ });
    await waitFor(() => expect(link.textContent).toContain('2'));
  });
});

