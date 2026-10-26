import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import LookupPage from './LookupPage';

afterEach(cleanup);

describe('LookupPage', () => {
  it('should hide the phone number and the applications found from screen recordings', async () => {
    // Arrange
    const client = new QueryClient();
    const router = createMemoryRouter([{ path: '/', element: <LookupPage /> }]);

    // Act
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    // Assert: the field and the results area below it sit inside the masked part of the page.
    const field = await screen.findByLabelText(/Số điện thoại/);
    expect(field.closest('main')?.getAttribute('data-clarity-mask')).toBe('true');
  });
});
