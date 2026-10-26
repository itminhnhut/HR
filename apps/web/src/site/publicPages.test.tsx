import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { mockApi } from '../api/mock';
import CandidateAccountPage from '../pages/candidate/CandidateAccountPage';
import HrLoginPage from '../pages/hr/HrLoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ShareButtons } from './news/ShareButtons';

function show(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: ['/khong-co'] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.head.innerHTML = '';
});

describe('not-found page', () => {
  it('should say what happened in the page title and offer a way back', () => {
    // Act
    show(<NotFoundPage />);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang này' })).toBeTruthy();
    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumbs).getByRole('link', { name: 'Trang chủ' }).getAttribute('href')).toBe('/');
    const main = screen.getByRole('main');
    expect(
      within(main)
        .getByRole('link', { name: /Tin tức/ })
        .getAttribute('href'),
    ).toBe('/tin-tuc');
  });
});

describe('one main landmark per page', () => {
  it('should have exactly one main on "Hồ sơ của tôi" when signed out', async () => {
    // Arrange
    await mockApi.candidateLogout();

    // Act
    show(<CandidateAccountPage />);

    // Assert
    await screen.findByRole('heading', { name: 'Đăng nhập' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('should have exactly one main on the HR sign-in page', async () => {
    // Act
    show(<HrLoginPage />);

    // Assert
    await screen.findByRole('heading', { name: 'Quản trị tuyển dụng' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

describe('share buttons', () => {
  it('should offer copy and Facebook only when the browser has no share sheet', () => {
    // Arrange
    vi.stubGlobal('navigator', { ...navigator, share: undefined });

    // Act
    show(<ShareButtons url="https://example.com/tin-tuc/a" title="A" />);

    // Assert
    expect(screen.getByRole('button', { name: 'Chép link' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chia sẻ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zalo' })).toBeNull();
    expect(screen.getByRole('link', { name: /Facebook/ })).toBeTruthy();
  });

  it('should label the share sheet "Chia sẻ" on devices that have one', () => {
    // Arrange
    vi.stubGlobal('navigator', { ...navigator, share: () => Promise.resolve() });

    // Act
    show(<ShareButtons url="https://example.com/tin-tuc/a" title="A" />);

    // Assert
    expect(screen.getByRole('button', { name: 'Chia sẻ' })).toBeTruthy();
  });
});
