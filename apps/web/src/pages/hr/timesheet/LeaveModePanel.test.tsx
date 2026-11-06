import type { TimesheetDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { LeaveModePanel } from './LeaveModePanel';

const period = (over: Partial<TimesheetDto>) => ({ periodId: 'p11', status: 'open', rule: { threshold: 14, perPeriod: 1, mode: 'law' }, ...over }) as TimesheetDto;

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><LeaveModePanel /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the leave counting choice', () => {
  it('should show which way the open period counts leave', async () => {
    // Arrange
    vi.spyOn(api, 'hrTimesheet').mockResolvedValue(period({}));

    // Act
    open();

    // Assert
    expect((await screen.findByRole('radio', { name: /Theo luật/ })).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /Như Excel cũ/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('should switch the open period when HR picks the other way', async () => {
    // Arrange
    vi.spyOn(api, 'hrTimesheet').mockResolvedValue(period({}));
    const set = vi.spyOn(api, 'hrSetLeaveMode').mockResolvedValue(period({ rule: { threshold: 14, perPeriod: 1, mode: 'excel' } }));
    open();

    // Act
    await userEvent.click(await screen.findByRole('radio', { name: /Như Excel cũ/ }));

    // Assert
    await waitFor(() => expect(set).toHaveBeenCalledWith('p11', 'excel'));
  });

  it('should not let a closed period change', async () => {
    // Arrange
    vi.spyOn(api, 'hrTimesheet').mockResolvedValue(period({ status: 'closed' }));

    // Act
    open();

    // Assert
    expect((await screen.findByRole('radio', { name: /Như Excel cũ/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/T[0-9]+\/[0-9]+ đã chốt/)).toBeTruthy();
  });
});
