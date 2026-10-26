import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockDb } from '../../api/mock';

// Demo mode (no BE address), like the demo site: the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { NewsListPage } from './NewsListPage';
import { NewsPostPage } from './NewsPostPage';

function show(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/tin-tuc', element: <NewsListPage /> },
      { path: '/tin-tuc/chuyen-muc/:slug', element: <NewsListPage /> },
      { path: '/tin-tuc/the/:tag', element: <NewsListPage /> },
      { path: '/tin-tuc/:slug', element: <NewsPostPage /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => resetMockDb(new Date()));
afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});

describe('public news pages (demo data)', () => {
  it('should list published posts newest first, without drafts', async () => {
    show('/tin-tuc');

    const titles = await screen.findAllByRole('heading', { level: 2 });

    expect(titles.map((h) => h.textContent)).toEqual([
      '5 điều nên chuẩn bị trước buổi phỏng vấn tại TOP FLOW',
      'Một ngày làm việc của kỹ sư kinh doanh tại TOP FLOW',
    ]);
    expect(screen.queryByText('Chuyến đi thiện nguyện Vĩnh Hy 2026')).toBeNull();
  });

  it('should filter by category from its address', async () => {
    show('/tin-tuc/chuyen-muc/cam-nang-ung-vien');

    expect(await screen.findByRole('heading', { level: 1, name: 'Cẩm nang ứng viên' })).toBeTruthy();
    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles).toHaveLength(1);
  });

  it('should show a not-found message for an unknown category', async () => {
    show('/tin-tuc/chuyen-muc/khong-co');

    expect(await screen.findByRole('heading', { level: 2, name: 'Không tìm thấy chuyên mục' })).toBeTruthy();
  });

  it('should keep an unknown category out of search results, with no canonical address', async () => {
    show('/tin-tuc/chuyen-muc/khong-co');

    await screen.findByRole('heading', { level: 2, name: 'Không tìm thấy chuyên mục' });

    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex'),
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('should read an old ?page= address as ?trang= and replace it in the address bar', async () => {
    // Act
    const router = show('/tin-tuc?page=2&utm_source=zalo');

    // Assert
    await waitFor(() => expect(router.state.location.search).toBe('?utm_source=zalo&trang=2'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('should drop ?page=1 from the address', async () => {
    const router = show('/tin-tuc?page=1');

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('should list the posts of a hashtag on its own page', async () => {
    show('/tin-tuc/the/kinh-doanh');

    expect(await screen.findByRole('heading', { level: 1, name: '#Kinh doanh' })).toBeTruthy();
    expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(2);
  });

  it('should say a hashtag is not found when no published post uses it', async () => {
    show('/tin-tuc/the/thien-nguyen');

    expect(await screen.findByRole('heading', { level: 2, name: 'Không tìm thấy hashtag' })).toBeTruthy();
  });

  it('should show the article with its table of contents and structured data for Google', async () => {
    show('/tin-tuc/mot-ngay-lam-viec-cua-ky-su-kinh-doanh-tai-top-flow');

    const title = await screen.findByRole('heading', { level: 1 });
    const toc = screen.getAllByRole('navigation', { name: 'Mục lục' })[0];
    const types = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(
      (s) => JSON.parse(s.textContent ?? '{}')['@type'],
    );

    expect(title.textContent).toBe('Một ngày làm việc của kỹ sư kinh doanh tại TOP FLOW');
    expect(within(toc).getByRole('link', { name: 'Buổi sáng: họp nhanh và lên lịch gặp khách' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Buổi sáng: họp nhanh và lên lịch gặp khách' }).id).toBe(
      'buoi-sang-hop-nhanh-va-len-lich-gap-khach',
    );
    expect(types).toEqual(['BlogPosting', 'BreadcrumbList']);
    const tags = screen.getByRole('list', { name: 'Hashtag' });
    expect(within(tags).getByRole('link', { name: '#Kinh doanh' }).getAttribute('href')).toBe(
      '/tin-tuc/the/kinh-doanh',
    );
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
  });

  it('should say a draft is not found instead of showing it', async () => {
    show('/tin-tuc/chuyen-di-thien-nguyen-vinh-hy-2026');

    expect(await screen.findByText('Không tìm thấy bài viết')).toBeTruthy();
  });
});
