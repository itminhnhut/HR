import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayrollLogLineDto, PayrollLogPageDto } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { address, ME, month, open } from '../payrollTestData';
import { LIST } from '../profiles/profileTestData';

/**
 * The Nhật ký tab of Lương (spec 4.1, 4.2, 4.4, 11.9, step 22). Cases: docs/test-cases-luong.md L-I09, L-L06, L-L11,
 * L-L15. Made-up people and amounts.
 */

const line = (over: Partial<PayrollLogLineDto> = {}): PayrollLogLineDto => ({
  id: '1',
  area: 'ho-so',
  actor: 'Lan',
  action: 'Sửa',
  detail: 'Sửa hồ sơ của NV01 NV A, từ 01/10/2026: Tiền cơm 1.100.000 → 1.150.000',
  month: '2026-10',
  at: '2026-11-05T03:30:00.000Z',
  ...over,
});

const page = (lines: PayrollLogLineDto[], over: Partial<PayrollLogPageDto> = {}): PayrollLogPageDto => ({
  lines,
  hasMore: false,
  actors: ['Lan', 'Minh'],
  ...over,
});

function answer(first: PayrollLogPageDto = page([line()])) {
  spyOnApi('hrMe').mockResolvedValue(ME);
  spyOnApi('hrPayrollMonth').mockResolvedValue(month());
  spyOnApi('hrPayrollProfiles').mockResolvedValue(LIST);
  return spyOnApi('hrPayrollLog').mockResolvedValue(first);
}

