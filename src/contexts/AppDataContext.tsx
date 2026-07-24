import { createContext, useContext, type ReactNode } from 'react';
import { useSupabaseAppData } from '@/hooks/useSupabaseAppData';

const AppDataContext = createContext<ReturnType<typeof useSupabaseAppData> | null>(null);

/**
 * Organization-scoped application data provider.
 *
 * The active organization comes from OrganizationContext and every database
 * read/write is still protected by Supabase Row Level Security.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const data = useSupabaseAppData();
  return <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>;
}

export function useAppDataContext() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppDataContext must be used within AppDataProvider');
  }
  return context;
}
