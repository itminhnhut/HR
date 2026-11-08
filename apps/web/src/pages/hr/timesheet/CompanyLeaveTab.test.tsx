import { todayInVietnam, type AbsenceBatchDto, type AbsenceKindDto, type EmployeeDto, type TimesheetRegionDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { CompanyLeaveTab } from './CompanyLeaveTab';
import { leaveApi } from './leaveApi';

const REGIONS: TimesheetRegionDto[] = [
  { id: 'r1', name: 'HCM', saturdays: 2, tone: 'blue', employees: 2, hidden: false, saturdayChanges: [] },
  { id: 'r2', name: 'HN', saturdays: 4, tone: 'rose', employees: 1, hidden: false, saturdayChanges: [] },
];
const personOf = (id: string, regionId: string, department: string) => ({ id, code: id.toUpperCase(), fullName: `Người ${id.toUpperCase()}`, department, title: '', regionId, employment: 'official', staffKindId: null, joinedOn: null, officialOn: null, leftOn: null, openingLeave: 0 }) as EmployeeDto;
const PEOPLE = [personOf('a', 'r1', 'Sales'), personOf('b', 'r2', 'Sales'), personOf('c', 'r1', 'Kế toán')];
const KINDS: AbsenceKindDto[] = [
  { key: 'other-paid', name: 'Nghỉ có lương khác', code: 'CL', days: null, isOwn: false, needsPaper: false },
  { key: 'late', name: 'Đi muộn, về sớm', code: 'M', days: null, isOwn: false, needsPaper: false },
];
const today = todayInVietnam();
const BATCH: AbsenceBatchDto = {
  id: 'b1', name: 'Tết thêm', reason: 'other-paid', label: 'Nghỉ có lương khác', code: 'CL', from: today, to: today, approvedBy: 'HR', note: '',
  audience: { kind: 'all' }, employeeIds: ['a', 'b', 'c'], version: 3, createdBy: 'Lan', createdAt: '2026-11-01T00:00:00.000Z',
};

function open(link = '/hr/cham-cong/nghi-cong-ty') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[link]}><TooltipProvider><CompanyLeaveTab /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.spyOn(api, 'hrEmployees').mockResolvedValue(PEOPLE);
  vi.spyOn(api, 'hrRegions').mockResolvedValue(REGIONS);
  vi.spyOn(api, 'hrApprovers').mockResolvedValue([]);
  vi.spyOn(api, 'hrAbsenceKinds').mockResolvedValue(KINDS);
  vi.spyOn(leaveApi, 'batches').mockResolvedValue([BATCH]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Nghỉ công ty tab', () => {
  it('should say public holidays already apply to everyone, with a link to them', async () => {
    // Act
    open();

    // Assert
    const link = await screen.findByRole('link', { name: 'Cấu hình → Ngày lễ' });
    expect(link.getAttribute('href')).toBe('/hr/cham-cong/cau-hinh?muc=ngay-le');
  });

  it('should save a company day off for everyone at work, saying how many it comes to', async () => {
    // Arrange
    const created = vi.spyOn(leaveApi, 'createBatch').mockResolvedValue({ ...BATCH, id: 'b2', name: 'Nghỉ thêm', skipped: [] });
    open();

    // Act
    await userEvent.type(await screen.findByRole('textbox', { name: 'Tên đợt' }), 'Nghỉ thêm');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu đợt nghỉ' }));

    // Assert
    expect(screen.getByText('Áp dụng cho 3 người')).toBeTruthy();
    await vi.waitFor(() => expect(created).toHaveBeenCalled());
    expect(created.mock.calls[0]?.[0]).toMatchObject({ name: 'Nghỉ thêm', reason: 'other-paid', code: 'CL', from: today, to: today, approvedBy: 'HR', audience: { kind: 'all' } });
    expect(await screen.findByText('Đã lưu "Nghỉ thêm" cho 3 người.')).toBeTruthy();
  });

  it('should pick people by region, and show who and why when one of them cannot be saved', async () => {
    // Arrange
    const created = vi.spyOn(leaveApi, 'createBatch').mockRejectedValue(new ApiError(409, 'B Người B: Trùng với Nghỉ phép năm 10/11–10/11.', {}, 'absence_overlap', { employeeId: 'b' }));
    open();
    await userEvent.type(await screen.findByRole('textbox', { name: 'Tên đợt' }), 'Nghỉ thêm');

    // Act
    await userEvent.click(screen.getByRole('radio', { name: 'Theo khu vực' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'HN' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu đợt nghỉ' }));

    // Assert
    expect(created.mock.calls[0]?.[0].audience).toEqual({ kind: 'region', regionIds: ['r2'] });
    expect((await screen.findByRole('alert')).textContent).toBe('B Người B: Trùng với Nghỉ phép năm 10/11–10/11. Không ai được lưu.');
  });

  it('should list each batch with its days, name, people, counting and approver, and edit it with its version', async () => {
    // Arrange
    const updated = vi.spyOn(leaveApi, 'updateBatch').mockResolvedValue({ ...BATCH, version: 4, skipped: [] });
    open();
    const row = (await screen.findByText('Tết thêm')).closest('tr');
    if (!row) throw new Error('no row');

    // Act
    await userEvent.click(within(row).getByRole('button', { name: 'Sửa Tết thêm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    // Assert
    expect(within(row).getByText('3 người')).toBeTruthy();
    expect(within(row).getByText('Có lương, không trừ phép')).toBeTruthy();
    expect(within(row).getByText('HR')).toBeTruthy();
    await vi.waitFor(() => expect(updated).toHaveBeenCalled());
    expect(updated.mock.calls[0]?.[0]).toBe('b1');
    expect(updated.mock.calls[0]?.[1]).toMatchObject({ name: 'Tết thêm', version: 3, audience: { kind: 'all' } });
  });

  it('should delete a batch only after HR confirms', async () => {
    // Arrange
    const removed = vi.spyOn(leaveApi, 'removeBatch').mockResolvedValue({ removed: 3 });
    open();

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Xoá Tết thêm' }));
    const dialog = await screen.findByRole('dialog');
    const asked = dialog.textContent;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xoá đợt này' }));

    // Assert
    expect(asked).toMatch(/Huỷ nghỉ của 3 người/);
    await vi.waitFor(() => expect(removed).toHaveBeenCalledWith('b1'));
  });
});
