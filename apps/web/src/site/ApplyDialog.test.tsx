import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { JobDetailDto } from '@careers/shared';
import { ApplyDialog } from './ApplyDialog';

const job: JobDetailDto = {
  id: 'j1',
  slug: 'nhan-vien-kinh-doanh-b2b',
  title: 'Nhân viên Kinh doanh B2B',
  department: 'Kinh doanh',
  employmentType: 'full_time',
  place: 'Gò Vấp, TP. HCM',
  deadline: '2099-12-31',
  status: 'open',
  publishedAt: null,
  perks: '',
  salaryMin: 12_000_000,
  salaryMax: 18_000_000,
  address: null,
  workingHours: null,
  experience: null,
  education: null,
  responsibilities: [],
  requirements: [],
  preferred: [],
  benefits: [],
  roadmap: [],
};

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <ApplyDialog job={job} open onClose={() => {}} /> }]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('ApplyDialog', () => {
  it('opens the form straight away, with an optional Google sign-in shortcut', async () => {
    setup();
    expect(await screen.findByRole('button', { name: /Gửi hồ sơ/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Đăng nhập Google/ })).toBeTruthy();
  });

  it('starts with the consent box unticked and no "keep 12 months" box (BR-11)', async () => {
    setup();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(1);
    expect((boxes[0] as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText(/Giữ hồ sơ 12 tháng/)).toBeNull();
  });

  it('formats the phone number while it is typed', async () => {
    setup();
    const phone = await screen.findByLabelText(/Số điện thoại/);
    await userEvent.type(phone, '+84912345678');
    expect((phone as HTMLInputElement).value).toBe('0912 345 678');
  });

  it('will not send without name, phone, CV and consent, and asks for each in plain words', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Gửi hồ sơ/ }));
    expect(await screen.findByText('Nhập họ và tên.')).toBeTruthy();
    expect(screen.getByText('Nhập số điện thoại (Zalo).')).toBeTruthy();
    expect(screen.getByText(/Đính kèm file CV/)).toBeTruthy();
    expect(screen.getByText('Hãy tích ô đồng ý để gửi hồ sơ.')).toBeTruthy();
  });

  it('should say the phone number is wrong only when one was typed', async () => {
    setup();
    await userEvent.type(await screen.findByLabelText(/Số điện thoại/), '0912');
    await userEvent.click(screen.getByRole('button', { name: /Gửi hồ sơ/ }));
    expect(await screen.findByText(/Số điện thoại chưa đúng, cần 10 số/)).toBeTruthy();
    expect(screen.queryByText('Nhập số điện thoại (Zalo).')).toBeNull();
  });

  it('should scroll the first problem to the middle so the sticky send bar does not cover its message', async () => {
    // Arrange
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    setup();
    await userEvent.type(await screen.findByLabelText('Họ và tên'), 'Nguyễn Văn An');
    await userEvent.type(screen.getByLabelText(/Số điện thoại/), '0912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Dán link thay vì tải file' }));
    await userEvent.type(screen.getByLabelText('Link CV'), 'https://drive.google.com/cv');

    // Act
    await userEvent.click(screen.getByRole('button', { name: /Gửi hồ sơ/ }));

    // Assert
    const message = await screen.findByText('Hãy tích ô đồng ý để gửi hồ sơ.');
    expect(document.activeElement).toBe(screen.getByRole('checkbox'));
    expect(scrolled).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }));
    expect(scrolled.mock.contexts.at(-1)).toBe(message.closest('[role="alert"]'));
  });
});
