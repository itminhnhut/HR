import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { AddApplicationDialog } from './AddApplicationDialog';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
let posts: number;

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  posts = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const reply = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (String(input).endsWith('/hr/jobs')) {
        return reply(200, {
          jobs: [{ id: JOB_ID, title: 'Kế toán', status: 'open' }],
          newApplications: 0,
          dueForDeletion: 0,
        });
      }
      if (init?.method === 'POST') {
        posts += 1;
        return reply(409, {
          error: 'Đã có hồ sơ của Trần Khoa cho vị trí này.',
          fieldErrors: {},
          code: 'duplicate',
          existing: { id: 'old-id', fullName: 'Trần Khoa', status: 'seen', createdAt: '2026-10-20T03:00:00.000Z' },
        });
      }
      return reply(404, { error: 'not found' });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(onAdded = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AddApplicationDialog open onClose={() => {}} onAdded={onAdded} />
    </QueryClientProvider>,
  );
  return onAdded;
}

async function fillBasics() {
  await userEvent.selectOptions(
    await screen.findByLabelText('Vị trí ứng tuyển'),
    await screen.findByRole('option', { name: 'Kế toán' }),
  );
  await userEvent.type(screen.getByLabelText('Họ và tên'), 'Trần Khoa');
  await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912345678');
}

describe('HR adds an application', () => {
  it('should ask for the source and the consent before sending anything', async () => {
    // Arrange
    show();
    await fillBasics();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    // Assert
    expect(screen.getByText('Chọn nguồn hồ sơ.')).toBeTruthy();
    expect(screen.getByText(/Xác nhận ứng viên đã đồng ý/)).toBeTruthy();
    expect(posts).toBe(0);
  });

  it('should point to the existing application when this phone already applied for the job', async () => {
    // Arrange
    const onAdded = show();
    await fillBasics();
    await userEvent.selectOptions(screen.getByLabelText('Nguồn hồ sơ'), 'zalo');
    await userEvent.click(screen.getByRole('checkbox'));

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mở hồ sơ đó' }));

    // Assert
    expect(screen.getByText(/Đã có hồ sơ của/)).toBeTruthy();
    expect(onAdded).toHaveBeenCalledWith('old-id');
  });
});
