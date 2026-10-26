import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockDb } from '../../../../api/mock';
import type { CtaPayload } from './CtaNode';

vi.hoisted(() => vi.stubEnv('VITE_API_URL', ''));
import { CtaForm } from './CtaDialog';

function show(initial: CtaPayload | null = null) {
  const onSubmit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CtaForm initial={initial} onSubmit={onSubmit} onClose={() => undefined} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

beforeEach(() => resetMockDb(new Date()));
afterEach(cleanup);

describe('call-to-action button form', () => {
  it('should point a new button at all open jobs, labelled "Xem vị trí đang tuyển"', async () => {
    // Arrange
    const onSubmit = show();
    await screen.findByRole('option', { name: 'Tất cả vị trí đang tuyển' });

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Chèn nút' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Xem vị trí đang tuyển', url: '/' });
  });

  it('should label the button after the job once one is picked', async () => {
    // Arrange
    const [job] = (await mockApi.listJobs()).jobs;
    if (!job) throw new Error('no demo job');
    const onSubmit = show();
    await screen.findByRole('option', { name: job.title });

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vị trí' }), job.slug);
    await userEvent.click(screen.getByRole('button', { name: 'Chèn nút' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ text: `Ứng tuyển: ${job.title}`, url: `/viec-lam/${job.slug}` });
  });

  it('should keep words HR typed when a job is picked afterwards', async () => {
    // Arrange
    const [job] = (await mockApi.listJobs()).jobs;
    if (!job) throw new Error('no demo job');
    const onSubmit = show();
    await screen.findByRole('option', { name: job.title });
    const text = screen.getByLabelText('Chữ trên nút');
    await userEvent.clear(text);
    await userEvent.type(text, 'Nộp CV ngay');

    // Act
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Vị trí' }), job.slug);
    await userEvent.click(screen.getByRole('button', { name: 'Chèn nút' }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Nộp CV ngay', url: `/viec-lam/${job.slug}` });
  });

  it('should open an existing "all jobs" button with all jobs selected', async () => {
    // Act
    show({ text: 'Xem vị trí đang tuyển', url: '/' });

    // Assert
    await screen.findByRole('option', { name: 'Tất cả vị trí đang tuyển' });
    expect((screen.getByRole('combobox', { name: 'Vị trí' }) as HTMLSelectElement).value).toBe('');
    expect((screen.getByRole('radio', { name: 'Vị trí đang tuyển' }) as HTMLInputElement).checked).toBe(true);
  });
});
