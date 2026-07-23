import { createContext, useContext, type ReactNode } from 'react';
import { useAppData, type useAppData as UseAppDataType } from '../hooks/useAppData';

const AppDataContext = createContext<ReturnType<typeof UseAppDataType> | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const data = useAppData();
  return (
    <AppDataContext.Provider value={data}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppDataContext() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppDataContext must be used within AppDataProvider');
  }
  return context;
}
