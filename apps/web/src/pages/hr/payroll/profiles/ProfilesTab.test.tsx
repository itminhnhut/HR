import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { address, month, open, person } from '../payrollTestData';
import { answerReads, LEVEL, LIST, profile } from './profileTestData';

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
    const missing = screen.getByRole('button', { name: 'Mở hồ sơ NV M' }).closest('li');
    expect(missing && within(missing).getByText('Thiếu hồ sơ')).toBeTruthy();
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

  it('F15: should confirm every open item of the person in one go, after asking once', async () => {
    // Arrange
    answerReads();
    const confirm = spyOnApi('hrPayrollConfirmCheck').mockResolvedValue({
      id: 'check-1',
      item: 'so-du-dau-nam',
      employeeId: 'nv-a',
      closingId: null,
      confirmed: true,
      confirmedAt: '2026-11-08T03:00:00.000Z',
      confirmedBy: 'Phòng Nhân sự',
    });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const box = await drawer();

    // Act
    fireEvent.click(await within(box).findByRole('button', { name: 'Đã kiểm cả 2 mục của người này' }));
    const ask = within(box).getByRole('alertdialog', { name: 'Xác nhận đã kiểm' });
    expect(ask.textContent).toMatch(/^Xác nhận đã kiểm 2 mục của /);
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(within(ask).getByRole('button', { name: 'Xác nhận' }));

    // Assert
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(confirm.mock.calls.every(([input]) => input.employeeId === 'nv-a' && input.confirmed)).toBe(true);
  });

  it('F28: should open the bank section with the add form shown when "Thiếu" is clicked in Tài khoản', async () => {
    // Arrange: NV A is paid this month and has no bank account.
    answerReads();
    const noAccount = person({
      employeeId: 'nv-a',
      sheet: {
        title: '',
        dependants: 1,
        taxMethod: 'progressive',
        paid: {},
        payslipEmail: null,
        bankName: null,
        bankAccount: null,
      },
    });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ lines: [noAccount] }));
    open('/hr/luong/ho-so?ky=2026-10');

    // Act
    const cells = await screen.findAllByRole('button', {
      name: /^Tài khoản của NV A: Thiếu\. Thêm tài khoản ngân hàng/,
    });
    fireEvent.click(cells[0] as HTMLElement);

    // Assert
    const bank = await within(await drawer()).findByRole('region', { name: 'Ngân hàng' });
    expect(await within(bank).findByRole('textbox', { name: 'Số tài khoản' })).toBeTruthy();
    expect(address()).toBe('/hr/luong/ho-so?ky=2026-10&hs=nv-a&phan=ngan-hang&them=1');
  });

  it('should show the account on file today in Tài khoản, whatever the month viewed says, and "Từ dd/mm" for one that starts later', async () => {
    // Arrange: the month viewed was paid before either account started.
    answerReads();
    const [a, j, ...rest] = LIST.people;
    spyOnApi('hrPayrollProfiles').mockResolvedValue({
      ...LIST,
      people: [
        { ...a!, account: { last4: '6789', changedOn: '2026-11-08', isInForce: true } },
        { ...j!, account: { last4: '1111', changedOn: '2026-11-12', isInForce: false } },
        ...rest.map((p) => ({ ...p, account: null })),
      ],
    });

    // Act
    open('/hr/luong/ho-so?ky=2026-10');

    // Assert
    const inForce = await screen.findAllByRole('button', { name: /^Tài khoản của NV A: ••••6789\. Mở phần Tài khoản/ });
    const later = screen.getAllByRole('button', { name: /^Tài khoản của NV J: Từ 12\/11\. Mở phần Tài khoản/ });
    const none = screen.getAllByRole('button', { name: /^Tài khoản của NV M: Thiếu\. Thêm tài khoản ngân hàng/ });
    expect([inForce.length, later.length, none.length].every((n) => n > 0)).toBe(true);
  });

  it("should date a person's first account from the day they joined, so it is there for every month, and say so", async () => {
    // Arrange
    answerReads(profile({ bankAccounts: [] }));
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a&phan=ngan-hang&them=1');

    // Act
    const bank = await within(await drawer()).findByRole('region', { name: 'Ngân hàng' });
    const from = await within(bank).findByRole('button', { name: 'Từ ngày' });

    // Assert
    expect(from.textContent).toBe('02/03/2025');
    expect(within(bank).getByRole('note').textContent).toBe(
      'Tài khoản này dùng cho mọi kỳ lương có ngày trả lương từ 02/03/2025 trở đi. Tài khoản đầu tiên: điền sẵn ngày vào làm để tháng lương nào cũng có tài khoản.',
    );
  });

  it('should date a later account from today and say which pay dates it is for', async () => {
    // Arrange: the person already has an account.
    answerReads();
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a&phan=ngan-hang&them=1');

    // Act
    const bank = await within(await drawer()).findByRole('region', { name: 'Ngân hàng' });
    const from = await within(bank).findByRole('button', { name: 'Từ ngày' });

    // Assert
    expect(from.textContent).toBe('08/11/2026');
    expect(within(bank).getByRole('note').textContent).toBe(
      'Tài khoản này dùng cho mọi kỳ lương có ngày trả lương từ 08/11/2026 trở đi. Các kỳ trả trước ngày đó giữ tài khoản cũ.',
    );
  });

  it('F28: should open the dependants of the person, nothing being added, from a number of dependants', async () => {
    // Arrange
    answerReads();
    const paid = person({
      employeeId: 'nv-a',
      sheet: {
        title: '',
        dependants: 2,
        taxMethod: 'progressive',
        paid: {},
        payslipEmail: null,
        bankName: null,
        bankAccount: '••••1234',
      },
    });
    spyOnApi('hrPayrollMonth').mockResolvedValue(month({ lines: [paid] }));
    open('/hr/luong/ho-so?ky=2026-10');

    // Act
    fireEvent.click((await screen.findAllByRole('button', { name: /^NPT của NV A: 2\./ }))[0] as HTMLElement);

    // Assert
    await drawer();
    expect(address()).toBe('/hr/luong/ho-so?ky=2026-10&hs=nv-a&phan=npt');
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

  it("should keep the payslip email out of the bank form: it is the person's own, edited in Chấm công › Nhân viên", async () => {
    // Arrange
    answerReads();
    const add = spyOnApi('hrPayrollAddBank').mockResolvedValue({
      id: 'b-2',
      bank: 'Ngân hàng Thử',
      last4: '8901',
      changedOn: '2026-10-01',
    });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const bank = await within(await drawer()).findByRole('region', { name: 'Ngân hàng' });

    // Act
    fireEvent.click(await within(bank).findByRole('button', { name: 'Thêm tài khoản' }));
    fireEvent.change(within(bank).getByLabelText('Ngân hàng'), { target: { value: 'Ngân hàng Thử' } });
    fireEvent.change(within(bank).getByLabelText('Số tài khoản'), { target: { value: '012345678901' } });
    fireEvent.click(within(bank).getByRole('button', { name: 'Lưu' }));

    // Assert
    expect(within(bank).queryByLabelText('Email nhận phiếu lương')).toBeNull();
    const link = within(bank).getByRole('link', { name: 'Sửa email ở Chấm công › Nhân viên' });
    expect(link.getAttribute('href')).toBe('/hr/cham-cong/nhan-vien?nv=nv-a');
    await waitFor(() => expect(add).toHaveBeenCalled());
    expect(Object.keys(add.mock.calls[0]?.[1] ?? {}).sort()).toEqual(['accountNumber', 'bank', 'changedOn']);
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
