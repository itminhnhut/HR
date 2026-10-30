import type { CandidateApplicationDto, CandidateOverview } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real HTTP client against a faked server (fetch is the boundary).
vi.hoisted(() => vi.stubEnv('VITE_API_URL', '/api'));
import { CvUpdate } from './CvUpdate';

const app = (over: Partial<CandidateApplicationDto> = {}): CandidateApplicationDto => ({
  id: 'a1',
  jobSlug: 'ke-toan',
  jobTitle: 'Kế toán',
  salary: '12 – 15 triệu',
  place: 'Gò Vấp',
  createdAt: '2026-10-26T03:00:00.000Z',
  stage: 'seen',
  hasCv: true,
  cvBlock: null,
  cvChangedAt: null,
  ...over,
});

let sent: { url: string; body: FormData }[];
beforeEach(() => {
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body instanceof FormData) sent.push({ url: String(input), body: init.body });
      const overview: Pick<CandidateOverview, 'applications'> = {
        applications: [app({ cvChangedAt: '2026-10-29T03:00:00.000Z' })],
      };
      return new Response(JSON.stringify(overview), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = (a: CandidateApplicationDto) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CvUpdate app={a} savedFileName={null} />
    </QueryClientProvider>,
  );

describe('candidate CV update', () => {
  it('should send a new PDF for the application', async () => {
    // Arrange
    show(app());
    await userEvent.click(screen.getByRole('button', { name: 'Cập nhật CV' }));
    const pdf = new File(['%PDF'], 'CV moi.pdf', { type: 'application/pdf' });

    // Act
    await userEvent.upload(screen.getByLabelText(/Chọn file CV/), pdf);
    await userEvent.click(screen.getByRole('button', { name: 'Gửi CV mới' }));

    // Assert
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe('/api/candidate/applications/a1/cv');
    expect((sent[0]?.body.get('cv') as File).name).toBe('CV moi.pdf');
  });

  it('should say why the CV cannot be changed instead of offering it', () => {
    show(app({ cvBlock: 'Hồ sơ đã được xử lý, liên hệ HR nếu cần gửi thêm.' }));
    expect(screen.queryByRole('button', { name: 'Cập nhật CV' })).toBeNull();
    expect(screen.getByText(/đã được xử lý/)).toBeTruthy();
  });

  it('should offer "Gửi CV" when the application has none yet', () => {
    show(app({ hasCv: false }));
    expect(screen.getByRole('button', { name: 'Gửi CV' })).toBeTruthy();
  });
});
