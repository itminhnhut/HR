import type { DepartmentDto, EmployeeDto, EmployeeInput, StaffKindDto, TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PeopleTab } from './PeopleTab';

/** Khối (BO / KD) in Chấm công › Nhân viên: the column, the filter, the form field, its suggestion, the bulk change. Made-up people. */
const region: TimesheetRegionDto = { id: '11111111-1111-4111-8111-111111111111', name: 'HCM', saturdays: 2, tone: 'blue', employees: 3, hidden: false, saturdayChanges: [] };
const person = (id: string, fullName: string, over: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id, code: id, fullName, department: 'Kế toán', title: '', regionId: region.id, employment: 'official', staffKindId: null, joinedOn: '2025-01-06', officialOn: null, leftOn: null, openingLeave: 0,
  block: null, joinedOnConfirmed: false, officialOnConfirmed: false, leftOnConfirmed: false, ...over,
});
const PEOPLE = [person('A', 'Người Thử A', { block: 'BO' }), person('B', 'Người Thử B', { block: 'KD', department: 'Kinh doanh' }), person('C', 'Người Thử C', { department: 'Phòng Kinh Doanh 2' })];

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
const dialog = () => within(screen.getByRole('dialog'));
const saved = (spy: { mock: { calls: unknown[][] } }, call = 0) => spy.mock.calls[call]?.[1] as EmployeeInput;

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

describe('the Khối column and filter', () => {
  it('should show each block, and "Thiếu khối" on someone without one', async () => {
    // Act
    await screen.findByText('Người Thử A');

    // Assert
    expect(within(rowOf('Người Thử A')).getByText('BO')).toBeTruthy();
    expect(within(rowOf('Người Thử B')).getByText('KD')).toBeTruthy();
    expect(within(rowOf('Người Thử C')).getByText('Thiếu khối')).toBeTruthy();
  });

  it('should open the form of the person from the Khối cell', async () => {
    // Arrange
    await screen.findByText('Người Thử A');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa khối Người Thử C' }));

    // Assert
    expect(dialog().getByText('Sửa Người Thử C')).toBeTruthy();
  });

  it('should keep the people of one block, or those without a block', async () => {
    // Arrange
    await screen.findByText('Người Thử A');
    const filter = screen.getByRole('combobox', { name: 'Khối' });

    // Act + Assert
    await userEvent.selectOptions(filter, 'KD');
    expect(screen.queryByText('Người Thử A')).toBeNull();
    expect(screen.getByText('Người Thử B')).toBeTruthy();

    await userEvent.selectOptions(filter, 'none');
    expect(screen.queryByText('Người Thử B')).toBeNull();
    expect(screen.getByText('Người Thử C')).toBeTruthy();
  });
});

describe('the Khối field of the form', () => {
  it('should explain what the block is for', async () => {
    // Arrange
    await screen.findByText('Người Thử A');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Người Thử A' }));

    // Assert
    expect(dialog().getByText('Dùng để tính % KPI ở bảng lương: BO tự tính theo ngày công, KD do HR nhập')).toBeTruthy();
    expect((dialog().getByRole('combobox', { name: 'Khối' }) as HTMLSelectElement).value).toBe('BO');
  });

  it('should save the block HR picks for a person', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue(person('A', 'Người Thử A', { block: 'KD' }));
    await screen.findByText('Người Thử A');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Người Thử A' }));

    // Act
    await userEvent.selectOptions(dialog().getByRole('combobox', { name: 'Khối' }), 'KD');
    await userEvent.click(dialog().getByRole('button', { name: 'Lưu nhân viên' }));

    // Assert
    expect(saved(update).block).toBe('KD');
  });

  it('should only suggest a block for someone already on the list, and save none until HR takes it', async () => {
    // Arrange: C has no block, in a sales department
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue(person('C', 'Người Thử C'));
    await screen.findByText('Người Thử A');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Người Thử C' }));

    // Act: save without touching the block
    expect(dialog().getByText(/Gợi ý: KD — Kinh doanh/)).toBeTruthy();
    expect((dialog().getByRole('combobox', { name: 'Khối' }) as HTMLSelectElement).value).toBe('');
    await userEvent.click(dialog().getByRole('button', { name: 'Lưu nhân viên' }));

    // Assert
    expect(saved(update).block).toBeNull();
  });

  it('should take the suggestion when HR presses "Dùng gợi ý"', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockResolvedValue(person('C', 'Người Thử C', { block: 'KD' }));
    await screen.findByText('Người Thử A');
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Người Thử C' }));

    // Act
    await userEvent.click(dialog().getByRole('button', { name: 'Dùng gợi ý' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Lưu nhân viên' }));

    // Assert
    expect(saved(update).block).toBe('KD');
  });

  it('should prefill the block of a new person as a suggestion HR can change', async () => {
    // Arrange
    await screen.findByText('Người Thử A');

    // Act: no department yet, so BO is suggested
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    const field = dialog().getByRole('combobox', { name: 'Khối' }) as HTMLSelectElement;

    // Assert: a suggestion until HR picks
    expect(field.value).toBe('BO');
    expect(dialog().getByText(/Gợi ý theo bộ phận/)).toBeTruthy();
    await userEvent.selectOptions(field, 'KD');
    expect(field.value).toBe('KD');
    expect(dialog().queryByText(/Gợi ý theo bộ phận/)).toBeNull();
  });
});

describe('changing the block of several people', () => {
  it('should save each picked person with their own details and say how many were saved', async () => {
    // Arrange
    const update = vi.spyOn(api, 'hrUpdateEmployee').mockImplementation(async (id) => ({ ...person(id, `Người Thử ${id}`), block: 'KD' }));
    await screen.findByText('Người Thử A');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Người Thử A' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Người Thử C' }));

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Khối mới' }), 'KD');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi khối 2 người' }));

    // Assert
    expect(await screen.findByText('Đã lưu 2/2 người')).toBeTruthy();
    expect(update.mock.calls.map((c) => c[0])).toEqual(['A', 'C']);
    expect(saved(update, 1)).toMatchObject({ code: 'C', fullName: 'Người Thử C', department: 'Phòng Kinh Doanh 2', regionId: region.id, block: 'KD' });
  });

  it('should name in full who was not saved', async () => {
    // Arrange: the save of C fails
    vi.spyOn(api, 'hrUpdateEmployee').mockImplementation(async (id) => {
      if (id === 'C') throw new Error('x');
      return person(id, `Người Thử ${id}`);
    });
    await screen.findByText('Người Thử A');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả nhân viên đang hiện' }));

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Khối mới' }), 'BO');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi khối 3 người' }));

    // Assert
    expect(await screen.findByText('Đã lưu 2/3 người')).toBeTruthy();
    expect(screen.getByText(/Người Thử C: /)).toBeTruthy();
  });
});
