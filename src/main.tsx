import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { AppProviders } from './providers/AppProviders';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <OrganizationProvider>
          <AppProviders>
            <HashRouter>
              <App />
            </HashRouter>
          </AppProviders>
        </OrganizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
