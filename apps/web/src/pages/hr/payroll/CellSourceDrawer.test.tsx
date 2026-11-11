import type { PayrollSettingsMonthDto, PayrollSettingViewLineDto } from '@careers/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayrollLineDto } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { PayrollValueCell } from './PayrollCell';
import { payrollBands, type PayrollColumnSpec } from './payrollModel';
import { address, month, open, person } from './payrollTestData';
import { answerReads, profile } from './profiles/profileTestData';

/** "Auto + link + CRUD": a computed cell opens how it is computed and where its inputs are edited, over the grid. */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const line = (
  key: string,
  label: string,
  over: Partial<PayrollSettingViewLineDto> = {},
): PayrollSettingViewLineDto => ({
  key,
  label,
  area: 'tham-so',
  readOn: '2026-10-01',
  inForce: null,
  overrides: 0,
  rows: [],
  ...over,
});

const VIEW: PayrollSettingsMonthDto = {
  month: '2026-10',
  payDate: '2026-11-05',
  insuranceDate: '2026-10-01',
  lines: [
    line('luat.bh-nld', 'BH người lao động'),
    line('luat.giam-tru', 'Giảm trừ gia cảnh'),
    line('quy-tac.dem-ngay-bh', 'Đếm 14 ngày cho tháng vào, nghỉ giữa tháng (BH-1)', {
      area: 'quy-tac',
      readOn: '2026-10',
    }),
  ],
};

const EXPLAINED = person({
  cells: { dependantDeduction: 12_400_000, health: 96_000 } as PayrollLineDto['cells'],
  explain: {
    dependantDeduction: { formula: '2 người phụ thuộc × 6.200.000 = 12.400.000', refs: [] },
    health: { formula: '1,5% × 6.400.000 = 96.000', refs: [] },
  },
});

const column = (no: string): PayrollColumnSpec => {
  const found = payrollBands([{ id: 'luong', name: 'Lương thời gian' }])
    .flatMap((b) => b.columns)
    .find((c) => c.no === no);
  if (!found) throw new Error(`No column (${no})`);
  return found;
};

function Where() {
  const { search } = useLocation();
  return <output aria-label="địa chỉ ô">{search}</output>;
}

describe('a computed cell', () => {
  it('should link (36) to its sources over the grid, keeping the month and the filters', () => {
    // Arrange
    render(
      <MemoryRouter initialEntries={['/hr/luong?ky=2026-10&kv=hcm']}>
        <TooltipProvider>
          <PayrollValueCell
            line={EXPLAINED}
            column={column('36')}
            month={{ monthKey: '2026-10', to: '2026-10-25', isLocked: false, lockReason: null }}
          />
        </TooltipProvider>
        <Where />
      </MemoryRouter>,
    );

    // Act
    fireEvent.click(screen.getByRole('link', { name: /Giảm trừ NPT của NV A/ }));

    // Assert
    const search = screen.getByLabelText('địa chỉ ô').textContent ?? '';
    expect(search).toContain('ky=2026-10');
    expect(search).toContain('kv=hcm');
    expect(search).toContain('tinh=dependantDeduction');
    expect(search).toContain('nguoi=nv-a');
  });
});

function answerAll(status: 'draft' | 'approved' = 'draft') {
  const reads = answerReads();
  const sheet = spyOnApi('hrPayrollMonth').mockResolvedValue(month({ status, lines: [EXPLAINED] }));
  const settings = spyOnApi('hrPayrollSettingsMonth').mockResolvedValue(VIEW);
  return { ...reads, sheet, settings };
}

