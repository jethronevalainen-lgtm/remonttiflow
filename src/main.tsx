import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ViewAsProvider } from '@/contexts/ViewAsContext';
import { AppProviders } from './providers/AppProviders';
import AuthCallback from '@/pages/AuthCallback';
import './index.css';
import './mobile-header-panels.css';

const isAuthCallback = window.location.pathname === '/auth/callback';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      return syncRegistration.sync?.register('vakantti-sync');
    }).catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {isAuthCallback ? (
          <AuthCallback />
        ) : (
          <OrganizationProvider>
            <ViewAsProvider>
              <AppProviders>
                <HashRouter>
                  <App />
                </HashRouter>
              </AppProviders>
            </ViewAsProvider>
          </OrganizationProvider>
        )}
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
