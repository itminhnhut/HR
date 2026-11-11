import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { address, ME, month, open } from './payrollTestData';
import { answerReads } from './profiles/profileTestData';

/** The Lương shell and its Bảng lương tab (spec 11.1, 11.2, 4.1, 4.17). Cases: docs/test-cases-luong.md, L-H03, L-L05–L-L07, L-L14. */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('who may open Lương', () => {
  it('L-H03: should say "Không có quyền" and ask for no number when the HR has no payroll right', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue({ ...ME, canPayroll: false, canApprovePayroll: false });
    const asked = spyOnApi('hrPayrollMonth').mockResolvedValue(month());

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await screen.findByText('Không có quyền xem lương')).toBeTruthy();
    expect(asked).not.toHaveBeenCalled();
    expect(screen.queryByText('NV A')).toBeNull();
  });
});

describe('the period', () => {
  it('L-L05: should open the current period on every tab when the address names none', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    const asked = spyOnApi('hrPayrollMonth').mockResolvedValue(
      month({ year: 2026, month: 11, monthKey: '2026-11', status: 'waiting', lines: [] }),
    );
    spyOnApi('hrPayrollProfiles').mockResolvedValue({ people: [], missing: [] });

    // Act
    open('/hr/luong/ho-so');

    // Assert
    expect(await screen.findByRole('button', { name: /Kỳ lương T11\/2026/ })).toBeTruthy();
    expect(asked).toHaveBeenCalledWith(2026, 11);
    expect(await screen.findByRole('region', { name: 'Hồ sơ lương' })).toBeTruthy();
  });

  it('L-L05: should put a new period in the address and keep it when changing tab', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Tháng sau' }));
    fireEvent.click(screen.getByRole('link', { name: /Nhật ký/ }));

    // Assert
    await waitFor(() => expect(address()).toBe('/hr/luong/nhat-ky?ky=2026-11'));
  });
});

describe('the shared filters', () => {
  it('L-L06: should keep the search in the address and say when no row matches, with a button to clear it', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10&tim=zzz');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá tìm' }));

    // Assert
    expect(address()).toBe('/hr/luong?ky=2026-10');
  });

  it('L-L06: should write each filter into the address as it is picked', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.change(await screen.findByRole('textbox', { name: 'Tìm nhân viên' }), { target: { value: 'NV J' } });

    // Assert
    await waitFor(() => expect(address()).toBe('/hr/luong?ky=2026-10&tim=NV+J'));
    expect(screen.getByText('Đang xem 1/2 người')).toBeTruthy();
  });
});

describe('a period that cannot show a payroll', () => {
  it('L-L07: should say what a period looks like for a wrong one, without asking for any month', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    const asked = spyOnApi('hrPayrollMonth').mockResolvedValue(month());

    // Act
    open('/hr/luong?ky=abc');

    // Assert
    expect(await screen.findByText('Kỳ “abc” không đúng dạng. Kỳ ghi dạng 2026-11 (năm-tháng).')).toBeTruthy();
    expect(asked).not.toHaveBeenCalled();
  });

  it('L-L07: should pass on the range the server gives for a month out of it', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockRejectedValue(new ApiError(404, 'Có bảng lương từ T10/2026 đến T11/2027.'));

    // Act
    open('/hr/luong?ky=2019-01');

    // Assert
    expect(await screen.findByText('Có bảng lương từ T10/2026 đến T11/2027.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về kỳ này' }).getAttribute('href')).toBe('/hr/luong');
  });

  it('L-L07: should say a running period waits for the timesheet close', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(
      month({
        year: 2026,
        month: 11,
        monthKey: '2026-11',
        period: { from: '2026-10-26', to: '2026-11-25' },
        status: 'waiting',
        lines: [],
      }),
    );

    // Act
    open('/hr/luong?ky=2026-11');

    // Assert
    // F14: nothing to type in yet, so the banner says the next step and links to the timesheet of that period.
    expect(await screen.findByText(/Kỳ công 26\/10 – 25\/11 chưa chốt\. Bước tiếp: vào Chấm công/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mở Chấm công kỳ này ›' }).getAttribute('href')).toBe(
      '/hr/cham-cong?ky=2026-11',
    );
    expect(screen.getByText('Chưa có bảng lương vì kỳ công chưa chốt.')).toBeTruthy();
    expect(screen.queryByText(/gõ trước KPI/)).toBeNull();
  });

  it('L-L07: should call a month still ahead "Dự tính"', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(
      month({
        year: 2027,
        month: 1,
        monthKey: '2027-01',
        period: { from: '2026-12-26', to: '2027-01-25' },
        status: 'waiting',
        lines: [],
      }),
    );

    // Act
    open('/hr/luong?ky=2027-01');

    // Assert
    expect(await screen.findByText(/Dự tính/)).toBeTruthy();
  });
});

describe('the counts under the grid', () => {
  it('L-L14: should count typed cells and people with own settings, and filter to them on a click', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: '1 ô gõ đè' }));

    // Assert
    expect(screen.getByRole('button', { name: '1 người có cấu hình riêng' })).toBeTruthy();
    expect(await screen.findByText('Đang xem 1/2 người')).toBeTruthy();
    expect(address()).toContain('loc=go-de');
  });
});

describe('a group A cell', () => {
  it("should open the person's Hồ sơ lương over Bảng lương, and give the grid back when closed", async () => {
    // Arrange: the address a click on (8) writes (PayrollCell.test checks the link itself)
    answerReads();
    open('/hr/luong?ky=2026-10&kv=hcm&hs=nv-a&phan=muc');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText(/Mức lương/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bảng lương/, hidden: true }).getAttribute('aria-current')).toBe('page');
    const grid = document.querySelector('[data-payroll-grid]');
    expect(grid).toBeTruthy();

    // Act
    fireEvent.keyDown(drawer, { key: 'Escape' });

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(address()).toBe('/hr/luong?ky=2026-10&kv=hcm');
    expect(document.querySelector('[data-payroll-grid]')).toBe(grid);
  });
});
