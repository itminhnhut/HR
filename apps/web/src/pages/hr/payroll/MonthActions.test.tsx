import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PayrollMonthDto } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { address, ME, month, open, person } from './payrollTestData';

/** Month status, Duyệt, Mở lại, Đã chuyển khoản and Rà soát (spec 11.2–11.4). Cases: L-E01–L-E09, L-L19, L-M01–L-M05. */

const RED = {
  level: 'red',
  code: 'closing-unconfirmed',
  employeeId: null,
  cell: null,
  message: 'Tháng đầu trên web: xác nhận lại lần chốt kỳ công',
} as const;
const YELLOW = {
  level: 'yellow',
  code: 'override-differs',
  employeeId: 'nv-j',
  cell: 'kpiPercent',
  message: '% KPI gõ 0% khác số tính 53,18%',
} as const;
const APPROVED: Partial<PayrollMonthDto> = {
  status: 'approved',
  approval: { no: 1, at: '2026-11-05T09:20:00.000Z', by: 'Phòng Nhân sự' },
};

const header = () => screen.getByRole('region', { name: 'Trạng thái tháng' });
const button = (name: RegExp | string) => within(header()).queryByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the month status and its buttons', () => {
  it('L-E01: should show Nháp with only Duyệt on a draft', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await screen.findByText(/^Nháp · tính lúc/)).toBeTruthy();
    expect(screen.getByText('Chi trả 05/11/2026')).toBeTruthy();
    expect((button('Duyệt') as HTMLButtonElement).disabled).toBe(false);
    expect(button('Mở lại')).toBeNull();
    expect(button('Đã chuyển khoản')).toBeNull();
  });

  it('L-M03, L-M05: should show Đã duyệt lần N with Mở lại and Đã chuyển khoản on an approved month', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month(APPROVED));

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await screen.findByText('Đã duyệt lần 1 · 16:20 05/11 · bởi Phòng Nhân sự')).toBeTruthy();
    expect(button('Duyệt')).toBeNull();
    expect(button('Mở lại')).toBeTruthy();
    expect(button('Đã chuyển khoản')).toBeTruthy();
  });

  it('L-E08: should show Đã chuyển khoản dd/mm and no action on a paid month', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ ...APPROVED, status: 'paid', paidOn: '2026-11-06' }));

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await screen.findByText('Đã chuyển khoản 06/11')).toBeTruthy();
    expect(button('Duyệt')).toBeNull();
    expect(button('Mở lại')).toBeNull();
    expect(button('Đã chuyển khoản')).toBeNull();
  });

  it('L-E02: should disable Duyệt with a hint for an HR without the approve right', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue({ ...ME, canApprovePayroll: false });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    const approve = (await within(await screen.findByRole('region', { name: 'Trạng thái tháng' })).findByRole(
      'button',
      { name: 'Duyệt' },
    )) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(screen.getByText('Cần quyền Duyệt lương')).toBeTruthy();
  });

  it('L-E02: should disable Mở lại for an HR without the approve right, and still allow Đã chuyển khoản', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue({ ...ME, canApprovePayroll: false });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month(APPROVED));

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    await screen.findByText(/^Đã duyệt lần 1 ·/);
    expect((button('Mở lại') as HTMLButtonElement).disabled).toBe(true);
    expect((button('Đã chuyển khoản') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Duyệt', () => {
  it('L-M01: should keep "Duyệt" in the dialog off until the red warnings are marked "Đã xem", then approve', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ review: [RED, YELLOW] }));
    const approve = spyOnApi('hrPayrollApprove').mockResolvedValue(month({ ...APPROVED, review: [RED, YELLOW] }));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Duyệt tháng' }) as HTMLButtonElement;
    const wasDisabled = confirm.disabled;
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Đã xem 1 cảnh báo đỏ/ }));
    fireEvent.click(confirm);

    // Assert
    expect(wasDisabled).toBe(true);
    expect(within(dialog).getByText('1 đỏ · 1 vàng')).toBeTruthy();
    await waitFor(() => expect(approve).toHaveBeenCalledWith(2026, 10, { acknowledgedRed: true }));
    expect(await screen.findByText('Đã duyệt lần 1 · 16:20 05/11 · bởi Phòng Nhân sự')).toBeTruthy();
  });

  it('L-L19: should approve straight away when only yellow warnings are left', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ review: [YELLOW] }));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    const dialog = await screen.findByRole('dialog');

    // Assert
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Duyệt tháng' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('should say why Duyệt failed and keep the dialog open', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    spyOnApi('hrPayrollApprove').mockRejectedValue(new ApiError(409, 'T10/2026 đã duyệt, không duyệt lại được.'));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Duyệt tháng' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'T10/2026 đã duyệt, không duyệt lại được.');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('Mở lại', () => {
  it('L-E09, L-M03: should ask a reason before Mở lại and send it', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month(APPROVED));
    const reopen = spyOnApi('hrPayrollReopen').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Mở lại' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Mở lại tháng' }) as HTMLButtonElement;
    const wasDisabled = confirm.disabled;
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Lý do mở lại/ }), {
      target: { value: ' Sửa KPI NV J ' },
    });
    fireEvent.click(confirm);

    // Assert
    expect(wasDisabled).toBe(true);
    expect(within(dialog).getByText(/Bản duyệt lần 1 · 16:20 05\/11 · bởi Phòng Nhân sự/)).toBeTruthy();
    await waitFor(() => expect(reopen).toHaveBeenCalledWith(2026, 10, { reason: 'Sửa KPI NV J' }));
    expect(await screen.findByText(/^Nháp · tính lúc/)).toBeTruthy();
  });
});

