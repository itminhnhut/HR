import type { SourceDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { ManageSourcesDialog } from './ManageSourcesDialog';

let list: SourceDto[];
let calls: { method: string; url: string; body: unknown }[];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => {
  calls = [];
  list = [
    { key: 'website', name: 'Website', kind: 'system', hidden: false, applications: 5 },
    { key: 'zalo', name: 'Zalo', kind: 'builtin', hidden: false, applications: 2 },
    { key: 'other', name: 'Khác', kind: 'builtin', hidden: false, applications: 0 },
    { key: 'linkedin', name: 'LinkedIn', kind: 'custom', hidden: false, applications: 0 },
    { key: 'hoi-cho', name: 'Hội chợ', kind: 'custom', hidden: false, applications: 3 },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method, url: String(input), body });
      if (method === 'PATCH')
        list = list.map((s) => (String(input).endsWith(`/${s.key}`) ? { ...s, hidden: true } : s));
      return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
  vi.stubGlobal('confirm', () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ManageSourcesDialog open onClose={() => {}} />
    </QueryClientProvider>,
  );
const row = async (name: string) => within((await screen.findByText(name)).closest('li') as HTMLElement);

describe('manage sources', () => {
  it('should keep "Website" fixed, never hide "Khác", and delete only an unused source HR added', async () => {
    show();
    expect((await row('Website')).queryByRole('button')).toBeNull();
    expect((await row('Khác')).queryByRole('button', { name: 'Ẩn' })).toBeNull();
    expect((await row('LinkedIn')).getByRole('button', { name: 'Xoá' })).toBeTruthy();
    expect((await row('Hội chợ')).queryByRole('button', { name: 'Xoá' })).toBeNull();
    expect((await row('Zalo')).queryByRole('button', { name: 'Xoá' })).toBeNull();
  });

  it('should hide a source and show its count', async () => {
    // Arrange
    show();
    const zalo = await row('Zalo');

    // Act
    await userEvent.click(zalo.getByRole('button', { name: 'Ẩn' }));

    // Assert
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/hr/sources/zalo'))).toBe(true),
    );
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ hidden: true });
    expect(await screen.findByText(/2 hồ sơ · Có sẵn · đã ẩn/)).toBeTruthy();
  });

  it('should add a source from the list itself', async () => {
    // Arrange
    show();

    // Act
    await userEvent.type(await screen.findByLabelText('Tên nguồn mới'), 'Hội chợ việc làm');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));

    // Assert
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/hr/sources'))).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Hội chợ việc làm' });
  });
});
