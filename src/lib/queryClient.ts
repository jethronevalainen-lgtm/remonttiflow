/**
 * Shared TanStack Query client for VaKantti.
 *
 * Defaults chosen for a field-work app where data changes through this
 * same client: short stale time, one retry, and no refetch on window
 * focus (users often alt-tab between tools on site).
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
