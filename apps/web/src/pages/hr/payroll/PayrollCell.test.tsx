import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MONTH_INPUTS } from '@careers/shared';
import type { PayrollLineDto } from '../../../api';
import { TooltipProvider } from '../../../vendor/shadcn-grid/components/ui/tooltip';
import { BlockCell, CodeCell, PayrollValueCell, RegionChip } from './PayrollCell';
import { payrollBands, type PayrollColumnSpec } from './payrollModel';

/** One cell of the payroll grid (spec 11.2, Q5–Q7, 4.4, 4.6, 6.3). Cases: docs/test-cases-luong.md, L-L03–L-L12. */

const MONTH = { monthKey: '2026-10', to: '2026-10-25', isLocked: false, lockReason: null };

const NV_G: PayrollLineDto = {
  employeeId: 'nv-g',
  code: 'NV07',
  fullName: 'NV G',
  department: 'Hành chính',
  regionId: 'hcm',
  contractTypeId: 'thu-viec',
  block: 'BO',
  probation: true,
  norm: 22,
  amounts: { luong: 6_400_000 },
  kpiAmount: 0,
  cells: {
    paidDays: 20,
    dailyRate: 366_136,
    exempt: 1_268_182,
    netPay: 7_322_727,
    kpiPercent: 0.531818,
  } as PayrollLineDto['cells'],
  explain: {
    paidDays: { formula: 'Công hưởng lương của bản chốt Chấm công', refs: [], fromTimesheet: true },
    dailyRate: { formula: '(6.400.000 + 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136', refs: [] },
    exempt: {
      formula: 'Tiền cơm 1.000.000 (trần 1.200.000) + Điện thoại 409.091 (mức quy chế 450.000) = 1.268.182',
      refs: [
        {
          key: 'luat.tran-tien-an',
          label: 'Trần tiền ăn miễn thuế',
          value: '1.200.000',
          from: '01/07/2026',
          source: 'NĐ 253/2026',
          area: 'tham-so',
          isPersonal: false,
        },
      ],
    },
  },
  overrides: [],
  personSettings: [],
  note: '',
  inputs: EMPTY_MONTH_INPUTS,
};

const column = (no: string): PayrollColumnSpec => {
  const found = payrollBands([{ id: 'luong', name: 'Lương thời gian' }])
    .flatMap((b) => b.columns)
    .find((c) => c.no === no);
  if (!found) throw new Error(`No column (${no})`);
  return found;
};

const show = (line: PayrollLineDto, no: string) =>
  render(
    <MemoryRouter>
      <TooltipProvider>
        <PayrollValueCell line={line} column={column(no)} month={MONTH} />
      </TooltipProvider>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the formula tooltip', () => {
  it('L-L08: should show the formula of (18) with the real numbers on hover', async () => {
    // Arrange
    show(NV_G, '18');

    // Act
    await userEvent.hover(screen.getByText('366.136'));

    // Assert
    expect(await screen.findByText('(6.400.000 + 1.100.000 + 450.000 + 1.000.000) × 90% ÷ 22 = 366.136')).toBeTruthy();
  });

  it('L-L09: should name the version used in (33) and open its settings over the grid, not on Cấu hình', async () => {
    // Arrange
    show(NV_G, '33');

    // Act
    await userEvent.hover(screen.getByText('1.268.182'));

    // Assert
    expect(await screen.findByText(/Trần tiền ăn miễn thuế 1\.200\.000 · từ 01\/07\/2026 · NĐ 253\/2026/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Mở cấu hình/ })).toBeNull();
    const link = screen.getByRole('link', { name: 'Xem cách tính Miễn thuế của NV G' });
    expect(link.getAttribute('href')).toBe('/?tinh=exempt&nguoi=nv-g');
  });
});

describe('the explanation on a click', () => {
  it('L-L08: should link (18) to its formula and sources over the grid when the number is clicked', () => {
    // Arrange
    show(NV_G, '18');

    // Assert
    const link = screen.getByRole('link', { name: 'Xem cách tính Lương 1 ngày của NV G' });
    expect(link.getAttribute('href')).toBe('/?tinh=dailyRate&nguoi=nv-g');
  });

  it('should not offer an explanation for a number the engine did not explain', () => {
    // Arrange
    show(NV_G, '42');

    // Assert
    expect(screen.queryByRole('button', { name: /Giải thích/ })).toBeNull();
  });
});

describe('the region chip', () => {
  it('should show the short region and keep the full name for hover', () => {
    // Arrange
    render(<RegionChip regionId="hcm" regions={[{ id: 'hcm', name: 'Hồ Chí Minh', tone: 'blue' }]} />);

    // Assert
    const chip = screen.getByText('HCM');
    expect(chip.closest('[title]')?.getAttribute('title')).toBe('Hồ Chí Minh');
  });
});

describe('copying a number', () => {
  it('L-L10: should copy the plain number, without the thousands dots, from a button outside the tab order', async () => {
    // Arrange
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    show(NV_G, '42');

    // Act
    const button = screen.getByRole('button', { name: 'Sao chép (42) Thực nhận' });
    fireEvent.click(button);

    // Assert
    expect(writeText).toHaveBeenCalledWith('7322727');
    expect(button.getAttribute('tabindex')).toBe('-1');
  });
});

