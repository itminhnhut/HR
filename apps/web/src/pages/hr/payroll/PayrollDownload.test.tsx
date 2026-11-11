import { PAYROLL_MONEY_CELLS, type PayrollExportRequest } from '@careers/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PayrollExportDto, type PayrollLineDto, type PayrollMonthDto } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { PayslipLink } from './download/PayslipDrawer';
import { exportPayroll } from './excel/payrollBook';
import { exportPayslips } from './excel/payslipBook';
import { address, ME, month, open, person } from './payrollTestData';

/**
 * Tải Excel and Phiếu lương on the Lương page (spec 11.2, 11.7, 12.1; steps 23, 25). The file builders have their own
 * tests and write a file in the browser, so they are stood in for here; what is checked: when the button can be used,
 * which months and people each choice asks the server for, what the builders are handed, and the payslip drawer.
 * Cases: docs/test-cases-luong.md L-F05, L-F09, L-F15, L-F18, L-F19, L-F22. People are made up.
 */

vi.mock('./excel/payrollBook', () => ({ exportPayroll: vi.fn(() => Promise.resolve()) }));
vi.mock('./excel/payslipBook', () => ({ exportPayslips: vi.fn(() => Promise.resolve()) }));

const LONG_NAME = 'NV J Tên Rất Dài Để Thử Không Bị Cắt Ngắn';

const cells = (netPay: number): PayrollLineDto['cells'] => ({
  ...(Object.fromEntries(PAYROLL_MONEY_CELLS.map((key) => [key, 0])) as Record<
    (typeof PAYROLL_MONEY_CELLS)[number],
    number
  >),
  gross: 0,
  paidDays: 22,
  dailyRate: 0,
  kpiPercent: 1,
  overtimeHours: 0,
  restDays: 0,
  holidayDays: 0,
  netPay,
});

/** What the sheet prints beyond the grid; the month on screen has the account masked. */
const sheet = (bankAccount: string): NonNullable<PayrollLineDto['sheet']> => ({
  title: 'Nhân viên',
  dependants: 0,
  taxMethod: 'progressive',
  paid: {},
  payslipEmail: null,
  bankName: 'Ngân hàng Demo',
  bankAccount,
});

const two = (over: Partial<PayrollMonthDto> = {}): PayrollMonthDto =>
  month({
    lines: [
      person({ cells: cells(18_516_850), sheet: sheet('••••4567') }),
      person({
        employeeId: 'nv-j',
        code: 'NV10',
        fullName: LONG_NAME,
        block: 'KD',
        cells: cells(9_000_000),
        sheet: sheet('••••8901'),
      }),
    ],
    ...over,
  });

/** T8, T9 approved; T10 a draft; T11 waiting for the close; no other month of 2026. */
function answerYear() {
  const approval = { no: 1, at: '2026-10-08T02:10:00.000Z', by: 'HR Lan' };
  const byMonth: Record<number, PayrollMonthDto> = {
    8: two({ month: 8, monthKey: '2026-08', status: 'approved', approval }),
    9: two({ month: 9, monthKey: '2026-09', status: 'paid', approval }),
    10: two(),
    11: two({ month: 11, monthKey: '2026-11', status: 'waiting', lines: [] }),
  };
  return spyOnApi('hrPayrollMonth').mockImplementation((_year, m) => {
    const found = byMonth[m];
    return found ? Promise.resolve(found) : Promise.reject(new ApiError(404, 'Chưa có bảng lương tháng này.'));
  });
}

/**
 * The server's answer to a download: each month asked for, only the people asked for. No pay component, so the
 * builders' configuration needs no settings.
 */
function answerExport() {
  return spyOnApi('hrPayrollExport').mockImplementation((input: PayrollExportRequest) => {
    const months = input.months.map((key): PayrollExportDto['months'][number] => {
      const whole = two({ month: Number(key.slice(5)), monthKey: key, components: [] });
      const lines = whole.lines.filter((l) => !input.employeeIds || input.employeeIds.includes(l.employeeId));
      return {
        month: { ...whole, lines },
        peopleTotal: whole.lines.length,
        closingNo: 1,
        formulaVersion: 'luong-2026.11',
        settings: [],
        notes: [],
      };
    });
    return Promise.resolve({ kind: input.kind, months });
  });
}

function Where() {
  const { pathname, search } = useLocation();
  return <output aria-label="ở đâu">{`${pathname}${search}`}</output>;
}

