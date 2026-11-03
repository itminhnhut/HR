import type { HrMe } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { HrAccountsPage } from './HrAccountsPage';

const account: HrMe = {
  id: 'u1',
  email: 'lan@topflow.vn',
  name: 'Lan',
  phone: '0909000111',
  contactEmail: 'lan@gmail.com',
  jobTitle: null,
  alias: 'Ms. Lee',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let patches: unknown[];
let patchReply: (body: Record<string, unknown>) => Response;

beforeEach(() => {
  patches = [];
  patchReply = (body) => reply(200, { ...account, ...body });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/hr/me') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        patches = [...patches, body];
        return patchReply(body);
      }
      if (url.endsWith('/hr/me')) return reply(200, account);
      if (url.endsWith('/hr/users')) return reply(200, []);
      return reply(404, { error: 'not found' });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function openPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HrAccountsPage />
    </QueryClientProvider>,
  );
}

describe('Thông tin người gửi', () => {
  it('should show the saved job title and alias', async () => {
    // Arrange + Act
    openPage();

    // Assert
    expect((await screen.findByLabelText<HTMLInputElement>('Chức danh')).value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(/Tên gọi khác/).value).toBe('Ms. Lee');
    expect(screen.getByText(/Tên gọi khác/, { selector: 'label' }).textContent).toContain('không bắt buộc');
  });

  it('should save the job title together with the other sender details', async () => {
    // Arrange
    const user = userEvent.setup();
    openPage();

    // Act
    await user.type(await screen.findByLabelText('Chức danh'), 'HR Generalist');
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

    // Assert
    await screen.findByText('Đã lưu.');
    expect(patches).toEqual([
      {
        name: 'Lan',
        phone: '0909000111',
        contactEmail: 'lan@gmail.com',
        jobTitle: 'HR Generalist',
        alias: 'Ms. Lee',
      },
    ]);
  });

  it('should show the server message under the job title when it is refused', async () => {
    // Arrange
    patchReply = () =>
      reply(422, { error: 'Kiểm tra lại thông tin.', fieldErrors: { jobTitle: 'Chức danh tối đa 100 ký tự.' } });
    const user = userEvent.setup();
    openPage();

    // Act
    await user.type(await screen.findByLabelText('Chức danh'), 'Quá dài');
    await user.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

    // Assert
    expect(await screen.findByText('Chức danh tối đa 100 ký tự.')).toBeTruthy();
  });
});
