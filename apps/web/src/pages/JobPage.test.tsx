import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockDb } from '../api/mock';

// Demo mode (no BE address), like the demo site: the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { JobPage } from './JobPage';

function show(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/viec-lam/:slug', element: <JobPage /> }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const jsonLd = () =>
  [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(
    (el) => JSON.parse(el.textContent ?? '{}') as Record<string, unknown>,
  );
const headMeta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');

beforeEach(() => {
  resetMockDb(new Date());
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('job page', () => {
  it('should list nice-to-haves under "Ưu tiên (không bắt buộc)", apart from the requirements', async () => {
    // Act
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    // Assert
    const preferred = await screen.findByRole('heading', { level: 2, name: 'Ưu tiên (không bắt buộc)' });
    const list = within(preferred.closest('section') ?? document.body).getAllByRole('listitem');
    expect(list.map((li) => li.textContent)).toEqual([
      'Đã bán phần mềm hoặc dịch vụ cho doanh nghiệp.',
      'Đã dùng CRM (HubSpot, Salesforce, Bitrix…).',
      'Có sẵn mạng lưới khách hàng doanh nghiệp.',
    ]);
    const requirements = screen.getByRole('heading', { level: 2, name: 'Yêu cầu' }).closest('section');
    expect(requirements?.textContent).not.toContain('CRM');
  });

  it('should give Google the job posting and a breadcrumb, with one title separator', async () => {
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    await waitFor(() => expect(jsonLd().map((d) => d['@type'])).toEqual(['JobPosting', 'BreadcrumbList']));
    expect(document.title).toBe('Nhân viên Kinh doanh B2B · TOP FLOW');
    expect(jsonLd()[1]).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Việc làm' },
        { position: 2, name: 'Nhân viên Kinh doanh B2B' },
      ],
    });
  });

  it('should keep a missing job out of search results, with a 404 title and no canonical address', async () => {
    show('/viec-lam/khong-co-tin-nay');

    await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy tin tuyển dụng' });

    await waitFor(() => expect(headMeta('meta[name="robots"]')).toBe('noindex'));
    expect(document.title).toBe('Không tìm thấy tin tuyển dụng · TOP FLOW');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
