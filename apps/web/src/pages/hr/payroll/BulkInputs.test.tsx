import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { BulkInputsButton } from './BulkInputs';
import { month, person } from './payrollTestData';

/** "Nhập cho nhiều người" in the month's header (F11). */

const PEOPLE = [
  person({ employeeId: 'nv-a', code: 'NV01', fullName: 'NV A', block: 'BO', kpiAmount: 1_000_000 }),
  person({ employeeId: 'nv-c', code: 'NV03', fullName: 'NV C', block: 'KD', kpiAmount: 5_000_000 }),
  person({ employeeId: 'nv-k', code: 'NV11', fullName: 'NV K', block: 'KD', kpiAmount: 5_000_000 }),
];

const show = (status: 'draft' | 'approved' = 'draft', search = 'ky=2026-10') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <BulkInputsButton month={month({ status, lines: PEOPLE })} search={search} />
    </QueryClientProvider>,
  );

const answer = { inputs: { ...EMPTY_MONTH_INPUTS, kpiPercent: 1 }, line: null };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Nhập cho nhiều người', () => {
  it('should save the same % KPI for everyone of the block picked', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(answer);
    show();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));
    const form = await screen.findByRole('form', { name: 'Nhập cho nhiều người' });
    fireEvent.change(within(form).getByRole('textbox', { name: '% đánh giá KPI' }), { target: { value: '100' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Khối KD' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu cho 2 người' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { kpiPercent: 1 });
    expect(put).toHaveBeenCalledWith('2026-10', 'nv-k', { kpiPercent: 1 });
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nhập cho nhiều người' })).toBeNull());
  });

  it('should open on the people the grid is filtered to', async () => {
    // Arrange
    show('draft', 'ky=2026-10&khoi=BO');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));

    // Assert
    expect(await screen.findByRole('button', { name: 'Lưu cho 1 người' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'NV01 · NV A' }).checked).toBe(true);
    expect(screen.getByText('Đang chọn 1 người (theo bộ lọc của lưới)')).toBeTruthy();
  });

  it('should open with nobody ticked when the grid is not filtered, and hold the save until someone is', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(answer);
    show();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));
    const save = await screen.findByRole<HTMLButtonElement>('button', { name: 'Lưu cho 0 người' });
    const boxes = screen.getAllByRole<HTMLInputElement>('checkbox');

    // Assert: nobody, and nothing to save.
    expect(boxes.map((b) => b.checked)).toEqual([false, false, false]);
    expect(save.disabled).toBe(true);
    expect(screen.getByText('Đang chọn 0 người')).toBeTruthy();

    // Act: two people ticked: exactly those two are saved.
    fireEvent.change(screen.getByRole('textbox', { name: '% đánh giá KPI' }), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'NV01 · NV A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'NV11 · NV K' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho 2 người' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls.map((c) => c[1])).toEqual(['nv-a', 'nv-k']);
  });

  it('should tick everyone with "Chọn tất cả" and nobody with "Bỏ chọn"', async () => {
    // Arrange
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));

    // Act + Assert
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn tất cả' }));
    expect(screen.getByRole('button', { name: 'Lưu cho 3 người' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu cho 0 người' }).disabled).toBe(true);
  });

  it('should keep the dialog open and name who was not saved, with the reason', async () => {
    // Arrange
    spyOnApi('hrPayrollSaveInputs').mockImplementation((_month, employeeId) =>
      employeeId === 'nv-c' ? Promise.reject(new ApiError(409, 'Tháng đã duyệt')) : Promise.resolve(answer),
    );
    show();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '% đánh giá KPI' }), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tất cả' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho 3 người' }));

    // Assert
    expect((await screen.findByRole('alert')).textContent).toBe('Đã lưu 2/3 người. Chưa lưu: NV C (Tháng đã duyệt)');
  });

  it('F26: should ask once before putting everyone back to the computed %, and send nothing on Huỷ', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(answer);
    show();

    // Act: the % is left empty.
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chọn tất cả' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho 3 người' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Xoá % KPI đã gõ' });

    // Assert
    expect(ask.textContent).toContain('Xoá % KPI đã gõ của 3 người, quay về số tự tính?');
    fireEvent.click(within(ask).getByRole('button', { name: 'Huỷ' }));
    expect(put).not.toHaveBeenCalled();

    // Act: asked again, and confirmed.
    fireEvent.click(screen.getByRole('button', { name: 'Lưu cho 3 người' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá % đã gõ' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledTimes(3));
    expect(put).toHaveBeenCalledWith('2026-10', 'nv-a', { kpiPercent: null });
  });

  it('should save the same Ghi chú for the two people ticked, and refuse an empty one', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(answer);
    show();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Nhập cho nhiều người' }));
    const form = await screen.findByRole('form', { name: 'Nhập cho nhiều người' });
    fireEvent.change(within(form).getByRole('combobox', { name: 'Cột' }), { target: { value: 'note' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Khối KD' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu cho 2 người' }));
    const refusal = within(form).getByRole('alert').textContent;
    fireEvent.change(within(form).getByRole('textbox', { name: 'Ghi chú' }), { target: { value: ' Chờ đối soát ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu cho 2 người' }));

    // Assert
    expect(refusal).toMatch(/^Nhập ghi chú\./);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { note: 'Chờ đối soát' });
    expect(put).toHaveBeenCalledWith('2026-10', 'nv-k', { note: 'Chờ đối soát' });
  });

  it('should not be offered on an approved month', () => {
    // Act
    show('approved');

    // Assert
    expect(screen.queryByRole('button', { name: 'Nhập cho nhiều người' })).toBeNull();
  });
});
