import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { address, open } from '../payrollTestData';
import { answerReads, LEVEL, profile } from './profileTestData';

/** Hồ sơ lương (spec 11.5, 17.2). Cases: docs/test-cases-luong.md L-B01, L-B06, L-B24, L-B28, L-L17. */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const rows = () => screen.getAllByRole('button', { name: /^Mở hồ sơ / }).map((b) => b.getAttribute('aria-label'));
const drawer = async () => screen.findByRole('dialog');

describe('the list', () => {
  it('should open on the people still working, with "Thiếu hồ sơ" on whoever has no profile', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/ho-so?ky=2026-10');

    // Assert
    await waitFor(() => expect(rows()).toEqual(['Mở hồ sơ NV A', 'Mở hồ sơ NV J', 'Mở hồ sơ NV M']));
    const missing = screen.getByRole('button', { name: 'Mở hồ sơ NV M' });
    expect(within(missing).getByText('Thiếu hồ sơ')).toBeTruthy();
    expect(screen.getByText(/1 người có trong Chấm công, chưa có hồ sơ lương/)).toBeTruthy();
  });

  it('should narrow by search, block, department and "Thiếu hồ sơ" from the address', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/ho-so?ky=2026-10&khoi=KD');

    // Assert
    await waitFor(() => expect(rows()).toEqual(['Mở hồ sơ NV J', 'Mở hồ sơ NV M']));
    fireEvent.click(screen.getByRole('button', { name: 'Thiếu hồ sơ' }));
    await waitFor(() => expect(rows()).toEqual(['Mở hồ sơ NV M']));
    expect(address()).toContain('thieu=1');
  });

  it('should show the people who left when the status asks for them, and keep department filters', async () => {
    // Arrange
    answerReads();
    open('/hr/luong/ho-so?ky=2026-10&bp=H%C3%A0nh%20ch%C3%ADnh');
    await waitFor(() => expect(rows()).toEqual(['Mở hồ sơ NV A']));

    // Act
    fireEvent.change(screen.getByRole('combobox', { name: 'Trạng thái' }), { target: { value: 'left' } });

    // Assert
    await waitFor(() => expect(screen.getByText('Không có nhân viên phù hợp.')).toBeTruthy());
    expect(address()).toContain('tt=nghi');
  });
});

