import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { AppDataProvider } from './contexts/AppDataContext';

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </HashRouter>,
);
