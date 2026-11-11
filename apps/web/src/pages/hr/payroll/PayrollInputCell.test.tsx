import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PayrollLineDto, type PayrollMonthDto } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { cashSplit, monthLockOf } from './monthInputsModel';
import { PayrollInputCell } from './PayrollInputCell';
import { payrollBands, type PayrollColumnSpec } from './payrollModel';
import { month, person } from './payrollTestData';

/** Month inputs typed in the grid (spec 2 (4), 5.3 (19), (21)–(24), (32)): save, cancel, errors, locked months. */

const KEY = ['hr', 'payroll', 'month', 2026, 10];

const NV_C = person({
  employeeId: 'nv-c',
  code: 'NV03',
  fullName: 'NV C',
  kpiAmount: 5_000_000,
  cells: { kpiPercent: 0.5, kpiBonus: 2_500_000, cash: 0, netPay: 9_000_000 } as PayrollLineDto['cells'],
});

const column = (no: string): PayrollColumnSpec => {
  const found = payrollBands([{ id: 'luong', name: 'Lương thời gian' }])
    .flatMap((b) => b.columns)
    .find((c) => c.no === no);
  if (!found) throw new Error(`No column (${no})`);
  return found;
};

/** The cell reads its row from the month in the cache, as the grid does, so a save shows the row the server sent. */
function Row({ no, status }: { no: string; status: PayrollMonthDto['status'] }) {
  const { data } = useQuery<PayrollMonthDto>({ queryKey: KEY, enabled: false });
  const line = data?.lines.find((l) => l.employeeId === 'nv-c');
  if (!line) return null;
  const context = {
    monthKey: '2026-10',
    to: '2026-10-25',
    isLocked: !!monthLockOf(status),
    lockReason: monthLockOf(status),
  };
  return <PayrollInputCell line={line} column={column(no)} month={context} />;
}

function show(no: string, line: PayrollLineDto = NV_C, status: PayrollMonthDto['status'] = 'draft') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, month({ status, lines: [line] }));
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TooltipProvider>
          <Row no={no} status={status} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const saved = (over: Partial<PayrollLineDto>, inputs: Partial<PayrollLineDto['inputs']>) => {
  const all = { ...EMPTY_MONTH_INPUTS, ...inputs, updatedBy: 'Phòng Nhân sự', updatedAt: '2026-11-08T03:00:00.000Z' };
  return { inputs: all, line: { ...NV_C, ...over, inputs: all } };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('typing (19) % KPI in the grid', () => {
  it('should send the % as a fraction on Enter and show the row the server computed again', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(
      saved({ cells: { ...NV_C.cells, kpiPercent: 0.8, kpiBonus: 4_000_000 } }, { kpiPercent: 0.8 }),
    );
    show('19');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (19) % đánh giá KPI của NV C' }));
    const input = screen.getByRole('textbox', { name: '(19) % đánh giá KPI của NV C, tính bằng %' });
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { kpiPercent: 0.8 }));
    expect(await screen.findByText('80%')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByLabelText('Đã nhập tay')).toBeTruthy();
  });

  it('should cancel on Esc without sending anything', () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs');
    show('19');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (19) % đánh giá KPI của NV C' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // Assert
    expect(put).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('should show the server refusal on the cell and keep what was typed', async () => {
    // Arrange
    const message = 'Nhập % trong khoảng 0–200%.';
    spyOnApi('hrPayrollSaveInputs').mockRejectedValue(new ApiError(422, message, { kpiPercent: message }));
    show('19');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (19) % đánh giá KPI của NV C' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((input as HTMLInputElement).value).toBe('250');
  });

  it('should put a typed % back to the engine with "Về số tính"', async () => {
    // Arrange
    const typed = { ...NV_C, inputs: { ...EMPTY_MONTH_INPUTS, kpiPercent: 0.8, updatedBy: 'HR', updatedAt: 'x' } };
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, { kpiPercent: null }));
    show('19', typed);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (19) % đánh giá KPI của NV C' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Về số tính' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { kpiPercent: null }));
  });

  it('should send hours as typed, with a decimal comma', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, { overtimeHours: 1.5 }));
    show('21');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (21) Giờ làm thêm của NV C' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { overtimeHours: 1.5 }));
  });
});

describe('a locked month', () => {
  it('should show the inputs read only, with the reason on hover', async () => {
    // Arrange
    show('19', NV_C, 'approved');

    // Act
    await userEvent.hover(screen.getByText('50%'));

    // Assert
    expect(screen.queryByRole('button', { name: /Sửa/ })).toBeNull();
    expect(await screen.findByText(/Tháng đã duyệt, chỉ xem/)).toBeTruthy();
  });

  it('should keep the % read only for someone without a KPI', () => {
    // Act
    show('19', { ...NV_C, kpiAmount: 0 });

    // Assert
    expect(screen.queryByRole('button', { name: /Sửa/ })).toBeNull();
  });
});

