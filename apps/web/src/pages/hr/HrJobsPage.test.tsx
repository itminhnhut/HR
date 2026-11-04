import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoHrPassword, mockApi, resetMockDb } from '../../api/mock';
import { DEMO_HR } from '../../api/mock-seed';
import { HrJobsPage } from './HrJobsPage';

// Demo mode (no BE address): the API answers from the in-browser data.
vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));

beforeEach(async () => {
  resetMockDb(new Date());
  await mockApi.hrSignIn(DEMO_HR.email, demoHrPassword());
});
afterEach(cleanup);

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/hr/tin', element: <HrJobsPage /> }], { initialEntries: ['/hr/tin'] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const statusOf = async (id: string) => (await mockApi.hrJobs()).jobs.find((j) => j.id === id)?.status;

async function pressClose() {
  const { jobs } = await mockApi.hrJobs();
  const job = jobs.find((j) => j.status === 'open');
  if (!job) throw new Error('no live demo job');
  open();
  const [menu] = await screen.findAllByRole('button', { name: `Thao tác khác cho ${job.title}` });
  if (!menu) throw new Error('no menu');
  await userEvent.click(menu);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Đóng tin' }));
  return job;
}

describe('Closing a job', () => {
  it('should ask first and leave the job open on "Huỷ"', async () => {
    // Arrange
    const job = await pressClose();
    const dialog = screen.getByRole('alertdialog', { name: `Đóng tin "${job.title}"?` });

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: 'Huỷ' }));

    // Assert
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await statusOf(job.id)).toBe(job.status);
  });

  it('should close the job once HR agrees', async () => {
    // Arrange
    const job = await pressClose();

    // Act
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Đóng tin' }));

    // Assert
    await waitFor(async () => expect(await statusOf(job.id)).toBe('closed'));
  });
});

describe('The actions of a row', () => {
  it('should name every icon for screen readers and keep them in a word on hover', async () => {
    // Arrange
    open();
    const [edit] = await screen.findAllByRole('link', { name: /^Sửa tin / });
    if (!edit) throw new Error('no job');

    // Act
    await userEvent.hover(edit);

    // Assert
    expect((await screen.findByRole('tooltip')).textContent).toContain('Sửa tin');
  });
});
