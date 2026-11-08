import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveApi } from './leaveApi';
import { LeaveBalanceHint } from './LeaveBalanceHint';

function show(props: { personId: string; from: string; to: string; code: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><LeaveBalanceHint {...props} /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the leave balance in the leave form', () => {
  it('should say what is left today and after this absence, as the server counts it', async () => {
    // Arrange
    const balance = vi.spyOn(leaveApi, 'balance').mockResolvedValue({ now: 3, after: 1.5, overdrawn: 0 });

    // Act
    show({ personId: 'e1', from: '2026-11-09', to: '2026-11-10', code: 'P' });

    // Assert
    expect(await screen.findByText('Phép còn: 3 ngày (tính đến hôm nay)')).toBeTruthy();
    expect(screen.getByText('sau đơn này còn 1,5')).toBeTruthy();
    expect(screen.queryByText(/phần vượt không lương/)).toBeNull();
    expect(balance).toHaveBeenCalledWith('e1', { from: '2026-11-09', to: '2026-11-10', code: 'P' });
  });

  it('should warn, without blocking, that days beyond the balance are unpaid', async () => {
    // Arrange
    vi.spyOn(leaveApi, 'balance').mockResolvedValue({ now: 1, after: -2, overdrawn: 2 });

    // Act
    show({ personId: 'e1', from: '2026-11-09', to: '2026-11-11', code: 'P' });

    // Assert
    expect(await screen.findByText('Vượt 2 ngày, phần vượt không lương')).toBeTruthy();
    expect(screen.getByText('sau đơn này còn -2')).toBeTruthy();
  });

  it('should ask nothing until a person and a day are chosen', () => {
    // Arrange
    const balance = vi.spyOn(leaveApi, 'balance');

    // Act
    show({ personId: '', from: '2026-11-09', to: '2026-11-09', code: 'P' });

    // Assert
    expect(balance).not.toHaveBeenCalled();
    expect(screen.queryByText(/Phép còn/)).toBeNull();
  });
});
