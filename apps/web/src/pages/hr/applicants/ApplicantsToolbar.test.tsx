import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../api';
import { ApplicantsToolbar } from './ApplicantsToolbar';

function Address() {
  return <output aria-label="địa chỉ">{useLocation().pathname}</output>;
}

const noop = () => undefined;

function open() {
  vi.spyOn(api, 'hrSources').mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const filters = {
    search: '',
    onSearch: noop,
    onSearchCommit: noop,
    jobId: undefined,
    jobs: [],
    onJob: noop,
    source: undefined,
    onSource: noop,
    byMatch: false,
    onByMatch: noop,
  };
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/hr/ho-so']}>
        <ApplicantsToolbar filters={filters} actions={{ onAdd: noop, onManageSources: noop }} />
        <Address />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('The applicants toolbar', () => {
  it('should open Nhật ký tuyển dụng from the Thêm menu', async () => {
    // Arrange
    open();

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nhật ký tuyển dụng' }));

    // Assert
    expect(screen.getByLabelText('địa chỉ').textContent).toBe('/hr/ho-so/nhat-ky');
  });
});