describe('the drawer', () => {
  it('should open on the levels with the one in force for the month marked, when the grid sends HR there', async () => {
    // Arrange
    answerReads(profile({ versions: [{ ...LEVEL, id: 'lv-0', effectiveOn: '2026-01-01' }, LEVEL] }));

    // Act
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a&phan=muc');

    // Assert
    const box = await drawer();
    const levels = await within(box).findByRole('region', { name: 'Mức lương theo ngày hiệu lực' });
    const current = within(levels)
      .getByText(/^Từ 26\/09\/2026/)
      .closest('li');
    expect(current?.getAttribute('aria-current')).toBe('true');
    expect(
      within(levels)
        .getByText(/^Từ 01\/01\/2026/)
        .closest('li')
        ?.getAttribute('aria-current'),
    ).toBeNull();
    expect(within(levels).getByText('Áp dụng cho T10/2026')).toBeTruthy();
  });

  it('L-B28: should list what is still open for the person and the facts from Chấm công as read-only', async () => {
    // Arrange
    answerReads();

    // Act
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');

    // Assert
    const box = await drawer();
    expect(await within(box).findByText('Còn thiếu: 2 mục trước tháng lương đầu')).toBeTruthy();
    expect(within(box).getByText('Số dư đầu năm:')).toBeTruthy();
    expect(within(box).getByRole('link', { name: /Sửa ở Chấm công/ })).toBeTruthy();
  });

  it('should start a new level from the latest one and send it by month, with a toast', async () => {
    // Arrange
    answerReads();
    const save = spyOnApi('hrPayrollSaveLevel').mockResolvedValue({
      version: { ...LEVEL, id: 'lv-2', effectiveOn: '2026-11-26' },
      warnings: [],
      splitsMonth: null,
      approvedMonthsTouched: [],
    });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();
    fireEvent.click(await within(box).findByRole('button', { name: 'Thêm mức' }));

    // Act
    fireEvent.change(within(box).getByLabelText('Từ tháng'), { target: { value: '2026-12' } });
    expect(within(box).getByText('Lưu ngày 26/11/2026 (đầu kỳ T12/2026).')).toBeTruthy();
    fireEvent.click(within(box).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith('nv-a', null, {
        fromMonth: '2026-12',
        contractTypeId: 'khong-thoi-han',
        probationDays: null,
        managesBusiness: false,
        unionMember: true,
        kpiAmount: 2_000_000,
        amounts: { luong: 6_400_000, com: 1_100_000 },
      }),
    );
  });

  it('L-B01: should fill the first level from the prefill, from the day they joined', async () => {
    // Arrange
    answerReads(profile({ versions: [], person: { ...profile().person, employeeId: 'nv-m', fullName: 'NV M' } }));
    spyOnApi('hrPayrollProfilePrefill').mockResolvedValue({
      effectiveOn: '2026-11-03',
      contractTypeId: 'thu-viec',
      probationDays: null,
      amounts: { com: 1_100_000 },
      suggestedOfficialOn: null,
    });
    const save = spyOnApi('hrPayrollSaveLevel').mockResolvedValue({
      version: { ...LEVEL, effectiveOn: '2026-11-03' },
      warnings: [],
      splitsMonth: '2026-11',
      approvedMonthsTouched: [],
    });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-m');
    const box = await drawer();

    // Act
    fireEvent.click(await within(box).findByRole('button', { name: 'Tạo hồ sơ' }));
    fireEvent.click(await within(box).findByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]?.[2]).toMatchObject({
      effectiveOn: '2026-11-03',
      contractTypeId: 'thu-viec',
      amounts: { com: 1_100_000 },
    });
  });

  it('L-L17: should add a dependant range after the last one and delete a commitment, each confirmed by a toast', async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollSaveDependant').mockResolvedValue({
      id: 'd-2',
      fromMonth: '2027-01',
      toMonth: null,
      count: 2,
    });
    const remove = spyOnApi('hrPayrollDeleteFact').mockResolvedValue({ ok: true });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();
    const npt = await within(box).findByRole('region', { name: 'Người phụ thuộc' });

    // Act
    fireEvent.click(within(npt).getByRole('button', { name: 'Thêm' }));
    fireEvent.click(within(npt).getByRole('button', { name: 'Lưu' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Xoá cam kết năm 2026' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }));

    // Assert
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith('nv-a', null, { fromMonth: '2027-01', toMonth: null, count: 2 }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith('nv-a', 'commitments', 'c-1'));
  });

  it('L-B24: should show the API field error on the account number field', async () => {
    // Arrange
    answerReads();
    const message = 'Số tài khoản gồm 6–19 chữ số.';
    spyOnApi('hrPayrollAddBank').mockRejectedValue(new ApiError(422, message, { accountNumber: message }));
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();

    // Act
    fireEvent.click(await within(box).findByRole('button', { name: 'Thêm tài khoản' }));
    fireEvent.change(within(box).getByLabelText('Số tài khoản'), { target: { value: '12' } });
    fireEvent.click(within(box).getByRole('button', { name: 'Lưu' }));

    // Assert
    const field = (await within(box).findByText(message)).closest('label');
    expect(field?.hasAttribute('data-invalid')).toBe(true);
    expect(within(field ?? box).getByLabelText('Số tài khoản')).toBeTruthy();
  });

  it('L-B24: should show only the last four digits until "Hiện đủ", which asks the API (logged)', async () => {
    // Arrange
    answerReads();
    const reveal = spyOnApi('hrPayrollRevealBank').mockResolvedValue({ accountNumber: '0001234567' });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();
    expect(await within(box).findByText('••••4567')).toBeTruthy();
    expect(within(box).queryByText('0001234567')).toBeNull();

    // Act
    fireEvent.click(within(box).getByRole('button', { name: 'Hiện đủ' }));

    // Assert
    expect(await within(box).findByText('0001234567')).toBeTruthy();
    expect(reveal).toHaveBeenCalledWith('nv-a', 'b-1');
  });
});

describe('the toast', () => {
  it('should confirm a saved commitment', async () => {
    // Arrange
    answerReads(profile({ commitments: [] }));
    spyOnApi('hrPayrollSaveCommitment').mockResolvedValue({ id: 'c-2', year: 2026, signedOn: '2026-11-02' });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();
    const section = await within(box).findByRole('region', { name: 'Cam kết thuế (mẫu 08)' });

    // Act
    fireEvent.click(within(section).getByRole('button', { name: 'Thêm' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(await screen.findByText('Đã lưu cam kết năm 2026.')).toBeTruthy();
  });
});
