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

  it('should show the duty groups HR typed, numbering the duties from 01 in each group', async () => {
    // Act
    show('/viec-lam/nhan-vien-chung-tu-logistics');

    // Assert
    const duties = (await screen.findByRole('heading', { level: 2, name: 'Mô tả công việc' })).closest('section');
    const groups = within(duties ?? document.body).getAllByRole('heading', { level: 3 });
    expect(groups.map((h) => h.textContent)).toEqual([
      '1Quản lý đơn hàng & vận chuyển nhập khẩu',
      '2Thủ tục hải quan',
      '3Báo cáo',
    ]);
    const firstDuties = within(duties ?? document.body).getAllByRole('list')[1];
    expect(within(firstDuties ?? document.body).getAllByRole('listitem')[0]?.textContent).toBe(
      '01Chuẩn bị bộ chứng từ: hợp đồng, hóa đơn, phiếu đóng gói, vận đơn.',
    );
  });

  it('should show level, openings and work mode beside the other facts when HR set them', async () => {
    // Act
    show('/viec-lam/nhan-vien-chung-tu-logistics');

    // Assert
    await screen.findByRole('heading', { level: 1, name: 'Nhân viên Chứng từ – Logistics' });
    const fact = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(fact('Cấp bậc')).toBe('Nhân viên');
    expect(fact('Số lượng tuyển')).toBe('2 người');
    expect(fact('Hình thức làm việc')).toBe('Kết hợp (Hybrid)');
    expect(fact('Loại hình')).toBe('Toàn thời gian');
  });

  it('should show a job without groups or new facts as before', async () => {
    // Act
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    // Assert
    const duties = (await screen.findByRole('heading', { level: 2, name: 'Mô tả công việc' })).closest('section');
    expect(within(duties ?? document.body).queryByRole('heading', { level: 3 })).toBeNull();
    expect(within(duties ?? document.body).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByText('Cấp bậc')).toBeNull();
    expect(screen.queryByText('Số lượng tuyển')).toBeNull();
    expect(screen.queryByText('Hình thức làm việc')).toBeNull();
  });

  it('should give Google the job posting and a breadcrumb, with one title separator', async () => {
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    await waitFor(() => expect(jsonLd().map((d) => d['@type'])).toEqual(['JobPosting', 'BreadcrumbList']));
    expect(document.title).toBe('Tuyển Nhân viên Kinh doanh B2B – Gò Vấp, TP.HCM · TOP FLOW');
    expect(jsonLd()[1]).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Việc làm' },
        { position: 2, name: 'Nhân viên Kinh doanh B2B' },
      ],
    });
  });

  it('should describe the job for search and previews starting with "Tuyển", the same as the crawler page', async () => {
    // Act
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    // Assert
    await waitFor(() => expect(headMeta('meta[name="description"]')).toMatch(/^Tuyển Nhân viên Kinh doanh B2B tại /));
    const description = headMeta('meta[name="description"]') ?? '';
    expect(description).toContain('Lương 12 – 18 triệu');
    expect(description).toMatch(/Hạn nộp \d{2}\/\d{2}\/\d{4}/);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(headMeta('meta[property="og:description"]')).toBe(description);
    expect(headMeta('meta[property="og:title"]')).toBe(document.title);
  });

  it('should link the related articles below the job, before the similar jobs', async () => {
    // Act
    show('/viec-lam/nhan-vien-kinh-doanh-b2b');

    // Assert
    const heading = await screen.findByRole('heading', { level: 2, name: 'Bài viết liên quan' });
    const section = heading.closest('section');
    if (!section) throw new Error('no related section');
    const hrefs = within(section)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/tin-tuc/mot-ngay-lam-viec-cua-ky-su-kinh-doanh-tai-top-flow',
        '/tin-tuc/5-dieu-nen-chuan-bi-truoc-buoi-phong-van-tai-top-flow',
      ]),
    );
    expect(
      within(section).getByRole('heading', { level: 3, name: /Một ngày làm việc của kỹ sư kinh doanh/ }),
    ).toBeTruthy();
    const similar = screen.getByRole('heading', { level: 2, name: 'Việc làm tương tự' });
    expect(heading.compareDocumentPosition(similar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should keep a missing job out of search results, with a 404 title and no canonical address', async () => {
    show('/viec-lam/khong-co-tin-nay');

    await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy tin tuyển dụng' });

    await waitFor(() => expect(headMeta('meta[name="robots"]')).toBe('noindex'));
    expect(document.title).toBe('Không tìm thấy tin tuyển dụng · TOP FLOW');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
