import type { RecruitmentLogLineDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { RecruitmentLog } from './RecruitmentLog';

const line = (over: Partial<RecruitmentLogLineDto> = {}): RecruitmentLogLineDto => ({
  id: 'l1',
  applicationId: 'a1',
  candidateName: 'Trần Văn Thử',
  jobTitle: 'Kế toán',
  isDeleted: false,
  group: 'trang-thai',
  action: 'Đổi trạng thái',
  actor: 'Lan',
  from: 'Đã xem',
  to: 'Hẹn phỏng vấn',
  detail: null,
  at: '2026-10-05T03:30:00.000Z',
  ...over,
});

function Address() {
  return <output aria-label="địa chỉ">{useLocation().search}</output>;
}

function open(start = '/hr/ho-so/nhat-ky') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}>
        <RecruitmentLog />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const address = () => screen.getByLabelText('địa chỉ').textContent;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Nhật ký tuyển dụng', () => {
  it('should show a line with what, whose application, old → new, who and the Vietnam time, on the page', async () => {
    // Arrange
    vi.spyOn(api, 'hrRecruitmentLog').mockResolvedValue({ lines: [line()], hasMore: false });

    // Act
    open();

    // Assert
    expect(await screen.findByText('Đổi trạng thái')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Đã xem')).toBeTruthy();
    expect(screen.getByText('Hẹn phỏng vấn')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();
    expect(screen.getByText('10:30')).toBeTruthy();
    expect(screen.getByText('05/10/2026')).toBeTruthy();
  });

  it('should open the application from its line', async () => {
    // Arrange
    vi.spyOn(api, 'hrRecruitmentLog').mockResolvedValue({ lines: [line()], hasMore: false });

    // Act
    open();

    // Assert
    const link = await screen.findByRole('link', { name: /Trần Văn Thử/ });
    expect(link.getAttribute('href')).toBe('/hr/ho-so?trang-thai=all&id=a1');
  });

  it('should say "Ứng viên đã xoá" with the job for a deleted application, without a link', async () => {
    // Arrange
    const gone = line({
      applicationId: null,
      candidateName: null,
      isDeleted: true,
      action: 'Xoá hồ sơ',
      group: 'ho-so',
    });
    vi.spyOn(api, 'hrRecruitmentLog').mockResolvedValue({ lines: [gone], hasMore: false });

    // Act
    open();

    // Assert
    expect(await screen.findByText('Ứng viên đã xoá (vị trí Kế toán)')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('should keep the chosen group in the address and read only that', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrRecruitmentLog').mockResolvedValue({ lines: [line()], hasMore: false });
    open();
    await screen.findByText('Đổi trạng thái');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Ghi chú' }));

    // Assert
    expect(address()).toBe('?nhom=ghi-chu');
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ group: 'ghi-chu', search: '', offset: 0 }));
  });

  it('should search what HR typed, after a short wait', async () => {
    // Arrange
    const read = vi.spyOn(api, 'hrRecruitmentLog').mockResolvedValue({ lines: [], hasMore: false });
    open();

    // Act
    await userEvent.type(screen.getByLabelText('Tìm trong nhật ký'), 'Thử');

    // Assert
    await waitFor(() => expect(read).toHaveBeenLastCalledWith({ group: undefined, search: 'Thử', offset: 0 }));
    expect(address()).toBe('?tim=Th%E1%BB%AD');
    expect(await screen.findByText('Không có dòng nào khớp.')).toBeTruthy();
  });

  it('should read the next page on Xem thêm and keep the first', async () => {
    // Arrange
    const read = vi
      .spyOn(api, 'hrRecruitmentLog')
      .mockResolvedValueOnce({ lines: [line()], hasMore: true })
      .mockResolvedValueOnce({ lines: [line({ id: 'l2', action: 'Thêm ghi chú', group: 'ghi-chu' })], hasMore: false });
    open();
    await screen.findByText('Đổi trạng thái');

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));

    // Assert
    expect(await screen.findByText('Thêm ghi chú')).toBeTruthy();
    expect(screen.getByText('Đổi trạng thái')).toBeTruthy();
    expect(read).toHaveBeenLastCalledWith({ group: undefined, search: '', offset: 100 });
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });
});
