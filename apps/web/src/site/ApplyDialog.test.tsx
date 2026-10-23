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
  remote: false,
  city: 'TP. HCM',
  deadline: '2099-12-31',
  status: 'open',
  publishedAt: null,
  perks: '',
  salaryMin: 12,
  salaryMax: 18,
  salaryNote: null,
  address: null,
  workingHours: null,
  level: null,
  experience: null,
  education: null,
  language: null,
  headcount: null,
  skills: [],
  summary: null,
  teamNote: null,
  responsibilities: [],
  requirements: [],
  niceToHave: [],
  benefits: { income: [], insurance: [], timeOff: [], growth: [], environment: [] },
  plan: { day30: null, day60: null, day90: null },
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
  it('starts with both consent boxes unticked (BR-11)', async () => {
    setup();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect((box as HTMLInputElement).checked).toBe(false);
  });

  it('will not send without name, phone, CV and consent', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Gửi hồ sơ/ }));
    expect(await screen.findByText('Nhập họ và tên.')).toBeTruthy();
    expect(screen.getByText(/Số điện thoại chưa đúng/)).toBeTruthy();
    expect(screen.getByText(/Đính kèm file CV/)).toBeTruthy();
    expect(screen.getByText(/Cần tích ô đồng ý/)).toBeTruthy();
  });
});
