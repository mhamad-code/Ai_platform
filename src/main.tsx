import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './i18n';
import { AuthProvider } from './lib/auth';
import { applySettings, useSettings } from './store/settings';
import './index.css';

// Apply stored preferences before the first frame to avoid a theme flash.
applySettings(useSettings.getState());
useSettings.subscribe((s) => applySettings(s));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