describe('the sources drawer', () => {
  it('should open (36) on the dependants with the formula, over Bảng lương', async () => {
    // Arrange
    answerAll();

    // Act
    open('/hr/luong?ky=2026-10&tinh=dependantDeduction&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('2 người phụ thuộc × 6.200.000 = 12.400.000')).toBeTruthy();
    const dependants = await within(drawer).findByRole('region', { name: 'Người phụ thuộc' });
    expect(within(dependants).getByText('2 người')).toBeTruthy();
    expect(await within(drawer).findByText('Giảm trừ gia cảnh')).toBeTruthy();
    expect(document.querySelector('[data-payroll-grid]')).toBeTruthy();
  });

  it('should open (29) on the insurance settings without leaving the tab, and close back to the grid', async () => {
    // Arrange
    answerAll();
    open('/hr/luong?ky=2026-10&kv=hcm&tinh=health&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('BH người lao động')).toBeTruthy();
    expect(within(drawer).getByText(/Quy tắc 14 ngày/)).toBeTruthy();
    expect(within(drawer).getByRole('region', { name: 'Mức lương theo ngày hiệu lực' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Bảng lương/, hidden: true }).getAttribute('aria-current')).toBe('page');
    expect(address().startsWith('/hr/luong?')).toBe(true);

    // Act
    fireEvent.keyDown(drawer, { key: 'Escape' });

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(address()).toBe('/hr/luong?ky=2026-10&kv=hcm');
  });

  it('should compute the row again after a dependant is saved in the drawer', async () => {
    // Arrange
    const { sheet } = answerAll();
    const save = spyOnApi('hrPayrollSaveDependant').mockResolvedValue({
      id: 'd-2',
      fromMonth: '2027-01',
      toMonth: null,
      count: 2,
    });
    open('/hr/luong?ky=2026-10&tinh=dependantDeduction&nguoi=nv-a');
    const drawer = await screen.findByRole('dialog');
    const dependants = await within(drawer).findByRole('region', { name: 'Người phụ thuộc' });
    const asked = sheet.mock.calls.length;

    // Act
    fireEvent.click(within(dependants).getByRole('button', { name: /Thêm/ }));
    fireEvent.click(within(dependants).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(save).toHaveBeenCalled());
    await waitFor(() => expect(sheet.mock.calls.length).toBeGreaterThan(asked));
  });

  it('should show an approved month read only, with the lock reason', async () => {
    // Arrange
    answerAll('approved');

    // Act
    open('/hr/luong?ky=2026-10&tinh=dependantDeduction&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(/Tháng đã duyệt, chỉ xem/)).toBeTruthy();
    const dependants = await within(drawer).findByRole('region', { name: 'Người phụ thuộc' });
    expect(within(dependants).getByRole('button', { name: /Thêm/ }).matches(':disabled')).toBe(true);
    await within(drawer).findByText('Giảm trừ gia cảnh');
    for (const change of within(drawer).getAllByRole('button', { name: /^Đổi/ })) {
      expect(change.matches(':disabled')).toBe(true);
    }
  });
});

describe('(32) Hỗ trợ / Hoàn ứng / Tạm ứng', () => {
  it("should open the person's recurring items over the grid from the month editor", async () => {
    // Arrange
    answerAll();
    open('/hr/luong?ky=2026-10&tinh=cash&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByRole('region', { name: 'Khoản (32) định kỳ' })).toBeTruthy();
    expect(within(drawer).queryByText('Cấu hình dùng')).toBeNull();
  });
});

describe('(40) Thuế TNCN of a probation person', () => {
  it('should say which commitment applied and offer both ways to change it: the contract setting and a signed one', async () => {
    // Arrange
    answerReads();
    spyOnApi('hrPayrollSettingsMonth').mockResolvedValue(VIEW);
    const probation = person({
      contractTypeId: 'thu-viec',
      probation: true,
      cells: { tax: 0 } as PayrollLineDto['cells'],
      explain: { tax: { formula: 'Không khấu trừ · Cam kết theo hợp đồng = 0', refs: [] } },
    });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ lines: [probation] }));

    // Act
    open('/hr/luong?ky=2026-10&tinh=tax&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('Không khấu trừ · Cam kết theo hợp đồng = 0')).toBeTruthy();
    expect(await within(drawer).findByText(/ · Cam kết thuế kèm hợp đồng \(không khấu trừ 10%\)$/)).toBeTruthy();
    expect(await within(drawer).findByRole('region', { name: 'Cam kết thuế (mẫu 08)' })).toBeTruthy();
  });
});

describe('(32) with "Công ty trả thay BH"', () => {
  it('should show the formula of the item and the item itself, to edit or stop', async () => {
    // Arrange
    const formula =
      'Hỗ trợ 0 + Hoàn ứng 0 − Tạm ứng 0 + Công ty trả thay BH [(28) + (29) + (30) = 512.000 + 96.000 + 64.000 = 672.000, chưa tính thuế] = 672.000';
    const item = { id: 'r-1', kind: 'insurance-paid' as const, amount: 0, taxable: false, fromMonth: '2026-10' };
    answerReads(profile({ recurring: [{ ...item, toMonth: null, note: '' }] }));
    spyOnApi('hrPayrollSettingsMonth').mockResolvedValue(VIEW);
    const paid = person({
      cells: { cash: 672_000 } as PayrollLineDto['cells'],
      explain: { cash: { formula, refs: [] } },
    });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ lines: [paid] }));

    // Act
    open('/hr/luong?ky=2026-10&tinh=cash&nguoi=nv-a');

    // Assert
    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(formula)).toBeTruthy();
    const items = await within(drawer).findByRole('region', { name: 'Khoản (32) định kỳ' });
    expect(within(items).getByText('Công ty trả thay BH · tự tính = (28) + (29) + (30)')).toBeTruthy();
    expect(within(items).getByRole('button', { name: /^Sửa công ty trả thay bh/ })).toBeTruthy();
  });
});