const menuButton = () => screen.findByRole('button', { name: 'Tải Excel' });

async function openMenu() {
  fireEvent.click(await menuButton());
  return screen.findByRole('menu', { name: 'Tải Excel' });
}

/** A choice that needs the months of the year is off until they are read. */
async function ready(menu: HTMLElement, name: string) {
  const item = within(menu).getByRole('menuitem', { name });
  await waitFor(() => expect(item).toHaveProperty('disabled', false));
  return item;
}

const slipsHanded = () => vi.mocked(exportPayslips).mock.calls[0]?.[1].map((s) => s.code);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
  spyOnApi('hrMe').mockResolvedValue(ME);
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'error');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(exportPayroll).mockClear();
  vi.mocked(exportPayslips).mockClear();
});

describe('when Tải Excel can be used', () => {
  it('should be off with the reason while the month waits for the timesheet close', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two({ status: 'waiting' }));

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    const button = await menuButton();
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText('Chờ chốt công, chưa có số để tải')).toBeTruthy();
  });

  it('should be off with the reason when the month has no rows', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two({ lines: [] }));

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await menuButton()).toHaveProperty('disabled', true);
    expect(screen.getByText('Kỳ này chưa có dòng lương nào', { selector: '.sr-only' })).toBeTruthy();
  });

  it('should offer this month, several months, the year and payslips on a draft month, marked NHÁP', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());

    // Act
    open('/hr/luong?ky=2026-10');
    const menu = await openMenu();

    // Assert
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Tháng này · T10/2026 (NHÁP)', 'Nhiều tháng…', 'Cả năm 2026', 'Phiếu lương nhiều người…']);
  });

  it('should not show the button to someone without the payroll right', async () => {
    // Arrange
    spyOnApi('hrMe').mockResolvedValue({ ...ME, canPayroll: false, canApprovePayroll: false });
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());

    // Act
    open('/hr/luong?ky=2026-10');

    // Assert
    expect(await screen.findByText('Không có quyền xem lương')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tải Excel' })).toBeNull();
  });
});

