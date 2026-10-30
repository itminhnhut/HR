import type { ReviewItemPublicDto, ReviewPageDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real HTTP client against a faked server (fetch is the boundary).
vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import ReviewPage from './ReviewPage';

const TOKEN = 'a'.repeat(43);

const item = (over: Partial<ReviewItemPublicDto> = {}): ReviewItemPublicDto => ({
  id: 'i1',
  fullName: 'Trần Minh Khoa',
  jobTitle: 'Nhân viên Kinh doanh B2B',
  appliedAt: '2026-10-26T03:00:00.000Z',
  matchPercent: 86,
  matchItems: [{ requirement: 'Tối thiểu 1 năm kinh nghiệm', verdict: 'met', reason: null }],
  hrPick: 'yes',
  hrComment: 'Nói chuyện tự tin',
  message: null,
  cv: 'file',
  cvLink: null,
  decision: null,
  reviewerComment: null,
  decidedAt: null,
  hrReply: null,
  hrRepliedAt: null,
  scheduled: false,
  ...over,
});

const pageOf = (over: Partial<ReviewPageDto> = {}): ReviewPageDto => ({
  title: 'Duyệt ứng viên · Kinh doanh B2B',
  senderName: 'Ngọc Anh (Phòng Nhân sự)',
  reviewerName: 'anh Minh',
  message: 'Anh xem giúp em nhé.',
  respondBy: '2026-11-02T10:00:00.000Z',
  expiresAt: '2026-11-07T10:00:00.000Z',
  state: 'open',
  doneAt: null,
  items: [item()],
  ...over,
});

let server: { page: ReviewPageDto | null; puts: unknown[] };

function fakeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  if (!server.page) return reply(404, { error: 'Link không đúng hoặc đã bị xoá. Hỏi lại HR link mới.' });
  if (init?.method === 'PUT') {
    const body = JSON.parse(String(init.body)) as { decision: ReviewItemPublicDto['decision']; comment: string | null };
    server.puts.push(body);
    server.page = {
      ...server.page,
      items: server.page.items.map((i) =>
        url.endsWith(`/items/${i.id}`) ? { ...i, decision: body.decision, reviewerComment: body.comment } : i,
      ),
    };
  }
  return reply(200, server.page);
}

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/duyet/:token', element: <ReviewPage /> }], {
    initialEntries: [`/duyet/${TOKEN}`],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  server = { page: pageOf(), puts: [] };
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

const decisions = async () => within(await screen.findByRole('group', { name: /Quyết định cho Trần Minh Khoa/ }));

describe('reviewer page', () => {
  it('should show what HR sent: title, sender, message and the application', async () => {
    show();
    expect(await screen.findByRole('heading', { level: 1, name: 'Duyệt ứng viên · Kinh doanh B2B' })).toBeTruthy();
    expect(screen.getByText(/HR gửi: Ngọc Anh/)).toBeTruthy();
    expect(screen.getByText('Anh xem giúp em nhé.')).toBeTruthy();
    expect(screen.getByText('Nói chuyện tự tin')).toBeTruthy();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
  });

  it('should save "Duyệt PV" at once', async () => {
    // Act
    show();
    await userEvent.click((await decisions()).getByRole('button', { name: /Duyệt PV/ }));

    // Assert
    await waitFor(() => expect(server.puts).toEqual([{ decision: 'approve', comment: null }]));
    expect(await screen.findByText(/Đã lưu · Duyệt phỏng vấn/)).toBeTruthy();
  });

  it('should only save "Không" once a reason is written', async () => {
    // Arrange
    show();
    await userEvent.click((await decisions()).getByRole('button', { name: 'Không' }));
    const save = screen.getByRole('button', { name: /Lưu: Không phỏng vấn/ });

    // Assert: nothing sent without a reason
    expect(save).toHaveProperty('disabled', true);
    expect(server.puts).toEqual([]);

    // Act
    await userEvent.type(screen.getByLabelText('Lý do không phỏng vấn'), 'Chưa bán B2B');
    await userEvent.click(save);

    // Assert
    await waitFor(() => expect(server.puts).toEqual([{ decision: 'reject', comment: 'Chưa bán B2B' }]));
  });

  it('should be read only once the link has expired', async () => {
    server.page = pageOf({ state: 'expired' });
    show();
    expect(await screen.findByText(/Link đã hết hạn/)).toBeTruthy();
    expect((await decisions()).getByRole('button', { name: /Duyệt PV/ })).toHaveProperty('disabled', true);
  });

  it('should explain a link that does not open', async () => {
    server.page = null;
    show();
    expect(await screen.findByRole('heading', { name: 'Link không mở được' })).toBeTruthy();
    expect(screen.getByText(/Hỏi lại HR link mới/)).toBeTruthy();
  });

  it("should show HR's answer under the reviewer's question", async () => {
    server.page = pageOf({
      items: [item({ decision: 'ask', reviewerComment: 'Lương mong muốn?', hrReply: '15 triệu' })],
    });
    show();
    expect(await screen.findByText('15 triệu')).toBeTruthy();
  });
});
