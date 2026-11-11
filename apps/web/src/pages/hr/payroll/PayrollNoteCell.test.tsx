import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PayrollLineDto, PayrollMonthDto } from '../../../api';
import { spyOnApi } from '../../../test/apiSpy';
import { payslipOnScreen } from './excel/fromMonth';
import { monthLockOf } from './monthInputsModel';
import { PayrollNoteCell } from './PayrollNoteCell';
import { fullNoteOf } from './payrollModel';
import { month, person } from './payrollTestData';

/** "Ghi chú" on the grid: HR's own note of the person this month, typed in the cell; the automatic notes read only. */

const KEY = ['hr', 'payroll', 'month', 2026, 10];
const AUTO = 'Thử việc: không đóng BH';
const withNote = (note: string) =>
  person({ employeeId: 'nv-c', code: 'NV03', fullName: 'NV C', note: AUTO, inputs: { ...EMPTY_MONTH_INPUTS, note } });

function Cell({ status }: { status: PayrollMonthDto['status'] }) {
  const { data } = useQuery<PayrollMonthDto>({ queryKey: KEY, enabled: false });
  const line = data?.lines.find((l) => l.employeeId === 'nv-c');
  if (!line) return null;
  const lockReason = monthLockOf(status);
  return (
    <PayrollNoteCell
      line={line}
      month={{ monthKey: '2026-10', to: '2026-10-25', isLocked: !!lockReason, lockReason }}
    />
  );
}

function show(line: PayrollLineDto, status: PayrollMonthDto['status'] = 'draft') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, month({ status, lines: [line] }));
  return render(
    <QueryClientProvider client={client}>
      <Cell status={status} />
    </QueryClientProvider>,
  );
}

const saved = (note: string) => {
  const inputs = { ...EMPTY_MONTH_INPUTS, note, updatedBy: 'Phòng Nhân sự', updatedAt: '2026-11-08T03:00:00.000Z' };
  return { inputs, line: { ...withNote(note), inputs } };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Ghi chú on the payroll grid', () => {
  it('should show HR’s note, then the automatic note in muted italic with its own tooltip', () => {
    // Arrange, Act
    const { container } = show(withNote('Chờ bổ sung hồ sơ'));

    // Assert
    const own = container.querySelector('[data-note="hr"]');
    const auto = container.querySelector('[data-note="auto"]');
    expect(own?.textContent).toBe('Chờ bổ sung hồ sơ');
    expect(own?.getAttribute('title')).toBe('Chờ bổ sung hồ sơ');
    expect(own?.className).not.toContain('italic');
    expect(auto?.textContent).toBe(AUTO);
    expect(auto?.className).toContain('italic');
    expect(auto?.getAttribute('title')).toBe(`Ghi chú tự động của hệ thống: ${AUTO}`);
  });

  it('should save the note typed in the popover with "Lưu" and show it on the row', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved('Chờ bổ sung hồ sơ'));
    show(withNote(''));

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Thêm ghi chú của NV C' }));
    const form = await screen.findByRole('form', { name: 'Ghi chú · NV C' });
    const box = within(form).getByRole('textbox', { name: 'Ghi chú của NV C' });
    fireEvent.change(box, { target: { value: '  Chờ bổ sung hồ sơ ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { note: 'Chờ bổ sung hồ sơ' }));
    expect(box.getAttribute('maxlength')).toBe('500');
    expect(await screen.findByRole('button', { name: 'Sửa ghi chú của NV C' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Ghi chú · NV C' })).toBeNull());
  });

  it('should save on Enter, and delete the note when the text is emptied', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved(''));
    const { container } = show(withNote('Chờ bổ sung hồ sơ'));

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú của NV C' }));
    const box = await screen.findByRole('textbox', { name: 'Ghi chú của NV C' });
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    // Assert
    await waitFor(() => expect(put).toHaveBeenCalledWith('2026-10', 'nv-c', { note: '' }));
    await waitFor(() => expect(container.querySelector('[data-note="hr"]')).toBeNull());
    expect(container.querySelector('[data-note="auto"]')?.textContent).toBe(AUTO);
  });

  it('should send nothing on "Huỷ", and nothing when the text did not change', async () => {
    // Arrange
    const put = spyOnApi('hrPayrollSaveInputs').mockResolvedValue(saved('x'));
    show(withNote('Chờ bổ sung hồ sơ'));

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú của NV C' }));
    const box = await screen.findByRole('textbox', { name: 'Ghi chú của NV C' });
    fireEvent.change(box, { target: { value: 'Khác' } });
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Ghi chú · NV C' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ghi chú của NV C' }));
    fireEvent.keyDown(await screen.findByRole('textbox', { name: 'Ghi chú của NV C' }), { key: 'Enter' });

    // Assert
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Ghi chú · NV C' })).toBeNull());
    expect(put).not.toHaveBeenCalled();
  });

  it('should be read only on an approved month, with the reason on hover', () => {
    // Arrange, Act
    const { container } = show(withNote('Chờ bổ sung hồ sơ'), 'approved');

    // Assert
    expect(screen.queryByRole('button', { name: /ghi chú của NV C/ })).toBeNull();
    expect(container.querySelector('[data-note-locked]')?.getAttribute('title')).toMatch(/^Tháng đã duyệt, chỉ xem/);
    expect(container.querySelector('[data-note="hr"]')?.getAttribute('title')).toMatch(/Tháng đã duyệt, chỉ xem/);
    expect(container.querySelector('[data-note="auto"]')?.textContent).toBe(AUTO);
  });
});

describe('Ghi chú on the payslip', () => {
  it('should print HR’s note first, then the automatic notes that are printed', () => {
    // Arrange
    const line = { ...withNote('Chờ bổ sung hồ sơ'), note: `${AUTO}; Khối lấy từ hồ sơ nhân viên` };

    // Act
    const slip = payslipOnScreen(month({ lines: [line] }), 'nv-c');

    // Assert
    expect(fullNoteOf(line)).toBe(`Chờ bổ sung hồ sơ · ${AUTO}`);
    expect(slip?.notes).toEqual(['Chờ bổ sung hồ sơ', AUTO]);
  });
});
