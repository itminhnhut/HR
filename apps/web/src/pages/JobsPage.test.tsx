import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockDb } from '../api/mock';

// Demo mode (no BE address), like the demo site: the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { JobsPage } from './JobsPage';

let isPhone = false;

function show(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <JobsPage /> }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Job card titles (H3 inside a link to a job; the news teaser below the jobs has H3s too). */
const jobHeadings = () =>
  screen.queryAllByRole('heading', { level: 3 }).filter((h) => h.closest('a[href^="/viec-lam/"]'));

/** Titles of the job cards on screen, once the list has loaded. */
async function cardTitles() {
  await waitFor(() => expect(jobHeadings().length).toBeGreaterThan(0));
  return jobHeadings().map((h) => h.textContent);
}

const query = (router: ReturnType<typeof show>) => new URLSearchParams(router.state.location.search);

beforeEach(() => {
  resetMockDb(new Date());
  isPhone = false;
  // jsdom has no matchMedia: answer the phone-width question from the test.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: isPhone,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('home page job filters (demo data)', () => {
  it('should show every open job and its count when no filter is set', async () => {
    // Arrange
    const { jobs } = await mockApi.listJobs();

    // Act
    show();

    // Assert
    expect(await cardTitles()).toHaveLength(jobs.length);
    expect(screen.getByText(`${jobs.length} vị trí`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xoá lọc' })).toBeNull();
  });

  it.each(['tuyển dụng', 'tuyen dung'])('should find a job by title when searching "%s"', async (text) => {
    // Arrange
    const router = show();
    await cardTitles();

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm vị trí' }), text);

    // Assert
    await waitFor(() => expect(screen.getByText('1 vị trí')).toBeTruthy());
    expect(await cardTitles()).toEqual(['Chuyên viên Tuyển dụng']);
    expect(query(router).get('q')).toBe(text);
  });

  it('should find a job by its department in the search box', async () => {
    // Arrange
    show();
    await cardTitles();

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm vị trí' }), 'ky thuat');

    // Assert
    await waitFor(async () => expect(await cardTitles()).toEqual(['Lập trình viên Frontend (React)']));
  });

  it('should replace the history entry while typing so Back is not filled up', async () => {
    // Arrange
    const router = show();
    await cardTitles();

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm vị trí' }), 'react');

    // Assert
    await waitFor(() => expect(query(router).get('q')).toBe('react'));
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('should filter by department and keep it in the address', async () => {
    // Arrange
    const router = show();
    await cardTitles();

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phòng ban' }), 'Kinh doanh');

    // Assert
    await waitFor(() => expect(screen.getByText('2 vị trí')).toBeTruthy());
    expect(await cardTitles()).toEqual(
      expect.arrayContaining(['Nhân viên Kinh doanh B2B', 'Thực tập sinh Kinh doanh']),
    );
    expect(query(router).get('phong-ban')).toBe('Kinh doanh');
  });

  it('should filter by location with options from the open jobs only', async () => {
    // Arrange: one job moves to another office.
    const listJobs = mockApi.listJobs.bind(mockApi);
    vi.spyOn(mockApi, 'listJobs').mockImplementation(async () => {
      const result = await listJobs();
      const jobs = result.jobs.map((j) => (j.slug === 'lap-trinh-vien-frontend-react' ? { ...j, place: 'Quận 1' } : j));
      return { ...result, jobs };
    });
    const router = show();
    await cardTitles();
    const select = screen.getByRole('combobox', { name: 'Nơi làm việc' });

    // Act
    await userEvent.selectOptions(select, 'Quận 1');

    // Assert
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Mọi nơi làm',
      'Gò Vấp, TP. HCM',
      'Quận 1',
    ]);
    await waitFor(async () => expect(await cardTitles()).toEqual(['Lập trình viên Frontend (React)']));
    expect(query(router).get('noi-lam')).toBe('Quận 1');
  });

  it('should read the filters from the address on load', async () => {
    // Arrange, Act
    show('/?q=react&phong-ban=K%E1%BB%B9+thu%E1%BA%ADt');

    // Assert
    expect(await cardTitles()).toEqual(['Lập trình viên Frontend (React)']);
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Tìm vị trí' }).value).toBe('react');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Phòng ban' }).value).toBe('Kỹ thuật');
    expect(screen.getByText('1 vị trí')).toBeTruthy();
  });

  it('should clear every filter with "Xoá lọc" and put focus back in the search box', async () => {
    // Arrange
    const { jobs } = await mockApi.listJobs();
    const router = show('/?q=chuyen&phong-ban=Nh%C3%A2n+s%E1%BB%B1');
    await cardTitles();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Xoá lọc' }));

    // Assert
    await waitFor(() => expect(screen.getByText(`${jobs.length} vị trí`)).toBeTruthy());
    expect(router.state.location.search).toBe('');
    const search = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Tìm vị trí' });
    expect(search.value).toBe('');
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole('button', { name: 'Xoá lọc' })).toBeNull();
  });

  it('should show an empty state with a way back when nothing matches', async () => {
    // Arrange
    show();
    await cardTitles();

    // Act
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm vị trí' }), 'phi công');

    // Assert
    expect(await screen.findByText('Không có vị trí phù hợp')).toBeTruthy();
    expect(screen.getByText('0 vị trí')).toBeTruthy();
    expect(jobHeadings()).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Xoá lọc' })).toHaveLength(2);
  });

  it('should show every job on phones without "Xem thêm" when there are 10 or fewer', async () => {
    // Arrange
    isPhone = true;
    const { jobs } = await mockApi.listJobs();
    expect(jobs.length).toBeLessThanOrEqual(10);

    // Act
    show();

    // Assert
    expect(await cardTitles()).toHaveLength(jobs.length);
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).toBeNull();
  });
});