const lastAsked = (asked: ReturnType<typeof answer>) => asked.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('what the Nhật ký tab asks for', () => {
  it('L-I09: should ask for the current pay month when the address names no filter', async () => {
    // Arrange
    const asked = answer();

    // Act
    open('/hr/luong/nhat-ky');

    // Assert
    expect(await screen.findByText('Tiền cơm 1.100.000')).toBeTruthy();
    expect(asked).toHaveBeenCalledWith({ month: '2026-11', offset: 0 });
    expect(screen.getByRole('button', { name: /Kỳ lương T11\/2026/ })).toBeTruthy();
  });

  it('should ask for the pay month of the address', async () => {
    // Arrange
    const asked = answer();

    // Act
    open('/hr/luong/nhat-ky?ky=2026-10');

    // Assert
    await screen.findByText('Tiền cơm 1.100.000');
    expect(asked).toHaveBeenCalledWith({ month: '2026-10', offset: 0 });
  });

  it('should ask for every month after "Tất cả các kỳ", and for one month again once a month is stepped to', async () => {
    // Arrange
    const asked = answer();
    open('/hr/luong/nhat-ky?ky=2026-10');
    await screen.findByText('Tiền cơm 1.100.000');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả các kỳ' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ offset: 0 }));
    expect(address()).toContain('moi-ky=1');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ month: '2026-11', offset: 0 }));
    expect(address()).not.toContain('moi-ky');
  });

  it('L-I09: should ask for one group, and for the approval steps alone', async () => {
    // Arrange
    const asked = answer();
    open('/hr/luong/nhat-ky');
    const groups = within(await screen.findByRole('group', { name: 'Lọc theo nhóm' }));

    // Act
    fireEvent.click(groups.getByRole('button', { name: 'Hồ sơ lương' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ area: 'ho-so', month: '2026-11', offset: 0 }));
    expect(address()).toContain('nhom=ho-so');

    // Act
    fireEvent.click(groups.getByRole('button', { name: 'Duyệt, chuyển khoản' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ isApprovalOnly: true, month: '2026-11', offset: 0 }));
    expect(groups.getByRole('button', { name: 'Duyệt, chuyển khoản' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('L-L06: should ask for one person and for one HR, and keep both in the address', async () => {
    // Arrange
    const asked = answer();
    open('/hr/luong/nhat-ky');
    await screen.findByText('Tiền cơm 1.100.000');

    // Act: the popover picker of Bảng lương, where a name is never cut.
    fireEvent.click(screen.getByRole('button', { name: 'Lọc Nhân viên' }));
    fireEvent.click(await screen.findByRole('option', { name: 'NV10 · NV J' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Người làm' }), { target: { value: 'Minh' } });

    // Assert
    await waitFor(() =>
      expect(lastAsked(asked)).toEqual({ personCode: 'NV10', actor: 'Minh', month: '2026-11', offset: 0 }),
    );
    expect(address()).toContain('ma=NV10');
    expect(address()).toContain('ai=Minh');
  });

  it('L-I09: should ask for the words typed, a moment after typing stops', async () => {
    // Arrange
    const asked = answer();
    open('/hr/luong/nhat-ky');
    await screen.findByText('Tiền cơm 1.100.000');

    // Act
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm trong nhật ký' }), { target: { value: 'cơm ' } });

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ search: 'cơm', month: '2026-11', offset: 0 }));
    expect(new URLSearchParams(address().split('?')[1]).get('tim')).toBe('cơm');
  });

  it('L-L06: should drop every filter with "Xoá lọc" and keep the pay month', async () => {
    // Arrange
    const asked = answer();
    open('/hr/luong/nhat-ky?ky=2026-10&nhom=cau-hinh&ma=NV01&ai=Lan&tim=c%C6%A1m&moi-ky=1');
    await screen.findByText('Tiền cơm 1.100.000');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Xoá lọc' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ month: '2026-10', offset: 0 }));
    expect(address()).toBe('/hr/luong/nhat-ky?ky=2026-10');
    expect(screen.queryByRole('button', { name: 'Xoá lọc' })).toBeNull();
  });
});

describe('a line of the Nhật ký tab', () => {
  it('L-L15: should say what was done, by whom and when, old and new apart, on the page itself', async () => {
    // Arrange
    answer();

    // Act
    open('/hr/luong/nhat-ky');

    // Assert
    const item = within((await screen.findByText('Tiền cơm 1.100.000')).closest('li') ?? document.body);
    expect(item.getByText('Sửa')).toBeTruthy();
    expect(item.getByText('Hồ sơ lương')).toBeTruthy();
    expect(item.getByText('1.150.000')).toBeTruthy();
    expect(item.getByText('Lan')).toBeTruthy();
    expect(item.getByText('10:30')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '05/11/2026' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('L-L11: should link the person to their Hồ sơ lương and the month to its Bảng lương', async () => {
    // Arrange
    answer();

    // Act
    open('/hr/luong/nhat-ky');

    // Assert
    const person = await screen.findByRole('link', { name: 'Hồ sơ lương của NV01 NV A' });
    expect(person.getAttribute('href')).toBe('/hr/luong/ho-so?ky=2026-11&hs=nv-a&phan=muc');
    const sheet = screen.getByRole('link', { name: 'Bảng lương T10/2026' });
    expect(sheet.getAttribute('href')).toBe('/hr/luong?ky=2026-10');
  });

  it('L-L11: should link a typed cell to its sources and a setting to Cấu hình', async () => {
    // Arrange
    const typed = line({
      id: '2',
      area: 'bang-luong',
      action: 'Sửa đầu vào tháng',
      detail: 'NV10 NV J: % KPI trống → 0%',
    });
    const setting = line({
      id: '3',
      area: 'cau-hinh',
      action: 'Thêm',
      detail: 'Thêm khoan.com.thue cho NV01 NV A: chịu thuế, từ T10/2026',
    });
    answer(page([typed, setting]));

    // Act
    open('/hr/luong/nhat-ky');

    // Assert
    const cell = await screen.findByRole('link', { name: 'Ô % KPI' });
    expect(cell.getAttribute('href')).toBe('/hr/luong?ky=2026-10&tinh=kpiPercent&nguoi=nv-j');
    const config = screen.getByRole('link', { name: 'Cấu hình: khoan.com.thue' });
    expect(config.getAttribute('href')).toBe('/hr/luong/cau-hinh?ky=2026-10&khoa=khoan.com.thue');
  });
});

describe('the length and the states of the Nhật ký tab', () => {
  it('L-I09: should bring the next hundred lines with "Xem thêm", under the ones already shown', async () => {
    // Arrange
    const asked = answer(page([line()], { hasMore: true }));
    open('/hr/luong/nhat-ky');
    await screen.findByText('Tiền cơm 1.100.000');
    asked.mockResolvedValue(page([line({ id: '9', detail: 'Xoá mức của NV10 NV J, từ 01/09/2026: Lương 9.000.000' })]));

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));

    // Assert
    expect(await screen.findByText('Lương 9.000.000')).toBeTruthy();
    expect(screen.getByText('Tiền cơm 1.100.000')).toBeTruthy();
    expect(lastAsked(asked)).toEqual({ month: '2026-11', offset: 100 });
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('should offer every month when the pay month has no line yet', async () => {
    // Arrange
    const asked = answer(page([]));
    open('/hr/luong/nhat-ky');
    expect(await screen.findByText('Chưa có thay đổi nào trong kỳ T11/2026.')).toBeTruthy();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Xem tất cả các kỳ' }));

    // Assert
    await waitFor(() => expect(lastAsked(asked)).toEqual({ offset: 0 }));
    expect(await screen.findByText('Chưa có thay đổi nào.')).toBeTruthy();
  });

  it('L-L06: should say nothing matches the filters, with a way to drop them', async () => {
    // Arrange
    answer(page([]));

    // Act
    open('/hr/luong/nhat-ky?nhom=quyen');

    // Assert
    expect(await screen.findByText('Không có dòng nào khớp.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Xoá lọc' }).length).toBeGreaterThan(0);
  });

  it('should say the log could not be read and try again on "Tải lại"', async () => {
    // Arrange
    const asked = answer();
    asked.mockRejectedValueOnce(new Error('Mất mạng'));
    open('/hr/luong/nhat-ky');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Tải lại' }));

    // Assert
    expect(await screen.findByText('Tiền cơm 1.100.000')).toBeTruthy();
    expect(asked).toHaveBeenCalledTimes(2);
  });
});
