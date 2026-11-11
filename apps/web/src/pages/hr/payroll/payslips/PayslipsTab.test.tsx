import { DEFAULT_MESSAGE_TEMPLATES, TEMPLATE_KEYS, type PayslipListDto, type PayslipPersonDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../../api';
import * as richCopy from '../../mail/copyRichMail';
import { filtersFromParams } from '../payrollModel';
import { ME, month, person as line } from '../payrollTestData';
import { PayslipsTab } from './PayslipsTab';
import { PayslipTabCount } from './PayslipTabCount';

/** Lương › Phiếu lương on screen: the list, the mail of one person, "Sao chép & mở Outlook", the walk. Made-up people. */
const NEVER = { state: 'never' as const, at: null, by: null, channel: null, error: null };
const SENT = {
  state: 'sent' as const,
  at: '2026-11-05T07:05:00.000Z',
  by: 'HR Thử',
  channel: 'manual' as const,
  error: null,
};
const lines = [
  line({ employeeId: 'e1', code: 'NV01', fullName: 'Người Thử A' }),
  line({ employeeId: 'e2', code: 'NV02', fullName: 'Người Thử B' }),
  line({ employeeId: 'e3', code: 'NV03', fullName: 'Người Thử C' }),
];
const SHEET = month({ lines, status: 'approved' });
const row = (
  employeeId: string,
  code: string,
  fullName: string,
  over: Partial<PayslipPersonDto> = {},
): PayslipPersonDto => ({
  employeeId,
  code,
  fullName,
  department: 'Kế toán',
  block: 'BO',
  email: `${code.toLowerCase()}@example.com`,
  netPay: 9_000_000,
  send: NEVER,
  ...over,
});
const PEOPLE = [
  row('e1', 'NV01', 'Người Thử A'),
  row('e2', 'NV02', 'Người Thử B', { email: null }),
  row('e3', 'NV03', 'Người Thử C'),
];
const listOf = (over: Partial<PayslipListDto> = {}): PayslipListDto => ({
  monthKey: SHEET.monthKey,
  status: 'approved',
  approvalNo: 1,
  payDate: SHEET.payDate,
  canSend: true,
  mail: { isConfigured: false, redirectTo: null, blocked: null },
  people: PEOPLE,
  ...over,
});

let opened: string[];

function show(list: PayslipListDto, start = '/hr/luong/phieu-luong') {
  vi.spyOn(api, 'hrPayrollPayslips').mockResolvedValue(list);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[start]}>
        <PayslipTabCount />
        <PayslipsTab month={SHEET} filters={filtersFromParams(new URLSearchParams())} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[2]?.textContent);
const dialog = () => within(screen.getByRole('dialog'));

