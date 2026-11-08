import type { AbsenceKindDto } from '@careers/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { KindsPanel } from './AbsenceKinds';

const kinds: AbsenceKindDto[] = [
  { key: 'sick', name: 'Ốm có giấy BHXH', code: 'OM', days: null, isOwn: false, needsPaper: true },
  { key: 'annual', name: 'Nghỉ phép năm', code: 'P', days: null, isOwn: false, needsPaper: false },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('which reasons ask for papers', () => {
  it('TC-GT-14: should show each reason\'s switch and turn it off when HR clicks it', async () => {
    // Arrange
    const set = vi.spyOn(api, 'hrSetNeedsPaper').mockResolvedValue(kinds.map((k) => ({ ...k, needsPaper: false })));
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><KindsPanel kinds={kinds} /></QueryClientProvider>);
    const sick = screen.getByRole('switch', { name: 'Cần giấy tờ: Ốm có giấy BHXH' });

    // Act
    await userEvent.click(sick);

    // Assert
    expect(sick.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Cần giấy tờ: Nghỉ phép năm' }).getAttribute('aria-checked')).toBe('false');
    await waitFor(() => expect(set).toHaveBeenCalledWith('sick', false));
  });
});
