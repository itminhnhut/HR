import type { PayrollSettingsMonthDto, PayrollSettingViewLineDto } from '@careers/shared';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { address, ME, month, open } from '../payrollTestData';
import { LIST } from '../profiles/profileTestData';

/** Cấu hình lương (spec 6, 11.6). Cases: docs/test-cases-luong.md L-L01, L-L02, L-L05, L-A24, L-A32. */

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
  over: Partial<PayrollSettingViewLineDto> & { key: string; label: string },
): PayrollSettingViewLineDto => ({
  area: 'quy-tac',
  readOn: '2026-11',
  inForce: null,
  overrides: 0,
  rows: [],
  ...over,
});

const ROW = {
  stop: false,
  supersededBy: null,
  createdBy: 'HR',
  createdAt: '2026-11-01T02:00:00.000Z',
};

const PROBATION_ROW = {
  ...ROW,
  id: 'st-1',
  key: 'quy-tac.ty-le-thu-viec',
  employeeId: null,
  from: '2026-11',
  value: 0.95,
  source: 'Quyết định công ty',
};

const MEAL_ROW = {
  ...ROW,
  id: 'st-2',
  key: 'khoan.com.thue',
  employeeId: 'nv-a',
  from: '2026-10',
  value: { kind: 'taxable' },
  source: 'Quyết định riêng',
};

const VIEW = (monthKey: string): PayrollSettingsMonthDto => ({
  month: monthKey,
  payDate: '2026-12-05',
  insuranceDate: `${monthKey}-01`,
  lines: [
    line({ key: 'luat.luong-co-so', label: 'Lương cơ sở', area: 'tham-so', readOn: `${monthKey}-01` }),
    line({
      key: 'quy-tac.ty-le-thu-viec',
      label: 'Tỷ lệ lương thử việc',
      inForce: PROBATION_ROW,
      rows: [{ ...PROBATION_ROW, status: 'in-force' }],
    }),
    line({ key: 'quy-tac.gio-mot-ngay', label: 'Giờ một ngày' }),
    line({
      key: 'khoan.com.thue',
      label: 'khoan.com.thue',
      area: 'khoan-luong',
      overrides: 1,
      rows: [{ ...MEAL_ROW, status: 'in-force' }],
    }),
  ],
});

const REGION = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Hồ Chí Minh',
  saturdays: 2,
  tone: 'blue' as const,
  employees: 3,
  hidden: false,
  saturdayChanges: [],
};

function answerReads() {
  spyOnApi('hrMe').mockResolvedValue(ME);
  spyOnApi('hrPayrollMonth').mockResolvedValue(month());
  spyOnApi('hrPayrollProfiles').mockResolvedValue(LIST);
  spyOnApi('hrRegions').mockResolvedValue([REGION]);
  return spyOnApi('hrPayrollSettingsMonth').mockImplementation(async (m) => VIEW(m));
}

const saved = (input: { key: string; from: string; value?: unknown; employeeId?: string | null }) => ({
  setting: { ...ROW, id: 'st-new', source: '', employeeId: null, value: null, ...input },
  warnings: [],
  approvedMonthsTouched: [],
});

const items = () => screen.getAllByRole('button', { expanded: false }).map((b) => b.textContent ?? '');