describe('the (32) editor', () => {
  it('should offer Hỗ trợ, Hoàn ứng and Tạm ứng and send the whole list', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(
      saved(
        { cells: { ...NV_C.cells, cash: -1_000_000 } },
        { cash: [{ kind: 'advance', amount: 1_000_000, reason: '' }] },
      ),
    );
    show('32');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (32) Hỗ trợ / hoàn / tạm ứng của NV C' }));
    const form = await screen.findByRole('form', { name: '(32) Hỗ trợ / hoàn / tạm ứng · NV C' });
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm dòng' }));
    // F09: the recurring part, read only, with the way to it; nothing typed for this month yet.
    expect(within(form).getByText(/Định kỳ từ Hồ sơ lương/)).toBeTruthy();
    expect(within(form).getByRole('link', { name: 'Sửa ở Hồ sơ lương ›' })).toBeTruthy();
    const kind = within(form).getByRole('combobox', { name: 'Loại dòng 1' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Số tiền dòng 1' }), { target: { value: '1.000.000' } });
    fireEvent.change(kind, { target: { value: 'advance' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(
      within(kind)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Hỗ trợ', 'Hoàn ứng', 'Tạm ứng']);
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', {
        cash: [{ kind: 'advance', amount: 1_000_000, reason: '' }],
      }),
    );
    expect(await screen.findByText('-1.000.000')).toBeTruthy();
  });

  it('F09: should show the recurring part of (32) read only, then the lines of this month and the total', () => {
    // Arrange: (32) holds 630.000 of recurring items and a 500.000 advance typed for this month.
    const line = person({
      fullName: 'NV C',
      cells: { cash: 130_000 } as PayrollLineDto['cells'],
      inputs: { ...EMPTY_MONTH_INPUTS, cash: [{ kind: 'advance', amount: 500_000, reason: 'Ứng lương' }] },
    });

    // Act
    const split = cashSplit(line, [{ kind: 'advance', amount: 500_000 }]);
    const withMore = cashSplit(line, [
      { kind: 'advance', amount: 500_000 },
      { kind: 'support', amount: 200_000 },
    ]);

    // Assert
    expect(split).toEqual({ recurring: 630_000, typed: -500_000, total: 130_000 });
    expect(withMore.total).toBe(330_000);
  });

  it('should ask for a tax choice and a reason before sending (24)', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs');
    show('24');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (24) Thu nhập khác của NV C' }));
    const form = await screen.findByRole('form');
    fireEvent.click(within(form).getByRole('button', { name: 'Thêm dòng' }));
    fireEvent.change(within(form).getByRole('textbox', { name: 'Số tiền dòng 1' }), { target: { value: '500000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect((await within(form).findByRole('alert')).textContent).toBe('Chọn chịu thuế hay miễn thuế.');
    expect(put).not.toHaveBeenCalled();
  });
});

describe('Tiền phép chưa nghỉ inside (24)', () => {
  const PAYOUT = {
    days: 3.5,
    base: 6_600_000,
    norm: 22,
    basisOn: '2026-09-25',
    computed: 1_050_000,
    typed: null,
    amount: 1_050_000,
    exempt: 1_050_000,
  };
  const LEAVING = { ...NV_C, leavePayout: PAYOUT };
  const openEditor = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sửa (24) Thu nhập khác của NV C' }));
    return screen.findByRole('form');
  };

  it('should show it as its own item with the formula for someone leaving in the period', async () => {
    // Arrange
    show('24', LEAVING);

    // Act
    const box = within(await openEditor()).getByRole('region', { name: 'Tiền phép chưa nghỉ' });

    // Assert
    expect(box.textContent).toContain('3,5 ngày phép chưa nghỉ × 6.600.000');
    expect(box.textContent).toContain('Trả 1.050.000 (tự tính), miễn thuế cả khoản.');
    expect((within(box).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }) as HTMLInputElement).value).toBe('');
  });

  it('should say the web computes none for someone who is not leaving, and still take an amount', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, { leavePayout: 700_000 }));
    show('24');
    const form = await openEditor();
    const box = within(form).getByRole('region', { name: 'Tiền phép chưa nghỉ' });

    // Act
    fireEvent.change(within(box).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }), {
      target: { value: '700.000' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(box.textContent).toContain('Không nghỉ việc trong kỳ nên web không tự tính');
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { otherIncome: [], leavePayout: 700_000 }));
  });

  it('should save the amount HR types with the list, and 0 as paying nothing', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, { leavePayout: 0 }));
    show('24', LEAVING);
    const form = await openEditor();

    // Act
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }), { target: { value: '0' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { otherIncome: [], leavePayout: 0 }));
  });

  it('should go back to automatic when the box is emptied', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, {}));
    show('24', { ...NV_C, leavePayout: { ...PAYOUT, typed: 1_500_000, amount: 1_500_000 } });
    const form = await openEditor();
    const box = within(form).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }) as HTMLInputElement;

    // Act
    const before = box.value;
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(before).toBe('1.500.000');
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { otherIncome: [], leavePayout: null }));
  });

  it('should leave the amount out of the save when HR did not touch it, and refuse a wrong one', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved({}, {}));
    show('24', LEAVING);
    const form = await openEditor();

    // Act
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }), { target: { value: 'abc' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect((await within(form).findByRole('alert')).textContent).toContain('nhập số đồng từ 0');
    expect(put).not.toHaveBeenCalled();

    // Act
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tiền phép chưa nghỉ' }), { target: { value: '' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { otherIncome: [] }));
  });
});
