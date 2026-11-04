import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from '../../../api/mock';
import { DEMO_HR } from '../../../api/mock-seed';
import { HrApplicantsPage } from '../HrApplicantsPage';

// Demo mode (no BE address): the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});
afterEach(cleanup);

async function pressDelete() {
  const [app] = (await mockApi.hrApplications()).applications;
  if (!app) throw new Error('no demo application');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/hr/ho-so', element: <HrApplicantsPage /> }], {
    initialEntries: [`/hr/ho-so?id=${app.id}`],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole('button', { name: 'Xoá hồ sơ' }));
  return { app, dialog: screen.getByRole('alertdialog', { name: `Xoá hồ sơ ${app.fullName}?` }) };
}

const stillThere = async (id: string) => (await mockApi.hrApplications()).applications.some((a) => a.id === id);

describe('Deleting an application', () => {
  it('should keep it on "Huỷ"', async () => {
    // Arrange
    const { app, dialog } = await pressDelete();

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }));

    // Assert
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await stillThere(app.id)).toBe(true);
  });

  it('should delete it once HR agrees', async () => {
    // Arrange
    const { app, dialog } = await pressDelete();

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xoá hồ sơ' }));

    // Assert
    await waitFor(async () => expect(await stillThere(app.id)).toBe(false));
  });
});
