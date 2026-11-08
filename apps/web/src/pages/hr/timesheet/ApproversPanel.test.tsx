import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { ApproversPanel } from './ApproverField';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the approvers HR keeps (TC-DK-57)', () => {
  it('should offer no way to remove HR, and mark it as the default', async () => {
    // Arrange
    vi.spyOn(api, 'hrApprovers').mockResolvedValue([{ id: 'a1', name: 'Chị Lan' }, { id: 'a2', name: 'HR' }]);

    // Act
    render(<QueryClientProvider client={new QueryClient()}><ApproversPanel /></QueryClientProvider>);

    // Assert
    expect(await screen.findByRole('button', { name: 'Xoá Chị Lan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xoá HR' })).toBeNull();
    expect(screen.getByText('Mặc định')).toBeTruthy();
  });
});
