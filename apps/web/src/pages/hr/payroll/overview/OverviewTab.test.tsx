import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type PayrollLineDto, type PayrollMonthDto } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { address, ME, month, open, person } from '../payrollTestData';

/** The Tổng quan tab (spec 11.8, step 26). Cases: docs/test-cases-luong.md L-G02, L-G05, L-G06, L-G11, L-L32. */

const cells = (over: Partial<PayrollLineDto['cells']>) => over as PayrollLineDto['cells'];
const A = person({ cells: cells({ income: 10_000_000, netPay: 8_650_000, totalCost: 12_150_000, tax: 300_000 }) });
const J = person({
  employeeId: 'nv-j',
  code: 'NV10',
  fullName: 'NV J',
  block: 'KD',
  department: 'Kinh doanh',
  cells: cells({ income: 6_000_000, netPay: 5_400_000, totalCost: 6_000_000, tax: 600_000 }),
});
const RED = { level: 'red', code: 'missing-block', employeeId: 'nv-j', cell: null, message: 'Thiếu khối' } as const;

const OCTOBER = month({
  status: 'approved',
  approval: { no: 1, at: '2026-11-04T02:00:00.000Z', by: 'HR' },
  lines: [A, J],
  review: [RED],
});
const NOVEMBER = month({ month: 11, monthKey: '2026-11', status: 'draft', lines: [A] });
const DECEMBER = month({ month: 12, monthKey: '2026-12', status: 'waiting', lines: [] });
const BY_KEY: Record<string, PayrollMonthDto> = { '2026-10': OCTOBER, '2026-11': NOVEMBER, '2026-12': DECEMBER };

/** The server has payroll from T10/2026: an earlier month is refused, as the real one does. */
function serve() {
  return spyOnApi('hrPayrollMonth').mockImplementation((year, m) => {
    const found = BY_KEY[`${year}-${String(m).padStart(2, '0')}`];
    return found ? Promise.resolve(found) : Promise.reject(new ApiError(404, 'Có bảng lương từ T10/2026.'));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
  spyOnApi('hrMe').mockResolvedValue(ME);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const hrefOf = (name: RegExp | string, inside: HTMLElement = document.body) =>
  within(inside).getByRole('link', { name }).getAttribute('href');

describe('Tổng quan of a month', () => {
  it('should show the totals of the lines, each opening Bảng lương on that month', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10');
    const view = await screen.findByRole('region', { name: 'Tổng quan T10/2026' });

    // Assert
    expect(hrefOf('Thực nhận: 14.050.000. Mở Bảng lương', view)).toBe('/hr/luong?ky=2026-10');
    expect(hrefOf('Tổng chi phí: 18.150.000. Mở Bảng lương', view)).toBe('/hr/luong?ky=2026-10');
    expect(hrefOf('Số người: 2 người. Mở Bảng lương', view)).toBe('/hr/luong?ky=2026-10');
    expect(within(view).getByText('Đã duyệt')).toBeTruthy();
  });

  it('L-G11: should split the month by block, each number opening the grid on that block', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10');
    const blocks = await screen.findByRole('region', { name: 'Theo khối' });

    // Assert
    expect(hrefOf('Thực nhận KD · Kinh doanh T10/2026: 5.400.000. Mở Bảng lương', blocks)).toBe(
      '/hr/luong?ky=2026-10&khoi=KD',
    );
    expect(hrefOf('Thực nhận tổng cộng T10/2026: 14.050.000. Mở Bảng lương', blocks)).toBe('/hr/luong?ky=2026-10');
    expect(screen.getByRole('region', { name: 'Theo bộ phận' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Theo khu vực' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Theo loại HĐ' })).toBeTruthy();
  });

  it('should follow the filters of the address and keep them in the links', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10&khoi=KD');
    const view = await screen.findByRole('region', { name: 'Tổng quan T10/2026' });

    // Assert
    expect(hrefOf('Thực nhận: 5.400.000. Mở Bảng lương', view)).toBe('/hr/luong?ky=2026-10&khoi=KD');
    expect(within(view).getByText(/Đang lọc: 1\/2 người/)).toBeTruthy();
  });

  it('should count the warnings and open Rà soát over the grid', async () => {
    // Arrange
    serve();
    open('/hr/luong/tong-quan?ky=2026-10');

    // Act
    fireEvent.click(await screen.findByRole('link', { name: '1 cảnh báo đỏ. Mở Rà soát' }));

    // Assert
    expect(await screen.findByRole('dialog', { name: 'Rà soát T10/2026' })).toBeTruthy();
    expect(address()).toBe('/hr/luong?ky=2026-10&rs=1');

    // Act
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Đóng' })[0] as HTMLElement);

    // Assert
    await waitFor(() => expect(address()).toBe('/hr/luong?ky=2026-10'));
  });

  it('L-G02: should say a draft month is a draft', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-11');
    const view = await screen.findByRole('region', { name: 'Tổng quan T11/2026' });

    // Assert
    expect(within(view).getByText('Nháp · số còn đổi')).toBeTruthy();
  });

  it('should show no number for a month waiting for the timesheet, with the way to close it', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-12');
    const view = await screen.findByRole('region', { name: 'Tổng quan T12/2026' });

    // Assert
    expect(within(view).getByText(/đang chờ chốt công nên chưa có số/)).toBeTruthy();
    expect(hrefOf('Mở Chấm công để chốt kỳ', view)).toBe('/hr/cham-cong?ky=2026-12');
    expect(within(view).queryByRole('link', { name: /Mở Bảng lương/ })).toBeNull();
  });
});

