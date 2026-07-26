import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ViewAsProvider } from '@/contexts/ViewAsContext';
import { AppProviders } from './providers/AppProviders';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <OrganizationProvider>
          <ViewAsProvider>
            <AppProviders>
              <HashRouter>
                <App />
              </HashRouter>
            </AppProviders>
          </ViewAsProvider>
        </OrganizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
