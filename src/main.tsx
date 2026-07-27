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
