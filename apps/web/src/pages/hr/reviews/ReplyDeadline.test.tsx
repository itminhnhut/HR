import { addDays, type ApplicationRowDto, type ReviewBatchDto, todayInVietnam } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseOption, optionNames } from '../../../test/choose';
import { InterviewField } from '../applicants/InterviewField';
import { REPLY_LIMITS } from './reviewModel';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { LinkPanel } from './ReviewSide';
import { SendReviewDialog } from './SendReviewDialog';

const row = {
  id: 'a1',
  fullName: 'Nguyễn Thị Mai Anh',
  jobTitle: 'Kế toán',
  matchPercent: null,
  noteLine: null,
} as ApplicationRowDto;

const batch = {
  id: 'b1',
  token: 'tok',
  state: 'open',
  title: 'Duyệt ứng viên',
  reviewerName: 'anh Minh',
  senderName: 'Lan',
  respondBy: '2026-11-07T10:00:00.000Z',
  expiresAt: '2026-11-12T10:00:00.000Z',
  openedAt: null,
  doneAt: null,
} as ReviewBatchDto;

const REFUSAL = { error: 'Hạn phản hồi tối đa 30 ngày.', fieldErrors: { respondBy: 'Tối đa 30 ngày.' } };

let answer: () => Response;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  answer = () =>
    new Response(JSON.stringify(REFUSAL), { status: 422, headers: { 'content-type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => answer()),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const withClient = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const deadline = () => screen.getByRole('button', { name: /^Mong sếp phản hồi trước/ });
const picker = () => screen.getByRole('dialog', { name: 'Chọn hạn phản hồi' });

function openSendForm() {
  render(withClient(<SendReviewDialog rows={[row]} open onClose={vi.fn()} onSent={vi.fn()} />));
}

function ReplyField({ start }: { start: string }) {
  const [value, setValue] = useState<string | null>(start);
  return (
    <InterviewField
      fieldName="Hạn phản hồi"
      placeholder="Chọn hạn phản hồi"
      limits={REPLY_LIMITS}
      value={value}
      onChange={setValue}
    />
  );
}

describe('The deadline in "Gửi sếp duyệt"', () => {
  it('should offer every hour of the day, not the hours of an interview', async () => {
    // Arrange
    openSendForm();
    await userEvent.click(deadline());

    // Act
    const hours = await optionNames(within(picker()).getByRole('combobox', { name: 'Giờ' }), '23');

    // Assert
    expect(hours).toContain('06');
    expect(hours).toContain('21');
    expect(hours).toHaveLength(24);
  });

  it('should take a deadline late in the evening', async () => {
    // Arrange
    openSendForm();
    await userEvent.click(deadline());
    await userEvent.click(within(picker()).getByRole('button', { name: 'Ngày kia' }));

    // Act
    await chooseOption(within(picker()).getByRole('combobox', { name: 'Giờ' }), '21');
    await chooseOption(within(picker()).getByRole('combobox', { name: 'Phút' }), '45');
    await userEvent.click(within(picker()).getByRole('button', { name: 'Áp dụng' }));

    // Assert
    expect(deadline().textContent).toContain('21:45');
  });

  it('should not say "Giờ phỏng vấn" to a screen reader', async () => {
    // Arrange
    openSendForm();

    // Act
    await userEvent.click(deadline());

    // Assert
    expect(within(picker()).getByRole('group', { name: 'Giờ phản hồi' })).toBeTruthy();
    expect(within(picker()).queryByRole('group', { name: 'Giờ phỏng vấn' })).toBeNull();
  });

  it('should turn invalid, red and linked to the message when the server refuses the deadline', async () => {
    // Arrange
    openSendForm();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Tạo link gửi sếp' }));

    // Assert
    await waitFor(() => expect(deadline().getAttribute('aria-invalid')).toBe('true'));
    expect(deadline().className).toContain('border-error');
    const message = document.getElementById(deadline().getAttribute('aria-describedby') ?? '');
    expect(message?.textContent).toContain('Tối đa 30 ngày.');
    expect(screen.queryByText(/Link dùng được thêm 5 ngày/)).toBeNull();
  });
});

describe('The reply limits', () => {
  it('should stop the month where the server stops, 30 days from now', async () => {
    // Arrange: the month of the first day past the limit.
    const today = todayInVietnam();
    const last = addDays(today, 29);
    const past = addDays(today, 31);
    render(<ReplyField start={`${past}T10:00:00+07:00`} />);

    // Act
    await userEvent.click(screen.getByRole('button', { name: /^Hạn phản hồi/ }));

    // Assert
    const dayButton = (iso: string) => document.querySelector<HTMLButtonElement>(`dialog [data-day="${iso}"] button`);
    expect(dayButton(past)?.disabled ?? true).toBe(true);
    if (dayButton(last)) expect(dayButton(last)?.disabled).toBe(false);
  });
});

describe('"Gia hạn" of a sent batch', () => {
  const field = () => screen.getByRole('button', { name: /^Hạn phản hồi mới/ });

  async function openExtend() {
    render(withClient(<LinkPanel batch={batch} onAdd={vi.fn()} />));
    await userEvent.click(screen.getByRole('button', { name: 'Gia hạn' }));
  }

  it('should offer every hour of the day', async () => {
    // Arrange
    await openExtend();
    await userEvent.click(field());

    // Act
    const hours = await optionNames(screen.getByRole('combobox', { name: 'Giờ' }), '23');

    // Assert
    expect(hours).toHaveLength(24);
  });

  it('should turn invalid, red and linked to the message when the server refuses the new deadline', async () => {
    // Arrange
    await openExtend();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hạn mới' }));

    // Assert
    await waitFor(() => expect(field().getAttribute('aria-invalid')).toBe('true'));
    expect(field().className).toContain('border-error');
    const message = document.getElementById(field().getAttribute('aria-describedby') ?? '');
    expect(message?.textContent).toContain('Tối đa 30 ngày.');
  });

  it('should keep a refusal that names no field in sight', async () => {
    // Arrange
    answer = () =>
      new Response(JSON.stringify({ error: 'Đợt này đã khoá.', fieldErrors: {} }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    await openExtend();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hạn mới' }));

    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain('Đợt này đã khoá.');
    expect(field().getAttribute('aria-invalid')).toBeNull();
  });
});
