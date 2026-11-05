import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { useSaveCells } from './queries';

const choice = { kind: 'month', year: 2026, month: 11 } as const;
const first = { employeeId: 'a', day: '2026-11-03', code: 'P' as const };
const second = { employeeId: 'b', day: '2026-11-04', code: 'KL' as const };

function setUp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useSaveCells(choice), { wrapper });
}

afterEach(() => vi.restoreAllMocks());

describe('saving cells after a save failed', () => {
  it('should send what failed along with the next key pressed, so nothing is dropped', async () => {
    // Arrange
    const send = vi.spyOn(api, 'hrTimesheetCells').mockRejectedValueOnce(new Error('mạng')).mockResolvedValue({} as never);
    const { result } = setUp();
    act(() => result.current.save('p', [first]));
    await waitFor(() => expect(result.current.state).toBe('failed'));

    // Act
    act(() => result.current.save('p', [second]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    // Assert
    expect(send.mock.calls[1]?.[1]).toEqual([first, second]);
  });

  it('should let the newer value of a cell win over the one that failed', async () => {
    // Arrange
    const send = vi.spyOn(api, 'hrTimesheetCells').mockRejectedValueOnce(new Error('mạng')).mockResolvedValue({} as never);
    const { result } = setUp();
    act(() => result.current.save('p', [first]));
    await waitFor(() => expect(result.current.state).toBe('failed'));

    // Act
    act(() => result.current.save('p', [{ ...first, code: 'M' as const }]));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    // Assert
    expect(send.mock.calls[1]?.[1]).toEqual([{ ...first, code: 'M' }]);
  });

  it('should still retry on its own when asked', async () => {
    // Arrange
    const send = vi.spyOn(api, 'hrTimesheetCells').mockRejectedValueOnce(new Error('mạng')).mockResolvedValue({} as never);
    const { result } = setUp();
    act(() => result.current.save('p', [first]));
    await waitFor(() => expect(result.current.state).toBe('failed'));

    // Act
    act(() => { result.current.retry(); });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));

    // Assert
    expect(send.mock.calls[1]?.[1]).toEqual([first]);
  });
});