describe('the Cấu hình tab', () => {
  it('L-L05: should open on the current pay month and say which dates it reads', async () => {
    // Arrange
    const read = answerReads();

    // Act
    open('/hr/luong/cau-hinh');

    // Assert
    await waitFor(() => expect(read).toHaveBeenCalledWith('2026-11'));
    expect(screen.getByRole('button', { name: /^Kỳ lương T11\/2026/ })).toBeTruthy();
    expect(await screen.findByText(/Xem cấu hình áp dụng cho T11\/2026/)).toBeTruthy();
  });

  it('should show the default with its legal source, and mark a value changed for everyone', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/cau-hinh?muc=quy-tac');

    // Assert
    const probation = (await screen.findByText('Tỷ lệ lương thử việc')).closest('li');
    expect(probation && within(probation).getByText('95%')).toBeTruthy();
    expect(probation && within(probation).getByText('Đã đổi')).toBeTruthy();
    expect(probation && within(probation).getByText(/Mặc định 90% · từ T1\/2026 · BLLĐ Đ.26/)).toBeTruthy();
  });

  it('F24: should list the minimum-wage zone of each region under Bảo hiểm, vùng I until HR picks one', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/cau-hinh?muc=bao-hiem');

    // Assert
    const zone = (await screen.findByText('Vùng lương tối thiểu · Hồ Chí Minh')).closest('li');
    expect(zone && within(zone).getAllByText(/Vùng I/).length).toBeGreaterThan(0);
    expect(zone && within(zone).getByRole('button', { name: 'Đổi Vùng lương tối thiểu · Hồ Chí Minh' })).toBeTruthy();
  });

  it('F27: should add a pay component from the month viewed, last in the list, with an id made from its name', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting').mockImplementation(async (input) => saved(input));
    open('/hr/luong/cau-hinh?muc=khoan-luong');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm khoản lương' }));
    const form = screen.getByRole('form', { name: 'Thêm khoản lương từ T11/2026' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Tên khoản lương' }), {
      target: { value: 'PC độc hại' },
    });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Mức điền sẵn' }), { target: { value: '500.000' } });
    fireEvent.click(within(form).getByRole('checkbox', { name: 'Chia theo ngày công' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    const input = add.mock.calls[0]?.[0];
    const list = Array.isArray(input?.value) ? (input.value as { id: string; order: number }[]) : [];
    expect(input).toMatchObject({ key: 'khoan.danh-sach', from: '2026-11' });
    expect(list.map((c) => c.id).slice(-2)).toEqual(['chuyen-can', 'pc-doc-hai']);
    expect(list.at(-1)).toMatchObject({
      name: 'PC độc hại',
      perDay: false,
      insured: false,
      contractPay: false,
      tax: { kind: 'taxable' },
      defaultAmount: 500_000,
      stoppedFrom: null,
    });
  });

  it('F27: should offer Đổi tên and Ngừng dùng on a pay component, and stop it from the month viewed', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting').mockImplementation(async (input) => saved(input));
    open('/hr/luong/cau-hinh?muc=khoan-luong');

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng dùng Tiền cơm' }));
    const ask = screen.getByRole('alertdialog', { name: 'Ngừng dùng Tiền cơm' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Ngừng dùng từ T11/2026' }));

    // Assert
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ key: 'khoan.com.ngung', from: '2026-11', value: '2026-11', source: '' }),
    );
    expect(screen.getByRole('button', { name: 'Đổi tên Tiền cơm' })).toBeTruthy();
  });

  it('should narrow to "Chỉ mục đã đổi" and keep it in the address', async () => {
    // Arrange
    answerReads();
    open('/hr/luong/cau-hinh?muc=quy-tac');
    await screen.findByText('Giờ một ngày');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ mục đã đổi' }));

    // Assert
    await waitFor(() => expect(screen.queryByText('Giờ một ngày')).toBeNull());
    expect(items().some((t) => t.includes('Tỷ lệ lương thử việc'))).toBe(true);
    expect(address()).toContain('doi=1');
  });

  it('L-L02: should add a new version for everyone from the month HR picks', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting').mockResolvedValue(
      saved({ key: 'quy-tac.gio-mot-ngay', from: '2026-12', value: 7.5 }),
    );
    open('/hr/luong/cau-hinh?muc=quy-tac');
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi Giờ một ngày' }));
    const form = await screen.findByRole('form', { name: 'Đổi cho tất cả' });

    // Act
    expect(within(form).getByLabelText('Áp dụng từ')).toHaveProperty('value', '2026-11');
    fireEvent.change(within(form).getByLabelText('Giờ một ngày'), { target: { value: '7.5' } });
    fireEvent.change(within(form).getByLabelText('Áp dụng từ'), { target: { value: '2026-12' } });
    fireEvent.change(within(form).getByLabelText('Nguồn / lý do'), { target: { value: 'Nội quy mới' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        key: 'quy-tac.gio-mot-ngay',
        employeeId: null,
        from: '2026-12',
        value: 7.5,
        source: 'Nội quy mới',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Đổi cho tất cả' })).toBeNull());
  });

  it('L-L01: should list a person override and add one for another person', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting').mockResolvedValue(
      saved({ key: 'khoan.com.thue', from: '2026-11', employeeId: 'nv-j', value: { kind: 'taxable' } }),
    );
    open('/hr/luong/cau-hinh?muc=khoan-luong');
    const meal = await screen.findByRole('region', { name: 'Tiền cơm' });
    const tax = within(meal).getByText('Cách thuế').closest('li');
    if (!tax) throw new Error('no Cách thuế row for Tiền cơm');
    expect(within(tax).getByText('1 người riêng')).toBeTruthy();

    // Act
    fireEvent.click(within(tax).getByRole('button', { expanded: false }));
    const own = within(tax).getByRole('region', { name: 'Riêng từng người: Cách thuế' });
    expect(within(own).getByText('NV01 · NV A: Chịu thuế')).toBeTruthy();
    fireEvent.click(within(tax).getByRole('button', { name: 'Thêm ghi đè' }));
    const form = within(tax).getByRole('form', { name: 'Ghi đè cho nhân viên đã chọn' });
    fireEvent.click(within(form).getByRole('checkbox', { name: 'NV10 · NV J' }));
    fireEvent.change(within(form).getByLabelText('Cách thuế'), { target: { value: 'taxable' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'khoan.com.thue',
          employeeId: 'nv-j',
          from: '2026-11',
          value: { kind: 'taxable' },
        }),
      ),
    );
  });

  it('should save one row per person when several are picked, and name the ones the API refused', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting').mockImplementation(async (input) => {
      if (input.employeeId === 'nv-z') throw new ApiError(422, 'Người này đã nghỉ việc.');
      return saved({ key: input.key, from: input.from, employeeId: input.employeeId, value: input.value });
    });
    open('/hr/luong/cau-hinh?muc=quy-tac');
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi Tỷ lệ lương thử việc' }));
    const all = await screen.findByRole('form', { name: 'Đổi cho tất cả' });

    // Act
    fireEvent.click(within(all).getByRole('radio', { name: 'Chọn nhân viên (nhiều)' }));
    const form = await screen.findByRole('form', { name: 'Ghi đè cho nhân viên đã chọn' });
    fireEvent.click(within(form).getByRole('checkbox', { name: 'NV01 · NV A' }));
    fireEvent.click(within(form).getByRole('checkbox', { name: 'NV10 · NV J' }));
    fireEvent.click(within(form).getByRole('checkbox', { name: 'NV20 · NV Z' }));
    expect(within(form).getByText('Đã chọn 3 người')).toBeTruthy();
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(add).toHaveBeenCalledTimes(3));
    expect(add.mock.calls.map(([input]) => input.employeeId).sort()).toEqual(['nv-a', 'nv-j', 'nv-z']);
    const alert = await within(form).findByRole('alert');
    expect(alert.textContent).toContain('Đã lưu 2/3 người');
    expect(alert.textContent).toContain('NV20 · NV Z: Người này đã nghỉ việc.');
    expect(within(form).getByText('Đã chọn 1 người')).toBeTruthy();
  });

  it('should not save for nobody when "Chọn nhân viên" has no one picked', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddSetting');
    open('/hr/luong/cau-hinh?muc=quy-tac');
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi Tỷ lệ lương thử việc' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Chọn nhân viên (nhiều)' }));
    const form = await screen.findByRole('form', { name: 'Ghi đè cho nhân viên đã chọn' });

    // Act
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect((await within(form).findByRole('alert')).textContent).toContain('Chọn ít nhất một nhân viên.');
    expect(add).not.toHaveBeenCalled();
  });

  it('L-A24: should put the API refusal on the value field', async () => {
    // Arrange
    answerReads();
    spyOnApi('hrPayrollAddSetting').mockRejectedValue(
      new ApiError(422, 'Luật tối thiểu 85% (BLLĐ Đ.26).', { value: 'Luật tối thiểu 85% (BLLĐ Đ.26).' }),
    );
    open('/hr/luong/cau-hinh?muc=quy-tac');
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi Tỷ lệ lương thử việc' }));
    const form = await screen.findByRole('form', { name: 'Đổi cho tất cả' });

    // Act
    fireEvent.change(within(form).getByLabelText('Tỷ lệ lương thử việc (%)'), { target: { value: '80' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Lưu' }));

    // Assert
    const field = (await within(form).findByText('Luật tối thiểu 85% (BLLĐ Đ.26).')).closest('label');
    expect(field?.getAttribute('data-invalid')).toBe('');
    expect(field?.textContent).toContain('Giá trị');
  });

  it('L-A32: should read another month when HR picks it', async () => {
    // Arrange
    const read = answerReads();
    open('/hr/luong/cau-hinh?muc=bao-hiem');
    await screen.findByText('Lương cơ sở');

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));

    // Assert
    await waitFor(() => expect(read).toHaveBeenCalledWith('2026-10'));
    expect(address()).toContain('ky=2026-10');
  });

  it('L-L09: should open the setting a grid tooltip links to, in its group, marked', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/cau-hinh?ky=2026-10&muc=tham-so&khoa=luat.luong-co-so');

    // Assert
    const item = (await screen.findByText('Lương cơ sở')).closest('li');
    expect(item?.getAttribute('aria-current')).toBe('true');
    expect(item && within(item).getByRole('button', { expanded: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bảo hiểm' }).getAttribute('aria-current')).toBe('page');
  });

  it('should show another group when HR picks it in the menu', async () => {
    // Arrange
    answerReads();
    open('/hr/luong/cau-hinh?ky=2026-10&muc=tham-so&khoa=luat.luong-co-so');
    await screen.findByText('Lương cơ sở');

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Quy tắc/ }));

    // Assert
    expect(await screen.findByText('Giờ một ngày')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Quy tắc/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('Lương cơ sở')).toBeNull();
  });
});
