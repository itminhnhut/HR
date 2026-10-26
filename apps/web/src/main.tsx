import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ApiError } from './api';
import { router } from './app/router';
import { startAnalytics } from './lib/analytics';
import './styles.css';

/** An expired HR session sends everyone back to the HR login screen. */
function onApiError(error: unknown, key: readonly unknown[]) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  if (key[0] === 'hr' && key[1] !== 'me') queryClient.setQueryData(['hr', 'me'], null);
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => onApiError(error, query.queryKey) }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Do not hammer the BE on 4xx; one retry for network blips.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
});

// Page views and screen recording follow the router (HR and account pages are never sent nor recorded).
startAnalytics(router, window.location.origin, document.referrer);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
