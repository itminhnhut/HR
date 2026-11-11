import {
  DEFAULT_MESSAGE_TEMPLATES,
  TEMPLATE_KEYS,
  type PayrollLineDto,
  type PayslipChangesDto,
  type PayslipListDto,
  type PayslipPersonDto,
} from '@careers/shared';
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
    const sent = screen.getByRole('row', { name: /Người Thử C/ });
    expect(within(sent).getByText('Đã gửi')).toBeTruthy();
    expect(within(sent).getByText('14:05 · 05/11/2026 · bởi HR Thử')).toBeTruthy();
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

  it('should keep only the send actions in the drawer: the mark is on the list', async () => {
    // Arrange
    show(listOf(), '/hr/luong/phieu-luong?pl=e1');

    // Assert
    await screen.findByRole('button', { name: 'Sao chép & mở Outlook' });
    expect(dialog().getByText('Chưa gửi')).toBeTruthy();
    expect(dialog().queryByRole('button', { name: /Đánh dấu/ })).toBeNull();
    expect(dialog().getByText(/Web tự ghi "Đã gửi" cho người này/)).toBeTruthy();
  });

  it('should only preview a month that is not approved, and say why the buttons are off', async () => {
    // Arrange
    show(listOf({ status: 'draft', canSend: false, approvalNo: null }), '/hr/luong/phieu-luong?pl=e1');

    // Assert
    const send = await screen.findByRole<HTMLButtonElement>('button', { name: 'Sao chép & mở Outlook' });
    expect(send.disabled).toBe(true);
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

describe('marking on the list, without opening the mail', () => {
  const STALE = { ...SENT, state: 'stale' as const };

  it('should mark one person sent with one click on their row', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf());

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Đánh dấu đã gửi Người Thử A' }));

    // Assert
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1'], sent: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should take the mark of a sent person back with "Bỏ đánh dấu"', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf({ people: [{ ...PEOPLE[0]!, send: SENT }] }));

    // Act
    const undo = await screen.findByRole('button', { name: 'Bỏ đánh dấu đã gửi Người Thử A' });
    const words = undo.textContent;
    await userEvent.click(undo);

    // Assert
    expect(words).toBe('Bỏ đánh dấu');
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1'], sent: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should offer "Đánh dấu đã gửi lại" on a person whose numbers changed after the mail', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf({ people: [{ ...PEOPLE[0]!, send: STALE }] }));

    // Act
    const again = await screen.findByRole('button', { name: 'Đánh dấu đã gửi lại Người Thử A' });
    const words = again.textContent;
    const tone = screen.getByText('Cần gửi lại').dataset.tone;
    const detail = screen.getByText('Số đã đổi sau lần gửi 14:05 05/11');
    await userEvent.click(again);

    // Assert
    expect(tone).toBe('amber');
    expect(detail).toBeTruthy();
    expect(words).toBe('Đánh dấu đã gửi lại');
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1'], sent: true }));
  });

  it('should hold the marks of a month that is not approved and say why', async () => {
    // Arrange
    show(listOf({ status: 'draft', canSend: false, approvalNo: null }));

    // Assert
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: 'Đánh dấu đã gửi Người Thử A' });
    expect(button.disabled).toBe(true);
    expect(button.parentElement?.title).toBe('Tháng chưa duyệt — duyệt bảng lương rồi mới gửi phiếu');
  });

  it('should mark the ticked people who are not sent yet in one go', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    show(listOf({ people: [PEOPLE[0]!, { ...PEOPLE[1]!, send: SENT }, PEOPLE[2]!] }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Chọn tất cả người đang hiện' }));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã gửi 2 người' }));

    // Assert
    await waitFor(() => expect(mark).toHaveBeenCalledWith(SHEET.monthKey, { employeeIds: ['e1', 'e3'], sent: true }));
  });

  it('should say when the mark could not be saved', async () => {
    // Arrange
    vi.spyOn(api, 'hrPayrollPayslipsMark').mockRejectedValue(new Error('Mất kết nối'));
    show(listOf());

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Đánh dấu đã gửi Người Thử A' }));

    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa ghi được trạng thái gửi');
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

describe('what changed since the payslip went out', () => {
  const STALE = { ...SENT, state: 'stale' as const };
  const cells = (netPay: number, income: number) => ({ netPay, income, social: 720_000 }) as PayrollLineDto['cells'];
  const NOW = month({
    status: 'approved',
    lines: [line({ employeeId: 'e1', code: 'NV01', fullName: 'Người Thử A', cells: cells(9_000_000, 9_720_000) })],
  });
  const changesOf = (over: Partial<PayslipChangesDto> = {}): PayslipChangesDto => ({
    monthKey: NOW.monthKey,
    employeeId: 'e1',
    code: 'NV01',
    fullName: 'Người Thử A',
    sent: { at: SENT.at, by: 'HR Thử', approvalNo: 1, channel: 'manual' },
    current: { status: 'approved', approvalNo: 2 },
    events: [
      { kind: 'reopened', approvalNo: 1, at: '2026-11-06T02:00:00.000Z', by: 'HR Thử', reason: 'Sửa hỗ trợ' },
      { kind: 'approved', approvalNo: 2, at: '2026-11-06T03:00:00.000Z', by: 'Sếp Thử', reason: null },
    ],
    sentMonth: {
      ...NOW,
      approval: { no: 1, at: '2026-11-05T02:00:00.000Z', by: 'Sếp Thử' },
      lines: [line({ employeeId: 'e1', code: 'NV01', fullName: 'Người Thử A', cells: cells(8_500_000, 9_220_000) })],
    },
    cells: [{ key: 'netPay', sent: 8_500_000, now: 9_000_000 }],
    canConfirmUnchanged: false,
    log: [
      {
        id: 'log-1',
        area: 'bang-luong',
        actor: 'HR Thử',
        action: 'Sửa đầu vào tháng',
        detail: 'NV01 Người Thử A: hỗ trợ 0 → 500.000',
        month: NOW.monthKey,
        at: '2026-11-06T02:30:00.000Z',
      },
    ],
    ...over,
  });
  function showStale(dto: PayslipChangesDto) {
    const read = vi.spyOn(api, 'hrPayrollPayslipChanges').mockResolvedValue(dto);
    vi.spyOn(api, 'hrPayrollPayslips').mockResolvedValue(listOf({ people: [{ ...PEOPLE[0]!, send: STALE }] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/hr/luong/phieu-luong']}>
          <PayslipsTab month={NOW} filters={filtersFromParams(new URLSearchParams())} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return read;
  }
  const rowsOf = () =>
    dialog()
      .getAllByRole('row')
      .slice(1)
      .map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      );

  it('should open from the status of a stale row and show the figures that differ, net pay first', async () => {
    // Arrange
    const read = showStale(changesOf());

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thay đổi từ lần gửi của Người Thử A' }));

    // Assert
    expect(
      await dialog().findByRole('heading', { name: /Thay đổi từ lần gửi 14:05 05\/11\/2026 · Người Thử A/ }),
    ).toBeTruthy();
    expect(read).toHaveBeenCalledWith(NOW.monthKey, 'e1');
    await waitFor(() =>
      expect(rowsOf()).toEqual([
        ['Thực nhận', '8.500.000', '9.000.000', '+500.000'],
        ['Tổng thu nhập', '9.220.000', '9.720.000', '+500.000'],
      ]),
    );
    const summary = dialog().getByRole('region', { name: 'Vì sao cần gửi lại' }).textContent;
    expect(summary).toContain('Đã gửi lúc 14:05 05/11/2026 bởi HR Thử, theo bản duyệt lần 1');
    expect(summary).toContain('Mở lại lúc 09:00 06/11/2026 bởi HR Thử, lý do: "Sửa hỗ trợ"');
    expect(summary).toContain('Duyệt lại thành bản duyệt lần 2 lúc 10:00 06/11/2026 bởi Sếp Thử');
  });

  it('should keep the figures that did not move behind "Hiện cả dòng không đổi"', async () => {
    // Arrange
    showStale(changesOf());
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thay đổi từ lần gửi của Người Thử A' }));
    await dialog().findByText('Tổng thu nhập');
    expect(dialog().queryByText('BHXH')).toBeNull();

    // Act
    await userEvent.click(dialog().getByRole('checkbox', { name: /Hiện cả dòng không đổi/ }));

    // Assert
    const social = rowsOf().find((r) => r[0] === 'BHXH');
    expect(social).toEqual(['BHXH', '720.000', '720.000', '0']);
  });

  it('should list what was done since, each line with its links, and lead to the whole log of the person', async () => {
    // Arrange
    showStale(changesOf());

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thay đổi từ lần gửi của Người Thử A' }));

    // Assert
    const log = await dialog().findByRole('region', { name: 'Đã làm gì từ lần gửi' });
    expect(within(log).getByText('Gõ số trên bảng lương')).toBeTruthy();
    expect(
      within(log)
        .getByRole('link', { name: /NV01 Người Thử A/ })
        .getAttribute('href'),
    ).toContain('hs=e1');
    const all = within(log).getByRole('link', { name: 'Xem tất cả trong Nhật ký' });
    expect(all.getAttribute('href')).toBe(`/hr/luong/nhat-ky?ky=${NOW.monthKey}&ma=NV01`);
  });

  it('should say plainly when no figure differs, and let HR keep the payslip sent as still right', async () => {
    // Arrange
    const same = changesOf();
    showStale(changesOf({ sentMonth: { ...same.sentMonth!, lines: NOW.lines }, cells: [], canConfirmUnchanged: true }));
    const confirm = vi.spyOn(api, 'hrPayrollPayslipUnchanged').mockResolvedValue(listOf());
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thay đổi từ lần gửi của Người Thử A' }));

    // Act
    expect(await dialog().findByText('Số trên phiếu không đổi so với lần gửi.')).toBeTruthy();
    await userEvent.click(dialog().getByRole('button', { name: 'Đánh dấu vẫn đúng (không cần gửi lại)' }));

    // Assert
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(NOW.monthKey, 'e1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('should open the payslip of now and mark it sent again from the foot of the drawer', async () => {
    // Arrange
    const mark = vi.spyOn(api, 'hrPayrollPayslipsMark').mockResolvedValue(listOf());
    showStale(changesOf());
    await userEvent.click(await screen.findByRole('button', { name: 'Xem thay đổi từ lần gửi của Người Thử A' }));
    await dialog().findByText('Tổng thu nhập');

    // Act
    await userEvent.click(dialog().getByRole('button', { name: 'Đánh dấu đã gửi lại' }));

    // Assert
    await waitFor(() => expect(mark).toHaveBeenCalledWith(NOW.monthKey, { employeeIds: ['e1'], sent: true }));
  });
});
