import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../api';
import { spyOnApi } from '../../../../test/apiSpy';
import { open } from '../payrollTestData';
import { saveForPeople } from './bulkModel';
import { answerReads, profile } from './profileTestData';

/**
 * One fact for many people at once in Hồ sơ lương: a signed tax commitment, or "Công ty trả thay BH" in (32). One
 * request per person; the report says how many were saved and who was not, with the API's reason.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-08T03:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const dialogOf = async (button: string) => {
  fireEvent.click(await screen.findByRole('button', { name: button }));
  return screen.findByRole('dialog');
};
const tick = (box: HTMLElement, ...names: string[]) =>
  names.forEach((name) => fireEvent.click(within(box).getByRole('checkbox', { name })));

describe('one request per person', () => {
  it('should go on after a refusal and report who was not saved, with the reason', async () => {
    // Arrange
    const people = [
      { employeeId: 'a', code: 'NV01', fullName: 'NV A' },
      { employeeId: 'b', code: 'NV02', fullName: 'NV B' },
      { employeeId: 'c', code: 'NV03', fullName: 'NV C' },
    ];
    const run = vi.fn(async (id: string) => {
      if (id === 'b') throw new ApiError(409, 'Đã có cam kết năm 2026.', {});
    });

    // Act
    const result = await saveForPeople(people, ['a', 'b', 'c'], run);

    // Assert
    expect(run.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({
      total: 3,
      saved: 2,
      failed: [{ employeeId: 'b', name: 'NV02 NV B', message: 'Đã có cam kết năm 2026.' }],
    });
  });
});

describe('"Thêm cam kết thuế cho nhiều người"', () => {
  it('should save the year and the signing day for each person ticked, and say "Đã lưu 1/2 người" when one is refused', async () => {
    // Arrange
    answerReads();
    const save = spyOnApi('hrPayrollSaveCommitment').mockImplementation(async (employeeId) => {
      if (employeeId === 'nv-j') throw new ApiError(409, 'Đã có cam kết năm 2026.', {});
      return { id: 'c-9', year: 2026, signedOn: '2026-11-08' };
    });
    open('/hr/luong/ho-so?ky=2026-10');
    const box = await dialogOf('Thêm cam kết thuế cho nhiều người');

    // Act
    tick(box, 'NV01 · NV A', 'NV10 · NV J');
    fireEvent.click(within(box).getByRole('button', { name: 'Lưu cho 2 người' }));

    // Assert: today is the signing day until HR picks another
    const report = await within(box).findByRole('status');
    expect(report.textContent).toContain('Đã lưu 1/2 người');
    expect(report.textContent).toContain('NV10 NV J: Đã có cam kết năm 2026.');
    expect(save.mock.calls).toEqual([
      ['nv-a', null, { year: 2026, signedOn: '2026-11-08' }],
      ['nv-j', null, { year: 2026, signedOn: '2026-11-08' }],
    ]);
  });

  it('should not save while nobody is ticked', async () => {
    // Arrange
    answerReads();
    open('/hr/luong/ho-so?ky=2026-10');

    // Act
    const box = await dialogOf('Thêm cam kết thuế cho nhiều người');

    // Assert
    expect(within(box).getByRole('button', { name: 'Lưu cho 0 người' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('"Công ty trả thay BH cho nhiều người"', () => {
  it('should add the item from the month viewed, not taxed as the sheet, without any amount', async () => {
    // Arrange
    answerReads();
    const save = spyOnApi('hrPayrollSaveRecurring').mockResolvedValue({
      id: 'r-1',
      kind: 'insurance-paid',
      amount: 0,
      taxable: false,
      fromMonth: '2026-10',
      toMonth: null,
      note: '',
    });
    open('/hr/luong/ho-so?ky=2026-10');
    const box = await dialogOf('Công ty trả thay BH cho nhiều người');

    // Act
    tick(box, 'NV01 · NV A', 'NV10 · NV J');
    fireEvent.click(within(box).getByRole('button', { name: 'Lưu cho 2 người' }));

    // Assert
    await waitFor(() => expect(within(box).getByRole('status').textContent).toContain('Đã lưu 2/2 người'));
    const item = { kind: 'insurance-paid', amount: 0, taxable: false, fromMonth: '2026-10', toMonth: null, note: '' };
    expect(save.mock.calls).toEqual([
      ['nv-a', null, item],
      ['nv-j', null, item],
    ]);
    expect(within(box).queryByLabelText('Số tiền mỗi tháng')).toBeNull();
    expect(within(box).getByText(/NĐ 253\/2026 Đ\.8/)).toBeTruthy();
  });

  it('should send "Tính thuế" when HR ticks it', async () => {
    // Arrange
    answerReads();
    const save = spyOnApi('hrPayrollSaveRecurring').mockRejectedValue(new ApiError(409, 'Đã có khoản này.', {}));
    open('/hr/luong/ho-so?ky=2026-10');
    const box = await dialogOf('Công ty trả thay BH cho nhiều người');

    // Act
    tick(box, 'NV01 · NV A', 'Tính thuế');
    fireEvent.click(within(box).getByRole('button', { name: 'Lưu cho 1 người' }));

    // Assert
    await waitFor(() => expect(within(box).getByRole('status').textContent).toContain('Đã lưu 0/1 người'));
    expect(save.mock.calls[0]?.[2]).toMatchObject({ kind: 'insurance-paid', taxable: true });
  });
});

describe('"Công ty trả thay BH" of one person, in the drawer', () => {
  it('should show the item with its formula and whether it is taxed, and edit it without an amount', async () => {
    // Arrange
    const item = {
      id: 'r-1',
      kind: 'insurance-paid' as const,
      amount: 0,
      taxable: false,
      fromMonth: '2026-10',
      toMonth: null,
      note: '',
    };
    answerReads(profile({ recurring: [item] }));
    const save = spyOnApi('hrPayrollSaveRecurring').mockResolvedValue({ ...item, taxable: true });
    open('/hr/luong/ho-so?ky=2026-10&hs=nv-a');
    const section = await within(await screen.findByRole('dialog')).findByRole('region', {
      name: 'Khoản (32) định kỳ',
    });

    // Act
    expect(within(section).getByText('Công ty trả thay BH · tự tính = (28) + (29) + (30)')).toBeTruthy();
    expect(within(section).getByText(/chưa tính thuế/)).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: /^Sửa công ty trả thay bh/ }));
    expect(within(section).queryByLabelText('Số tiền mỗi tháng')).toBeNull();
    fireEvent.click(within(section).getByRole('checkbox', { name: 'Tính thuế' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));

    // Assert
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]).toEqual(['nv-a', 'r-1', { ...item, taxable: true }]);
  });
});
