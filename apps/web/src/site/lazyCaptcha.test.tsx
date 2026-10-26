import type { JobDetailDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Demo data, and a Turnstile key so the anti-spam check is switched on.
vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', '');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
});
import LookupPage from '../pages/LookupPage';
import { ApplyDialog } from './ApplyDialog';

const job: JobDetailDto = {
  id: 'j1',
  slug: 'nhan-vien-kinh-doanh-b2b',
  title: 'Nhân viên Kinh doanh B2B',
  department: 'Kinh doanh',
  employmentType: 'full_time',
  place: 'Gò Vấp, TP. HCM',
  deadline: '2099-12-31',
  status: 'open',
  publishedAt: null,
  perks: '',
  salaryMin: 12_000_000,
  salaryMax: 18_000_000,
  address: null,
  workingHours: null,
  experience: null,
  education: null,
  responsibilities: [],
  requirements: [],
  preferred: [],
  benefits: [],
  roadmap: [],
};

/** Stands in for Cloudflare's script: "loads" at once; each widget drawn is one render call. */
const turnstile = { render: vi.fn(() => 'widget'), reset: vi.fn(), remove: vi.fn() };
const turnstileStarted = () => turnstile.render.mock.calls.length > 0;

function show(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/', element }]);
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T): T => {
    if (node instanceof HTMLScriptElement && node.src.includes('challenges.cloudflare.com')) {
      window.turnstile = turnstile;
      queueMicrotask(() => node.onload?.(new Event('load')));
    }
    return append(node);
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  turnstile.render.mockClear();
});

describe('anti-spam check (Cloudflare Turnstile) loads only when needed', () => {
  it('should not load on the job page while the apply form is closed', async () => {
    // Act
    show(<ApplyDialog job={job} open={false} onClose={() => undefined} />);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Assert
    expect(turnstileStarted()).toBe(false);
  });

  it('should load once the apply form is opened', async () => {
    // Act
    show(<ApplyDialog job={job} open onClose={() => undefined} />);

    // Assert
    await screen.findByRole('button', { name: /Gửi hồ sơ/ });
    await vi.waitFor(() => expect(turnstileStarted()).toBe(true));
  });

  it('should wait on the lookup page until the phone field is first focused', async () => {
    // Arrange
    show(<LookupPage />);
    const phone = await screen.findByLabelText('Số điện thoại');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(turnstileStarted()).toBe(false);

    // Act
    await userEvent.click(phone);

    // Assert
    await vi.waitFor(() => expect(turnstileStarted()).toBe(true));
  });
});
