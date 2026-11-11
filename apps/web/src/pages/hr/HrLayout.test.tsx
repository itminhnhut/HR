import type { HrMe } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spyOnApi } from '../../test/apiSpy';
import { HrLayout } from './HrLayout';

/** The admin menu shows Lương only to HR with the payroll right (spec 2 (1)). Case: docs/test-cases-luong.md, L-H01. */

const ME: HrMe = { id: 'u1', email: 'hr@congty.vn', name: 'Lan', phone: null, contactEmail: null, jobTitle: null, alias: null };

function open(me: HrMe) {
  spyOnApi('hrMe').mockResolvedValue(me);
  spyOnApi('hrJobs').mockResolvedValue({ jobs: [], newApplications: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/hr', element: <HrLayout />, children: [{ index: true, element: <p>Trang tổng quan</p> }] }],
    { initialEntries: ['/hr'] },
  );
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the Lương menu entry', () => {
  it('L-H01: should not show Lương to an HR account without the payroll right', async () => {
    // Act
    open({ ...ME, canPayroll: false });

    // Assert
    expect(await screen.findByText('Trang tổng quan')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Chấm công/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Lương/ })).toBeNull();
  });

  it('L-H01: should not show Lương when the server says nothing about the right', async () => {
    // Act
    open(ME);

    // Assert
    expect(await screen.findByText('Trang tổng quan')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Lương/ })).toBeNull();
  });

  it('L-H01: should show Lương to an HR account with the payroll right', async () => {
    // Act
    open({ ...ME, canPayroll: true });

    // Assert
    expect(await screen.findByText('Trang tổng quan')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Lương/ })[0]?.getAttribute('href')).toBe('/hr/luong');
  });
});