beforeEach(() => {
  opened = [];
  vi.spyOn(api, 'hrMe').mockResolvedValue(ME);
  vi.spyOn(api, 'hrMessageTemplates').mockResolvedValue({
    templates: TEMPLATE_KEYS.map((k) => DEFAULT_MESSAGE_TEMPLATES[k]),
    customized: [],
  });
  vi.spyOn(richCopy, 'copyRichMail').mockResolvedValue('copied');
  vi.spyOn(window, 'open').mockImplementation((url) => {
    opened.push(String(url));
    return null;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the payslip list', () => {
  it('should list the person without an email first, with a red link to their form, and count who is not sent', async () => {
    // Act
    show(listOf({ people: [PEOPLE[0]!, PEOPLE[1]!, { ...PEOPLE[2]!, send: SENT }] }));

    // Assert
    await screen.findByText('Người Thử B');
    expect(names()).toEqual(['Người Thử B', 'Người Thử A', 'Người Thử C']);
    const missing = screen.getByRole('link', { name: 'Thiếu email Người Thử B: bấm để nhập' });
    expect(missing.getAttribute('href')).toBe('/hr/cham-cong/nhan-vien?nv=e2');
    expect(screen.getByText('Đã gửi lúc 14:05 05/11/2026 bởi HR Thử')).toBeTruthy();
    expect(screen.getByLabelText('2 người chưa gửi phiếu lương').textContent).toBe('2');
  });

  it('should show only the people of the status picked, kept in the address', async () => {
    // Act
    show(listOf({ people: [PEOPLE[0]!, { ...PEOPLE[2]!, send: SENT }] }), '/hr/luong/phieu-luong?gui=da');

    // Assert
    await screen.findByText('Người Thử C');
    expect(names()).toEqual(['Người Thử C']);
  });
});

describe('sending to one person', () => {
  it('should copy the designed mail with the payslip in it, open Outlook to the employee and record "Đã gửi"', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf());
    await userEvent.click(await screen.findByRole('button', { name: 'Xem và gửi phiếu lương Người Thử A' }));

    // Act
    await userEvent.click(dialog().getByRole('button', { name: 'Sao chép & mở Outlook' }));

    // Assert
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1'], sent: true }));
    const [html, text] = vi.mocked(richCopy.copyRichMail).mock.calls[0] ?? [];
    expect(html).toContain('Thân gửi anh/chị Người Thử A,');
    expect(html).toContain('Thực nhận');
    expect(text).toContain('THỰC NHẬN');
    const url = new URL(opened[0] ?? '');
    expect(url.searchParams.get('to')).toBe('nv01@example.com');
    expect(url.searchParams.get('subject')).toContain('Người Thử A');
  });

  it('should record one "Đã gửi" however often the button is pressed', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf());
    await userEvent.click(await screen.findByRole('button', { name: 'Xem và gửi phiếu lương Người Thử A' }));

    // Act
    await userEvent.click(dialog().getByRole('button', { name: 'Sao chép & mở Outlook' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Sao chép & mở Outlook' }));

    // Assert
    await waitFor(() => expect(opened).toHaveLength(2));
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('should take the mark back with "Đánh dấu chưa gửi"', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf({ people: [{ ...PEOPLE[0]!, send: SENT }] }), '/hr/luong/phieu-luong?pl=e1');

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Đánh dấu chưa gửi' }));

    // Assert
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1'], sent: false }));
  });

  it('should only preview a month that is not approved, and say why the buttons are off', async () => {
    // Arrange
    show(listOf({ status: 'draft', canSend: false, approvalNo: null }), '/hr/luong/phieu-luong?pl=e1');

    // Assert
    const send = await screen.findByRole<HTMLButtonElement>('button', { name: 'Sao chép & mở Outlook' });
    expect(send.disabled).toBe(true);
    expect(dialog().getByRole<HTMLButtonElement>('button', { name: 'Đánh dấu đã gửi' }).disabled).toBe(true);
    expect(dialog().getByRole('note').textContent).toContain('Tháng lương chưa duyệt');
    expect(dialog().getByTitle('Xem trước thư phiếu lương')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Tích người cần gửi', hidden: true }).disabled).toBe(
      true,
    );
  });

  it('should hold the send button for someone without an email', async () => {
    // Arrange
    show(listOf(), '/hr/luong/phieu-luong?pl=e2');

    // Assert
    expect((await screen.findByRole<HTMLButtonElement>('button', { name: 'Sao chép & mở Outlook' })).disabled).toBe(
      true,
    );
    expect(dialog().getByRole('note').textContent).toContain('chưa có email');
  });
});

describe('several people, one by one', () => {
  it('should walk the ticked people in order, one mail at a time', async () => {
    // Arrange
    show(listOf());
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Chọn Người Thử A' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Người Thử C' }));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Gửi lần lượt 2 người' }));
    const first = dialog().getByRole('heading').textContent;
    await userEvent.click(dialog().getByRole('button', { name: 'Tiếp' }));
    const second = dialog().getByRole('heading').textContent;
    await userEvent.click(dialog().getByRole('button', { name: 'Xong' }));

    // Assert
    expect(first).toContain('Người 1/2 · Phiếu lương · Người Thử A');
    expect(second).toContain('Người 2/2 · Phiếu lương · Người Thử C');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opened).toEqual([]);
  });
});
