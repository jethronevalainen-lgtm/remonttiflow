/**
 * Top-level provider composition.
 *
 * A later agent wires this into main.tsx around <App />. Additional
 * providers (e.g. OrganizationContext, AuthContext) should be added
 * here as they land.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '../lib/queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