describe('what each choice downloads', () => {
  it('L-F05: "Tháng này" should ask for the month shown, everyone, and hand the builder a draft by the signed-in HR', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const asked = answerExport();
    open('/hr/luong?ky=2026-10');
    const menu = await openMenu();
    const note = within(menu).getByRole('status');

    // Act
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Tháng này/ }));

    // Assert
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payroll' }]]);
    const [months, download] = vi.mocked(exportPayroll).mock.calls[0] ?? [];
    expect(months?.map((m) => [m.dates.month, m.stamp.kind, m.rows.length])).toEqual([[10, 'draft', 2]]);
    expect(months?.[0]?.rows.map((r) => r.person.bankAccount)).toEqual(['••••4567', '••••8901']);
    expect([download?.by, download?.hideBank, download?.at]).toEqual(['Phòng Nhân sự', undefined, '2026-11-08T10:00']);
    expect(note).toBeTruthy();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã tải bảng lương T10/2026 · 2 người'));
    expect(months?.[0]?.partial).toBeUndefined();
  });

  it('F29: should download only the people the grid is filtered to, first in the menu, and mark the file as filtered', async () => {
    // Arrange: the grid shows the KD block only, one person of two.
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const asked = answerExport();
    open('/hr/luong?ky=2026-10&khoi=KD');
    const menu = await openMenu();
    const items = within(menu)
      .getAllByRole('menuitem')
      .map((i) => i.textContent);

    // Act
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Đang lọc · 1 người/ }));

    // Assert
    expect(items.slice(0, 2)).toEqual(['Đang lọc · 1 người · T10/2026 (NHÁP)', 'Cả tháng · 2 người · T10/2026 (NHÁP)']);
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payroll', employeeIds: ['nv-j'] }]]);
    const [months] = vi.mocked(exportPayroll).mock.calls[0] ?? [];
    expect(months?.[0]?.rows).toHaveLength(1);
    expect(months?.[0]?.partial).toEqual({ shown: 1, total: 2 });
    expect(months?.[0]?.labels).toContain('Đã lọc: 1/2 người');
    expect(months?.[0]?.totals).toBeUndefined();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã tải bảng lương T10/2026 · 1 người (đang lọc)'));
  });

  it('F29: should still give everyone of the month from a filtered grid with "Cả tháng"', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const asked = answerExport();
    open('/hr/luong?ky=2026-10&khoi=KD');

    // Act
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: /^Cả tháng · 2 người/ }));

    // Assert
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payroll' }]]);
  });

  it('L-F15: "Cả năm" should ask for the approved and draft months of the year, not one waiting for the close', async () => {
    // Arrange
    answerYear();
    const asked = answerExport();
    open('/hr/luong?ky=2026-10');
    const menu = await openMenu();

    // Act
    fireEvent.click(await ready(menu, 'Cả năm 2026'));

    // Assert
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-08', '2026-09', '2026-10'], kind: 'payroll' }]]);
    expect(toast.success).toHaveBeenCalledWith('Đã tải bảng lương 3 tháng · 2 người');
  });

  it('L-F09: "Nhiều tháng…" should offer the months with numbers and ask for from–to, saying how many drafts', async () => {
    // Arrange
    answerYear();
    const asked = answerExport();
    open('/hr/luong?ky=2026-10');
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Nhiều tháng…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tải nhiều tháng' });
    await waitFor(() =>
      expect(
        within(within(dialog).getByLabelText('Từ tháng'))
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['T8 · Đã duyệt', 'T9 · Đã chuyển khoản', 'T10 · Nháp']),
    );

    // Act
    fireEvent.change(within(dialog).getByLabelText('Từ tháng'), { target: { value: '9' } });
    fireEvent.change(within(dialog).getByLabelText('Đến tháng'), { target: { value: '10' } });
    const summary = within(dialog).getByTestId('export-summary').textContent;
    const go = within(dialog).getByRole('button', { name: 'Tải Excel' });
    await waitFor(() => expect(go).toHaveProperty('disabled', false));
    fireEvent.click(go);

    // Assert
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(summary).toBe('2 tháng · 1 bản nháp');
    expect(asked.mock.calls).toEqual([[{ months: ['2026-09', '2026-10'], kind: 'payroll' }]]);
  });

  it('C01: "Cả năm" on Tổng quan should take the year being browsed, not the year of the pay month', async () => {
    // Arrange: the pay month is T10/2026, the year table shows 2025.
    answerYear();
    const asked = answerExport();
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam&nam=2025');
    const menu = await openMenu();

    // Act
    fireEvent.click(await ready(menu, 'Cả năm 2025'));

    // Assert
    await waitFor(() => expect(exportPayroll).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2025-08', '2025-09', '2025-10'], kind: 'payroll' }]]);
  });

  it('should offer the same download on Tổng quan', async () => {
    // Arrange
    answerYear();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10');
    const menu = await openMenu();

    // Assert
    expect(within(menu).getByRole('menuitem', { name: 'Cả năm 2026' })).toBeTruthy();
    expect(address()).toBe('/hr/luong/tong-quan?ky=2026-10');
  });

  it("should show the server's own words when the export is refused, and keep the button usable", async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const refusal = 'T10/2026 vừa mở lại kỳ công, chưa có số để tải.';
    spyOnApi('hrPayrollExport').mockRejectedValue(new ApiError(409, refusal));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: /Tháng này/ }));

    // Assert
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(refusal));
    expect(exportPayroll).not.toHaveBeenCalled();
    await waitFor(async () => expect(await menuButton()).toHaveProperty('disabled', false));
  });

  it('should say the file could not be made when the browser fails to build it', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    answerExport();
    vi.mocked(exportPayroll).mockRejectedValueOnce(new Error('Hết bộ nhớ'));
    open('/hr/luong?ky=2026-10');

    // Act
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: /Tháng này/ }));

    // Assert
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Chưa tải được file, thử lại sau ít phút.'));
  });
});