describe('cells that come from the timesheet', () => {
  it("L-L11: should open the person's cell on the timesheet from (17)", () => {
    // Act
    show(NV_G, '17');

    // Assert
    const link = screen.getByRole('link', { name: 'Xem công của NV G ở Bảng công' });
    expect(link.getAttribute('href')).toBe('/hr/cham-cong?ky=2026-10&ngay=2026-10-25&nv=nv-g');
  });

  it('L-L12: should send a change of (17) back to the timesheet: reopen it there, not type it here', async () => {
    // Arrange
    show(NV_G, '17');

    // Act
    await userEvent.hover(screen.getByText('20'));

    // Assert
    const reopen = await screen.findByRole('link', { name: 'Mở lại kỳ công' });
    expect(reopen.getAttribute('href')).toBe('/hr/cham-cong?ky=2026-10');
  });
});

describe('marks on the row', () => {
  const withSetting: PayrollLineDto = {
    ...NV_G,
    fullName: 'NV A',
    personSettings: [
      { key: 'khoan.com.thue', text: 'Tiền cơm chịu thuế', from: 'T10/2026', cells: ['exempt'], area: 'khoan-luong' },
    ],
  };

  it("L-L03: should dot (33) for a person's own setting and say whose and since when", async () => {
    // Arrange
    show(withSetting, '33');

    // Act
    await userEvent.hover(screen.getByText('1.268.182'));

    // Assert
    expect(screen.getByLabelText('Có cấu hình riêng')).toBeTruthy();
    expect(await screen.findByText('Riêng NV A từ T10/2026: Tiền cơm chịu thuế')).toBeTruthy();
  });

  it('L-L03: should put an icon on the code of someone with their own settings', () => {
    // Act
    render(
      <TooltipProvider>
        <CodeCell line={withSetting} />
      </TooltipProvider>,
    );

    // Assert
    expect(screen.getByLabelText('NV A có cấu hình riêng')).toBeTruthy();
  });

  it('L-L04: should mark a typed cell with a corner and show the computed number, the typed one and the reason', async () => {
    // Arrange
    const typed: PayrollLineDto = {
      ...NV_G,
      cells: { ...NV_G.cells, kpiPercent: 0 },
      overrides: [
        {
          cell: 'kpiPercent',
          computed: 0.531818,
          typed: 0,
          reason: 'Vào giữa kỳ, chưa giao KPI',
          by: 'Phòng Nhân sự',
          at: '2026-11-03T02:00:00.000Z',
        },
      ],
    };
    show(typed, '19');

    // Act
    await userEvent.hover(screen.getByText('0%'));

    // Assert
    expect(screen.getByLabelText('Ô gõ đè')).toBeTruthy();
    expect(await screen.findByText('Số tính 53,18% · HR gõ 0%')).toBeTruthy();
    expect(screen.getByText('Lý do: Vào giữa kỳ, chưa giao KPI')).toBeTruthy();
    await waitFor(() => expect(document.body.textContent).not.toMatch(/Tự động|Thủ công/));
  });
});

describe('cells HR types in Hồ sơ lương', () => {
  it("should open the person's levels over Bảng lương from (8) and (16), keeping the tab, month and filters", () => {
    // Act
    render(
      <MemoryRouter initialEntries={['/hr/luong?ky=2026-10&kv=hcm']}>
        <TooltipProvider>
          <PayrollValueCell line={NV_G} column={column('8')} month={MONTH} />
          <PayrollValueCell line={NV_G} column={column('16')} month={MONTH} />
        </TooltipProvider>
      </MemoryRouter>,
    );

    // Assert
    const links = screen.getAllByRole('link', { name: 'Mở mức lương của NV G ở Hồ sơ lương' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/hr/luong?ky=2026-10&kv=hcm&hs=nv-g&phan=muc',
      '/hr/luong?ky=2026-10&kv=hcm&hs=nv-g&phan=muc',
    ]);
  });
});

describe('the Khối cell', () => {
  const show = (line: PayrollLineDto) =>
    render(
      <MemoryRouter>
        <TooltipProvider>
          <BlockCell line={line} />
        </TooltipProvider>
      </MemoryRouter>,
    );

  it("should link the block to the person's form in Chấm công → Nhân viên", () => {
    // Act
    show(NV_G);

    // Assert
    const link = screen.getByRole('link', { name: 'Sửa khối NV G: BO' });
    expect(link.getAttribute('href')).toBe('/hr/cham-cong/nhan-vien?nv=nv-g');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should say a block is missing and land on the "Thiếu khối" list', () => {
    // Act
    show({ ...NV_G, block: null });

    // Assert
    const link = screen.getByRole('link', { name: 'Sửa khối NV G: thiếu khối' });
    expect(link.textContent).toBe('Thiếu');
    expect(link.getAttribute('href')).toBe('/hr/cham-cong/nhan-vien?nv=nv-g&khoi=none');
  });

  it("should mark a block taken from the person's record", () => {
    // Act
    show({ ...NV_G, note: 'Khối lấy từ hồ sơ nhân viên (lần chốt công chưa có khối)' });

    // Assert
    expect(screen.getByRole('img', { name: 'Khối lấy từ hồ sơ nhân viên' })).toBeTruthy();
  });
});