describe('Cộng dồn năm thuế in the sources', () => {
  const YEAR = {
    before: {
      clothingExempt: 3_000_000,
      overtimeHours: 120,
      taxable: 90_000_000,
      tax: 4_500_000,
      insurance: 9_450_000,
    },
    month: { clothingExempt: 416_667, overtimeHours: 12.5, taxable: 10_000_000, tax: 500_000, insurance: 1_050_000 },
  };
  const serve = (year: PayrollLineDto['year']) => {
    answerReads();
    spyOnApi('hrPayrollSettingsMonth').mockResolvedValue(VIEW);
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ lines: [person({ year })] }));
  };

  it('should show the clothing pay exempted so far on (33)', async () => {
    // Arrange
    serve(YEAR);

    // Act
    open('/hr/luong?ky=2026-10&tinh=exempt&nguoi=nv-a');
    const block = await screen.findByRole('region', { name: 'Cộng dồn năm thuế' });

    // Assert
    const row = within(block).getByRole('row', { name: /Trang phục đã miễn thuế/ });
    expect(row.textContent).toContain('3.000.000');
    expect(row.textContent).toContain('416.667');
    expect(row.textContent).toContain('3.416.667');
  });

  it('should show the overtime hours so far on the overtime pay, and the estimate numbers on (40)', async () => {
    // Arrange
    serve(YEAR);

    // Act
    open('/hr/luong?ky=2026-10&tinh=overtimePay&nguoi=nv-a');

    // Assert
    const hours = await screen.findByRole('row', { name: /Giờ làm thêm tính vào trần năm/ });
    expect(hours.textContent).toContain('132,5 giờ');
  });

  it('should show taxable income, insurance and tax so far on (40)', async () => {
    // Arrange
    serve(YEAR);

    // Act
    open('/hr/luong?ky=2026-10&tinh=tax&nguoi=nv-a');
    const block = await screen.findByRole('region', { name: 'Cộng dồn năm thuế' });

    // Assert
    expect(within(block).getByRole('row', { name: /Thu nhập chịu thuế/ }).textContent).toContain('100.000.000');
    expect(within(block).getByRole('row', { name: /Thuế đã khấu trừ/ }).textContent).toContain('5.000.000');
  });

  it('should leave the block out of a row that carries no year, and of a cell the year does not touch', async () => {
    // Arrange
    serve(undefined);

    // Act
    open('/hr/luong?ky=2026-10&tinh=tax&nguoi=nv-a');
    await screen.findByRole('region', { name: 'Cách tính' });

    // Assert
    expect(screen.queryByRole('region', { name: 'Cộng dồn năm thuế' })).toBeNull();
  });
});