describe('Đã chuyển khoản', () => {
  it('L-M05: should start the transfer day on the pay date and mark the month paid', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month(APPROVED));
    const markPaid = spyOnApi('hrPayrollMarkPaid').mockResolvedValue(
      month({ ...APPROVED, status: 'paid', paidOn: '2026-11-05' }),
    );
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Đã chuyển khoản' }));
    const dialog = await screen.findByRole('dialog');
    const startDay = within(dialog).getByRole('button', { name: 'Ngày chuyển khoản' }).textContent;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Đánh dấu đã chuyển khoản' }));

    // Assert
    expect(startDay).toContain('05/11/2026');
    await waitFor(() => expect(markPaid).toHaveBeenCalledWith(2026, 10, { paidOn: '2026-11-05' }));
    expect(await screen.findByText('Đã chuyển khoản 05/11')).toBeTruthy();
  });
});

describe('Rà soát', () => {
  it('L-L19: should list the warnings with their count, red first, each row linking to the person', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ review: [RED, YELLOW] }));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /Rà soát/ }));
    const dialog = await screen.findByRole('dialog');
    const items = within(dialog)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    fireEvent.click(within(dialog).getByRole('link', { name: /NV J/ }));

    // Assert
    expect(within(header()).getByRole('button', { name: /Rà soát/ }).textContent).toContain('2');
    expect(items[0]).toContain('xác nhận lại lần chốt kỳ công');
    expect(items[1]).toContain('% KPI gõ 0%');
    await waitFor(() => expect(address()).toBe('/hr/luong?ky=2026-10&nv=nv-j'));
  });

  it("should link a Khối warning to the person's form in Chấm công → Nhân viên", async () => {
    // Arrange
    const missing = {
      level: 'red',
      code: 'missing-block',
      employeeId: 'nv-j',
      cell: null,
      message: 'Thiếu khối',
    } as const;
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(
      month({
        lines: [person({ employeeId: 'nv-j', fullName: 'NV J', code: 'NV10', block: null })],
        review: [missing],
      }),
    );
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /Rà soát/ }));
    const link = within(await screen.findByRole('dialog')).getByRole('link', { name: /NV J/ });

    // Assert
    expect(link.getAttribute('href')).toBe('/hr/cham-cong/nhan-vien?nv=nv-j&khoi=none');
  });

  it('should say an open month of the tax year and a typed leave payout in plain words', async () => {
    // Arrange
    const openMonth = {
      level: 'yellow',
      code: 'year-open-month',
      employeeId: null,
      cell: null,
      message: 'Tháng 9 chưa duyệt — số cộng dồn năm đang lấy bản nháp',
    } as const;
    const typed = {
      level: 'yellow',
      code: 'leave-payout-typed',
      employeeId: 'nv-j',
      cell: 'otherIncome',
      message:
        'Tiền phép chưa nghỉ gõ 500.000 thấp hơn số tính 1.050.000 (BLLĐ Đ.113 k3: trả đủ tiền lương cho những ngày chưa nghỉ)',
    } as const;
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ review: [openMonth, typed] }));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /Rà soát/ }));
    const dialog = await screen.findByRole('dialog');

    // Assert
    expect(within(dialog).getByText('Tháng 9 chưa duyệt — số cộng dồn năm đang lấy bản nháp')).toBeTruthy();
    expect(within(dialog).getByText('Cả tháng')).toBeTruthy();
    const link = within(dialog).getByRole('link', { name: /Tiền phép chưa nghỉ gõ 500.000 thấp hơn số tính/ });
    expect(link.getAttribute('href')).toBe('/hr/luong?ky=2026-10&nv=nv-j');
    expect(dialog.textContent).not.toMatch(/year-open-month|leave-payout-typed/);
  });

  it('should say there is nothing to review on a clean month', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue(ME);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month());
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: /Rà soát/ }));

    // Assert
    expect(within(await screen.findByRole('dialog')).getByText('Không có cảnh báo nào.')).toBeTruthy();
  });
});
