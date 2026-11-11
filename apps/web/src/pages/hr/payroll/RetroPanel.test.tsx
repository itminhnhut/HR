import type { PayrollRetroItemDto } from '@careers/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { month, person } from './payrollTestData';
import { RetroPanel } from './RetroPanel';
import type { RetroPatch } from './retroModel';

/** The list of truy lĩnh / truy thu on the receiving month (spec R6 (a), 11.4). People and amounts are made up. */

const item = (over: Partial<PayrollRetroItemDto> = {}): PayrollRetroItemDto => ({
  employeeId: 'nv-a',
  code: 'NV01',
  fullName: 'NV A',
  origin: '2026-09',
  originApproval: 1,
  cells: { income: 3_000_000, netPay: 2_760_000 },
  computed: 2_760_000,
  typed: null,
  reason: '',
  amount: 2_760_000,
  placed: true,
  causes: [
    {
      area: 'ho-so',
      action: 'Thêm mức lương',
      detail: 'NV01 NV A: lương 9.000.000 → 12.000.000',
      by: 'Lan',
      at: '2026-11-03T02:00:00.000Z',
    },
  ],
  ...over,
});

function show(over: Parameters<typeof month>[0] = {}) {
  const onApply = vi.fn<(patches: RetroPatch[]) => void>();
  const dto = month({ lines: [person({})], retro: [item()], ...over });
  render(
    <MemoryRouter>
      <RetroPanel month={dto} isSaving={false} error={null} onApply={onApply} />
    </MemoryRouter>,
  );
  return onApply;
}

afterEach(() => {
  cleanup();
});

describe('RetroPanel', () => {
  it('should list each adjustment with the month it comes from, the change behind it and the cells', () => {
    show();

    expect(screen.getByRole('heading').textContent).toContain('1 khoản, thực nhận +2.760.000');
    const origin = screen.getByRole('link', { name: /T9\/2026 \(bản duyệt lần 1\)/ });
    expect(origin.getAttribute('href')).toBe('/hr/luong?ky=2026-09');
    expect(screen.getByText(/Số tính \+2\.760\.000/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Thêm mức lương' }).getAttribute('href')).toContain('hs=nv-a');
    expect(screen.getByText(/Thu nhập thực tế: \+3\.000\.000/)).toBeTruthy();
  });

  it('should ask for a reason before leaving the selected ones out', () => {
    const onApply = show();
    fireEvent.click(screen.getByRole('checkbox', { name: /NV01 NV A, T9\/2026/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ra' }));
    expect(screen.getByRole('alert').textContent).toBe('Ghi lý do.');
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Đã trả tay' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ ra' }));
    expect(onApply).toHaveBeenCalledWith([
      { employeeId: 'nv-a', input: { retro: [{ origin: '2026-09', amount: 0, reason: 'Đã trả tay' }] } },
    ]);
  });

  it('should only read on an approved month, and show nothing without adjustments', () => {
    show({ status: 'approved' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bỏ ra' })).toBeNull();
  });

  it('should render nothing for a month without adjustments', () => {
    show({ retro: [] });
    expect(screen.queryByRole('region')).toBeNull();
  });
});
