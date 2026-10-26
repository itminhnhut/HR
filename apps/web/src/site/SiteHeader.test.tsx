import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockDb } from '../api/mock';

// Demo mode (no BE address), like the demo site: the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { SiteHeader } from './SiteHeader';

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element: <SiteHeader /> }]);
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const mainNav = () => screen.getByRole('navigation', { name: 'Điều hướng chính' });

beforeAll(() => {
  // jsdom has no <dialog> methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => resetMockDb(new Date()));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('site header account link', () => {
  it('should offer "Đăng nhập" to the candidate page when signed out', async () => {
    // Arrange
    await mockApi.candidateLogout();

    // Act
    show();

    // Assert
    const link = await within(mainNav()).findByRole('link', { name: 'Đăng nhập' });
    expect(link.getAttribute('href')).toBe('/ho-so-cua-toi');
    expect(within(mainNav()).queryByRole('link', { name: 'Hồ sơ của tôi' })).toBeNull();
    expect(within(mainNav()).getByRole('link', { name: 'Dành cho HR' }).getAttribute('href')).toBe('/hr');
  });

  it('should show "Hồ sơ của tôi" instead of "Đăng nhập" when signed in', async () => {
    // Arrange
    await mockApi.googleSignIn();

    // Act
    show();

    // Assert
    const link = await within(mainNav()).findByRole('link', { name: 'Hồ sơ của tôi' });
    expect(link.getAttribute('href')).toBe('/ho-so-cua-toi');
    expect(within(mainNav()).queryByRole('link', { name: 'Đăng nhập' })).toBeNull();
  });

  it('should show no account link while the sign-in check is still running', () => {
    // Arrange
    vi.spyOn(mockApi, 'candidateOverview').mockReturnValue(new Promise(() => undefined));

    // Act
    show();

    // Assert
    expect(within(mainNav()).getByRole('link', { name: 'Việc làm' })).toBeTruthy();
    expect(within(mainNav()).queryByRole('link', { name: 'Đăng nhập' })).toBeNull();
    expect(within(mainNav()).queryByRole('link', { name: 'Hồ sơ của tôi' })).toBeNull();
  });

  it('should offer "Đăng nhập" in the phone menu too', async () => {
    // Arrange
    await mockApi.candidateLogout();
    show();
    await within(mainNav()).findByRole('link', { name: 'Đăng nhập' });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));

    // Assert
    const menu = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/ho-so-cua-toi');
    expect(within(menu).getByRole('link', { name: 'Dành cho HR' })).toBeTruthy();
  });

  it('should close the phone menu with Escape and put focus back on "Mở menu"', async () => {
    // Arrange
    show();
    const opener = screen.getByRole('button', { name: 'Mở menu' });
    await userEvent.click(opener);
    const menu = screen.getByRole('dialog', { name: 'Menu' });

    // Act: Escape on a native <dialog> fires "cancel".
    fireEvent(menu, new Event('cancel', { cancelable: true }));

    // Assert
    expect(menu.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
