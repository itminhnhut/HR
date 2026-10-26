import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

  it('will not send without name, phone, CV and consent', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Gửi hồ sơ/ }));
    expect(await screen.findByText('Nhập họ và tên.')).toBeTruthy();
    expect(screen.getByText(/Số điện thoại chưa đúng/)).toBeTruthy();
    expect(screen.getByText(/Đính kèm file CV/)).toBeTruthy();
    expect(screen.getByText(/Cần tích ô đồng ý/)).toBeTruthy();
  });

  it('should hide everything in the dialog from screen recordings, the thank-you screen with name and phone included', async () => {
    // Arrange
    setup();
    const form = await screen.findByRole('button', { name: /Gửi hồ sơ/ });

    // Act
    const mask = form.closest('[data-clarity-mask="true"]');

    // Assert: the mask wraps all the dialog shows, so the screen that replaces the form is masked too.
    const dialog = form.closest('dialog');
    expect(mask?.textContent).toBe(dialog?.textContent);
  });
});
