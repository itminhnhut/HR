import type { TimesheetLogLineDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { detailParts, LogTab } from './LogTab';

const line: TimesheetLogLineDto = { id: '1', actor: 'Lan', action: 'Sửa nhân viên', detail: 'A Người A: Bộ phận Sales → Kế toán; Ngày nghỉ việc trống → 30/11/2026', at: '2026-10-05T03:30:00.000Z', area: 'nhan-vien', periodMonth: null };
const onSheet: TimesheetLogLineDto = { id: '2', actor: 'Lan', action: 'Chấm công', detail: 'A Người A, 03/11: 1 → P', at: '2026-10-04T17:30:00.000Z', area: 'bang-cong', periodMonth: '2026-11' };

function Address() {
  return <output aria-label="địa chỉ">{useLocation().search}</output>;
}

function open(start = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}><LogTab /><Address /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const address = () => screen.getByLabelText('địa chỉ').textContent;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Nhật ký tab', () => {
  it('should show lines on the page, with who, the Vietnam time and each change apart', async () => {
    // Arrange
    vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [line], hasMore: false });

    // Act
    open();

    // Assert
    expect(await screen.findByText('Sửa nhân viên')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('A Người A')).toBeTruthy();
    expect(screen.getByText('Bộ phận Sales')).toBeTruthy();
    expect(screen.getByText('Kế toán')).toBeTruthy();
    expect(screen.getByText('30/11/2026')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();
    expect(screen.getByText('10:30')).toBeTruthy();
  });

  it('should put a line after 17:00 UTC on the next day in Vietnam, and name its period', async () => {
    // Arrange
    vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [onSheet], hasMore: false });

    // Act
    open();

    // Assert
    expect(await screen.findByText('05/10/2026')).toBeTruthy();
    expect(screen.getByText('Kỳ T11/2026')).toBeTruthy();
  });

  it('should say what a code on the sheet means', async () => {
    // Arrange
    const cell = { ...onSheet, detail: 'A Người A, 03/11: tự động → P/2' };
    vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [cell], hasMore: false });

    // Act
    open();

    // Assert
    expect(await screen.findByText('tự động')).toBeTruthy();
    expect(screen.getByText('P/2 (Nghỉ phép 0,5 ngày)')).toBeTruthy();
  });

  it('should keep the chosen tab in the address and read only that', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [line], hasMore: false });
    open();
    await screen.findByText('Sửa nhân viên');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Nhân viên' }));

    // Assert
    expect(address()).toBe('?nhom=nhan-vien');
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ area: 'nhan-vien', search: '', offset: 0 }));
  });

  it('should search what HR typed, after a short wait', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [], hasMore: false });
    open();

    // Act
    await userEvent.type(screen.getByLabelText('Tìm trong nhật ký'), 'TF7');

    // Assert
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ area: undefined, search: 'TF7', offset: 0 }));
    expect(address()).toBe('?tim=TF7');
    expect(await screen.findByText('Không có dòng nào khớp.')).toBeTruthy();
  });

  it('should drop the chosen tab on Tất cả, then search everything', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrTimesheetLog').mockResolvedValue({ lines: [], hasMore: false });
    open('/?nhom=bang-cong');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    await userEvent.type(screen.getByLabelText('Tìm trong nhật ký'), 'TF7');

    // Assert
    await waitFor(() => expect(address()).toBe('?tim=TF7'));
    expect(read).toHaveBeenLastCalledWith({ area: undefined, search: 'TF7', offset: 0 });
  });

  it('should read the next page on Xem thêm and keep the first', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrTimesheetLog').mockResolvedValueOnce({ lines: [line], hasMore: true }).mockResolvedValueOnce({ lines: [onSheet], hasMore: false });
    open();
    await screen.findByText('Sửa nhân viên');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));

    // Assert
    expect(await screen.findByText('Chấm công')).toBeTruthy();
    expect(screen.getByText('Sửa nhân viên')).toBeTruthy();
    expect(read).toHaveBeenLastCalledWith({ area: undefined, search: '', offset: 100 });
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('should leave a line without a person as it is', () => {
    // Act + Assert
    expect(detailParts('Kế toán')).toEqual({ subject: '', changes: [['Kế toán']] });
    expect(detailParts('Kế toán → Kho').changes).toEqual([['Kế toán', 'Kho']]);
  });
});