describe('Tổng quan of a year', () => {
  const yearTable = async () => {
    const view = await screen.findByRole('region', { name: 'Tổng quan năm 2026' });
    await waitFor(() => expect(within(view).queryByText('Đang tải từng tháng…')).toBeNull());
    return view;
  };
  const rowOf = (view: HTMLElement, name: string) =>
    within(view).getByRole('row', { name: new RegExp(`^(Xem tổng quan )?${name} `) });

  it('L-L32: should list T1–T12 with the status of each, in the year of the pay month', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam');
    const view = await yearTable();

    // Assert
    expect(within(view).getAllByRole('row')).toHaveLength(1 + 12 + 2);
    expect(rowOf(view, 'T10/2026').textContent).toContain('Đã duyệt lần 1');
    expect(rowOf(view, 'T11/2026').textContent).toContain('Nháp');
    expect(rowOf(view, 'T12/2026').textContent).toContain('Chờ chốt công');
  });

  it('L-G05: should say "Chưa có dữ liệu" for a month before the web, without asking for every one of them', async () => {
    // Arrange
    const asked = serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam');
    const view = await yearTable();

    // Assert
    expect(rowOf(view, 'T1/2026').textContent).toContain('Chưa có dữ liệu');
    expect(rowOf(view, 'T9/2026').textContent).toContain('Chưa có dữ liệu');
    const months = asked.mock.calls.filter(([year]) => year === 2026).map(([, m]) => m);
    expect([...new Set(months)].sort((a, b) => a - b)).toEqual([9, 10, 11, 12]);
  });

  it('should open Bảng lương of the month from each number, with the filters', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam&bp=Hành chính');
    const view = await yearTable();

    // Assert
    expect(hrefOf('Thực nhận T11/2026: 8.650.000. Mở Bảng lương', view)).toBe(
      '/hr/luong?ky=2026-11&bp=H%C3%A0nh+ch%C3%ADnh',
    );
    expect(hrefOf('Số người T10/2026: 1. Mở Bảng lương', view)).toBe('/hr/luong?ky=2026-10&bp=H%C3%A0nh+ch%C3%ADnh');
  });

  it('L-G06: should total the approved and the draft months apart', async () => {
    // Arrange
    serve();

    // Act
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam');
    const view = await yearTable();

    // Assert
    expect(rowOf(view, 'Đã duyệt · 1 tháng').textContent).toContain('14.050.000');
    expect(rowOf(view, 'Nháp · 1 tháng').textContent).toContain('8.650.000');
  });

  it('should step to another year in the address and come back to a month from its row', async () => {
    // Arrange
    serve();
    open('/hr/luong/tong-quan?ky=2026-10&xem=nam');
    await yearTable();

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'Xem tổng quan T11/2026' }));

    // Assert
    expect(await screen.findByRole('region', { name: 'Tổng quan T11/2026' })).toBeTruthy();
    expect(address()).toBe('/hr/luong/tong-quan?ky=2026-11');

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'Theo năm' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Năm 2027' }));

    // Assert
    expect(await screen.findByRole('region', { name: 'Tổng quan năm 2027' })).toBeTruthy();
    expect(address()).toBe('/hr/luong/tong-quan?ky=2026-11&xem=nam&nam=2027');
  });
});