describe('payslip of one person', () => {
  it('L-F18: should open from the address with that person and month, the name in full, the account masked', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());

    // Act
    open('/hr/luong?ky=2026-10&phieu=nv-j');

    // Assert
    const drawer = await screen.findByRole('dialog', { name: /Phiếu lương/ });
    expect(await within(drawer).findByText('PHIẾU LƯƠNG THÁNG 10/2026')).toBeTruthy();
    expect(within(drawer).getAllByText(LONG_NAME).length).toBeGreaterThan(0);
    expect(within(drawer).getByTestId('payslip-net').textContent).toBe('9.000.000');
    expect(within(drawer).getByText('Chuyển khoản: Ngân hàng Demo · ****8901')).toBeTruthy();
  });

  it('L-F19: should mark the payslip of a draft month NHÁP', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());

    // Act
    open('/hr/luong?ky=2026-10&phieu=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog', { name: /Phiếu lương/ });
    expect(await within(drawer).findByText('NHÁP')).toBeTruthy();
  });

  it('should open from the row and keep the tab, the month and the filters in the address', async () => {
    // Arrange: the grid draws its rows only in a real browser, so the row's link stands alone here.
    render(
      <MemoryRouter initialEntries={['/hr/luong?ky=2026-10&khoi=BO']}>
        <PayslipLink line={person({})} />
        <Where />
      </MemoryRouter>,
    );

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'Xem phiếu lương NV A' }));

    // Assert
    expect(screen.getByLabelText('ở đâu').textContent).toBe('/hr/luong?ky=2026-10&khoi=BO&phieu=nv-a');
  });

  it('should ask for the payslip of that person alone and close back to the grid address', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const asked = answerExport();
    open('/hr/luong?ky=2026-10&phieu=nv-j');
    const drawer = await screen.findByRole('dialog', { name: /Phiếu lương/ });

    // Act
    fireEvent.click(await within(drawer).findByRole('button', { name: 'Tải Excel' }));
    await waitFor(() => expect(exportPayslips).toHaveBeenCalledTimes(1));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Đóng' }));

    // Assert
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payslips', employeeIds: ['nv-j'] }]]);
    expect(slipsHanded()).toEqual(['NV10']);
    expect(toast.success).toHaveBeenCalledWith('Đã tải 1 phiếu lương T10/2026');
    await waitFor(() => expect(address()).toBe('/hr/luong?ky=2026-10'));
  });

  it('should say the person has no row in the month instead of an empty payslip', async () => {
    // Arrange
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());

    // Act
    open('/hr/luong?ky=2026-10&phieu=khong-co');

    // Assert
    const drawer = await screen.findByRole('dialog', { name: /Phiếu lương/ });
    expect(within(drawer).getByText('Người này không có dòng ở tháng đang xem.')).toBeTruthy();
  });
});

describe('payslips of many people', () => {
  async function openPayslips(start = '/hr/luong?ky=2026-10') {
    spyOnApi('hrPayrollMonth').mockResolvedValue(two());
    const asked = answerExport();
    open(start);
    fireEvent.click(within(await openMenu()).getByRole('menuitem', { name: 'Phiếu lương nhiều người…' }));
    return { dialog: await screen.findByRole('dialog', { name: 'Tải phiếu lương' }), asked };
  }

  it('L-F22: "Tất cả" should ask for everyone of the month and make one file with a payslip each', async () => {
    // Arrange
    const { dialog, asked } = await openPayslips();

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải Excel (2 phiếu)' }));

    // Assert
    await waitFor(() => expect(exportPayslips).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payslips' }]]);
    expect(slipsHanded()).toEqual(['NV01', 'NV10']);
  });

  it('should ask only for the people ticked, their names shown in full', async () => {
    // Arrange
    const { dialog, asked } = await openPayslips();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Chọn người' }));

    // Act
    fireEvent.click(within(dialog).getByRole('checkbox', { name: `NV10 · ${LONG_NAME}` }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải Excel (1 phiếu)' }));

    // Assert
    await waitFor(() => expect(exportPayslips).toHaveBeenCalledTimes(1));
    expect(asked.mock.calls).toEqual([[{ months: ['2026-10'], kind: 'payslips', employeeIds: ['nv-j'] }]]);
    expect(slipsHanded()).toEqual(['NV10']);
  });

  it('should start from the people the filters show and not download while nobody is ticked', async () => {
    // Arrange
    const { dialog } = await openPayslips('/hr/luong?ky=2026-10&khoi=KD');

    // Act
    const ticked = within(dialog)
      .getAllByRole('checkbox')
      .map((c) => (c instanceof HTMLInputElement ? c.checked : null));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bỏ chọn' }));

    // Assert
    expect(ticked).toEqual([false, true]);
    expect(within(dialog).getByRole('button', { name: 'Tải Excel (0 phiếu)' })).toHaveProperty('disabled', true);
  });

  it("should keep the dialog open with the server's words when the export is refused", async () => {
    // Arrange
    const { dialog, asked } = await openPayslips();
    asked.mockRejectedValueOnce(new ApiError(403, 'Bạn không có quyền xem lương.'));

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tải Excel (2 phiếu)' }));

    // Assert
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Bạn không có quyền xem lương.');
    expect(exportPayslips).not.toHaveBeenCalled();
  });
});
